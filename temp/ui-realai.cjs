const { spawn } = require('child_process');
const http = require('http');
const BASE = 'http://localhost:5173';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9445;
const PROFILE = process.env.TEMP + '\\ssa-uirealai-' + Date.now();
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
  const goto = async (url, wait = 2400) => { await send('Page.navigate', { url }); await waitLoad(); await sleep(wait); };
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

  const ask = async q => {
    await fill("document.querySelector('form input[aria-label=\"Ask the tutor\"]')", q);
    await click("document.querySelector('form button[type=\"submit\"]')");
  };
  const aiCount = () => evalJs("document.querySelectorAll('#tutor-msgs [data-src=\"ai\"]').length");
  const localCount = () => evalJs("document.querySelectorAll('#tutor-msgs [data-src=\"local\"]').length");
  const allTags = () => evalJs("document.querySelectorAll('#tutor-msgs [data-src]').length");

  // ── student learn page ──
  await goto(BASE + '/seed-test.html?user=stu_test#/student/learn', 2600);
  check(await waitFor("document.body.innerText.includes('real AI, offline backup')"), 'tutor card renders');
  check(await evalJs("!!document.querySelector('form input[aria-label=\"Ask the tutor\"]')"), 'chat input present');

  // ── 1. REAL AI: curriculum question answered by the model through /api/ai ──
  await ask('What is a fraction?');
  check(await waitFor(`document.querySelectorAll('#tutor-msgs [data-src="ai"]').length >= 1`, 30000), 'real AI answered a curriculum question through /api/ai');
  const aiLen = await evalJs("(() => { const el = document.querySelector('#tutor-msgs [data-src=\"ai\"]'); return el ? el.innerText.length : 0; })()");
  check(aiLen > 60, 'AI reply is a full answer (len=' + aiLen + ')');

  // ── 2. app-intent fast path: exact answer with the configured payPhone, no network ──
  await ask('How do I unlock a package?');
  check(await waitFor("document.querySelector('#tutor-msgs').innerText.includes('Store page')", 30000), 'package question -> Store flow (local fast path)');
  check(await waitFor("document.querySelector('#tutor-msgs').innerText.includes('91 111 2233')", 10000), 'package answer quotes the configured payPhone');
  check(await evalJs("document.querySelectorAll('#tutor-msgs [data-src=\"local\"]').length >= 2"), 'local replies tagged (welcome + package)');

  // ── 3. offline: same chat keeps working from the local fallback ──
  await send('Network.enable');
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await ask('zzz qqq wwww vvvv');
  check(await waitFor("document.querySelectorAll('#tutor-msgs [data-src]').length >= 4", 30000), 'offline: question still answered (fallback path)');
  check(await waitFor("document.querySelector('#tutor-msgs').innerText.includes('I can explain curriculum terms')", 30000), 'offline: capability menu from local tutor');
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  // ── 4. back online: AI works again after the outage (retry — keyless upstream can hiccup) ──
  await sleep(6000);
  let recovered = false;
  for (let i = 0; i < 3 && !recovered; i++) {
    if (i) await sleep(8000);
    await ask('What is a percentage?');
    recovered = await waitFor(`document.querySelectorAll('#tutor-msgs [data-src="ai"]').length >= 2`, 30000);
  }
  if (!recovered) {
    const diag = await evalJs("(() => { const els = [...document.querySelectorAll('#tutor-msgs [data-src]')]; const last = els[els.length - 1]; return JSON.stringify({ ai: document.querySelectorAll('#tutor-msgs [data-src=\"ai\"]').length, local: document.querySelectorAll('#tutor-msgs [data-src=\"local\"]').length, lastTag: last && last.getAttribute('data-src'), lastHead: last && last.innerText.slice(0, 140) }); })()");
    console.log('recovery diag: ' + diag);
  }
  check(recovered, 'AI recovers after connection returns');

  // ── 5. open public AI: answers questions beyond the curriculum ──
  const askAI = async (q, minCount) => {
    for (let i = 0; i < 3; i++) {
      if (i) await sleep(8000);
      await ask(q);
      if (await waitFor(`document.querySelectorAll('#tutor-msgs [data-src="ai"]').length >= ${minCount}`, 30000)) return true;
    }
    return false;
  };
  check(await askAI('Why is the sky blue?', 3), 'open question (beyond curriculum) answered by real AI');
  check(await waitFor("(() => { const ai = document.querySelectorAll('#tutor-msgs [data-src=\"ai\"]'); const last = ai[ai.length - 1]; return !!last && /sky|sun|light|scatter/i.test(last.innerText); })()", 10000), 'open answer is substantive about the sky');

  // ── 6. conversation memory: remembers earlier turns ──
  check(await askAI('Remember: my name is Ayaan.', 4), 'memory note acknowledged by AI');
  check(await askAI('What is my name?', 5), 'follow-up question answered by AI');
  check(await waitFor("(() => { const ai = document.querySelectorAll('#tutor-msgs [data-src=\"ai\"]'); const last = ai[ai.length - 1]; return !!last && /Ayaan/i.test(last.innerText); })()", 10000), 'AI remembers the name from earlier messages');

  console.log('js errors: ' + errs.length + (errs.length ? ' :: ' + errs.join(' | ') : ''));
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `FAILED ${failed}/${results.length}` : `ALL ${results.length} REAL-AI CHECKS PASSED`);
  chrome.kill();
  process.exit(failed || errs.length ? 1 : 0);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
