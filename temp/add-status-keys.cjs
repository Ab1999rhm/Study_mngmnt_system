const fs = require('fs');
const F = 'src/i18n.js';
let s = fs.readFileSync(F, 'utf8');
const chunks = [
  "stActive: 'Active', stNeedsFollow: 'Needs follow-up', stNotStarted: 'Not started', needFollowUp: 'Need follow-up',",
  "stActive: 'Hirmaataa', stNeedsFollow: 'Hordofuu barbaachisu', stNotStarted: 'Ella hin dubbanne', needFollowUp: 'Hordofuu barbaachisa',",
  "stActive: '\u1273\u1203', stNeedsFollow: '\u1208\u12AB\u1218\u120B\u1320 \u1210\u1325\u134D \u12ED\u1308\u121E\u129D', stNotStarted: '\u12A0\u130D\u1208\u132D\u1218\u1203\u1308\u1325', needFollowUp: '\u1218\u122A\u1218\u1325\u1292 \u12ED\u1308\u121E\u129D',",
  "stActive: 'Firfirican', stNeedsFollow: 'Uubo u baahan yahay', stNotStarted: 'Weli furin', needFollowUp: 'Uubo baahan',"
];
let i = 0;
s = s.replace(/followUp:\s*'[^']*',/g, m => {
  if (i >= chunks.length) return m;
  return m + '\n  ' + chunks[i++];
});
if (i !== 4) { console.error('expected 4 followUp keys, replaced ' + i); process.exit(1); }
const keys = ['stActive', 'stNeedsFollow', 'stNotStarted', 'needFollowUp'];
for (const k of keys) {
  const n = (s.match(new RegExp('(?:^|[\\s{,])' + k + '\\s*:', 'gm')) || []).length;
  if (n !== 4) { console.error(k + ' count = ' + n + ' (want 4)'); process.exit(1); }
}
fs.writeFileSync(F, s);
console.log('inserted status keys x4 into all language blocks');
