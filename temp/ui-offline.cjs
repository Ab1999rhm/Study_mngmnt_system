const { spawn } = require('child_process');
const http = require('http');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9446;
const BASE = 'http://localhost:4173';
const PROFILE = process.env.TEMP + '\\ssa-uioffline-' + Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpReq(method, p) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: p, method }, r => {
      let d = '';
      r.data = d;
      r.on('data', c => (d += c));
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    });
    req.on('error', rej);
    req.end();
  });
}

function serverUp() {
  return new Promise((res, rej) => {
    const req = http.get(BASE + '/', r => { r.resume(); res(true); });
    req.on('error', rej);
    req.setTimeout(1500, () => { req.destroy(new Error('timeout')); });
  });
}

async function main() {
  const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4173', '--strictPort'], { cwd: process.cwd(), stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    try { await serverUp(); up = true; } catch (e) { await sleep(500); }
  }
  if (!up) { console.log('FAIL preview server did not start'); preview.kill(); process.exit(1); }
  console.log('preview up on 4173');

  const chrome = spawn(CHROME, ['--headless', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--window-size=1440,900'], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = await httpReq('PUT', '/json/new?' + encodeURIComponent(BASE + '/')); } catch (e) { await sleep(250); }
  }
  if (!target || !target.webSocketDebuggerUrl) { console.log('FAIL no devtools'); chrome.kill(); preview.kill(); process.exit(1); }

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
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result && r.result.value;
  };
  const waitLoad = async () => {
    for (let i = 0; i < 200; i++) { if (await evalJs('document.readyState') === 'complete') return; await sleep(150); }
  };
  const goto = async (url, wait = 2500) => { await send('Page.navigate', { url }); await waitLoad(); await sleep(wait); };
  const waitFor = async (expr, ms = 15000) => {
    for (let i = 0; i < ms / 300; i++) {
      try { if (await evalJs(`!!(${expr})`)) return true; } catch (e) {}
      await sleep(300);
    }
    return false;
  };
  const waitUntil = async (fn, ms = 30000) => {
    for (let i = 0; i < ms / 500; i++) {
      try { const v = await fn(); if (v) return v; } catch (e) {}
      await sleep(500);
    }
    return null;
  };
  const results = [];
  const check = (ok, label) => { results.push({ ok, label }); console.log((ok ? 'PASS ' : 'FAIL ') + label); };

  await send('Page.enable');
  await send('Runtime.enable');

  // 1. first online load -> SW registers + precaches
  await goto(BASE + '/?user=offline_t', 3500);
  const controller = await waitUntil(() => evalJs('!!navigator.serviceWorker.controller'), 20000);
  check(!!controller, 'service worker controls page after install');

  const precacheN = await waitUntil(async () => {
    const n = await evalJs(`(async () => { let n = 0; const ks = await caches.keys(); for (const k of ks) { if (/precache/i.test(k)) { const c = await caches.open(k); n += (await c.keys()).length; } } return n; })()`);
    return n >= 5 ? n : null;
  }, 30000);
  check(!!precacheN, `precache populated (entries: ${precacheN || 0})`);

  // 2. inject student session (?user= disables sync)
  const inj = await evalJs(`(() => {
    const t = new Date().toISOString();
    const db = { users: [{ id: 'offline_t', role: 'student', fullName: 'Offline Test', email: 'off@t.t', grade: 8, schoolName: 'Test School', active: true, points: 120, aiEnabled: true }],
      uploads: [
        { id: 'off_up1', type: 'book', title: 'Offline Book', subject: 'Mathematics', grade: 'all', body: 'Offline book body.', price: 0, free: true, createdAt: t },
        { id: 'off_up2', type: 'library', title: 'Offline Library Book', subject: 'Science', grade: 'all', body: 'Offline library body.', price: 0, free: true, createdAt: t }
      ],
      reports: [], progress: {}, notes: [], payRequests: [], resetRequests: [], packages: [], announcements: [], settings: {}, videos: [], codes: [] };
    localStorage.setItem('ssa_db_v1', JSON.stringify(db));
    localStorage.setItem('ssa_session_v1', 'offline_t');
    localStorage.removeItem('ssa_lang');
    return 'ok';
  })()`);
  check(inj === 'ok', 'injected student db + session');

  // 3. reload online -> student shell
  await send('Page.reload', {}); await waitLoad(); await sleep(2500);
  check(await waitFor(`document.body.innerText.includes('Study with AI')`, 20000), 'student shell renders online after reload');

  // 4. library page online (client-side nav)
  await evalJs(`location.hash = '#/student/library'`); await sleep(1800);
  const onlineCards = await evalJs('document.querySelectorAll(".subject-card").length');
  const onlineLabel = await evalJs('document.body.innerText.includes("Available offline")');
  check(!!onlineLabel && onlineCards > 0, `library + offline label visible online (${onlineCards} cards)`);

  // 5. kill preview -> genuine offline (no server at all)
  preview.kill();
  const down = await waitUntil(async () => { try { await serverUp(); return null; } catch (e) { return true; } }, 15000);
  check(!!down, 'preview server fully stopped');

  // 6. full reload offline -> SW must serve app shell from precache
  await send('Page.reload', {}); await sleep(1500);
  const offOk = await waitFor(`document.body.innerText.includes('Available offline')`, 30000);
  let offCards = 0;
  try { offCards = await evalJs('document.querySelectorAll(".subject-card").length'); } catch (e) {}
  check(offOk && offCards > 0, `OFFLINE reload renders library + "Available offline" (${offCards} cards)`);
  const stillCtrl = await evalJs('!!navigator.serviceWorker.controller').catch(() => false);
  check(!!stillCtrl, 'page still SW-controlled after offline reload');

  check(errs.length === 0, 'no js errors' + (errs.length ? ' -> ' + errs.slice(0, 3).join(' | ') : ''));

  const fail = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - fail}/${results.length} passed`);
  try { ws.close(); } catch (e) {}
  chrome.kill();
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
