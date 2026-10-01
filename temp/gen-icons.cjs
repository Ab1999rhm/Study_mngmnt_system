const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9449;
const PROFILE = process.env.TEMP + '\\ssa-genicons-' + Date.now();
const OUT = path.join(__dirname, '..', 'public');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="W" height="H">
  <rect width="512" height="512" rx="96" fill="#1a56db"/>
  <path d="M256 112L96 192v48h320v-48L256 112z" fill="#fff"/>
  <path d="M144 272v80c0 26 50 48 112 48s112-22 112-48v-80H144z" fill="#fbbf24"/>
  <rect x="368" y="200" width="16" height="160" rx="8" fill="#fff"/>
</svg>`;

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
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--window-size=600,600'], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = await httpReq('PUT', '/json/new?about:blank'); } catch (e) { await sleep(250); }
  }
  if (!target || !target.webSocketDebuggerUrl) { console.log('FAIL no devtools'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let mid = 0;
  const pending = new Map();
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data.toString());
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++mid; pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result && r.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');

  const shot = async (file, size, html) => {
    await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
    await evalJs(`document.open(); document.write(${JSON.stringify('<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body>' + html + '</body></html>')}); document.close();`);
    await sleep(400);
    const r = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: size, height: size, scale: 1 },
      captureBeyondViewport: true,
      fromSurface: true,
      omitBackground: true
    });
    fs.writeFileSync(path.join(OUT, file), Buffer.from(r.data, 'base64'));
    console.log('wrote ' + file + ' (' + Buffer.from(r.data, 'base64').length + ' bytes)');
  };

  // regular icons: full-bleed brand blue (platforms apply their own mask)
  await shot('icon-192.png', 192, `<div style="width:192px;height:192px;background:#1a56db;overflow:hidden">${LOGO.replace(/"W"/, '"192"').replace(/"H"/, '"192"')}</div>`);
  await shot('icon-512.png', 512, `<div style="width:512px;height:512px;background:#1a56db;overflow:hidden">${LOGO.replace(/"W"/, '"512"').replace(/"H"/, '"512"')}</div>`);
  // iOS home-screen icon (opaque, no transparency, no rounded corners needed - iOS masks itself)
  await shot('apple-touch-icon.png', 180, `<div style="width:180px;height:180px;background:#1a56db;overflow:hidden"><div style="width:180px;height:180px;transform:scale(0.3515625);transform-origin:0 0">${LOGO.replace(/"W"/, '"512"').replace(/"H"/, '"512"')}</div></div>`);
  // maskable: full-bleed brand color, logo inside the 80% safe zone
  await shot('icon-maskable-512.png', 512, `<div style="width:512px;height:512px;background:#1a56db;display:flex;align-items:center;justify-content:center"><div style="width:410px;height:410px">${LOGO.replace(/"W"/, '"410"').replace(/"H"/, '"410"')}</div></div>`);

  chrome.kill();
  process.exit(0);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
