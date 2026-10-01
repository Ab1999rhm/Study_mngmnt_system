const { spawn } = require('child_process');
const http = require('http');
const BASE = 'http://localhost:5173';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9441;
const PROFILE = process.env.TEMP + '\\ssa-uibadge-' + Date.now();
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
  const goto = async (url, wait = 2200) => { await send('Page.navigate', { url }); await waitLoad(); await sleep(wait); };
  const waitFor = async (expr, ms = 15000) => {
    for (let i = 0; i < ms / 300; i++) {
      try { if (await evalJs(`!!(${expr})`)) return true; } catch (e) {}
      await sleep(300);
    }
    return false;
  };
  const click = async expr => evalJs(`(() => { const el = (${expr}); if (!el) return false; el.click(); return true; })()`);
  const results = [];
  const check = (ok, label) => { results.push({ ok, label }); console.log((ok ? 'PASS ' : 'FAIL ') + label); };

  await send('Page.enable');
  await send('Runtime.enable');

  // ── A. Student waiting screen advances live when admin approves ──
  await goto(BASE + '/seed-test.html?user=none#/auth?mode=forgot');
  check(await waitFor("location.hash.includes('mode=forgot')"), 'forgot-password page loaded');
  check(await waitFor("!!document.querySelector('.auth-card form input[type=\"email\"]')"), 'forgot email field visible');
  const filled = await evalJs(`(() => { const el = document.querySelector('.auth-card form input[type="email"]'); if (!el) return false; Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, 't@t.t'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  check(filled === true, 'email filled');
  await click("[...document.querySelectorAll('.auth-card form button')].find(b => b.textContent.includes('Send reset request'))");
  check(await waitFor("document.body.innerText.includes('Request sent to the school admin')"), 'student sees waiting-for-admin note');
  check(await waitFor("document.querySelectorAll('.auth-card form input[type=\"password\"]').length === 0"), 'password form hidden while pending');

  // simulate admin approval arriving from another device/tab (storage event -> ssa:db)
  const adopted = await evalJs(`(() => {
    const db = JSON.parse(localStorage.getItem('ssa_db_v1'));
    const r = (db.resetRequests || []).find(x => x.status === 'pending');
    if (!r) return JSON.stringify({ ok: false, reason: 'no request created' });
    r.status = 'approved';
    localStorage.setItem('ssa_db_v1', JSON.stringify(db));
    window.dispatchEvent(new StorageEvent('storage', { key: 'ssa_db_v1', newValue: JSON.stringify(db) }));
    return JSON.stringify({ ok: true, id: r.id });
  })()`);
  check(JSON.parse(adopted).ok, 'pending reset request exists, approval event dispatched: ' + adopted);
  check(await waitFor("document.body.innerText.includes('Reset approved')"), 'student auto-advanced to set-password stage');
  check(await waitFor("document.querySelectorAll('.auth-card form input[type=\"password\"]').length >= 2"), 'new + confirm password fields visible (no re-submit needed)');

  // ── B. Admin sidebar badge for pending resets ──
  await evalJs(`localStorage.setItem('ssa_session_v1', 'adm_t')`);
  await goto(BASE + '/?user=adm_t#/admin/payments');
  check(await waitFor("location.hash.includes('/admin/payments') && document.querySelectorAll('.sidebar a').length > 0"), 'admin sidebar rendered');
  check(await waitFor("!document.querySelector('.nav-badge')"), 'no badge when 0 pending resets');

  const injected = await evalJs(`(() => {
    const db = JSON.parse(localStorage.getItem('ssa_db_v1'));
    db.resetRequests = db.resetRequests || [];
    db.resetRequests.push({ id: 'rr_badge1', studentId: 'stu_2', email: 't2@t.t', status: 'pending', at: new Date().toISOString() });
    localStorage.setItem('ssa_db_v1', JSON.stringify(db));
    return 'ok';
  })()`);
  check(injected === 'ok', 'pending reset request injected');

  await goto(BASE + '/?user=adm_t&t=' + Date.now() + '#/admin/payments');
  check(await waitFor("!!document.querySelector('.nav-badge')"), 'badge appears with pending reset');
  const badgeText = await evalJs("document.querySelector('.nav-badge')?.textContent.trim()");
  check(badgeText === '1', 'badge shows count 1 (got ' + badgeText + ')');
  const badgeOnPayments = await evalJs("!!document.querySelector('.nav-badge')?.closest('a')?.textContent.includes('Payments')");
  check(badgeOnPayments, 'badge attached to Payments nav item');

  await click("[...document.querySelectorAll('.data tbody button')].find(b => b.textContent.includes('Allow reset'))");
  check(await waitFor("!document.querySelector('.nav-badge')", 8000), 'badge clears after admin approves');
  check(await waitFor("document.body.innerText.includes('Reset allowed')", 8000), 'approval flash shown');

  console.log('js errors: ' + errs.length + (errs.length ? ' :: ' + errs.join(' | ') : ''));
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `FAILED ${failed}/${results.length}` : `ALL ${results.length} RESET-NOTIFY CHECKS PASSED`);
  chrome.kill();
  process.exit(failed || errs.length ? 1 : 0);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
