const fs = require('fs');
const F = 'src/i18n.js';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
// ensure a comma terminates the original last key line before each inserted block
s = s.replace(/([^\n,])\r?\n(\s*navGrpManagement: )/g, (m, before, ins) => { n++; return before + ',\n' + ins; });
fs.writeFileSync(F, s);
console.log('added missing commas:', n, '(want 4)');
fs.copyFileSync(F, 'temp/check-i18n.mjs');
const { execSync } = require('child_process');
try {
  execSync('node --check temp/check-i18n.mjs', { stdio: 'pipe' });
  console.log('parse OK');
} catch (e) {
  console.log('parse STILL BROKEN:\n' + String(e.stderr).split('\n').slice(0, 8).join('\n'));
  process.exit(1);
}
