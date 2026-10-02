// Live check of the new upload-form validation (submitUpload guards).
// Runs against dev server 5173 with seed-test.html?user=adm_t (sync disabled -> no db writes).
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9455;
const PROFILE = process.env.TEMP + '\\ssa-upvalid-' + Date.now();
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

let pass = 0, fail = 0;
const check = (ok, label, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : ' :: ' + extra)); ok ? pass++ : fail++; };

async function main() {
  const chrome = spawn(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
    '--window-size=1440,900'
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = await httpReq('PUT', '/json/new?' + encodeURIComponent(BASE + '/')); } catch (e) { await sleep(250); }
  }
  if (!target || !target.webSocketDebuggerUrl) { console.log('FAIL no devtools'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let mid = 0;
  const pending = new Map();
  const jsErrors = [];
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data.toString());
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      jsErrors.push('EXC: ' + String((d.exception && d.exception.description) || d.text).split('\n')[0]);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      jsErrors.push('CON: ' + m.params.args.map(a => a.value || (a.description || '').split('\n')[0]).join(' ').slice(0, 300));
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++mid;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.value;
  };
  const waitLoad = async () => {
    for (let i = 0; i < 40; i++) {
      const st = await evalJs('document.readyState');
      if (st === 'complete' || st === 'interactive') return;
      await sleep(250);
    }
  };
  const goto = async (url, wait = 2000) => { await send('Page.navigate', { url }); await waitLoad(); await sleep(wait); };

  await send('Runtime.enable');
  await send('Page.enable');

  await goto(BASE + '/seed-test.html?user=adm_t#/admin/uploads', 2600);

  const formInfo = await evalJs(`(() => {
    const ta = document.querySelector('textarea[placeholder^="Write or paste"]');
    const form = ta && ta.closest('form');
    return { hasForm: !!form };
  })()`);
  check(formInfo && formInfo.hasForm, 'upload form found on #/admin/uploads', JSON.stringify(formInfo));

  await evalJs(`window.__set = (sel, val) => {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return 'NOT FOUND';
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
  }`);

  // 1) title only, default type = book (study type) -> upNeedContent blocks submit
  const set1 = await evalJs(`window.__set('input[placeholder^="e.g. Grade 8 Algebra Workbook"]', 'Validation Book')`);
  console.log('DBG set1:', JSON.stringify(set1));
  const dbg = await evalJs(`(() => {
    const form = document.querySelector('textarea[placeholder^="Write or paste"]').closest('form');
    const invalid = [...form.querySelectorAll('input,textarea,select')].filter(el => el.willValidate && !el.validity.valid).map(el => (el.placeholder || el.type || el.tagName) + ' => ' + (el.validationMessage || 'invalid'));
    window.__submitted = 0;
    form.addEventListener('submit', () => { window.__submitted++; });
    return { check: form.checkValidity(), invalid, titleVal: form.querySelector('input[placeholder^="e.g. Grade 8"]').value };
  })()`);
  console.log('DBG form:', JSON.stringify(dbg));
  await evalJs(`document.querySelector('textarea[placeholder^="Write or paste"]').closest('form').requestSubmit()`);
  await sleep(600);
  const dbg2 = await evalJs(`({ submitted: window.__submitted, msg: (document.querySelector('.note-box.anim-pop') || {}).innerText || '' })`);
  console.log('DBG after submit:', JSON.stringify(dbg2));
  const msg1 = await evalJs(`(() => { const d = document.querySelector('.note-box.anim-pop'); return d ? d.innerText : ''; })()`);
  check(/Add content first: paste text, a link, or attach a file\./.test(msg1), 'empty study item -> upNeedContent message', msg1.slice(0, 120));

  const count1 = await evalJs(`(document.body.innerText.match(/Validation Book/g) || []).length`);

  // 2) add body content -> submit succeeds
  await evalJs(`window.__set('textarea[placeholder^="Write or paste"]', 'Validation body content for the test.')`);
  await evalJs(`document.querySelector('textarea[placeholder^="Write or paste"]').closest('form').requestSubmit()`);
  await sleep(700);
  const msg2 = await evalJs(`(() => { const d = document.querySelector('.note-box.anim-pop'); return d ? d.innerText : ''; })()`);
  check(/Uploaded "Validation Book"/.test(msg2), 'valid study item -> uploaded message', msg2.slice(0, 140));
  const count2 = await evalJs(`(document.body.innerText.match(/Validation Book/g) || []).length`);
  check(count2 > count1, 'new card appears after successful upload', `before=${count1} after=${count2}`);

  // 3) type = test with no questions -> upNeedQuestions blocks submit
  await evalJs(`(() => {
    const sel = document.querySelector('form select');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, 'test');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(300);
  await evalJs(`window.__set('input[placeholder^="e.g. Grade 8 Algebra Workbook"]', 'Validation Quiz')`);
  await evalJs(`window.__set('textarea[placeholder^="Write or paste"]', 'Quiz body')`);
  await evalJs(`document.querySelector('textarea[placeholder^="Write or paste"]').closest('form').requestSubmit()`);
  await sleep(600);
  const msg3 = await evalJs(`(() => { const d = document.querySelector('.note-box.anim-pop'); return d ? d.innerText : ''; })()`);
  check(/Add at least one question before saving this test or exam\./.test(msg3), 'test without questions -> upNeedQuestions message', msg3.slice(0, 120));

  check(jsErrors.length === 0, 'no js errors', jsErrors.join(' | ').slice(0, 300));

  console.log(fail ? `\nUPLOAD VALIDATION TEST FAILED (${fail})` : `\nALL ${pass} UPLOAD VALIDATION CHECKS PASSED`);
  try { ws.close(); } catch {}
  chrome.kill();
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });

