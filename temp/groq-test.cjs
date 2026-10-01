// Groq-primary / Pollinations-fallback / local-tier chain test for /api/ai
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DEV = { host: 'localhost', port: 5173 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function req(opts, body, timeout = 30000) {
  return new Promise((resolve, rej) => {
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r.setTimeout(timeout, () => { r.destroy(new Error('request timeout')); });
    r.on('error', rej);
    if (body != null) r.write(body);
    r.end();
  });
}

const results = [];
const check = (ok, label) => { results.push({ ok, label }); console.log((ok ? 'PASS ' : 'FAIL ') + label); };

const AI_BODY = JSON.stringify({
  messages: [
    { role: 'system', content: 'You are a tutor. Reply in one short sentence.' },
    { role: 'user', content: 'Say the word GROQOK and nothing else.' }
  ]
});

async function main() {
  // ---- Part A: dev server with real key -> Groq must answer ----
  const a = await req({ ...DEV, path: '/api/ai', method: 'POST', headers: { 'Content-Type': 'application/json' } }, AI_BODY);
  let aj = null; try { aj = JSON.parse(a.body); } catch {}
  check(a.status === 200, `A1 dev /api/ai responds 200 (got ${a.status})`);
  check(a.headers['x-ai-provider'] === 'groq', `A2 answered by groq (got ${a.headers['x-ai-provider'] || 'none'})`);
  check(!a.headers['x-ai-fallback'], 'A3 no fallback header on clean groq answer');
  check(!!aj && typeof aj.text === 'string' && aj.text.trim().length > 0, 'A4 non-empty text payload');
  check(!!aj && aj.provider === 'groq', `A5 body provider=groq (got ${aj && aj.provider})`);

  // validation paths
  const bad = await req({ ...DEV, path: '/api/ai', method: 'POST', headers: { 'Content-Type': 'application/json' } }, '{"nope":1}');
  check(bad.status === 400, `A6 bad body -> 400 (got ${bad.status})`);
  const get = await req({ ...DEV, path: '/api/ai', method: 'GET' }, null);
  check(get.status === 405, `A7 GET -> 405 (got ${get.status})`);

  // ---- key-leak checks ----
  let envLeak = false;
  try {
    const e = await req({ ...DEV, path: '/.env', method: 'GET' }, null, 5000);
    envLeak = e.status === 200 && e.body.includes('gsk_');
  } catch { envLeak = false; }
  check(!envLeak, 'A8 /.env not served with key (vite fs protection)');

  let srcLeak = false;
  const walk = dir => {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) { if (f !== 'node_modules' && f !== '.git' && f !== 'shots') walk(p); }
      else if (/\.(js|jsx|mjs|cjs|html|css|json)$/.test(f) && !p.includes('db.json') && !p.includes('data\\db')) {
        try { if (fs.readFileSync(p, 'utf8').includes('gsk_aner')) srcLeak = true; } catch {}
      }
    }
  };
  walk(path.join(__dirname, '..', 'src'));
  check(!srcLeak, 'A9 key absent from all src files');
  let distLeak = false;
  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    const walkDist = dir => {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walkDist(p);
        else { try { if (fs.readFileSync(p, 'utf8').includes('gsk_aner')) distLeak = true; } catch {} }
      }
    };
    walkDist(distDir);
  }
  check(!distLeak, 'A10 key absent from built dist');
  let cfgLeak = false;
  const idx = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
  cfgLeak = idx.includes('gsk_aner');
  check(!cfgLeak, 'A11 key absent from served html');

  // ---- Part B: spawn preview with an INVALID key -> must fall back to pollinations ----
  const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4174', '--strictPort'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore',
    env: { ...process.env, GROQ_API_KEY: 'invalid_test_key_for_fallback' }
  });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    try { await req({ host: 'localhost', port: 4174, path: '/', method: 'GET' }, null, 2000); up = true; } catch { await sleep(500); }
  }
  check(up, 'B0 preview with invalid key started');
  if (up) {
    const b = await req({ host: 'localhost', port: 4174, path: '/api/ai', method: 'POST', headers: { 'Content-Type': 'application/json' } }, AI_BODY, 35000);
    let bj = null; try { bj = JSON.parse(b.body); } catch {}
    check(b.status === 200, `B1 invalid groq key still answers via fallback (got ${b.status})`);
    check(b.headers['x-ai-provider'] === 'pollinations', `B2 provider=pollinations (got ${b.headers['x-ai-provider'] || 'none'})`);
    check(/^groq_/.test(b.headers['x-ai-fallback'] || ''), `B3 fallback reason recorded (${b.headers['x-ai-fallback'] || 'none'})`);
    check(!!bj && typeof bj.text === 'string' && bj.text.trim().length > 0, 'B4 non-empty fallback text');
  }
  preview.kill();

  const fail = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - fail}/${results.length} passed`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
