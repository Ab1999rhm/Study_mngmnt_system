// StudyReader PDF flow: exact page count, real rendered pages, AI gets the book text.
const { spawn } = require('child_process');
const http = require('http');
const BASE = 'http://localhost:5173/';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9459;
const PROFILE = process.env.TEMP + '\\ssa-pdfreader-' + Date.now();
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

function makePdfB64() {
  const s1 = 'BT /F1 18 Tf 60 730 Td (Chapter 1) Tj ET\nBT /F1 14 Tf 60 700 Td (Introduction to PDF Testing) Tj ET\nBT /F1 11 Tf 60 660 Td (Object-Oriented Programming is a paradigm based on objects.) Tj ET';
  const s2 = 'BT /F1 11 Tf 60 730 Td (Page two continues the chapter with more content to study.) Tj ET\nBT /F1 11 Tf 60 700 Td (Encapsulation binds data and methods into a single unit.) Tj ET';
  const s3 = 'BT /F1 18 Tf 60 730 Td (Chapter 2) Tj ET\nBT /F1 14 Tf 60 700 Td (Classes and Objects) Tj ET\nBT /F1 11 Tf 60 660 Td (A class is a blueprint; an object is an instance of a class.) Tj ET';
  const objs = {
    1: '<< /Type /Catalog /Pages 2 0 R >>',
    2: '<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>',
    3: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 6 0 R >>',
    4: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 7 0 R >>',
    5: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 8 0 R >>',
    6: `<< /Length ${s1.length} >>\nstream\n${s1}\nendstream`,
    7: `<< /Length ${s2.length} >>\nstream\n${s2}\nendstream`,
    8: `<< /Length ${s3.length} >>\nstream\n${s3}\nendstream`,
    9: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  };
  let out = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 1; i <= 9; i++) { offsets[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = out.length;
  out += 'xref\n0 10\n0000000000 65535 f \n';
  for (let i = 1; i <= 9; i++) out += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  out += `trailer\n<< /Size 10 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1').toString('base64');
}

async function main() {
  const chrome = spawn(CHROME, ['--headless', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--window-size=1440,900'], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = await httpReq('PUT', '/json/new?' + encodeURIComponent('about:blank')); } catch (e) { await sleep(250); }
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
      const txt = (m.params.args || []).map(a => a.value != null ? String(a.value) : (a.description || '')).join(' ');
      if (/PDF build failed/i.test(txt)) errs.push('[console] ' + txt.split('\n')[0]);
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
  const goto = async (url, wait = 2000) => { await send('Page.navigate', { url }); await waitLoad(); await sleep(wait); };
  const waitFor = async (expr, ms = 15000) => {
    for (let i = 0; i < ms / 300; i++) {
      try { if (await evalJs(`!!(${expr})`)) return true; } catch (e) {}
      await sleep(300);
    }
    return false;
  };
  const results = [];
  const check = (ok, label) => { results.push({ ok, label }); console.log((ok ? 'PASS ' : 'FAIL ') + label); };

  await send('Page.enable');
  await send('Runtime.enable');

  const pdfB64 = makePdfB64();
  const db = {
    v: 1,
    users: [{
      id: 'stu_pdf', name: 'PDF Student', email: 'stu_pdf@test.local', role: 'student',
      grade: 12, school: 'SSA Model School', password: '$2b$10$abcdefghijklmnopqrstuv', progress: {}
    }],
    uploads: [{
      id: 'up_pdf1', type: 'book', title: 'OOP Module', subject: 'Computer Science',
      grade: 'all', body: '', link: '', fileName: 'oop.pdf',
      fileData: 'data:application/pdf;base64,' + pdfB64,
      price: 0, free: true, hidden: false, createdAt: new Date().toISOString()
    }],
    packages: [], payRequests: [], notices: [], notes: [], directors: []
  };

  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try {
      localStorage.setItem('ssa_db_v1', ${JSON.stringify(JSON.stringify(db))});
      localStorage.setItem('ssa_session_v1', 'stu_pdf');
    } catch (e) {}`
  });

  await goto(BASE + '?user=pdfstu#/student/library', 3000);

  check(await waitFor("location.hash.includes('/student/library') && document.body.innerText.includes('OOP Module')"), 'student sees the PDF material in library');

  const studyBtn = await evalJs(`(() => {
    const card = [...document.querySelectorAll('button')].find(b => /Study$/.test(b.textContent.trim()) && !/AI|Plan/.test(b.textContent));
    if (!card) return false; card.click(); return true;
  })()`);
  check(!!studyBtn, 'Study button clicked');
  await sleep(2500);

  check(await waitFor("document.querySelector('[data-testid=ask-ai-book]') && !document.body.innerText.includes(\"Couldn't open the PDF pages\")"), 'reader plan opens without PDF failure');
  check(await waitFor("/\\u{1F4C4}\\s*3\\s*pages/u.test(document.body.innerText)", 20000), 'plan shows the exact page count (3 pages)');
  check(await waitFor("document.body.innerText.includes('Chapter 1: Introduction to PDF Testing')"), 'sidebar has detected chapter section');
  check(await waitFor("document.body.innerText.includes('Chapter 2: Classes and Objects')"), 'sidebar has second chapter section');

  await evalJs(`[...document.querySelectorAll('button')].find(b => /Start studying/i.test(b.textContent)).click()`);
  const painted = `(() => { const c = document.querySelector('[data-testid=pdf-canvas]'); if (!c || c.width < 200) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let dark = 0; for (let i = 0; i < d.length; i += 400) if (d[i] < 180) dark++; return dark > 5; })()`;
  check(await waitFor("location.hash !== undefined && document.querySelector('[data-testid=pdf-canvas]')"), 'read phase shows the rendered page canvas');
  check(await waitFor(painted, 20000), 'page canvas is actually painted (not blank)');
  check(await waitFor("/\\u{1F4C4}\\s*1\\/3/u.test(document.body.innerText)"), 'chip shows exact absolute page 1/3');

  await evalJs(`[...document.querySelectorAll('button')].find(b => /^Next/.test(b.textContent.trim())).click()`);
  check(await waitFor("/\\u{1F4C4}\\s*2\\/3/u.test(document.body.innerText)"), 'next page moves to exact page 2/3');
  check(await waitFor(painted, 15000), 'second page canvas painted');

  await evalJs(`document.querySelector('[data-testid=ask-ai-book]').click()`);
  check(await waitFor("location.hash.includes('/student/learn')"), 'Ask AI opens the AI tutor');
  check(await waitFor("localStorage.getItem('ssa_book_ctx')"), 'book context saved');
  const ctx = await evalJs(`JSON.parse(localStorage.getItem('ssa_book_ctx') || 'null')`);
  check(!!ctx && ctx.hasText === true, 'AI context hasText=true (AI can read the book)');
  check(!!ctx && /Object-Oriented/.test(ctx.text || ''), 'AI context contains page text (Object-Oriented)');
  check(!!ctx && /Classes and Objects/.test(ctx.text || ''), 'AI context contains later page text (Classes and Objects)');
  check(!!ctx && (ctx.sections || []).some(s => /Chapter 1/.test(s)), 'AI context section labels include chapters');

  console.log('js errors: ' + errs.length + (errs.length ? ' :: ' + errs.join(' | ') : ''));
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `FAILED ${failed}/${results.length}` : `ALL ${results.length} PDF-READER CHECKS PASSED`);
  chrome.kill();
  process.exit(failed || errs.length ? 1 : 0);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
