// Visual/behavioral probe: teal colors + hamburger drawer + horizontal tabs on phone.
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9444;
const BASE = 'http://localhost:5173/seed-test.html?user=adm_t#/admin';
const PROFILE = process.env.TEMP + '\\ssa-probe-' + Date.now();

const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpReq(method, path) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path, method }, r => {
      let d = '';
      r.on('data', c => (d += c));
      r.on('end', () => {
        try { res(JSON.parse(d)); } catch (e) { rej(e); }
      });
    });
    req.on('error', rej);
    req.end();
  });
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
    '--window-size=1440,900'
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 120 && !target; i++) {
    try { target = await httpReq('PUT', '/json/new?' + encodeURIComponent('http://localhost:5173/')); } catch (e) { await sleep(250); }
  }
  if (!target || !target.webSocketDebuggerUrl) {
    console.log('FAIL cannot start chrome devtools');
    chrome.kill();
    process.exit(1);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let mid = 0;
  const pending = new Map();
  const jsErrors = [];
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = e => rej(new Error('ws error')); });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data.toString());
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      jsErrors.push(String((m.params.exceptionDetails && m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || 'exception'));
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      jsErrors.push(m.params.args.map(a => a.value).join(' '));
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++mid;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails.text));
    return r.result && r.result.value;
  };
  const waitLoad = async () => {
    for (let i = 0; i < 80; i++) {
      const st = await evalJs('document.readyState');
      if (st === 'complete') return;
      await sleep(150);
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  const waitFor = async (expr, ms = 20000) => {
    for (let i = 0; i < ms / 300; i++) {
      try {
        const r = await send('Runtime.evaluate', { expression: `!!(${expr})`, returnByValue: true });
        if (r.result && r.result.value) return true;
      } catch (e) { /* retry */ }
      await sleep(300);
    }
    return false;
  };
  const results = [];
  const check = (name, ok, info) => {
    results.push(ok);
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  [' + info + ']'));
  };

  // ---------- desktop 1440 ----------
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE });
  await waitLoad();
  const w1 = await waitFor('document.querySelector(".sidebar a.active") && document.querySelector(".seg .thumb")');
  if (!w1) {
    const dbg = await evalJs(`JSON.stringify({ hash: location.href, ready: document.readyState, body: (document.body.innerText||'').slice(0,200), root: (document.getElementById('root')||{}).innerHTML ? 'has-root' : 'no-root' })`);
    console.log('DEBUG desktop state: ' + dbg);
    console.log('DEBUG errors so far: ' + jsErrors.join(' | ').slice(0, 500));
  }
  await sleep(400);

  const activeBg = await evalJs(`getComputedStyle(document.querySelector('.sidebar a.active')).backgroundColor`);
  check('desktop sidebar active = teal', activeBg === 'rgb(13, 148, 136)', activeBg);
  const dBurger = await evalJs(`getComputedStyle(document.querySelector('.nav-burger')).display`);
  check('desktop burger hidden', dBurger === 'none', dBurger);
  const dSide = await evalJs(`getComputedStyle(document.querySelector('.sidebar')).transform`);
  check('desktop sidebar normal column', dSide === 'none', dSide);
  const dThumb = await evalJs(`getComputedStyle(document.querySelector('.seg .thumb')).backgroundImage.includes('rgb(13, 148, 136)')`);
  check('desktop active tab thumb teal', dThumb === true, dThumb);
  const dStat = await evalJs(`getComputedStyle(document.querySelector('.stat.g-brand')).backgroundImage.includes('rgb(13, 148, 136)')`);
  check('desktop stat gradient teal', dStat === true, dStat);

  // ---------- phone 375 ----------
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 810, deviceScaleFactor: 1, mobile: true });
  await send('Page.reload');
  await waitLoad();
  await waitFor('document.querySelector(".nav-burger") && document.querySelector(".seg") && document.querySelector(".sidebar")');
  await sleep(400);

  const p = await evalJs(`(() => {
    const r = {};
    r.overflow = document.documentElement.scrollWidth - 375;
    const b = document.querySelector('.nav-burger');
    r.burger = getComputedStyle(b).display;
    r.bars = b.querySelectorAll('i').length;
    const s = document.querySelector('.sidebar');
    r.sideTransform = getComputedStyle(s).transform;
    r.sidePos = getComputedStyle(s).position;
    const seg = document.querySelector('.seg');
    r.segWrap = getComputedStyle(seg).flexWrap;
    r.segScroll = seg.scrollWidth > seg.clientWidth + 4;
    r.shellDir = getComputedStyle(document.querySelector('.shell')).flexDirection;
    r.mainTop = getComputedStyle(document.querySelector('.main')).paddingTop;
    r.headTop = Math.round(document.querySelector('.page-head').getBoundingClientRect().top);
    return r;
  })()`);
  check('phone no horizontal overflow', p.overflow <= 0, 'overflow=' + p.overflow);
  check('phone burger visible with 3 bars', p.burger !== 'none' && p.bars === 3, JSON.stringify(p));
  check('phone sidebar off-canvas drawer', p.sidePos === 'fixed' && p.sideTransform !== 'none', p.sidePos + ' ' + p.sideTransform);
  check('phone tabs horizontal scroll strip', p.segWrap === 'nowrap' && p.segScroll, p.segWrap + ' scroll=' + p.segScroll);
  check('phone content below burger', parseInt(p.mainTop, 10) >= 60 && p.headTop >= 60, p.mainTop + ' headTop=' + p.headTop);
  check('phone shell stacked column', p.shellDir === 'column', p.shellDir);

  // open drawer
  await evalJs(`document.querySelector('.nav-burger').click()`);
  await sleep(600);
  const open = await evalJs(`(() => {
    const s = document.querySelector('.sidebar');
    const bd = document.querySelector('.nav-backdrop');
    return {
      open: s.classList.contains('open'),
      left: Math.round(s.getBoundingClientRect().left),
      backdrop: bd ? bd.classList.contains('show') : false,
      closeBtn: getComputedStyle(document.querySelector('.nav-close')).display !== 'none'
    };
  })()`);
  check('drawer opens on burger tap', open.open && open.left === 0 && open.backdrop && open.closeBtn, JSON.stringify(open));

  // navigate from drawer
  const clicked = await evalJs(`(() => {
    const a = [...document.querySelectorAll('.sidebar a')].find(x => x.textContent.includes('Uploads'));
    if (a) a.click();
    return !!a;
  })()`);
  await sleep(800);
  const nav = await evalJs(`({ hash: location.hash, open: document.querySelector('.sidebar').classList.contains('open') })`);
  check('drawer link navigates and closes', clicked && nav.hash.includes('uploads') && !nav.open, JSON.stringify(nav));

  // reopen + backdrop close
  await evalJs(`document.querySelector('.nav-burger').click()`);
  await sleep(550);
  await evalJs(`document.querySelector('.nav-backdrop').click()`);
  await sleep(550);
  const closed = await evalJs(`!document.querySelector('.sidebar').classList.contains('open')`);
  check('backdrop closes drawer', closed === true, String(closed));

  check('no js errors during probe', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));

  const fails = results.filter(ok => !ok).length;
  console.log(`\n${results.length - fails} passed, ${fails} failed`);
  try { ws.close(); } catch (e) {}
  chrome.kill();
  try { fs.rmSync(PROFILE, { recursive: true, force: true, maxRetries: 3 }); } catch (e) {}
  process.exit(fails ? 1 : 0);
}
main().catch(e => { console.error('PROBE ERROR', e); process.exit(1); });
