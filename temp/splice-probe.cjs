const fs = require('fs');
const file = 'probe-fix.cjs';
const startMarker = '  // ================= C. AI LESSON FLOW =================';
const endMarker = "  check('AI: no js errors', errCount() === e1, jsErrors.slice(e1).join(' | ').slice(0, 600));";

const src = fs.readFileSync(file, 'utf8');
const lines = src.split(/\r?\n/);
const s = lines.findIndex(l => l.trimEnd() === startMarker.trimEnd());
const e = lines.findIndex(l => l.trimEnd() === endMarker.trimEnd());
if (s < 0 || e < 0 || e <= s) { console.error('markers not found s=' + s + ' e=' + e); process.exit(1); }
const repl = fs.readFileSync('temp/probe-section-c.txt', 'utf8').replace(/\s*$/, '');
const out = [...lines.slice(0, s), repl, '', ...lines.slice(e)].join('\n');
fs.writeFileSync(file, out);
console.log('spliced lines ' + (s + 1) + '..' + e + ' -> section C updated');
