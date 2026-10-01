const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9449;
const PROFILE = process.env.TEMP + '\\ssa-sync-' + Date.now();
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
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--window-size=1280,800'], { stdio: 'ignore' });
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
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errs.push(m.params.args.map(a => a.value || (a.description || '').split('\n')[0]).join(' ').slice(0, 300));
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++mid; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result && r.result.value;
  };
  const waitLoad = async () => {
    for (let i = 0; i < 200; i++) { if (await evalJs('document.readyState') === 'complete') return; await sleep(150); }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  const netLog = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data.toString());
    if (m.method === 'Network.requestWillBeSent' && m.params.request.url.includes('/api/db')) {
      netLog.push('REQ ' + m.params.request.method + ' ' + m.params.request.url.replace(BASE, '') +
        ' origin=' + (m.params.request.headers.Origin || '-') + ' referer=' + (m.params.request.headers.Referer || '-'));
    }
    if (m.method === 'Network.responseReceived' && m.params.response.url.includes('/api/db')) {
      netLog.push('RES ' + m.params.response.status + ' ' + m.params.response.url.replace(BASE, ''));
    }
    if (m.method === 'Network.loadingFailed' && String(m.params.blockedReason || m.params.errorText || '').length) {
      netLog.push('FAIL ' + (m.params.blockedReason || m.params.errorText));
    }
  });
  await send('Page.navigate', { url: BASE + '/' });
  await waitLoad();
  await sleep(6000);

  const apiOk = await evalJs(`fetch('/api/db').then(r => r.status).catch(e => 'ERR:' + e.message)`);
  console.log((apiOk === 200 ? 'PASS' : 'FAIL') + ' in-page GET /api/db => ' + apiOk);

  const timing = await evalJs(`JSON.stringify(performance.getEntriesByType('resource')
    .filter(e => e.name.includes('/api/db'))
    .map(e => ({ url: e.name.replace(location.origin, ''), start: Math.round(e.startTime), dur: Math.round(e.duration), status: e.responseStatus || '-' })))`);
  console.log('resource timings: ' + timing);
  console.log('network log: ' + JSON.stringify(netLog));

  // SSE: did the app open an EventSource? check resource timings for /api/db/events
  const sse = await evalJs(`(performance.getEntriesByType('resource').some(e => e.name.includes('/api/db/events')) || location.href)`);
  console.log((sse === true ? 'PASS' : 'WARN') + ' SSE connection attempted => ' + sse);

  const landing = await evalJs(`document.body.innerText.includes('Small steps every day')`);
  console.log((landing ? 'PASS' : 'FAIL') + ' landing rendered with sync ON');
  console.log('js errors: ' + errs.length + (errs.length ? ' :: ' + errs.join(' | ').slice(0, 800) : ''));
  chrome.kill();
  process.exit(apiOk === 200 && landing && errs.length === 0 ? 0 : 1);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
