const fs = require('fs');
const F = 'src/i18n.js';
let s = fs.readFileSync(F, 'utf8');
const fixes = [
  ['settingsAnnSub', 'student’s', "student's"],
  ['detailReadOnlySub', 'student’s', "student's"],
  ['cantPreview', 'can’t', "can't"]
];
let n = 0;
for (const [k, from, to] of fixes) {
  const re = new RegExp(`(\\b${k}: ')([^']*)(')`);
  s = s.replace(re, (m, a, b, c) => { n++; return a + b.split(from).join(to) + c; });
}
fs.writeFileSync(F, s);
console.log('fixed en values:', n, '(want 3)');
