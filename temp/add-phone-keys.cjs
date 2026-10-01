const fs = require('fs');
const P = 'src/i18n.js';
const KEYS = {
  payPhoneMissing: {
    en: 'Payment number not configured yet — contact your school admin.',
    om: 'Lakkoofsa bilbii kaffaltii hin qophoofne — bulchaa barnootaa gaafadhu.',
    am: 'የክፍያ ስልክ ቁጥር አልተዘጋጀም — የትምህርት ቤቱ ሃላፊን አድርግ።',
    so: 'Lambarka biilashada waa la waayey — la taliyaha macallinka la xiriir.'
  },
  payPhoneAdminWarn: {
    en: 'No payment number saved yet — students cannot pay until you set one.',
    om: 'Barattonni biiluu hin dandaanu yoo lakkoofsa bilbii hin qabnu.',
    am: 'የክፍያ ስልክ ቁጥር አልተቀጠረም — እስከ አስተካክሉ ተማሪዎች መክፈል አይችሉም።',
    so: 'Lambarka biilashada lama kaydin — ardaydu ma bixin karaan ilaa aad dejiso.'
  }
};
const ORDER = ['en', 'om', 'am', 'so'];
const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const lines = fs.readFileSync(P, 'utf8').split(/\r?\n/);
const anchorIdx = [];
lines.forEach((l, i) => { if (/^\s*paymentPhone: /.test(l)) anchorIdx.push(i); });
if (anchorIdx.length !== 4) { console.error('expected 4 paymentPhone anchors, got ' + anchorIdx.length); process.exit(1); }

let inserted = 0;
for (let b = anchorIdx.length - 1; b >= 0; b--) {
  const i = anchorIdx[b];
  const indent = (lines[i].match(/^\s*/) || [''])[0];
  const lang = ORDER[b];
  const block = [];
  for (const k of Object.keys(KEYS)) {
    block.push(`${indent}${k}: '${esc(KEYS[k][lang])}',`);
    inserted++;
  }
  lines.splice(i + 1, 0, ...block);
}
fs.writeFileSync(P, lines.join('\n'));
console.log('inserted ' + inserted + ' lines after ' + anchorIdx.length + ' anchors');
