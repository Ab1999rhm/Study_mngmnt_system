// Test localhost origin variants + GET with origin
const https = require('https');

function req(opts, body) {
  return new Promise(resolve => {
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ tag: opts.tag, status: res.statusCode, body: data.slice(0, 200) }));
    });
    r.on('error', e => resolve({ tag: opts.tag, error: e.message }));
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  const body = JSON.stringify({ messages: [{ role: 'user', content: 'Say OK' }] });
  const origins = [
    null,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://localhost',
    'http://myapp.local',
  ];
  for (const o of origins) {
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
    if (o) headers.Origin = o;
    const t = await req({ hostname: 'text.pollinations.ai', path: '/', method: 'POST', headers, tag: o || 'none' }, body);
    console.log(t.tag.padEnd(26), t.status ?? t.error, (t.body || '').slice(0, 80));
  }
})();
