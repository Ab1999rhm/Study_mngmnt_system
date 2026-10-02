const mem = {};
globalThis.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; }
};
const { default: i18n } = await import('../src/i18n.js');
let bad = 0;
for (const lng of ['en', 'om', 'am', 'so']) {
  for (const key of ['upNeedContent', 'upNeedQuestions']) {
    const v = i18n.t(key, { lng });
    const en = i18n.t(key, { lng: 'en' });
    const ok = v && v !== key && (lng === 'en' || v !== en);
    if (!ok) { bad++; console.log('FAIL', lng, key, '=>', JSON.stringify(v)); }
    else console.log('ok  ', lng, key, '=>', String(v).slice(0, 60));
  }
}
console.log(bad ? `BAD ${bad}` : 'new keys: all 4 languages green');
process.exit(bad ? 1 : 0);