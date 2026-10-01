const { spawn } = require('child_process');
const http = require('http');
const BASE = 'http://localhost:5173';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9442;
const PROFILE = process.env.TEMP + '\\ssa-uistatus-' + Date.now();
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
  const goto = async (url, wait = 2500) => { await send('Page.navigate', { url }); await waitLoad(); await sleep(wait); };
  const waitFor = async (expr, ms = 15000) => {
    for (let i = 0; i < ms / 300; i++) {
      try { if (await evalJs(`!!(${expr})`)) return true; } catch (e) {}
      await sleep(300);
    }
    return false;
  };
  const results = [];
  const check = (ok, label) => { results.push({ ok, label }); console.log((ok ? 'PASS ' : 'FAIL ') + label); };
  const statNums = async () => evalJs("[...document.querySelectorAll('.stat .num')].map(n => n.textContent.trim())");
  const countChip = async label => evalJs(`[...document.querySelectorAll('.chip')].filter(c => c.textContent.trim() === ${JSON.stringify(label)}).length`);

  await send('Page.enable');
  await send('Runtime.enable');

  // ── English ──────────────────────────────────────
  await goto(BASE + '/seed-test.html?user=dir_t#/director');
  check(await waitFor("document.querySelectorAll('.stat').length === 4"), 'director overview with 4 stats');
  await sleep(1200);
  const enNums = await statNums();
  console.log('EN stats: ' + JSON.stringify(enNums));
  check(enNums[0] === '2' && enNums[1] === '1' && String(enNums[2]).includes('74') && enNums[3] === '0', 'EN counts: total=2 active=1 avg=74 follow=0');
  check(await waitFor("document.body.innerText.includes('Active') && document.body.innerText.includes('Not started')"), 'EN pie legend shows status names');

  await goto(BASE + '/seed-test.html?user=dir_t#/director/students');
  check(await waitFor("document.querySelectorAll('.chip.ok').length + document.querySelectorAll('.chip.bad').length > 0"), 'EN status chips rendered');
  const enActive = await countChip('Active'), enNotStarted = await countChip('Not started');
  check(enActive === 1 && enNotStarted === 1, `EN chips: 1 Active, 1 Not started (got ${enActive}/${enNotStarted})`);

  // ── Oromo (labels translate, COUNTS must not change) ──
  await goto(BASE + '/seed-test.html?user=dir_t&lang=om#/director');
  check(await waitFor("document.body.innerText.includes('Hirmaataa')"), 'OM translation applied (Hirmaataa visible)');
  await sleep(1200);
  const omNums = await statNums();
  console.log('OM stats: ' + JSON.stringify(omNums));
  check(omNums[0] === '2' && omNums[1] === '1' && String(omNums[2]).includes('74') && omNums[3] === '0', 'OM counts identical to EN (key-based, not string compare)');
  check(await waitFor("document.body.innerText.includes('Ella hin dubbanne')"), 'OM legend/labels translated (Ella hin dubbanne)');

  await goto(BASE + '/seed-test.html?user=dir_t&lang=om#/director/students');
  check(await waitFor("document.querySelectorAll('.chip.ok').length > 0"), 'OM chips rendered');
  const omActive = await countChip('Hirmaataa'), omNotStarted = await countChip('Ella hin dubbanne');
  check(omActive === 1 && omNotStarted === 1, `OM chips: 1 Hirmaataa, 1 Ella hin dubbanne (got ${omActive}/${omNotStarted})`);

  console.log('js errors: ' + errs.length + (errs.length ? ' :: ' + errs.join(' | ') : ''));
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `FAILED ${failed}/${results.length}` : `ALL ${results.length} STATUS-I18N CHECKS PASSED`);
  chrome.kill();
  process.exit(failed || errs.length ? 1 : 0);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
