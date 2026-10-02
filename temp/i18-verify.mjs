// Functional check: import the real src/i18n.js and verify Somali now resolves.
const mem = {};
globalThis.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; }
};
const { default: i18n } = await import('../src/i18n.js');

const cases = [
  ['so', 'navGrpManagement', 'Maamulidda'],
  ['so', 'upUploaded', null],        // just must NOT be the raw key / English
  ['so', 'noContentAttached', 'Waxyaabo lagu daray ma jiro'],
  ['so', 'partLabel', 'Qayb'],
  ['en', 'navGrpManagement', 'Management'],
  ['en', 'upQuestionNeed', null],
  ['om', 'navGrpManagement', null],
  ['am', 'navGrpManagement', null]
];
let bad = 0;
for (const [lng, key, expect] of cases) {
  const v = i18n.t(key, { lng });
  const isRaw = v === key;
  const isEn = lng !== 'en' && v === i18n.t(key, { lng: 'en' });
  let ok;
  if (expect != null) ok = v === expect;
  else if (lng === 'en') ok = !isRaw;
  else ok = !isRaw && !isEn;
  if (!ok) { bad++; console.log('FAIL', lng, key, '=>', JSON.stringify(v)); }
  else console.log('ok  ', lng, key, '=>', JSON.stringify(v).slice(0, 70));
}
console.log(bad ? `BAD ${bad}` : 'i18n functional: all green');
process.exit(bad ? 1 : 0);