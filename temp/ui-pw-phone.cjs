const { spawn } = require('child_process');
const http = require('http');
const BASE = 'http://localhost:5173';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9443;
const PROFILE = process.env.TEMP + '\\ssa-uipwphone-' + Date.now();
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
  const fill = (sel, val) => evalJs(`(() => { const el = (${sel}); if (!el) return false; Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(val)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const results = [];
  const check = (ok, label) => { results.push({ ok, label }); console.log((ok ? 'PASS ' : 'FAIL ') + label); };

  await send('Page.enable');
  await send('Runtime.enable');

  // ── source: no hardcoded payment number anywhere ──
  const srcCheck = await evalJs(`Promise.all([
      '/src/data/store.js', '/src/pages/student/Store.jsx', '/src/pages/Landing.jsx', '/src/AdminDashboard.jsx'
    ].map(p => fetch(p).then(r => r.text()).catch(() => '')))
    .then(ts => JSON.stringify(ts.map(t => !t.includes('957 0426') && !t.includes('9570426'))))`);
  const srcArr = JSON.parse(srcCheck);
  check(srcArr.every(x => x), 'no payment number in store.js / Store.jsx / Landing.jsx / AdminDashboard.jsx: ' + srcCheck);

  // ── fresh boot: wizard; inject a LEGACY plain-text admin to prove login migrates it ──
  await goto(BASE + '/?user=cphone#/');
  check(await waitFor("document.body.innerText.includes('First-time setup')"), 'fresh boot shows setup wizard (no seeded admin)');
  await evalJs(`(() => {
    const d = JSON.parse(localStorage.getItem('ssa_db_v1') || '{"users":[]}');
    d.users = d.users || [];
    d.users.push({ id: 'adm_legacy', role: 'admin', fullName: 'Legacy Admin', email: 'legacy@test.et', password: 'PlainOld1', joinedAt: new Date().toISOString(), active: true });
    localStorage.setItem('ssa_db_v1', JSON.stringify(d));
    window.dispatchEvent(new StorageEvent('storage', { key: 'ssa_db_v1', newValue: JSON.stringify(d) }));
    return 1;
  })()`);
  check(await waitFor("!document.body.innerText.includes('First-time setup')"), 'wizard exits when account appears');

  // ── B: login with legacy plain password succeeds AND migrates to bcrypt ──
  await goto(BASE + '/?user=cphone#/auth?mode=login', 2000);
  check(await waitFor("document.querySelectorAll('.auth-card form input').length === 2"), 'login form ready');
  await fill("document.querySelectorAll('.auth-card form input')[0]", 'legacy@test.et');
  await fill("document.querySelectorAll('.auth-card form input')[1]", 'PlainOld1');
  await click("document.querySelector('.auth-card form button[type=\"submit\"]')");
  check(await waitFor("location.hash.includes('/admin') && document.querySelectorAll('.sidebar a').length > 0"), 'legacy plain password still logs in');
  const mig = await evalJs("(() => { const u = JSON.parse(localStorage.getItem('ssa_db_v1')).users.find(x => x.email === 'legacy@test.et'); return JSON.stringify({ h: String(u.password).startsWith('$2'), notPlain: u.password !== 'PlainOld1' }); })()");
  const migObj = JSON.parse(mig);
  check(migObj.h && migObj.notPlain, 'legacy password migrated to bcrypt hash on login');

  // ── B: registration stores a hash, not the typed password ──
  await evalJs("localStorage.removeItem('ssa_session_v1')");
  await goto(BASE + '/?user=cphone&t=' + Date.now() + '#/auth', 2000);
  check(await waitFor("[...document.querySelectorAll('.auth-card form input')].some(i => i.placeholder === 'Ayaan Ali')"), 'register form ready');
  await fill("[...document.querySelectorAll('.auth-card form input')].find(i => i.placeholder === 'Ayaan Ali')", 'Hash Student');
  await fill("[...document.querySelectorAll('.auth-card form input')].find(i => i.placeholder === 'Baro School')", 'Hash School');
  await fill("[...document.querySelectorAll('.auth-card form input')].find(i => i.placeholder === 'School Director')", 'Hash Dir');
  await fill("[...document.querySelectorAll('.auth-card form input')].find(i => i.placeholder === 'you@school.et')", 'hashstu@test.et');
  await fill("[...document.querySelectorAll('.auth-card form input')].find(i => i.placeholder === '••••••••')", 'StuPass123');
  await click("document.querySelector('.auth-card form button[type=\"submit\"]')");
  check(await waitFor("location.hash.includes('/student') && !!document.querySelector('.shell')"), 'student registered and logged in');
  const regHash = await evalJs("(() => { const u = JSON.parse(localStorage.getItem('ssa_db_v1')).users.find(x => x.email === 'hashstu@test.et'); return JSON.stringify({ h: String(u.password).startsWith('$2'), notPlain: u.password !== 'StuPass123' }); })()");
  const regHashObj = JSON.parse(regHash);
  check(regHashObj.h && regHashObj.notPlain, 'registered password stored as bcrypt hash, not plaintext');

  // ── B: wrong password rejected, correct password accepted (post-hash) ──
  await evalJs("localStorage.removeItem('ssa_session_v1')");
  await goto(BASE + '/?user=cphone&t=' + Date.now() + '#/auth?mode=login', 2000);
  await fill("document.querySelectorAll('.auth-card form input')[0]", 'hashstu@test.et');
  await fill("document.querySelectorAll('.auth-card form input')[1]", 'WrongPass99');
  await click("document.querySelector('.auth-card form button[type=\"submit\"]')");
  check(await waitFor("document.body.innerText.includes('Invalid email or password')"), 'wrong password rejected against hash');
  await fill("document.querySelectorAll('.auth-card form input')[1]", 'StuPass123');
  await click("document.querySelector('.auth-card form button[type=\"submit\"]')");
  check(await waitFor("location.hash.includes('/student') && !!document.querySelector('.shell')"), 'correct password accepted against hash');

  // ── C: student store page with no configured phone shows warning, no fallback number ──
  await goto(BASE + '/?user=cphone&t=' + Date.now() + '#/student/store', 2200);
  check(await waitFor("document.body.innerText.includes('Payment number not configured yet')"), 'store page warns when pay phone not configured');
  const noBaked = await evalJs("!document.body.innerText.includes('957 0426')");
  check(noBaked, 'store page never shows the baked-in number');

  // ── C: admin settings shows its own warning, sets the number, student sees it ──
  await evalJs("localStorage.setItem('ssa_session_v1', 'adm_legacy')");
  await goto(BASE + '/?user=cphone&t=' + Date.now() + '#/admin/settings', 2200);
  check(await waitFor("document.querySelectorAll('.sidebar a').length > 0 && document.body.innerText.includes('No payment number saved yet')"), 'admin settings warns while phone empty');
  const ph = await fill("[...document.querySelectorAll('input')].find(i => i.placeholder === '+251 9X XXX XXXX')", '+251 91 555 4433');
  check(ph === true, 'pay phone input found by placeholder');
  await click("[...document.querySelectorAll('button')].find(b => /save settings/i.test(b.textContent))");
  check(await waitFor("!document.body.innerText.includes('No payment number saved yet')"), 'admin warning clears after save');

  const stuId = await evalJs("(() => { const u = JSON.parse(localStorage.getItem('ssa_db_v1')).users.find(x => x.role === 'student'); return u && u.id; })()");
  await evalJs(`localStorage.setItem('ssa_session_v1', ${JSON.stringify(stuId)})`);
  await goto(BASE + '/?user=cphone&t=' + Date.now() + '#/student/store', 2200);
  check(await waitFor("document.body.innerText.includes('+251 91 555 4433')"), 'student store now shows admin-configured number');
  check(await evalJs("!document.body.innerText.includes('Payment number not configured yet')"), 'student warning gone once configured');
  check(await evalJs("!document.body.innerText.includes('957 0426')"), 'baked number still absent after configuration');

  console.log('js errors: ' + errs.length + (errs.length ? ' :: ' + errs.join(' | ') : ''));
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `FAILED ${failed}/${results.length}` : `ALL ${results.length} PW-HASH & PAY-PHONE CHECKS PASSED`);
  chrome.kill();
  process.exit(failed || errs.length ? 1 : 0);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
