const fs = require('fs');
const F = 'temp/i18n-add.cjs';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
for (const key of ['duplicatedN', 'confirmDeleteUpload']) {
  s = s.replace(new RegExp(`(${key}: \\[[^\\n]*?)' "`), (m, a) => { n++; return a + `'"`; });
  // also 2nd/3rd translation slots in same line
  s = s.replace(new RegExp(`(${key}: \\[[^\\n]*?, )' "`), (m, a) => { n++; return a + `'"`; });
  s = s.replace(new RegExp(`(${key}: \\[[^\\n]*?, )' "`), (m, a) => { n++; return a + `'"`; });
}
fs.writeFileSync(F, s);
console.log('patched slots:', n, '(want 6)');
