const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9445;
const PROFILE = process.env.TEMP + '\\ssa-uinotes-' + Date.now();
const BASE = 'http://localhost:5173';

const sleep = ms => new Promise(r => setTimeout(r, ms));
function httpReq(method, p) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: p, method }, r => {
      let d = '';
      r.on('data', c => (d += c));
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    });
    req.on('error', rej);
    req.end();
  });
}

async function main() {
  const chrome = spawn(CHROME, ['--headless', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--window-size=1440,900'], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = await httpReq('PUT', '/json/new?' + encodeURIComponent(BASE + '/')); } catch (e) { await sleep(250); }
  }
  if (!target || !target.webSocketDebuggerUrl) { console.log('FAIL no devtools'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let mid = 0;
  const pending = new Map();
  const errs = [];
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data.toString());
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errs.push(String((d.exception && d.exception.description) || d.text).split('\n')[0]);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++mid; pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result && r.result.value;
  };
  const waitLoad = async () => {
    for (let i = 0; i < 200; i++) { if (await evalJs('document.readyState') === 'complete') return; await sleep(150); }
  };
  const goto = async (url, wait = 2000) => { await send('Page.navigate', { url }); await waitLoad(); await sleep(wait); };
  const waitFor = async (expr, ms = 15000) => {
    for (let i = 0; i < ms / 300; i++) {
      try { if (await evalJs(`!!(${expr})`)) return true; } catch (e) {}
      await sleep(300);
    }
    return false;
  };
  const results = [];
  const check = (ok, label) => { results.push({ ok, label }); console.log((ok ? 'PASS ' : 'FAIL ') + label); };

  await send('Page.enable');
  await send('Runtime.enable');

  // â”€â”€ 1. Director adds a follow-up note â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await goto(BASE + '/seed-test.html?user=dir_t#/director/follow');
  check(await waitFor("location.hash.includes('/director/follow') && document.querySelector('.card select')"), 'director follow tab loaded');

  const noteText = 'e2e-note-' + Math.random().toString(36).slice(2, 8);
  await evalJs(`(() => {
    const sel = document.querySelector('.card select');
    const opt = sel.querySelector('option[value^="stu_"]');
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  check(await waitFor("!!document.querySelector('.card textarea')"), 'student selected, note form visible');

  await evalJs(`(() => {
    const ta = document.querySelector('.card textarea');
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, ${JSON.stringify(noteText)});
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Save note')).click()`);
  check(await waitFor(`document.body.innerText.includes(${JSON.stringify(noteText)})`), 'note shows in director History');

  // â”€â”€ 2. Note lives in shared db, legacy key absent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const storeCheck = await evalJs(`(() => {
    const db = JSON.parse(localStorage.getItem('ssa_db_v1'));
    const legacy = Object.keys(localStorage).filter(k => k.startsWith('ssa_notes_'));
    const hasNote = JSON.stringify(db.notes || []).includes(${JSON.stringify(noteText)});
    const stu = db.users.find(u => u.role === 'student');
    stu.directorId = 'dir_t'; stu.directorName = 'Dir';
    localStorage.setItem('ssa_db_v1', JSON.stringify(db));
    localStorage.setItem('ssa_session_v1', 'adm_t');
    return JSON.stringify({ hasNote, legacyKeys: legacy.length, isArray: Array.isArray(db.notes), count: (db.notes || []).filter(n => n.studentId === 'stu_test').length });
  })()`);
  const sc = JSON.parse(storeCheck);
  check(sc.hasNote, 'note persisted in ssa_db_v1 db.notes (shared store)');
  check(sc.legacyKeys === 0, 'no ssa_notes_* browser-local keys');
  check(sc.isArray && sc.count === 1, 'db.notes[] flat array with studentId');

  // â”€â”€ 3. Admin opens View Notes from another session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await goto(BASE + '/?user=adm_t#/admin/directors');
  const dbg = await evalJs('JSON.stringify({href: location.href, sess: localStorage.getItem("ssa_session_v1"), rows: document.querySelectorAll(".data tbody tr").length, btns: [...document.querySelectorAll("button")].map(b => b.textContent.trim()).slice(0, 30), body: document.body.innerText.slice(0, 700)})');
  console.log('DBG ' + dbg);
  check(await waitFor("[...document.querySelectorAll('button')].some(b => b.textContent.includes('View notes'))", 8000), 'admin directors page with View Notes buttons');
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('View notes')).click()`);
  check(await waitFor(`document.body.innerText.includes(${JSON.stringify(noteText)})`), 'admin View Notes modal shows the director note');
  check(await waitFor(`document.body.innerText.includes('Dir')`), 'note author visible to admin');

  console.log('js errors: ' + errs.length + (errs.length ? ' :: ' + errs.join(' | ') : ''));
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `FAILED ${failed}/${results.length}` : `ALL ${results.length} E2E CHECKS PASSED`);
  chrome.kill();
  process.exit(failed || errs.length ? 1 : 0);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });

