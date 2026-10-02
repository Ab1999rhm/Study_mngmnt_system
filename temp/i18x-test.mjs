import i18next from 'i18next';
const resources = {
  en: { translation: { hello: 'EN', upNeedContent: 'EN content' } },
  so: { translation: { hello: 'SO' } },
  upNeedContent: 'FLAT SO content',
  navGrpManagement: 'FLAT nav'
};
await i18next.init({ resources, lng: 'so', fallbackLng: 'en', interpolation: { escapeValue: false } });
console.log('hello =', i18next.t('hello'));
console.log('upNeedContent =', i18next.t('upNeedContent'));
console.log('navGrpManagement =', i18next.t('navGrpManagement'));
