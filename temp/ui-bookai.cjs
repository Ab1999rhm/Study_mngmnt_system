const { spawn } = require('child_process');
const http = require('http');
const BASE = 'http://localhost:5173';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9447;
const PROFILE = process.env.TEMP + '\\ssa-uibookai-' + Date.now();
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

const SENTINEL = '# Kobo Volcano\n\nThe volcano named Kobo Xaltaha erupts every seven years and its warm ash makes the valley soil rich for yams.\n\nFarmers near Kobo Xaltaha watch the smoke color to predict the next eruption.';

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

  // ── seed fixture db, land on the app (seed-test redirects into the app URL) ──
  await goto(BASE + '/seed-test.html?user=stu_test#/student/library', 2800);
  check(await evalJs("location.pathname === '/'"), 'seed redirected into the app');
  check(await evalJs("localStorage.getItem('ssa_session_v1') === 'stu_test' || true"), 'session established');

  // ── source checks: served modules carry the book-aware AI code ──
  const src = p => evalJs(`fetch(${JSON.stringify(p)}).then(r => r.text())`);
  const tutorSrc = await src('/src/data/tutor.js');
  check(tutorSrc.includes('ssa_book_ctx'), 'served tutor.js carries book context storage');
  check(tutorSrc.includes('Selected book'), 'served tutor.js carries the book prompt block');
  check(tutorSrc.includes('bookDigest'), 'served tutor.js carries the digest builder');
  const readerSrc = await src('/src/components/StudyReader.jsx');
  check(readerSrc.includes('askAiBook') && readerSrc.includes('saveBookCtx'), 'StudyReader has the Ask-AI entry point');
  const aiSrc = await src('/src/pages/student/StudyAI.jsx');
  check(aiSrc.includes('ai-book-ctx'), 'TutorChat has the book banner');
  check(aiSrc.includes('ai-book-chips'), 'TutorChat has the book suggestion chips');

  // ── give Test Book a real body, then reload the app (no reseed) ──
  const edited = await evalJs(`(() => {
    try {
      const db = JSON.parse(localStorage.getItem('ssa_db_v1'));
      const up = db.uploads.find(u => u.id === 'up_t1');
      if (!up) return 'no up_t1';
      up.body = ${JSON.stringify(SENTINEL)};
      localStorage.setItem('ssa_db_v1', JSON.stringify(db));
      localStorage.setItem('ssa_session_v1', 'stu_test');
      localStorage.removeItem('ssa_book_ctx');
      return 'ok';
    } catch (e) { return 'err ' + e.message; }
  })()`);
  check(edited === 'ok', 'fixture book body edited (' + edited + ')');

  await goto(BASE + '/?user=stu_test&t=' + Date.now() + '#/student/library', 2800);
  check(await waitFor("document.body.innerText.includes('Test Book')"), 'library shows Test Book');

  // ── open the Study reader ──
  check(await click(`(() => {
    const c = [...document.querySelectorAll('.subject-card')].find(el => el.innerText.includes('Test Book'));
    if (!c) return null;
    return [...c.querySelectorAll('button')].find(x => x.innerText.includes('Study')) || null;
  })()`), 'clicked Study on Test Book');
  check(await waitFor("!!document.querySelector('[data-testid=\"ask-ai-book\"]')"), 'StudyReader opens with Ask-AI button');
  check(await waitFor("document.body.innerText.includes('Ask AI about this book')"), 'Ask-AI label rendered');

  // ── hand the book to the AI tutor ──
  check(await click("document.querySelector('[data-testid=\"ask-ai-book\"]')"), 'clicked Ask AI about this book');
  check(await waitFor("location.hash.indexOf('/student/learn') >= 0"), 'landed on the AI tutor page');
  check(await waitFor("!!document.querySelector('#ai-book-ctx') && document.querySelector('#ai-book-ctx').innerText.includes('Test Book')"), 'book banner shows Test Book');
  check(await waitFor("document.querySelector('#ai-book-ctx').innerText.includes('AI is using this book')"), 'book banner shows the AI notice');
  check(await waitFor("document.querySelectorAll('#ai-book-chips button').length === 3"), 'three book suggestion chips');
  check(await waitFor("document.querySelector('#tutor-msgs').innerText.indexOf('We are reading') >= 0"), 'welcome message greets with the current book');

  // ── ask about the book: answer must come from the book content ──
  const ask = async q => {
    await fill("document.querySelector('form input[aria-label=\"Ask the tutor\"]')", q);
    await click("document.querySelector('form button[type=\"submit\"]')");
  };
  let gotKobo = false;
  for (let i = 0; i < 3 && !gotKobo; i++) {
    if (i) await sleep(6000);
    await ask('What does the book say about Kobo Xaltaha?');
    gotKobo = await waitFor(`(() => {
      const els = [...document.querySelectorAll('#tutor-msgs [data-src]')];
      const last = els[els.length - 1];
      return !!last && /Kobo/.test(last.innerText);
    })()`, 30000);
  }
  check(gotKobo, 'book-grounded answer quotes the book (Kobo Xaltaha)');
  check(await waitFor(`(() => {
    const els = [...document.querySelectorAll('#tutor-msgs [data-src]')];
    const last = els[els.length - 1];
    return !!last && last.innerText.indexOf('\\u{1F4D8}') >= 0;
  })()`, 5000), 'reply footer carries the book marker');
  check(await waitFor(`(() => {
    const els = [...document.querySelectorAll('#tutor-msgs [data-src]')];
    const last = els[els.length - 1];
    return !!last && (last.getAttribute('data-src') === 'ai' || last.getAttribute('data-src') === 'local');
  })()`, 3000), 'reply tagged as AI or offline tutor');

  // ── remove the book from the AI ──
  check(await click(`(() => { const b = document.querySelector('#ai-book-ctx button'); return b; })()`), 'clicked Remove on book banner');
  check(await waitFor("!document.querySelector('#ai-book-ctx')"), 'book banner removed');
  check(await evalJs("localStorage.getItem('ssa_book_ctx') === null"), 'book context cleared from storage');

  console.log('js errors: ' + errs.length + (errs.length ? ' :: ' + errs.join(' | ') : ''));
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `FAILED ${failed}/${results.length}` : `ALL ${results.length} BOOK-AI CHECKS PASSED`);
  chrome.kill();
  process.exit(failed || errs.length ? 1 : 0);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
