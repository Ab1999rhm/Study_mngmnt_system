// admin upload form: PDF tip always visible; Office-file warning + converter links on pptx attach
const { spawn } = require('child_process');
const http = require('http');
const BASE = 'http://localhost:5173/seed-test.html';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9458;
const PROFILE = process.env.TEMP + '\\ssa-officehint-' + Date.now();
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
    try { target = await httpReq('PUT', '/json/new?' + encodeURIComponent(BASE + '?user=adm_t')); } catch (e) { await sleep(250); }
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

  await goto(BASE + '?user=adm_t#/admin/uploads');
  check(await waitFor("location.hash.includes('/admin/uploads') && document.body.innerText.includes('open directly in the app')"), 'uploads form shows the PDF tip');
  check(!(await evalJs("document.body.innerText.includes(\"can't be previewed in-app\")")), 'no Office warning before an Office file is attached');

  const tipLinks = await evalJs("[...document.querySelectorAll('a[target=\"_blank\"]')].map(a => a.href)");
  check(!tipLinks.some(h => h.includes('cloudconvert')), 'converter links hidden until needed');

  await evalJs(`(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'lesson.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
    const inp = document.querySelector('input[type=file]');
    Object.defineProperty(inp, 'files', { value: dt.files, configurable: true });
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  check(await waitFor("document.body.innerText.includes(\"can't be previewed in-app\")"), 'attaching .pptx shows the export-to-PDF warning');

  const hrefs = await evalJs("[...document.querySelectorAll('a[target=\"_blank\"]')].map(a => a.href)");
  check(hrefs.some(h => h.includes('cloudconvert.com/ppt-to-pdf')), 'CloudConvert converter link present');
  check(hrefs.some(h => h.includes('ilovepdf.com/powerpoint_to_pdf')), 'iLovePDF converter link present');

  check(await waitFor("document.body.innerText.includes('Visible to')"), 'grade select shows visible-to-N student count');
  await evalJs(`(() => {
    const sel = [...document.querySelectorAll('select')].find(s => s.querySelector('option[value="all"]') && s.querySelector('option[value="remedial"]'));
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, 'remedial');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  check(await waitFor("document.body.innerText.includes('No students in this grade')"), 'remedial (0 students) shows the nobody-will-see warning');
  await evalJs(`(() => {
    const sel = [...document.querySelectorAll('select')].find(s => s.querySelector('option[value="all"]') && s.querySelector('option[value="remedial"]'));
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, 'all');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  check(await waitFor("document.body.innerText.includes('Visible to 2 students')"), 'All grades counts both seeded students again');

  console.log('js errors: ' + errs.length + (errs.length ? ' :: ' + errs.join(' | ') : ''));
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `FAILED ${failed}/${results.length}` : `ALL ${results.length} OFFICE-HINT CHECKS PASSED`);
  chrome.kill();
  process.exit(failed || errs.length ? 1 : 0);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
