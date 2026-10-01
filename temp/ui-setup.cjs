const { spawn } = require('child_process');
const http = require('http');
const BASE = 'http://localhost:5173';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9442;
const PROFILE = process.env.TEMP + '\\ssa-uisetup-' + Date.now();
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
  const fill = (idx, val) => evalJs(`(() => { const el = document.querySelectorAll('.auth-card form input')[${idx}]; if (!el) return false; Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(val)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const results = [];
  const check = (ok, label) => { results.push({ ok, label }); console.log((ok ? 'PASS ' : 'FAIL ') + label); };

  await send('Page.enable');
  await send('Runtime.enable');

  // ── 1. Fresh install (empty db, sync off) shows the setup wizard ──
  await goto(BASE + '/?user=setup#/');
  check(await waitFor("document.body.innerText.includes('First-time setup')"), 'wizard shown on empty first boot');
  check(await waitFor("document.querySelectorAll('.auth-card form input').length === 4"), 'wizard has name/email/password/confirm fields');

  const src = await evalJs("fetch('/src/data/store.js').then(r => r.text()).then(t => JSON.stringify({ noOldEmail: !t.includes('fikaduabraham093'), noOldPw: !t.includes('1234!@Qwer'), noOldDirEmail: !t.includes('director@ssa.local'), noBakedIds: !t.includes('\\'adm_1\\'') && !t.includes('\\'dir_1\\'') }))");
  const srcObj = JSON.parse(src);
  check(srcObj.noOldEmail, 'source has no baked admin email');
  check(srcObj.noOldPw, 'source has no baked admin password');
  check(srcObj.noOldDirEmail, 'source has no baked director email');
  check(srcObj.noBakedIds, 'source has no baked adm_1/dir_1 accounts');
  const emptyUsers = await evalJs("(() => { const d = JSON.parse(localStorage.getItem('ssa_db_v1') || '{\"users\":[]}'); return (d.users || []).length; })()");
  check(emptyUsers === 0, 'no accounts auto-created on first boot (users=' + emptyUsers + ')');

  // ── 2. Mismatched confirm rejected ──
  await fill(0, 'Ops Admin');
  await fill(1, 'ops@new.school');
  await fill(2, 'NewAdmin123');
  await fill(3, 'Different123');
  await click("[...document.querySelectorAll('.auth-card form button')].find(b => b.textContent.includes('Create admin account'))");
  check(await waitFor("document.body.innerText.includes('Passwords do not match')"), 'mismatched confirm rejected');
  const stillWizard = await evalJs("document.body.innerText.includes('First-time setup')");
  check(stillWizard, 'still on wizard after validation error');

  // ── 3. Correct setup creates admin and logs straight in ──
  await fill(3, 'NewAdmin123');
  await click("[...document.querySelectorAll('.auth-card form button')].find(b => b.textContent.includes('Create admin account'))");
  check(await waitFor("document.querySelectorAll('.sidebar a').length > 0 && location.hash.includes('/admin')"), 'admin dashboard after setup');
  const created = await evalJs("(() => { const d = JSON.parse(localStorage.getItem('ssa_db_v1')); const u = (d.users || []).find(x => x.email === 'ops@new.school'); return JSON.stringify({ found: !!u, role: u && u.role, pw: u && u.password, hash: u && String(u.password).startsWith('$2') }); })()");
  const createdObj = JSON.parse(created);
  check(createdObj.found && createdObj.role === 'admin', 'new admin stored with chosen credentials');
  check(createdObj.hash === true, 'password stored as bcrypt hash, never plain');

  // ── 4. Reload: wizard does not return ──
  await goto(BASE + '/?user=setup&t=' + Date.now() + '#/');
  check(await waitFor("location.hash.includes('/admin') && document.querySelectorAll('.sidebar a').length > 0"), 'session persists after reload');
  check(!(await evalJs("document.body.innerText.includes('First-time setup')")), 'wizard gone once an account exists');

  // ── 5. Login screen: old baked creds rejected, new creds work ──
  await evalJs("localStorage.removeItem('ssa_session_v1')");
  await goto(BASE + '/?user=setup&t=' + Date.now() + '#/auth?mode=login');
  check(await waitFor("document.querySelectorAll('.auth-card form input[type=\"email\"]').length > 0"), 'login screen reachable');
  await fill(0, 'fikaduabraham093@gmail.com');
  await fill(1, '1234!@Qwer');
  await click("[...document.querySelectorAll('.auth-card form button')].find(b => b.textContent.includes('Login') || b.textContent.includes('Log in'))");
  check(await waitFor("document.body.innerText.includes('Invalid email or password')"), 'old baked-in credentials rejected');
  await fill(0, 'ops@new.school');
  await fill(1, 'NewAdmin123');
  await click("[...document.querySelectorAll('.auth-card form button')].find(b => b.textContent.includes('Login') || b.textContent.includes('Log in'))");
  check(await waitFor("location.hash.includes('/admin') && document.querySelectorAll('.sidebar a').length > 0"), 'operator-chosen credentials log in');

  console.log('js errors: ' + errs.length + (errs.length ? ' :: ' + errs.join(' | ') : ''));
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `FAILED ${failed}/${results.length}` : `ALL ${results.length} SETUP-WIZARD CHECKS PASSED`);
  chrome.kill();
  process.exit(failed || errs.length ? 1 : 0);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
