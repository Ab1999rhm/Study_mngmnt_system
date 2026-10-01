const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PORT = 4178;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function get(p) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: p, method: 'GET' }, r => {
      let chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', rej);
    req.end();
  });
}

const results = [];
const check = (ok, label) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + label); };

async function main() {
  const preview = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT, stdio: 'ignore'
  });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    try { up = (await get('/')).status === 200; } catch { await sleep(500); }
  }
  if (!up) { console.log('FAIL preview did not start'); preview.kill(); process.exit(1); }

  // ── app shell ──
  const html = await get('/');
  check(html.status === 200, 'app shell served');
  const htmlText = html.body.toString('utf8');
  check(htmlText.includes('name="theme-color"'), 'theme-color meta present');
  check(htmlText.includes('apple-touch-icon'), 'apple-touch-icon link present');
  check(htmlText.includes('viewport'), 'viewport meta present');

  // ── manifest ──
  const mf = await get('/manifest.webmanifest');
  check(mf.status === 200, 'manifest served (' + mf.status + ')');
  check(String(mf.headers['content-type'] || '').includes('manifest'), 'manifest content-type: ' + mf.headers['content-type']);
  let man = null;
  try { man = JSON.parse(mf.body.toString('utf8')); } catch {}
  check(!!man, 'manifest parses as JSON');
  if (man) {
    check(man.name === 'SSA Learning Hub' && man.short_name === 'SSA Hub', 'manifest name/short_name');
    check(man.display === 'standalone', 'display standalone');
    check(typeof man.start_url === 'string' && man.start_url === '/', 'start_url is /');
    check(typeof man.scope === 'string' && man.scope === '/', 'scope is /');
    check(typeof man.id === 'string' && man.id === '/', 'stable manifest id');
    check(man.theme_color === '#1a56db', 'theme_color brand blue');
    const icons = Array.isArray(man.icons) ? man.icons : [];
    check(icons.some(i => i.sizes === '192x192' && i.type === 'image/png'), 'has 192x192 png icon');
    check(icons.some(i => i.sizes === '512x512' && i.type === 'image/png'), 'has 512x512 png icon');
    check(icons.some(i => String(i.purpose || '').includes('maskable')), 'has maskable icon');
    check(icons.some(i => String(i.purpose || '').includes('any')), 'has purpose any icon');

    // every manifest icon must be fetchable and a real PNG of the declared size
    for (const ic of icons) {
      const r = await get(ic.src);
      const buf = r.body;
      const isPng = buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      let w = 0, h = 0;
      if (isPng) { w = buf.readUInt32BE(16); h = buf.readUInt32BE(20); }
      check(r.status === 200 && isPng && `${w}x${h}` === ic.sizes, `icon ${ic.src} -> ${r.status} ${w}x${h} (${ic.sizes})`);
    }
  }

  // ── iOS icon ──
  const at = await get('/apple-touch-icon.png');
  check(at.status === 200 && at.body.length > 500 && at.body[1] === 0x50, 'apple-touch-icon.png serves a PNG');

  // ── service worker + precache ──
  const sw = await get('/sw.js');
  check(sw.status === 200, 'sw.js served');
  const swText = sw.body.toString('utf8');
  check(swText.includes('precacheAndRoute'), 'workbox precache SW');
  const reg = await get('/registerSW.js');
  check(reg.status === 200, 'registerSW.js served');
  check(reg.body.toString('utf8').includes('serviceWorker'), 'registerSW registers the SW');

  // ── install button wired into the bundle ──
  const assets = htmlText.match(/assets\/[^"]+\.js/g) || [];
  let bundleSrc = '';
  for (const a of assets) bundleSrc += (await get('/' + a)).body.toString('utf8');
  check(bundleSrc.includes('beforeinstallprompt'), 'bundle listens for beforeinstallprompt');
  check(bundleSrc.includes('install-pwa'), 'install button shipped in bundle');

  preview.kill();
  const failed = results.filter(r => !r).length;
  console.log(failed ? `FAILED ${failed}/${results.length}` : `ALL ${results.length} PWA-INSTALL CHECKS PASSED`);
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
