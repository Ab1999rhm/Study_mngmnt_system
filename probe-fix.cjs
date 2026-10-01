// Diagnostic probe: register flow, sidebar responsiveness at all widths, AI lesson flow.
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9445;
const PROFILE = process.env.TEMP + '\\ssa-fix-' + Date.now();
const SHOTS = path.join(__dirname, 'shots');
const BASE = 'http://localhost:5173';

const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS);

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
  const chrome = spawn(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
    '--window-size=1440,900'
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = await httpReq('PUT', '/json/new?' + encodeURIComponent(BASE + '/')); } catch (e) { await sleep(250); }
  }
  if (!target || !target.webSocketDebuggerUrl) { console.log('FAIL no devtools'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let mid = 0;
  const pending = new Map();
  const jsErrors = [];
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data.toString());
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      jsErrors.push('EXC: ' + String((d.exception && d.exception.description) || d.text).split('\n')[0]);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      jsErrors.push('CON: ' + m.params.args.map(a => a.value || (a.description || '').split('\n')[0]).join(' ').slice(0, 300));
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++mid;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result && r.result.value;
  };
  const waitLoad = async () => {
    for (let i = 0; i < 200; i++) {
      if (await evalJs('document.readyState') === 'complete') return;
      await sleep(150);
    }
  };
  const goto = async (url, wait = 1500) => { await send('Page.navigate', { url }); await waitLoad(); await sleep(wait); };
  const waitFor = async (expr, ms = 15000) => {
    for (let i = 0; i < ms / 300; i++) {
      try { if (await evalJs(`!!(${expr})`)) return true; } catch (e) { /* retry */ }
      await sleep(300);
    }
    return false;
  };
  const setSize = (w, h, mobile) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  const shot = async name => { console.log('  shot ' + name + ' @ ' + await evalJs('location.hash')); 
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'));
  };
  const results = [];
  const check = (name, ok, info) => {
    results.push(ok);
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  [' + String(info).slice(0, 300) + ']'));
  };
  const errCount = () => jsErrors.length;

  await send('Page.enable');
  await send('Runtime.enable');

  // ================= A. REGISTER FLOW =================
  console.log('--- A. register flow ---');
  await setSize(1440, 900, false);
  // first boot with an empty database must show the setup wizard (no baked-in accounts)
  await goto(BASE + '/?user=probe#/', 2000);
  check('first boot: setup wizard shown', await evalJs("document.body.innerText.includes('First-time setup')"));
  await evalJs(`(() => {
    const d = JSON.parse(localStorage.getItem('ssa_db_v1') || '{"users":[]}');
    d.users = d.users || [];
    d.users.push({ id: 'adm_probe', role: 'admin', fullName: 'Probe Admin', email: 'probe.admin@test.et', password: 'pw123456', joinedAt: new Date().toISOString() });
    localStorage.setItem('ssa_db_v1', JSON.stringify(d));
    window.dispatchEvent(new StorageEvent('storage', { key: 'ssa_db_v1', newValue: JSON.stringify(d) }));
    return 1;
  })()`);
  check('first boot: wizard exits once an account exists', await waitFor("!document.body.innerText.includes('First-time setup')"));
  await goto(BASE + '/?user=probe#/auth', 2000);
  // poll for the form (cold vite transform can be slow)
  let formN = 0;
  for (let i = 0; i < 40 && formN < 4; i++) {
    formN = await evalJs(`document.querySelectorAll('.auth-card form input').length`);
    if (formN < 4) await sleep(700);
  }
  let reg = { hash: '', hasShell: false, sidebarLinks: 0, stats: 0, text: '' };
  check('register: auth form renders', formN >= 4, 'inputs=' + formN);
  if (formN < 4) {
    const dbg = await evalJs(`({ text: (document.body.innerText || '').slice(0, 300), hash: location.hash, ready: document.readyState })`);
    console.log('  auth page state: ' + JSON.stringify(dbg));
    console.log('  js errors: ' + jsErrors.join(' | ').slice(0, 600));
  } else {
  await evalJs(`(() => {
    const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    const by = ph => [...document.querySelectorAll('.auth-card form input')].find(i => i.placeholder === ph);
    set(by('Ayaan Ali'), 'Probe Student');
    set(by('Baro School'), 'Probe School');
    set(by('School Director'), 'Probe Director');
    set(by('you@school.et'), 'probe_' + Date.now() + '@test.et');
    set(by('••••••••'), 'pw123456');
    return 1;
  })()`);
  await sleep(500);
  const e0 = errCount();
  await evalJs(`(() => { const f = document.querySelector('.auth-card form'); f.requestSubmit ? f.requestSubmit() : f.querySelector('button[type=submit]').click(); return 1; })()`);
  await sleep(3000);
  const regRaw = await evalJs(`({
    hash: location.hash,
    hasShell: !!document.querySelector('.shell'),
    sidebarLinks: document.querySelectorAll('.sidebar a').length,
    stats: document.querySelectorAll('.stat').length,
    text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 220)
  })`);
  reg = regRaw;
  check('register: lands on student page', reg.hash.includes('/student') && reg.hasShell && reg.stats > 0, JSON.stringify(reg));
  check('register: no js errors', errCount() === e0, jsErrors.slice(e0).join(' | ').slice(0, 400));
  await shot('01-after-register-desktop');
  }

  if (reg.hash.includes('/student') && reg.hasShell) {
    // registered user on phone: drawer
    await setSize(375, 810, true);
    await sleep(800);
    const regPhone = await evalJs(`(() => {
      const b = document.querySelector('.nav-burger');
      const s = document.querySelector('.sidebar');
      return { burger: getComputedStyle(b).display, side: getComputedStyle(s).position, tf: getComputedStyle(s).transform,
        overflow: document.documentElement.scrollWidth - 375 };
    })()`);
    check('register: phone drawer mode', regPhone.burger !== 'none' && regPhone.side === 'fixed' && regPhone.overflow <= 0, JSON.stringify(regPhone));
    await evalJs(`document.querySelector('.nav-burger').click()`);
    await sleep(700);
    const regOpen = await evalJs(`Math.round(document.querySelector('.sidebar').getBoundingClientRect().left)`);
    check('register: phone drawer opens', regOpen === 0, 'left=' + regOpen);
    await shot('02-after-register-phone-drawer');
    // logout for clean state
    await evalJs(`(() => { const a = [...document.querySelectorAll('.sidebar a')].find(x => /logout/i.test(x.textContent)); if (a) a.click(); return 1; })()`);
    await sleep(1200);

    // ---- landing login button → login mode (not register) ----
    await goto(BASE + '/?user=probe#/', 1500);
    const loginHref = await evalJs(`(() => { const a = document.querySelector('a[href="#/auth?mode=login"]'); return a ? a.getAttribute('href') : null; })()`);
    check('landing: login link targets login mode', loginHref === '#/auth?mode=login', String(loginHref));
    await evalJs(`(() => { const a = document.querySelector('a[href="#/auth?mode=login"]'); if (a) a.click(); return 1; })()`);
    await waitFor('document.querySelectorAll(".auth-card form input").length === 2');
    await sleep(300);
    const lm = await evalJs(`({
      hash: location.hash,
      inputs: document.querySelectorAll('.auth-card form input').length,
      hasName: !!([...document.querySelectorAll('.auth-card input')].find(i => i.placeholder === 'Ayaan Ali')),
      h2: (document.querySelector('.auth-card h2') || {}).textContent || ''
    })`);
    check('login button opens login form', lm.hash.includes('mode=login') && lm.inputs === 2 && !lm.hasName && /log/i.test(lm.h2), JSON.stringify(lm));

    // admin credentials end-to-end
    const eA = errCount();
    await evalJs(`(() => {
      const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
      const ins = document.querySelectorAll('.auth-card form input');
      set(ins[0], 'probe.admin@test.et');
      set(ins[1], 'pw123456');
      const f = document.querySelector('.auth-card form');
      f.requestSubmit ? f.requestSubmit() : f.querySelector('button[type=submit]').click();
      return 1;
    })()`);
    await sleep(2500);
    const adm = await evalJs(`({
      hash: location.hash,
      stats: document.querySelectorAll('.stat').length,
      sidebar: !!document.querySelector('.sidebar'),
      err: (document.querySelector('.note-box') || {}).textContent || ''
    })`);
    check('admin email+password log into admin dashboard', adm.hash.includes('/admin') && adm.sidebar && adm.stats >= 4, JSON.stringify(adm));
    check('admin login: no js errors', errCount() === eA, jsErrors.slice(eA).join(' | ').slice(0, 300));
  } else {
    check('register: phone drawer mode', false, 'skipped - register failed');
    check('register: phone drawer opens', false, 'skipped - register failed');
  }

  // ================= B. SIDEBAR RESPONSIVENESS (admin) =================
  console.log('--- B. sidebar responsive (admin) ---');
  const ADMIN = BASE + '/seed-test.html?user=adm_t#/admin';
  for (const [w, label] of [[1440, 'desktop'], [1200, 'laptop'], [1024, 'edge-1024']]) {
    await setSize(w, 900, false);
    await goto(ADMIN, 1600);
    if (!await waitFor('document.querySelector(".sidebar")')) { check('sidebar ' + label + ' visible column', false, 'sidebar never rendered'); continue; }
    const g = await evalJs(`(() => {
      const s = document.querySelector('.sidebar'), m = document.querySelector('.main'), b = document.querySelector('.nav-burger');
      const sr = s.getBoundingClientRect(), mr = m.getBoundingClientRect(), cs = getComputedStyle(s);
      return { w: Math.round(sr.width), l: Math.round(sr.left), h: Math.round(sr.height), pos: cs.position,
        tf: cs.transform, vis: cs.visibility, op: cs.opacity, overflowY: cs.overflowY,
        links: s.querySelectorAll('a').length, grp: s.querySelectorAll('.grp').length,
        burger: getComputedStyle(b).display, mainL: Math.round(mr.left),
        hOverflow: document.documentElement.scrollWidth - window.innerWidth,
        scrollable: s.scrollHeight > 0 };
    })()`);
    const ok = g.w >= 240 && g.l === 0 && g.burger === 'none' && g.mainL >= g.w && g.hOverflow <= 0 && g.tf === 'none' && g.links >= 5;
    check(`sidebar ${label} visible column`, ok, JSON.stringify(g));
    await shot('10-admin-' + label);
  }

  // tablet 900 -> drawer
  await setSize(900, 1000, false);
  await goto(ADMIN, 1600);
  await waitFor('document.querySelector(".sidebar") && document.querySelector(".nav-burger")');
  const t900 = await evalJs(`(() => {
    const s = document.querySelector('.sidebar'), b = document.querySelector('.nav-burger');
    return { burger: getComputedStyle(b).display, pos: getComputedStyle(s).position,
      left: Math.round(s.getBoundingClientRect().left), vw: window.innerWidth,
      hOverflow: document.documentElement.scrollWidth - window.innerWidth };
  })()`);
  check('tablet 900: burger + hidden drawer', t900.burger !== 'none' && t900.left < 0 && t900.hOverflow <= 0, JSON.stringify(t900));
  await evalJs(`document.querySelector('.nav-burger').click()`);
  await sleep(700);
  const tOpen = await evalJs(`Math.round(document.querySelector('.sidebar').getBoundingClientRect().left)`);
  check('tablet 900: drawer opens', tOpen === 0, 'left=' + tOpen);
  await shot('11-admin-tablet-drawer-900');

  // phone 375 admin
  await setSize(375, 810, true);
  await goto(ADMIN, 1600);
  await waitFor('document.querySelector(".sidebar") && document.querySelector(".nav-burger")');
  const p375 = await evalJs(`(() => {
    const s = document.querySelector('.sidebar');
    return { left: Math.round(s.getBoundingClientRect().left), burger: getComputedStyle(document.querySelector('.nav-burger')).display,
      hOverflow: document.documentElement.scrollWidth - 375,
      mainPad: getComputedStyle(document.querySelector('.main')).paddingTop };
  })()`);
  check('phone 375 admin: drawer hidden + no overflow', p375.left < 0 && p375.burger !== 'none' && p375.hOverflow <= 0, JSON.stringify(p375));
  await shot('12-admin-phone-375');
  await evalJs(`document.querySelector('.nav-burger').click()`);
  await sleep(700);
  await shot('13-admin-phone-drawer-375');

  // ================= C. AI LESSON FLOW =================
  console.log('--- C. AI flow (student) ---');
  await setSize(1440, 900, false);
  const STUD = BASE + '/seed-test.html?user=stu_test#/student/learn';
  const e1 = errCount();
  await goto(STUD, 2200);
  await waitFor('document.querySelector(".ai-banner")');
  const ai1 = await evalJs(`({
    banner: !!document.querySelector('.ai-banner'),
    cards: document.querySelectorAll('.subject-card').length,
    iframe: !!document.querySelector('iframe'),
    points: ((document.body.innerText.match(/(\\d+)\\s*Points/) || [])[1]) || '0',
    text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 160)
  })`);
  check('AI: subject list renders', ai1.banner && ai1.cards >= 3, JSON.stringify(ai1));
  await shot('20-ai-subjects');

  // enter first subject
  await evalJs(`document.querySelector('.subject-card').closest('a').click()`);
  await waitFor('document.querySelectorAll(".chapter-row").length > 0');
  await sleep(300);
  const ai2 = await evalJs(`({ chapters: document.querySelectorAll('.chapter-row').length, hash: location.hash })`);
  check('AI: chapter list renders', ai2.chapters >= 1, JSON.stringify(ai2));
  await shot('21-ai-chapters');

  // start first chapter
  await evalJs(`(() => { const b = [...document.querySelectorAll('.chapter-row .btn')][0]; b.click(); return 1; })()`);
  await waitFor('[...document.querySelectorAll("button")].some(b => /start lesson/i.test(b.textContent))');
  await sleep(300);
  const ai3 = await evalJs(`({
    banner: !!document.querySelector('.ai-banner'),
    buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).slice(0, 14),
    iframe: !!document.querySelector('iframe')
  })`);
  check('AI: lesson welcome renders', ai3.banner && ai3.buttons.some(x => /start lesson/i.test(x)), JSON.stringify(ai3));
  await shot('22-ai-welcome');

  // begin lesson
  await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(x => /start lesson/i.test(x.textContent)); b.click(); return 1; })()`);
  await waitFor('document.querySelectorAll(".subsection").length > 0');
  await sleep(300);
  const ai4 = await evalJs(`({
    subs: document.querySelectorAll('.subsection').length,
    buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).slice(0, 12)
  })`);
  check('AI: lesson subsections render', ai4.subs >= 1, JSON.stringify(ai4));
  await shot('23-ai-lessons');

  // to lesson quiz
  await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(x => !/back/i.test(x.textContent) && /quiz/i.test(x.textContent)); b.click(); return 1; })()`);
  await waitFor('!!document.querySelector(".quiz-q")');
  await sleep(300);
  const ai5 = await evalJs(`({
    quiz: !!document.querySelector('.quiz-q'),
    qtext: (document.querySelector('.qtext') || {}).textContent || '',
    opts: document.querySelectorAll('.opt').length,
    buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).slice(0, 12)
  })`);
  check('AI: lesson quiz renders', ai5.quiz && (ai5.opts > 0 || !!ai5.qtext), JSON.stringify(ai5));
  await shot('24-ai-quiz');

  // drive quiz: answer + next until result
  let driven = 0;
  for (let i = 0; i < 40 && driven === 0; i++) {
    const st = await evalJs(`(() => {
      if (document.querySelector('.result-box')) return { done: true };
      const opts = document.querySelectorAll('.opt');
      if (opts.length && !document.querySelector('.opt.sel')) { opts[0].click(); return { clicked: 'opt' }; }
      const inp = document.querySelector('.quiz-q input');
      if (inp && !inp.value) {
        const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        s.call(inp, 'test answer here'); inp.dispatchEvent(new Event('input', { bubbles: true }));
        return { clicked: 'input' };
      }
      const ta = document.querySelector('.quiz-q textarea');
      if (ta && !ta.value) {
        const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        s.call(ta, 'test answer words length'); ta.dispatchEvent(new Event('input', { bubbles: true }));
        return { clicked: 'textarea' };
      }
      const sel = document.querySelector('.quiz-q select');
      if (sel && !sel.value) {
        const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        const o = [...sel.options].find(x => x.value);
        s.call(sel, o.value); sel.dispatchEvent(new Event('change', { bubbles: true }));
        return { clicked: 'select' };
      }
      const navBtn = [...document.querySelectorAll('button')].find(b => !b.disabled && /^(next|→|submit|finish)/i.test(b.textContent.trim()));
      if (navBtn) { navBtn.click(); return { clicked: 'nav:' + navBtn.textContent.trim() }; }
      const fin = [...document.querySelectorAll('button')].find(b => /finish/i.test(b.textContent));
      if (fin) { fin.click(); return { clicked: 'finish' }; }
      return { stuck: true, text: (document.querySelector('.result-box') ? 'result' : document.body.innerText.slice(0, 120)) };
    })()`);
    if (st.done || st.stuck) { if (st.stuck) check('AI: quiz drive progress', false, JSON.stringify(st)); break; }
    await sleep(350);
  }
  await sleep(800);
  const ai6 = await evalJs(`({
    result: !!document.querySelector('.result-box'),
    resultText: (document.querySelector('.result-box') || {}).innerText || '',
    buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).slice(0, 12)
  })`);
  check('AI: quiz completes to result', ai6.result, JSON.stringify(ai6));
  await shot('25-ai-quiz-result');

  // finish → next stage (exam or remediate)
  await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(x => /finish/i.test(x.textContent)); if (b) b.click(); return 1; })()`);
  await sleep(1500);
  const ai7 = await evalJs(`({
    exam: document.body.innerText.includes('/ 40') || document.querySelectorAll('.quiz-q').length > 0,
    remediate: !!document.querySelector('.note-box.anim-pop'),
    text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 200),
    buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).slice(0, 10)
  })`);
  check('AI: routes to exam or remediation after quiz', ai7.exam || ai7.remediate, JSON.stringify(ai7));
  await shot('26-ai-after-quiz');

  // continue (if remediated) → chapter exam
  if (!ai7.exam) {
    await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(x => /continue/i.test(x.textContent)); if (b) b.click(); return 1; })()`);
    await waitFor('!!document.querySelector(".quiz-q")');
    await sleep(300);
  }
  const ai8 = await evalJs(`({
    quiz: !!document.querySelector('.quiz-q'),
    count: (document.body.innerText.match(/Question \\d+ \\/ \\d+/) || [''])[0],
    title: (document.querySelector('h2') || {}).textContent || ''
  })`);
  check('AI: chapter exam opens', ai8.quiz && /40/.test(ai8.count), JSON.stringify(ai8));
  await shot('27-ai-exam');

  // drive the 40-question exam to its result
  let examDone = false;
  for (let i = 0; i < 500 && !examDone; i++) {
    const st = await evalJs(`(() => {
      if (document.querySelector('.result-box')) return { done: true };
      const opts = document.querySelectorAll('.opt');
      if (opts.length && !document.querySelector('.opt.sel')) { opts[0].click(); return { clicked: 'opt' }; }
      const inp = document.querySelector('.quiz-q input');
      if (inp && !inp.value) {
        const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        s.call(inp, 'test answer here'); inp.dispatchEvent(new Event('input', { bubbles: true }));
        return { clicked: 'input' };
      }
      const ta = document.querySelector('.quiz-q textarea');
      if (ta && !ta.value) {
        const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        s.call(ta, 'test answer words length'); ta.dispatchEvent(new Event('input', { bubbles: true }));
        return { clicked: 'textarea' };
      }
      const sel = document.querySelector('.quiz-q select');
      if (sel && !sel.value) {
        const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        const o = [...sel.options].find(x => x.value);
        s.call(sel, o.value); sel.dispatchEvent(new Event('change', { bubbles: true }));
        return { clicked: 'select' };
      }
      const navBtn = [...document.querySelectorAll('button')].find(b => !b.disabled && /^(next|→|submit|finish)/i.test(b.textContent.trim()));
      if (navBtn) { navBtn.click(); return { clicked: 'nav:' + navBtn.textContent.trim() }; }
      return { stuck: true, text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 140) };
    })()`);
    if (st.done) { examDone = true; break; }
    if (st.stuck) { check('AI: exam drives forward', false, JSON.stringify(st)); break; }
    await sleep(160);
  }
  check('AI: exam reaches result', examDone, 'examDone=' + examDone);
  await shot('28-ai-exam-result');

  // finish → completion screen
  await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(x => /finish/i.test(x.textContent)); if (b) b.click(); return 1; })()`);
  await sleep(1500);
  const ai9 = await evalJs(`({
    ok: !!document.querySelector('.result-box.ok'),
    points: (document.body.innerText.match(/(\\d+)\\s*Points/) || [])[1] || '',
    text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 160)
  })`);
  check('AI: chapter completion screen', ai9.ok, JSON.stringify(ai9));
  await shot('29-ai-completed');

  // points must be live in the header after the lesson (no navigation needed)
  const ptsMid = await evalJs(`((document.body.innerText.match(/(\\d+)\\s*Points/) || [])[1]) || '0'`);
  check('AI: header points update live', Number(ptsMid) > Number(ai1.points), ai1.points + ' -> ' + ptsMid);

  check('AI: no js errors', errCount() === e1, jsErrors.slice(e1).join(' | ').slice(0, 600));

  // ================= D. ADMIN STUDENT MANAGEMENT =================
  console.log('--- D. admin student mgmt ---');
  const eD = errCount();
  await setSize(1440, 900, false);
  await goto(BASE + '/seed-test.html?user=adm_t#/admin/students', 2400);
  await waitFor('document.querySelectorAll(".data tbody tr").length > 0');
  const d1 = await evalJs(`({
    noAdd: !document.body.innerText.includes('Add student'),
    rows: document.querySelectorAll('.data tbody tr').length
  })`);
  check('admin: Add student button removed', d1.noAdd && d1.rows > 0, JSON.stringify(d1));

  const stuTarget = await evalJs(`(() => {
    try {
      const db = JSON.parse(localStorage.getItem('ssa_db_v1'));
      const s = db.users.find(u => u.role === 'student' && !u.packageOpen) || db.users.find(u => u.role === 'student');
      return s ? { id: s.id, name: s.fullName, email: s.email, pw: s.password, pkg: !!s.packageOpen } : null;
    } catch (e) { return null; }
  })()`);
  check('admin: unpaid student found in db', !!stuTarget, JSON.stringify(stuTarget));

  await evalJs(`(() => {
    const b = [...document.querySelectorAll('.data tbody td b')].find(x => x.textContent.trim() === ${JSON.stringify(stuTarget.name)});
    if (b) b.click();
    return !!b;
  })()`);
  await waitFor('[...document.querySelectorAll("button")].some(b => /reset password/i.test(b.textContent))');
  const d2 = await evalJs(`(() => {
    const rb = [...document.querySelectorAll('button')].find(b => /reset password/i.test(b.textContent));
    const modal = rb && rb.closest('div[style*="position: fixed"]');
    const scope = modal || document;
    return {
      found: !!rb,
      fields: scope.querySelectorAll('input, select, textarea').length,
      save: [...scope.querySelectorAll('button')].some(b => /save/i.test(b.textContent)),
      name: document.body.innerText.includes(${JSON.stringify(stuTarget.name)})
    };
  })()`);
  check('admin: detail modal is read-only', d2.found && d2.fields === 0 && !d2.save && d2.name, JSON.stringify(d2));

  // admin reset → approves request (student sets own password), password untouched
  await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(b => /reset password/i.test(b.textContent)); b.click(); return 1; })()`);
  await sleep(700);
  const dFlash = await evalJs(`(document.querySelector('.note-box') || {}).textContent || ''`);
  check('admin: reset flash says student sets own password', /set a new password/i.test(dFlash), dFlash.slice(0, 200));
  const dRst = await evalJs(`(() => {
    const db = JSON.parse(localStorage.getItem('ssa_db_v1'));
    const u = db.users.find(x => x.id === ${JSON.stringify(stuTarget.id)});
    const rr = (db.resetRequests || []).find(x => x.studentId === u.id && x.status === 'approved');
    return { pwUnchanged: u.password === ${JSON.stringify(stuTarget.pw)}, approved: !!rr };
  })()`);
  check('admin: reset approved, password untouched', dRst.pwUnchanged && dRst.approved, JSON.stringify(dRst));

  // open package -> persisted (modal gates the button behind a pending payment request).
  // inject the request into localStorage, reload so the store re-reads it, reopen the modal, click.
  await evalJs(`(() => {
    const db = JSON.parse(localStorage.getItem('ssa_db_v1'));
    db.payRequests = db.payRequests || [];
    db.payRequests.push({ id: 'pr_probe_' + Date.now(), studentId: ${JSON.stringify(stuTarget.id)}, plan: 'full', planLabel: 'Full access — all content', price: 1000, status: 'pending', at: new Date().toISOString() });
    localStorage.setItem('ssa_db_v1', JSON.stringify(db));
    return 1;
  })()`);
  await goto(BASE + '/?user=probe#/admin/students', 2200);
  await waitFor('document.body.innerText.includes("Export CSV")');
  await evalJs(`(() => {
    const b = [...document.querySelectorAll('.data tbody td b')].find(x => x.textContent.trim() === ${JSON.stringify(stuTarget.name)});
    if (b) b.click();
    return !!b;
  })()`);
  await waitFor('[...document.querySelectorAll("button")].some(b => /reset password/i.test(b.textContent))');
  await evalJs(`(() => {
    const rb = [...document.querySelectorAll('button')].find(b => /reset password/i.test(b.textContent));
    const modal = rb && rb.closest('div[style*="position: fixed"]');
    const b = [...(modal || document).querySelectorAll('button')].find(b => /open package/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(700);
  const pkgAfter = await evalJs(`(() => {
    const u = JSON.parse(localStorage.getItem('ssa_db_v1')).users.find(u => u.id === ${JSON.stringify(stuTarget.id)});
    return { pkg: !!u.packageOpen, exp: u.packageExpires };
  })()`);
  check('admin: open package persisted for student', pkgAfter.pkg === true && !!pkgAfter.exp, JSON.stringify(pkgAfter));
  await shot('30-admin-detail-readonly');

  // close modal, logout, student uses Forgot password to choose a new password
  await evalJs(`(() => { const b = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '200'); if (b) b.click(); return !!b; })()`);
  await sleep(500);
  await evalJs(`(() => { const a = [...document.querySelectorAll('.sidebar a')].find(x => /logout/i.test(x.textContent)); if (a) a.click(); return !!a; })()`);
  await sleep(1500);
  await goto(BASE + '/?user=probe#/', 1200);
  await goto(BASE + '/?user=probe#/auth?mode=login', 1500);
  await waitFor('document.querySelectorAll(".auth-card form input").length === 2');
  await evalJs(`(() => { const b = [...document.querySelectorAll('.auth-card button')].find(x => /forgot password/i.test(x.textContent)); if (b) b.click(); return !!b; })()`);
  try { await waitFor('document.body.innerText.includes("Send reset request")'); } catch (e) {}
  await evalJs(`(() => {
    const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    const ins = document.querySelectorAll('.auth-card form input');
    set(ins[0], ${JSON.stringify(stuTarget.email)});
    const f = document.querySelector('.auth-card form');
    f.requestSubmit ? f.requestSubmit() : f.querySelector('button[type=submit]').click();
    return 1;
  })()`);
  try { await waitFor('document.body.innerText.includes("Choose a new password")'); } catch (e) { await sleep(600); }
  const dStage = await evalJs(`({
    setForm: document.body.innerText.includes('Choose a new password'),
    editable: [...document.querySelectorAll('.auth-card form input')].filter(i => !i.disabled).length,
    confirm: [...document.querySelectorAll('.auth-card form input')].some(i => /confirm/i.test(((i.closest('.field') || {}).textContent) || ''))
  })`);
  check('student: forgot flow shows set-password form', dStage.setForm && dStage.editable === 2 && dStage.confirm, JSON.stringify(dStage));
  await evalJs(`(() => {
    const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    const ins = [...document.querySelectorAll('.auth-card form input')].filter(i => !i.disabled);
    set(ins[0], 'NewPass456');
    set(ins[1], 'NewPass456');
    const f = document.querySelector('.auth-card form');
    f.requestSubmit ? f.requestSubmit() : f.querySelector('button[type=submit]').click();
    return ins.length;
  })()`);
  await sleep(3000);
  const stuAfter = await evalJs(`({
    hash: location.hash,
    active: document.body.innerText.includes('Package Active'),
    locked: document.body.innerText.includes('Package Locked'),
    shell: !!document.querySelector('.shell'),
    pw: (() => { try { return JSON.parse(localStorage.getItem('ssa_db_v1')).users.find(u => u.id === ${JSON.stringify(stuTarget.id)}).password; } catch (e) { return '?'; } })()
  })`);
  check('student: lands on dashboard after setting new password', stuAfter.shell && stuAfter.hash.includes('/student'), JSON.stringify(stuAfter));
  check('student: header shows Package Active after admin opens package', stuAfter.active && !stuAfter.locked, JSON.stringify(stuAfter));
  check('student: new password persisted as bcrypt hash', String(stuAfter.pw).startsWith('$2') && stuAfter.pw !== 'NewPass456', 'pw=' + String(stuAfter.pw).slice(0, 12) + '…');
  await shot('31-student-after-admin-actions');
  check('admin mgmt: no js errors', errCount() === eD, jsErrors.slice(eD).join(' | ').slice(0, 500));

  // ================= E. STUDENT STUDIES UPLOADED CONTENT =================
  console.log('--- E. student study reader ---');
  const eE = errCount();
  await setSize(1440, 900, false);
  await goto(BASE + '/seed-test.html?user=stu_test#/student/materials', 2200);
  try { await waitFor('document.body.innerText.includes("Test Notes")'); } catch (e) {}
  const eCard = await evalJs(`(() => {
    const c = [...document.querySelectorAll('.subject-card')].find(x => x.textContent.includes('Test Notes'));
    return {
      found: !!c,
      freeChip: !!c && c.textContent.includes('Free'),
      studyBtn: !!c && [...c.querySelectorAll('button')].some(b => /study/i.test(b.textContent))
    };
  })()`);
  check('student: note card shows Free chip + Study button', eCard.found && eCard.freeChip && eCard.studyBtn, JSON.stringify(eCard));
  await evalJs(`(() => {
    const c = [...document.querySelectorAll('.subject-card')].find(x => x.textContent.includes('Test Notes'));
    const b = [...c.querySelectorAll('button')].find(b => /study/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(700);
  const ePlan = await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const txt = ov ? ov.textContent : '';
    return {
      overlay: !!ov,
      plan: /study plan/i.test(txt),
      sections: txt.includes('sections'),
      start: !!ov && [...ov.querySelectorAll('button')].some(b => /start studying/i.test(b.textContent)),
      methods: txt.includes('Page-by-page') && txt.includes('Capture in mind')
    };
  })()`);
  check('study: plan screen shows structure + methods', ePlan.overlay && ePlan.plan && ePlan.sections && ePlan.start && ePlan.methods, JSON.stringify(ePlan));
  await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const b = ov && [...ov.querySelectorAll('button')].find(b => /start studying/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(500);
  const eRead = await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const txt = ov ? ov.textContent : '';
    return {
      content: txt.includes('Notes body.'),
      pager: txt.includes('Page 1/1'),
      next: !!ov && [...ov.querySelectorAll('button')].some(b => /next|finish section/i.test(b.textContent))
    };
  })()`);
  check('study: read phase shows content page-by-page', eRead.content && eRead.pager && eRead.next, JSON.stringify(eRead));
  await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const b = ov && [...ov.querySelectorAll('button')].find(b => /next|finish section/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(500);
  const eCap = await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const txt = ov ? ov.textContent : '';
    return {
      capture: txt.includes('Capture in mind'),
      keys: txt.includes('Notes body.'),
      confirm: !!ov && [...ov.querySelectorAll('button')].some(b => /captured these/i.test(b.textContent)),
      recall: txt.includes('Hide & recall')
    };
  })()`);
  check('study: capture-in-mind step shows key points', eCap.capture && eCap.keys && eCap.confirm && eCap.recall, JSON.stringify(eCap));
  await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const b = ov && [...ov.querySelectorAll('button')].find(b => /captured these/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(500);
  const eExplain = await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const txt = ov ? ov.textContent : '';
    return {
      explain: txt.includes('Self-explanation'),
      textarea: !!ov && !!ov.querySelector('textarea'),
      conf: !!ov && [...ov.querySelectorAll('button')].some(b => /clearly understand/i.test(b.textContent))
    };
  })()`);
  check('study: self-explanation step with confidence', eExplain.explain && eExplain.textarea && eExplain.conf, JSON.stringify(eExplain));
  await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const b = ov && [...ov.querySelectorAll('button')].find(b => /clearly understand/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(250);
  await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const b = ov && [...ov.querySelectorAll('button')].find(b => /save & continue/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(700);
  const eDone = await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const txt = ov ? ov.textContent : '';
    let prog = null;
    try {
      const db = JSON.parse(localStorage.getItem('ssa_db_v1'));
      const u = db.users.find(x => x.id === 'stu_test');
      prog = u && u.progress ? u.progress['study:up_t3'] : null;
    } catch (e) {}
    return {
      done: txt.includes('Book completed'),
      review: txt.includes('Review due'),
      progress: !!(prog && prog.completedAt && prog.nextReview && prog.done && prog.done.length)
    };
  })()`);
  check('study: completion saved with spaced review date', eDone.done && eDone.review && eDone.progress, JSON.stringify(eDone));
  await shot('32-study-reader');
  check('study reader: no js errors', errCount() === eE, jsErrors.slice(eE).join(' | ').slice(0, 400));

  // ---- image/screenshot uploads must open in the study reader ----
  await evalJs(`(() => {
    const db = JSON.parse(localStorage.getItem('ssa_db_v1'));
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    db.uploads.push({ id: 'up_img', type: 'material', title: 'Screenshot Book', subject: 'English', grade: 'all', link: '',
      body: 'A short description of the screenshot.', fileName: 'notes.png', fileData: png, price: 0, free: true, createdAt: new Date().toISOString() });
    db.uploads.push({ id: 'up_img2', type: 'material', title: 'Image Only Note', subject: 'English', grade: 'all', link: '',
      body: '', fileName: 'shot2.png', fileData: png, price: 0, free: true, createdAt: new Date().toISOString() });
    localStorage.setItem('ssa_db_v1', JSON.stringify(db));
    return db.uploads.length;
  })()`);
  await send('Page.reload');
  await sleep(600);
  try { await waitLoad(); } catch (e) { /* context torn down mid-reload */ }
  await sleep(1500);
  await waitFor('document.body.innerText.includes("Screenshot Book")', 8000);
  const eImgCard = await evalJs(`(() => {
    const cards = [...document.querySelectorAll('.subject-card')];
    const c1 = cards.find(x => x.textContent.includes('Screenshot Book'));
    const c2 = cards.find(x => x.textContent.includes('Image Only Note'));
    return {
      c1: !!c1 && [...c1.querySelectorAll('button')].some(b => /study/i.test(b.textContent)),
      c2: !!c2 && [...c2.querySelectorAll('button')].some(b => /study/i.test(b.textContent))
    };
  })()`);
  check('study: image cards show Study button', eImgCard.c1 && eImgCard.c2, JSON.stringify(eImgCard));
  await evalJs(`(() => {
    const c = [...document.querySelectorAll('.subject-card')].find(x => x.textContent.includes('Screenshot Book'));
    const b = c && [...c.querySelectorAll('button')].find(b => /study/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(700);
  const eImgPlan = await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const txt = ov ? ov.textContent : '';
    return { plan: /study plan/i.test(txt), two: txt.includes('2 sections'), file: txt.includes('notes.png') };
  })()`);
  check('study: plan lists the uploaded file as its own section', eImgPlan.plan && eImgPlan.two && eImgPlan.file, JSON.stringify(eImgPlan));
  await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const b = ov && [...ov.querySelectorAll('button')].find(b => /start studying/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(500);
  const eImgRead = await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const img = ov && ov.querySelector('img');
    return { img: !!img, data: !!(img && String(img.src).startsWith('data:image')), page: !!(ov && ov.textContent.includes('Page 1/1')) };
  })()`);
  check('study: read phase displays the uploaded image itself', eImgRead.img && eImgRead.data && eImgRead.page, JSON.stringify(eImgRead));
  await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const b = ov && [...ov.querySelectorAll('button')].find(b => /finish section/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(500);
  const eImgCap = await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const txt = ov ? ov.textContent : '';
    return { cap: txt.includes('Capture in mind'), fallback: txt.includes('Look away from the screen') };
  })()`);
  check('study: capture step guides recall for file sections', eImgCap.cap && eImgCap.fallback, JSON.stringify(eImgCap));
  await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const b = ov && [...ov.querySelectorAll('button')].find(b => /captured these/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(500);
  const eImgExp = await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const txt = ov ? ov.textContent : '';
    return { exp: txt.includes('Self-explanation'), ta: !!(ov && ov.querySelector('textarea')) };
  })()`);
  check('study: file section goes to self-explanation without questions', eImgExp.exp && eImgExp.ta, JSON.stringify(eImgExp));
  await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const b = ov && [...ov.querySelectorAll('button')].find(b => /clearly understand/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(250);
  await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const b = ov && [...ov.querySelectorAll('button')].find(b => /save & continue/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(600);
  const eImgS2 = await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '240');
    const txt = ov ? ov.textContent : '';
    return { desc: txt.includes('A short description of the screenshot.'), sec2: txt.includes('2/2') };
  })()`);
  check('study: after the file comes the written description section', eImgS2.desc && eImgS2.sec2, JSON.stringify(eImgS2));
  await shot('35-study-image');
  check('image study: no js errors', errCount() === eE, jsErrors.slice(eE).join(' | ').slice(0, 400));

  // ================= F. UPLOAD TYPES + OPEN PACKAGE ONLY AFTER REQUEST =================
  console.log('--- F. upload types + open-package gate ---');
  const fF = errCount();

  await goto(BASE + '/seed-test.html?user=adm_t#/admin/uploads', 2400);
  await waitFor('document.body.innerText.includes("Upload new content")');
  const fAcc = await evalJs(`(() => {
    const i = document.querySelector('input[type=file]');
    return {
      has: !!i,
      video: !!i && i.accept.includes('video'),
      doc: !!i && i.accept.includes('docx'),
      audio: !!i && i.accept.includes('audio')
    };
  })()`);
  check('upload: file input accepts video/docs/audio', fAcc.has && fAcc.video && fAcc.doc && fAcc.audio, JSON.stringify(fAcc));

  await goto(BASE + '/?user=probe#/admin/students', 2200);
  await waitFor('document.body.innerText.includes("Export CSV")');
  const fStu = await evalJs(`(() => {
    const db = JSON.parse(localStorage.getItem('ssa_db_v1'));
    const prs = db.payRequests || [];
    const s = (db.users || []).find(u => u.role === 'student' && !u.packageOpen
      && !prs.some(r => r.studentId === u.id && r.status === 'pending'));
    return s ? { id: s.id, name: s.fullName } : null;
  })()`);
  check('gate: student without package/request found', !!fStu, JSON.stringify(fStu));

  await evalJs(`(() => {
    const b = [...document.querySelectorAll('.data tbody td b')].find(x => x.textContent.trim() === ${JSON.stringify(fStu.name)});
    if (b) b.click();
    return !!b;
  })()`);
  await waitFor('[...document.querySelectorAll("button")].some(b => /reset password/i.test(b.textContent))');
  const fBefore = await evalJs(`(() => {
    const rb = [...document.querySelectorAll('button')].find(b => /reset password/i.test(b.textContent));
    const modal = rb && rb.closest('div[style*="position: fixed"]');
    const scope = modal || document;
    const btns = [...scope.querySelectorAll('button')].map(b => b.textContent.trim());
    return {
      openBtn: btns.some(x => /open package/i.test(x)),
      closeBtn: btns.some(x => /close package/i.test(x)),
      hint: (scope.textContent || '').includes('No payment request yet')
    };
  })()`);
  check('gate: Open Package hidden in modal before any request', !fBefore.openBtn && !fBefore.closeBtn && fBefore.hint, JSON.stringify(fBefore));

  await goto(BASE + '/seed-test.html?user=' + fStu.id + '#/student/store', 2400);
  await waitFor('document.body.innerText.includes("My payment requests")');
  const fStore = await evalJs(`(() => {
    const txt = document.body.innerText;
    return {
      guide: txt.includes('How to pay') && txt.includes('+251 91 111 2233'),
      noCode: !txt.includes('Enter your access code') && !txt.includes('Redeem'),
      payBtns: [...document.querySelectorAll('button')].filter(b => /pay fee/i.test(b.textContent)).length
    };
  })()`);
  check('gate: store shows step-by-step guide, no code UI', fStore.guide && fStore.noCode && fStore.payBtns >= 1, JSON.stringify(fStore));
  await evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find(b => /pay fee/i.test(b.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(500);
  const fGuide = await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '220');
    const btns = ov ? [...ov.querySelectorAll('button')].map(b => b.textContent.trim()) : [];
    return { open: !!ov, paid: btns.some(x => /i have paid/i.test(x)), steps: !!ov && /telebirr/i.test(ov.innerText || '') };
  })()`);
  check('gate: Pay fee opens step-by-step payment guide', fGuide.open && fGuide.paid && fGuide.steps, JSON.stringify(fGuide));
  await evalJs(`(() => {
    const ov = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '220');
    const b = ov && [...ov.querySelectorAll('button')].find(x => /i have paid/i.test(x.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(700);
  const fReq = await evalJs(`(() => {
    const db = JSON.parse(localStorage.getItem('ssa_db_v1'));
    const r = (db.payRequests || []).filter(r => r.studentId === ${JSON.stringify(fStu.id)});
    const sel = r.filter(x => x.plan === 'full' && x.status === 'pending' && x.packageId === 'pk_month');
    return { sel: sel.length === 1, count: r.length };
  })()`);
  check('gate: payment request created for the SELECTED package', fReq.sel, JSON.stringify(fReq));

  await evalJs(`localStorage.setItem('ssa_session_v1', ${JSON.stringify('adm_t')})`);
  await goto(BASE + '/?user=probe#/admin/students', 2200);
  await waitFor('document.body.innerText.includes("Export CSV")');
  await evalJs(`(() => {
    const b = [...document.querySelectorAll('.data tbody td b')].find(x => x.textContent.trim() === ${JSON.stringify(fStu.name)});
    if (b) b.click();
    return !!b;
  })()`);
  await waitFor('[...document.querySelectorAll("button")].some(b => /reset password/i.test(b.textContent))');
  const fAfter = await evalJs(`(() => {
    const rb = [...document.querySelectorAll('button')].find(b => /reset password/i.test(b.textContent));
    const modal = rb && rb.closest('div[style*="position: fixed"]');
    const scope = modal || document;
    return { openBtn: [...scope.querySelectorAll('button')].some(b => /open package/i.test(b.textContent)) };
  })()`);
  check('gate: Open Package appears in modal after request', fAfter.openBtn, JSON.stringify(fAfter));

  await evalJs(`(() => {
    const rb = [...document.querySelectorAll('button')].find(b => /reset password/i.test(b.textContent));
    const modal = rb && rb.closest('div[style*="position: fixed"]');
    const b = [...(modal || document).querySelectorAll('button')].find(x => /open package/i.test(x.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(700);
  const fPkg = await evalJs(`(() => {
    const db = JSON.parse(localStorage.getItem('ssa_db_v1'));
    const u = db.users.find(u => u.id === ${JSON.stringify(fStu.id)});
    const reqs = (db.payRequests || []).filter(r => r.studentId === u.id);
    return {
      pkg: !!u.packageOpen, exp: !!u.packageExpires,
      plan: u.packagePlan && u.packagePlan.id,
      noPendFull: reqs.every(r => !(r.plan === 'full' && r.status === 'pending')),
      selOk: reqs.some(r => r.status === 'approved' && r.plan === 'full' && r.packageId === 'pk_month')
    };
  })()`);
  check('gate: modal opens ONLY selected package + request approved (no pending)', fPkg.pkg && fPkg.exp && fPkg.plan === 'pk_month' && fPkg.noPendFull && fPkg.selOk, JSON.stringify(fPkg));
  await shot('33-open-package-gate');

  await evalJs(`localStorage.setItem('ssa_session_v1', ${JSON.stringify(fStu.id)})`);
  await goto(BASE + '/?user=' + fStu.id + '#/student/store', 2200);
  await waitFor('document.body.innerText.includes("My payment requests")');
  const fSide = await evalJs(`(() => {
    const txt = document.body.innerText;
    return {
      active: txt.includes('Package Active'),
      approved: txt.includes('Approved'),
      payBtns: [...document.querySelectorAll('button')].filter(b => /pay fee/i.test(b.textContent)).length
    };
  })()`);
  check('gate: student sees selected package active + request approved', fSide.active && fSide.approved && fSide.payBtns === 1, JSON.stringify(fSide));

  await evalJs(`localStorage.setItem('ssa_session_v1', ${JSON.stringify('adm_t')})`);
  await goto(BASE + '/?user=probe#/admin/students', 2200);
  await waitFor('document.body.innerText.includes("Export CSV")');
  await evalJs(`(() => {
    const b = [...document.querySelectorAll('.data tbody td b')].find(x => x.textContent.trim() === ${JSON.stringify(fStu.name)});
    if (b) b.click();
    return !!b;
  })()`);
  await waitFor('[...document.querySelectorAll("button")].some(b => /close package/i.test(b.textContent))');
  await evalJs(`(() => {
    const rb = [...document.querySelectorAll('button')].find(b => /reset password/i.test(b.textContent));
    const modal = rb && rb.closest('div[style*="position: fixed"]');
    const b = [...(modal || document).querySelectorAll('button')].find(x => /close package/i.test(x.textContent));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(600);
  const fClosed = await evalJs(`(() => {
    const db = JSON.parse(localStorage.getItem('ssa_db_v1'));
    const u = db.users.find(u => u.id === ${JSON.stringify(fStu.id)});
    return { pkg: u.packageOpen === false, exp: u.packageExpires == null, plan: !u.packagePlan };
  })()`);
  check('gate: admin Close package clears package in db', fClosed.pkg && fClosed.exp && fClosed.plan, JSON.stringify(fClosed));

  await evalJs(`localStorage.setItem('ssa_session_v1', ${JSON.stringify(fStu.id)})`);
  await goto(BASE + '/?user=' + fStu.id + '#/student/store', 2200);
  await waitFor('document.body.innerText.includes("My payment requests")');
  const fClosedSide = await evalJs(`(() => {
    const txt = document.body.innerText;
    return {
      locked: txt.includes('Package Locked'),
      active: txt.includes('Package Active'),
      payBtns: [...document.querySelectorAll('button')].filter(b => /pay fee/i.test(b.textContent)).length
    };
  })()`);
  check('gate: close reaches student side (locked, both rows Pay fee)', fClosedSide.locked && !fClosedSide.active && fClosedSide.payBtns === 2, JSON.stringify(fClosedSide));
  await shot('33b-close-reaches-student');
  check('upload gate: no js errors', errCount() === fF, jsErrors.slice(fF).join(' | ').slice(0, 400));

  // summary
  const fails = results.filter(ok => !ok).length;
  console.log(`\n${results.length - fails} passed, ${fails} failed`);
  if (jsErrors.length) console.log('\nJS errors seen:\n' + jsErrors.map(e => '  ' + e).join('\n').slice(0, 3000));
  console.log('screenshots in ' + SHOTS);
  try { ws.close(); } catch (e) {}
  chrome.kill();
  try { fs.rmSync(PROFILE, { recursive: true, force: true, maxRetries: 3 }); } catch (e) {}
  process.exit(fails ? 1 : 0);
}
main().catch(e => { console.error('PROBE ERROR', e); process.exit(1); });

