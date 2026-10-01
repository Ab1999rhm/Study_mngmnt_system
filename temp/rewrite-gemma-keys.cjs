const fs = require('fs');
const P = 'src/i18n.js';
const NEW_DESC = {
  en: 'Ask about any term, chapter, exam or study tip - answers come straight from your SSA curriculum and work offline.',
  om: 'Yeroo, barniiffa, imtiihaan yookaan gorsa barachuunii gaafadhu - deebiin barnoota SSA keessaa kennee, offline ni shaqisa.',
  am: 'ግልባጭ፣ ምዕራፍ፣ ፈተናወይም የመማር ምክር ጠይቅ — መልሱ ከሥርዓተት ልሙድዎ ይመጣልና ከመስመር ውጭ ይሰራል።',
  so: 'Weydii erey, bab, imtixaan ama talo waxbarasho - jawaabta waxbarashadaada SSA ka timid oo shaqeysa offline.'
};
const TUTPH = {
  en: 'Ask about a term, chapter, exam…',
  om: 'Yeroo, barniiffa, imtiihaan gaafi…',
  am: 'ግልባጭ፣ ምዕራፍ ወይም ፈተና ጠይቅ…',
  so: 'Weydii erey, bab ama imtixaan…'
};
const ORDER = ['en', 'om', 'am', 'so'];
const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const lines = fs.readFileSync(P, 'utf8').split(/\r?\n/);
const idx = [];
lines.forEach((l, i) => { if (/^\s*gemmaDesc: /.test(l)) idx.push(i); });
if (idx.length !== 4) { console.error('expected 4 gemmaDesc anchors, got ' + idx.length); process.exit(1); }

for (let b = idx.length - 1; b >= 0; b--) {
  const i = idx[b];
  const indent = (lines[i].match(/^\s*/) || [''])[0];
  const lang = ORDER[b];
  lines[i] = `${indent}gemmaDesc: '${esc(NEW_DESC[lang])}',`;
  lines.splice(i + 1, 0, `${indent}tutorPh: '${esc(TUTPH[lang])}',`);
}
fs.writeFileSync(P, lines.join('\n'));
console.log('gemmaDesc rewritten x4 + tutorPh inserted x4');
