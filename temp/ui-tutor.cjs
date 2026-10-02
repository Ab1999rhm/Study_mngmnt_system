const { spawn } = require('child_process');
const http = require('http');
const BASE = 'http://localhost:5173';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9444;
const PROFILE = process.env.TEMP + '\\ssa-uitutor-' + Date.now();
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

  // ── G: tutor chat on learn page ──
  await goto(BASE + '/seed-test.html?user=stu_test#/student/learn', 2400);

  // ── G: source has no external AI service; real AI goes through same-origin proxy ──
  const srcClean = await evalJs("Promise.all(['/src/pages/student/StudyAI.jsx', '/src/data/tutor.js'].map(u => fetch(u).then(r => r.text()))).then(([a, b]) => JSON.stringify({ noHf: !a.includes('huggingface') && !a.includes('hf.space'), noGemma: !a.includes('GEMMA_SRC') && !a.includes('GemmaChat'), studyNoPoll: !a.includes('pollinations'), tutorNoPoll: !b.includes('pollinations'), usesProxy: b.includes('/api/ai') }))");
  const srcObj = JSON.parse(srcClean);
  check(srcObj.noHf, 'StudyAI source: no huggingface / hf.space references');
  check(srcObj.noGemma, 'StudyAI source: Gemma iframe code removed');
  check(srcObj.studyNoPoll && srcObj.tutorNoPoll, 'client source never references pollinations directly');
  check(srcObj.usesProxy, 'tutor calls same-origin /api/ai proxy');

  check(await waitFor("document.body.innerText.includes('real AI, offline backup')"), 'tutor card renders');
  check(await evalJs("document.querySelectorAll('iframe').length === 0"), 'no iframe on learn page');
  check(await evalJs("!document.documentElement.innerHTML.includes('huggingface')"), 'no huggingface anywhere in DOM');
  check(await evalJs("!!document.querySelector('#tutor-msgs') && !!document.querySelector('form input[aria-label=\"Ask the tutor\"]')"), 'chat box + input present');

  const ask = async q => {
    await fill("document.querySelector('form input[aria-label=\"Ask the tutor\"]')", q);
    await click("document.querySelector('form button[type=\"submit\"]')");
  };
  const tags = n => `document.querySelectorAll('#tutor-msgs [data-src]').length >= ${n}`;

  await ask('What is a fraction?');
  check(await waitFor(tags(2), 30000), 'curriculum question gets a live reply (AI or offline fallback)');
  check(await evalJs("!!document.querySelector('#tutor-msgs [data-src=\"ai\"]') || !!document.querySelector('#tutor-msgs [data-src=\"local\"]')"), 'reply carries a source tag');

  await ask('How do exams work?');
  check(await waitFor("document.querySelector('#tutor-msgs').innerText.includes('uploads real tests')", 30000), 'exam mechanics answered exactly (local fast path)');
  check(await evalJs("!!document.querySelector('#tutor-msgs [data-src=\"local\"]')"), 'app-intent reply tagged local');

  await send('Network.enable');
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await ask('zzz qqq wwww vvvv');
  check(await waitFor(tags(4), 30000), 'offline: junk question still answered from local fallback');
  check(await waitFor("document.querySelector('#tutor-msgs').innerText.includes('I can explain curriculum terms')", 30000), 'offline -> capability menu fallback');
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  // ── E: study plan schedule is progress-driven ──
  await goto(BASE + '/seed-test.html?user=stu_test#/student/plan', 2200);
  check(await waitFor("document.querySelectorAll('.tt-table tbody tr').length >= 6"), 'study plan schedule renders');
  const plan = await evalJs(`(() => {
    const rows = [...document.querySelectorAll('.tt-table tbody tr')].map(r => r.innerText.replace(/\\s+/g, ' '));
    return JSON.stringify({ rows, hasTarget: rows.some(r => r.includes('Test Book')), hasOldStatic: rows.some(r => r.includes('New sub-section of Mathematics + 3-line note')) });
  })()`);
  const planObj = JSON.parse(plan);
  check(planObj.hasTarget, 'plan tasks reference the real next upload', JSON.stringify(planObj.rows.slice(0, 4)));
  check(!planObj.hasOldStatic, 'old subjects[0]-static task text gone');

  // ── F: today plan on home is progress-driven ──
  await goto(BASE + '/seed-test.html?user=stu_test#/student', 2200);
  check(await waitFor("document.querySelectorAll('.tt-table tbody tr').length === 3"), 'today plan has 3 rows');
  const home = await evalJs(`(() => {
    const card = (document.querySelectorAll('.tt-table')[0] || {}).closest ? document.querySelectorAll('.tt-table')[0].closest('.card') : null;
    const rows = card ? [...card.querySelectorAll('.tt-table tbody tr')].map(r => r.innerText.replace(/\\s+/g, ' ')) : [];
    return JSON.stringify({ rows, hasTarget: rows.some(r => r.includes('Test Book')), hasOld: rows.some(r => r.includes("Review yesterday's notes")), nextUp: (document.body.innerText.match(/next up[^.]{0,80}/) || [''])[0] });
  })()`);
  const homeObj = JSON.parse(home);
  check(homeObj.rows.length === 3, 'three dynamic rows', JSON.stringify(homeObj.rows));
  check(homeObj.hasTarget, 'today rows cite the real next upload', JSON.stringify(homeObj.rows));
  check(!homeObj.hasOld, 'old static "Review yesterday\'s notes" row gone');
  check(/next up/i.test(homeObj.nextUp), 'note box shows next-up target', homeObj.nextUp);

  console.log('js errors: ' + errs.length + (errs.length ? ' :: ' + errs.join(' | ') : ''));
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `FAILED ${failed}/${results.length}` : `ALL ${results.length} TUTOR & SCHEDULE CHECKS PASSED`);
  chrome.kill();
  process.exit(failed || errs.length ? 1 : 0);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
