import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { store } from '../data/store.js';
import { LangSwitch } from '../components/Lang.jsx';

export default function Setup({ onDone }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPw: '' });
  const [err, setErr] = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // if an existing database arrives while setup is open (sync pulled a deployed db),
  // abandon the wizard and go to the normal login screen
  useEffect(() => {
    const h = () => { if (!store.needsSetup()) onDone(); };
    window.addEventListener('ssa:db', h);
    return () => window.removeEventListener('ssa:db', h);
  }, [onDone]);

  const submit = e => {
    e.preventDefault();
    setErr('');
    if (form.password !== form.confirmPw) return setErr('Passwords do not match.');
    const r = store.createFirstAdmin(form);
    if (!r.ok) return setErr(r.error);
    onDone(r.user);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card anim-up">
        <div className="auth-top">
          <span className="auth-brand">
            <span className="auth-logo">🎓</span>
            <span className="auth-name">{t('appName')}</span>
          </span>
          <LangSwitch />
        </div>

        <h2>First-time setup</h2>
        <p className="sub">No accounts exist yet — create the school administrator account to begin.</p>

        <form onSubmit={submit}>
          <div className="field">
            <label>{t('fullName')}</label>
            <input value={form.fullName} onChange={set('fullName')} placeholder="System Admin" required />
          </div>
          <div className="field">
            <label>{t('email')}</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="admin@school.et" required />
          </div>
          <div className="field">
            <label>{t('password')}</label>
            <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
          </div>
          <div className="field">
            <label>Confirm password</label>
            <input type="password" value={form.confirmPw} onChange={set('confirmPw')} placeholder="••••••••" required />
          </div>

          {err && <div className="note-box" style={{ marginBottom: 14 }}>⚠ {err}</div>}

          <button className="btn" style={{ width: '100%' }} type="submit">Create admin account</button>
        </form>

        <p style={{ marginTop: 18, fontSize: 13.5, color: 'var(--muted)' }}>
          After setup you can add a school director and students from the dashboard.
        </p>
      </div>
    </div>
  );
}
