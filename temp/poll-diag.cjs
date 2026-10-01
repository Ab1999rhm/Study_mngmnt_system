// Diagnose pollinations 403-on-Origin behavior
const https = require('https');

function req(opts, body) {
  return new Promise(resolve => {
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({
        tag: opts.tag, status: res.statusCode,
        acao: res.headers['access-control-allow-origin'] || null,
        body: data.slice(0, 600)
      }));
    });
    r.on('error', e => resolve({ tag: opts.tag, error: e.message }));
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  const body = JSON.stringify({ messages: [{ role: 'user', content: 'Say OK' }] });
  const base = { hostname: 'text.pollinations.ai', path: '/', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };

  const tests = [];
  tests.push(await req({ ...base, tag: 'no-origin' }, body));
  tests.push(await req({ ...base, tag: 'origin-localhost', headers: { ...base.headers, Origin: 'http://localhost:5173' } }, body));
  tests.push(await req({ ...base, tag: 'origin-example', headers: { ...base.headers, Origin: 'https://example.com' } }, body));
  tests.push(await req({ ...base, tag: 'origin-null', headers: { ...base.headers, Origin: 'null' } }, body));

  for (const t of tests) {
    console.log('---', t.tag);
    if (t.error) console.log('ERR', t.error);
    else console.log('status=', t.status, 'acao=', t.acao);
    if (t.body) console.log('body=', JSON.stringify(t.body));
  }
})();
