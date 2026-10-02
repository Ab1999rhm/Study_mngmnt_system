// Dry-run analysis of the truncated `so` block in src/i18n.js:
// the so language tail sits as DEAD flat keys inside `resources`
// (i18next ignores them -> Somali falls back to English).
// Run: node temp/analyze-so.mjs        (read-only)
// Run: node temp/analyze-so.mjs --apply  (move flat keys into `const so`)
import fs from 'node:fs';

const FILE = 'src/i18n.js';
const t = fs.readFileSync(FILE, 'utf8');
const soStart = t.indexOf('const so = {');
const resStart = t.indexOf('const resources = {');
const savedIdx = t.indexOf('const saved');
if (soStart < 0 || resStart < 0 || savedIdx < 0) { console.error('anchors not found'); process.exit(1); }

const soBlock = t.slice(soStart, resStart);      // 'const so = {...};\n\n'
const resBlock = t.slice(resStart, savedIdx);    // 'const resources = {...};\n\n'
const marker = 'so: { translation: so },\n';
const flatStart = resBlock.indexOf(marker);
if (flatStart < 0) { console.error('so marker not found'); process.exit(1); }
const flatFrom = flatStart + marker.length;
const flatTo = resBlock.lastIndexOf('};');
const flat = resBlock.slice(flatFrom, flatTo);

const soClose = soBlock.lastIndexOf('};');
const soBody = soBlock.slice(0, soClose);
const keysOf = s => new Set([...s.matchAll(/(?:^|\n)  (\w+):/g)].map(m => m[1]));
const soKeys = keysOf(soBody);
const flatLines = flat.split('\n');
const flatKeys = flatLines.map(l => (l.match(/^  (\w+):/) || [])[1]).filter(Boolean);
const dupes = flatKeys.filter(k => soKeys.has(k));
const nonKey = flatLines.filter((l, i) => i < flatLines.length - 1 && !/^  \w+:/.test(l) && l !== '');

console.log('so block keys:', soKeys.size, '| flat keys:', flatKeys.length, '| flat lines:', flatLines.length);
console.log('flat non-key (continuation) lines:', nonKey.length ? JSON.stringify(nonKey.slice(0, 5)) : 'none');
console.log('duplicates (already in const so, will be DROPPED from flat):', dupes.length ? dupes.join(', ') : 'none');
console.log('flat first key:', flatKeys[0], '| flat last key:', flatKeys[flatKeys.length - 1]);
console.log('soBody last 60 chars:', JSON.stringify(soBody.slice(-60)));

if (!process.argv.includes('--apply')) { console.log('\n(dry run — pass --apply to move them)'); process.exit(0); }

const soKeysSet = soKeys;
const keptLines = flatLines.filter(l => {
  const m = l.match(/^  (\w+):/);
  return !(m && soKeysSet.has(m[1]));
});
const flatKept = keptLines.join('\n').replace(/\s+$/, '');
let body = soBody.replace(/\s+$/, '');
if (!body.endsWith(',')) body += ',';
const soNew = body + '\n' + flatKept + '\n};\n\n';
const resNew = resBlock.slice(0, flatFrom) + '};\n\n';
const out = t.slice(0, soStart) + soNew + resNew + t.slice(savedIdx);
fs.writeFileSync(FILE, out, 'utf8');
console.log('\napplied: moved', flatKeys.length - dupes.length, 'keys into const so; resources now only maps languages.');