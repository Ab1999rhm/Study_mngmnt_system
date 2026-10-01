const fs = require('fs');
const F = 'src/i18n.js';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
// promptSetPw values were written with a raw newline inside single quotes -> replace with \n escape
s = s.replace(/(promptSetPw: ')([^'\n]*)\n([^'\n]*)(')/g, (m, a, b, c, d) => { n++; return a + b + '\\n' + c + d; });
// also fix the missed uploads table header
const A = 'src/AdminDashboard.jsx';
let a = fs.readFileSync(A, 'utf8');
let m = 0;
a = a.split('<th>Type</th>').join('<th>{t(\'typeLabel\')}</th>');
m = 0;
fs.writeFileSync(F, s);
fs.writeFileSync(A, a);
console.log('fixed newlines:', n, '(want 4)');
console.log('th Type remaining:', (a.split('<th>Type</th>').length - 1));
