const { spawn } = require('child_process');
const http = require('http');
const BASE = 'http://localhost:5173';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9443;
const PROFILE = process.env.TEMP + '\\ssa-uidel-' + Date.now();
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
  let nativeDialog = false;
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
    if (m.method === 'Page.javascriptDialogOpening') nativeDialog = true;
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
  const click = async expr => evalJs(`(() => { const el = (${expr}); if (!el) return false; el.click(); return true; })()`);
  const results = [];
  const check = (ok, label) => { results.push({ ok, label }); console.log((ok ? 'PASS ' : 'FAIL ') + label); };

  await send('Page.enable');
  await send('Runtime.enable');

  await goto(BASE + '/seed-test.html?user=adm_t#/admin/students');
  check(await waitFor("location.hash.includes('/admin/students') && document.querySelectorAll('.data tbody tr').length > 0"), 'students table loaded');
  const rowsBefore = await evalJs("[...document.querySelectorAll('.data tbody .btn')].filter(b => b.textContent.includes('Details')).length");

  // open detail modal of first row
  await click("[...document.querySelectorAll('.data tbody .btn')].find(b => b.textContent.includes('Details'))");
  check(await waitFor("[...document.querySelectorAll('button')].some(b => b.textContent.includes('Delete student'))"), 'detail modal open with Delete student');

  // cancel path
  await click("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Delete student'))");
  check(await waitFor("[...document.querySelectorAll('p')].some(p => p.textContent.includes('This cannot be undone.'))"), 'styled confirm dialog (not native) shows message');
  check(await waitFor("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '\u{1F5D1} Delete')"), 'confirm dialog has Delete button');
  await click("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Cancel'))");
  check(await waitFor("!document.body.innerText.includes('This cannot be undone.')"), 'Cancel closes confirm dialog');
  const rowsAfterCancel = await evalJs("[...document.querySelectorAll('.data tbody .btn')].filter(b => b.textContent.includes('Details')).length");
  check(rowsAfterCancel === rowsBefore, `student kept after cancel (${rowsAfterCancel} rows)`);

  // confirm path
  await click("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Delete student'))");
  check(await waitFor("document.body.innerText.includes('This cannot be undone.')"), 'confirm dialog reopens');
  await click("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '\u{1F5D1} Delete')");
  check(await waitFor(`[...document.querySelectorAll('.data tbody .btn')].filter(b => b.textContent.includes('Details')).length < ${rowsBefore}`), 'student removed from table');
  check(await waitFor("!document.body.innerText.includes('Delete student')"), 'detail modal closed after delete');
  check(await waitFor("document.body.innerText.includes('Student deleted')", 8000), 'success flash shown');

  await sleep(600);
  check(!nativeDialog, 'no native window.confirm fired');
  console.log('js errors: ' + errs.length + (errs.length ? ' :: ' + errs.join(' | ') : ''));
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `FAILED ${failed}/${results.length}` : `ALL ${results.length} DELETE-CONFIRM CHECKS PASSED`);
  chrome.kill();
  process.exit(failed || errs.length ? 1 : 0);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });

