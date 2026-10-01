import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n.js';

export const LANGS = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'om', label: 'Afaan Oromoo', flag: '🇪🇹' },
  { code: 'am', label: 'አማርኛ', flag: '🇪🇹' },
  { code: 'so', label: 'Af Soomaali', flag: '🇸🇴' }
];

export function LangSwitch() {
  const { i18n } = useTranslation();
  return (
    <div className="lang-switch">
      <select value={i18n.language} onChange={e => setLanguage(e.target.value)}>
        {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
      </select>
    </div>
  );
}