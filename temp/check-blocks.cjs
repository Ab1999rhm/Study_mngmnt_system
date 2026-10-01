const fs = require('fs');
const t = fs.readFileSync('src/i18n.js', 'utf8');
const bounds = { en: [t.indexOf('const en'), t.indexOf('const om')], om: [t.indexOf('const om'), t.indexOf('const am')], am: [t.indexOf('const am'), t.indexOf('const so')], so: [t.indexOf('const so'), t.indexOf('export default')] };
const keys = ['navGrpManagement', 'navGrpStore', 'navGrpData', 'perGrade', 'joinedLabel', 'myAccount', 'approveOpen', 'promptSetPw', 'hintTextbook', 'noPayReqYet', 'typeExam', 'bulkUpdated'];
let bad = 0;
for (const k of keys) for (const [l, [a, z]] of Object.entries(bounds)) {
  if (!new RegExp(`(?:^|[\\s{,])${k}\\s*:`).test(t.slice(a, z))) { console.log(`MISSING ${k} in ${l}`); bad++; }
}
console.log(bad ? `BAD ${bad}` : 'all sampled keys present in all 4 blocks');
process.exit(bad ? 1 : 0);
