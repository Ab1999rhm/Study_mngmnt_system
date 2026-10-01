import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function InstallPWA() {
  const { t } = useTranslation();
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) { setInstalled(true); return; }
    } catch { /* noop */ }
    const onPrompt = e => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const install = async () => {
    try {
      deferred.prompt();
      await deferred.userChoice;
    } catch { /* noop */ }
    setDeferred(null);
  };

  return (
    <button
      type="button"
      className="btn green sm"
      data-testid="install-pwa"
      onClick={install}
      style={{ position: 'fixed', right: 14, bottom: 14, zIndex: 500, boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}
    >
      ⬇ {t('installApp')}
    </button>
  );
}
