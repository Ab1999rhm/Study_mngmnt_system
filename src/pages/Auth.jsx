import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { store } from '../data/store.js';
import { LangSwitch } from '../components/Lang.jsx';

export default function Auth({ onLogin }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [mode, setMode] = useState(() => {
    const m = new URLSearchParams(location.search).get('mode');
    return m === 'login' ? 'login' : m === 'forgot' ? 'forgot' : 'register';
  });
  const [stage, setStage] = useState('email');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [form, setForm] = useState({
    fullName: '', schoolName: '', directorName: '', grade: '8',
    email: '', password: ''
  });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // live status: when the admin approves the reset (any device/tab), advance without re-submitting
  const [, setTick] = useState(0);
  useEffect(() => {
    const h = () => {
      setTick(x => x + 1);
      if (mode === 'forgot' && stage === 'email' && note) {
        const r = store.requestPasswordReset((form.email || '').trim());
        if (r.ok && r.status === 'approved') {
          setNote('✅ Reset approved — choose your new password below.');
          setStage('set');
        }
      }
    };
    window.addEventListener('ssa:db', h);
    return () => window.removeEventListener('ssa:db', h);
  }, [mode, stage, note, form.email]);

  const submit = e => {
    e.preventDefault();
    setErr('');
    setNote('');
    if (mode === 'forgot') {
      const email = form.email.trim();
      if (stage === 'email') {
        const r = store.requestPasswordReset(email);
        if (!r.ok) return setErr('No account found with this email address.');
        if (r.status === 'approved') return setStage('set');
        return setNote('⏳ Request sent to the school admin — waiting for approval. Come back here after the admin allows the reset.');
      }
      if (form.password.length < 6) return setErr('Password must be at least 6 characters.');
      if (form.password !== confirmPw) return setErr('Passwords do not match.');
      const u = store.setResetPassword(email, form.password);
      if (!u) return setErr('Reset is no longer available — send the request again.');
      const logged = store.loginWithReason(email, form.password);
      if (!logged.user) return setErr(logged.reason === 'blocked' ? 'Your account has been blocked by the school admin. Contact the school to unblock it.' : 'Invalid email or password.');
      return onLogin(logged.user);
    }
    if (mode === 'login') {
      const r = store.loginWithReason(form.email.trim(), form.password);
      if (!r.user) {
        return setErr(r.reason === 'blocked'
          ? 'Your account has been blocked by the school admin. Contact the school to unblock it.'
          : 'Invalid email or password.');
      }
      return onLogin(r.user);
    }
    if (!form.fullName || !form.schoolName || !form.directorName) return setErr('Please fill in all fields.');
    if (String(form.password || '').length < 6) return setErr('Password must be at least 6 characters.');
    if (store.emailTaken(form.email)) return setErr('Email already registered.');
    const u = store.registerStudent({ ...form, email: form.email.trim() });
    if (!u) return setErr('Registration failed — please choose a password of at least 6 characters.');
    onLogin(u);
  };

  const goMode = m => { setErr(''); setNote(''); setStage('email'); setConfirmPw(''); setMode(m); };

  return (
    <div className="auth-wrap">
      <div className="auth-card anim-up">
        <div className="auth-top">
          <Link to="/" className="auth-brand">
            <span className="auth-logo">🎓</span>
            <span className="auth-name">{t('appName')}</span>
          </Link>
          <LangSwitch />
        </div>

        <h2>{mode === 'register' ? t('register') : mode === 'login' ? t('login') : t('forgotPassword')}</h2>
        <p className="sub">
          {mode === 'register' ? 'Create your personal learning dashboard'
            : mode === 'login' ? 'Access your dashboard'
            : stage === 'email' ? 'Enter your email to request a password reset'
            : 'Choose a new password'}
        </p>

        <form onSubmit={submit}>
            {mode === 'register' && (
              <>
                <div className="field">
                  <label>{t('fullName')}</label>
                  <input value={form.fullName} onChange={set('fullName')} placeholder="Ayaan Ali" required />
                </div>
                <div className="field">
                  <label>{t('schoolName')}</label>
                  <input value={form.schoolName} onChange={set('schoolName')} placeholder="Baro School" required />
                </div>
                <div className="field">
                  <label>{t('directorName')}</label>
                  <input value={form.directorName} onChange={set('directorName')} placeholder="School Director" required />
                </div>
                <div className="field">
                  <label>{t('selectGrade')}</label>
                  <select value={form.grade} onChange={set('grade')}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
                      <option key={g} value={g}>{t('grade' + g)}</option>
                    ))}
                    <option value="remedial">{t('remedial')}</option>
                  </select>
                </div>
              </>
            )}
            <div className="field">
              <label>{t('email')}</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="you@school.et" required disabled={mode === 'forgot' && stage === 'set'} />
            </div>
            {!(mode === 'forgot' && stage === 'email') && (
              <div className="field">
                <label>{mode === 'forgot' ? 'New password' : t('password')}</label>
                <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
              </div>
            )}
            {mode === 'forgot' && stage === 'set' && (
              <div className="field">
                <label>Confirm password</label>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••" required />
              </div>
            )}

            {err && <div className="note-box" style={{ marginBottom: 14 }}>⚠ {err}</div>}
            {note && <div className="note-box" style={{ marginBottom: 14, background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e40af' }}>{note}</div>}

            <button className="btn" style={{ width: '100%' }} type="submit">
              {mode === 'register' ? t('register')
                : mode === 'login' ? t('login')
                : stage === 'email' ? 'Send reset request'
                : 'Set new password'}
            </button>
          </form>

          {mode === 'forgot' ? (
            <p style={{ marginTop: 18, fontSize: 14, color: 'var(--muted)' }}>
              Remembered your password?{' '}
              <button
                style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 700, fontSize: 14 }}
                onClick={() => goMode('login')}
              >
                {t('login')}
              </button>
            </p>
          ) : (
            <p style={{ marginTop: 18, fontSize: 14, color: 'var(--muted)' }}>
              {mode === 'register' ? 'Already have an account?' : 'New here?'}{' '}
              <button
                style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 700, fontSize: 14 }}
                onClick={() => goMode(mode === 'register' ? 'login' : 'register')}
              >
                {mode === 'register' ? t('login') : t('register')}
              </button>
            </p>
          )}
          {mode === 'login' && (
            <p style={{ marginTop: 10, fontSize: 14, color: 'var(--muted)' }}>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 700, fontSize: 14 }}
                onClick={() => goMode('forgot')}
              >
                Forgot password?
              </button>
            </p>
          )}
      </div>
    </div>
  );
}
