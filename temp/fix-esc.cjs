const fs = require('fs');
const F = 'src/i18n.js';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
for (const [from, to] of [
  ["student's dashboard", "student\\'s dashboard"],
  ["student's account", "student\\'s account"],
  ["can't preview here", "can\\'t preview here"]
]) {
  const c = s.split(from).length - 1;
  n += c;
  s = s.split(from).join(to);
}
fs.writeFileSync(F, s);
console.log('escaped apostrophes:', n, '(want 3)');
fs.copyFileSync(F, 'temp/check-i18n.mjs');
const { execSync } = require('child_process');
try {
  execSync('node --check temp/check-i18n.mjs', { stdio: 'pipe' });
  console.log('parse OK');
} catch (e) {
  console.log('parse STILL BROKEN:\n' + String(e.stderr).split('\n').slice(0, 8).join('\n'));
  process.exit(1);
}
