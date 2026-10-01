import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { store } from '../../data/store.js';
import UploadCard from '../../components/UploadCard.jsx';

export default function Store({ user }) {
  const { t } = useTranslation();
  const [msg, setMsg] = useState(null);
  const [guide, setGuide] = useState(null);
  const [tick, setTick] = useState(0);

  const uploads = store.uploads().filter(u => !u.hidden && store.gradeVisible(user, u));
  const requests = store.payRequests().filter(r => r.studentId === user.id);
  const pendingItemIds = new Set(requests.filter(r => r.status === 'pending').map(r => r.itemId));
  const packages = store.packages();
  const cheapestPkg = packages.length ? packages.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a)) : null;
  const phone = (store.settings().payPhone || '').trim();
  const bump = () => setTick(x => x + 1);

  const pay = item => {
    if (pendingItemIds.has(item.id)) { setMsg({ ok: true, text: t('requestSent') }); return; }
    setGuide({ label: item.title, price: item.price, plan: 'item', item });
  };

  const payFull = pkg => {
    const label = pkg ? pkg.name : (cheapestPkg ? cheapestPkg.name : 'Full access — all content');
    const price = pkg ? pkg.price : (cheapestPkg ? cheapestPkg.price : 0);
    const pending = requests.some(r => r.status === 'pending' && r.plan === 'full' && r.planLabel === label);
    if (pending) { setMsg({ ok: true, text: t('requestSent') }); return; }
    setGuide({ label, price, plan: 'full', pkg: pkg || null });
  };

  const confirmPay = () => {
    if (!guide) return;
    if (guide.plan === 'full') {
      store.createPayRequest(user.id, {
        plan: 'full', itemId: null, planLabel: guide.label, price: guide.price,
        packageId: guide.pkg ? guide.pkg.id : null,
        days: guide.pkg ? guide.pkg.days : null
      });
    } else {
      store.createPayRequest(user.id, { plan: 'item', itemId: guide.item.id, planLabel: guide.item.title, price: guide.item.price });
    }
    setGuide(null);
    setMsg({ ok: true, text: t('requestSent') });
    bump();
  };

  const activePkgId = user.packagePlan ? user.packagePlan.id : null;
  const rowActive = p => {
    if (!user.packageOpen) return false;
    if (activePkgId) return p.id === activePkgId;
    return !packages.length || p.id === packages[0].id;
  };

  return (
    <>
      <div className="note-box">🛒 <b>{t('store')}</b> — {t('storeSub')}</div>
      {phone ? (
        <div className="note-box" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
          💳 <b>{t('fee')}:</b> {t('payInstructions', { phone })}
        </div>
      ) : (
        <div className="note-box" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          ⚠️ {t('payPhoneMissing')}
        </div>
      )}

      {msg && (
        <div className="note-box anim-pop" style={msg.ok
          ? { background: '#d1fae5', borderColor: '#6ee7b7', color: '#065f46' }
          : { background: '#fee2e2', borderColor: '#fecaca', color: '#991b1b' }}>
          {msg.ok ? '✓ ' : '✕ '}{msg.text}
        </div>
      )}

      <div className="grid cols2 stagger" style={{ marginBottom: 22 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 12 }}>🔓 Full access</h3>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 12 }}>{t('storeSub')}</p>
          {packages.length === 0 && (
            <div className="empty" style={{ padding: 26 }}>
              <div className="ico">🧾</div>
              No package configured yet — ask the school admin to add one.
            </div>
          )}
          {packages.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <div>
                <b style={{ fontSize: 15 }}>{p.name}</b>
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{p.days ? p.days + ' ' + t('days') : '∞'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <b style={{ fontSize: 18 }}>ETB {p.price}</b>
                {rowActive(p)
                  ? <span className="chip ok">● {t('packageActive')}{user.packageExpires ? ' · ' + new Date(user.packageExpires).toLocaleDateString() : ''}</span>
                  : <button className="btn amber sm" onClick={() => payFull(p)}>{t('payNow')}</button>}
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 12 }}>📱 {t('payGuideTitle')}</h3>
          {!phone && (
            <div className="note-box" style={{ marginBottom: 12, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
              ⚠️ {t('payPhoneMissing')}
            </div>
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              t('payStep1', { amount: '…', phone }),
              t('payStep2'),
              t('payStep3'),
              t('payStep4')
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, lineHeight: 1.55 }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 99, background: '#0d9488', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h3 className="section-title">💳 {t('myRequests')}</h3>
      <div className="table-wrap" style={{ marginBottom: 24 }}>
        <table className="data">
          <thead>
            <tr><th>{t('name')}</th><th>{t('fee')}</th><th>{t('status')}</th><th>Date</th></tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id}>
                <td><b>{r.planLabel}</b></td>
                <td>ETB {r.price}</td>
                <td>
                  <span className={'chip ' + (r.status === 'approved' ? 'ok' : r.status === 'rejected' ? 'bad' : 'warn')}>
                    {r.status === 'approved' ? '✓ ' + t('approved') : r.status === 'rejected' ? '✕ ' + t('rejected') : '⏳ ' + t('pending')}
                  </span>
                </td>
                <td>{new Date(r.at).toLocaleDateString()}</td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: 26, color: 'var(--muted)' }}>{t('noRequests')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="section-title">🛒 {t('catalog')}</h3>
      <div className="grid cols3 stagger">
        {uploads.map(u => (
          <div key={u.id} style={{ position: 'relative' }}>
            <UploadCard item={u} user={user} onPay={() => pay(u)} />
            {pendingItemIds.has(u.id) && (
              <span className="chip warn" style={{ position: 'absolute', top: 10, right: 10 }}>⏳ {t('pending')}</span>
            )}
          </div>
        ))}
      </div>
      {uploads.length === 0 && <div className="empty"><div className="ico">🛒</div>{t('catalog')}</div>}
      <div style={{ height: 10 }} key={tick} />

      {guide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: 'min(460px, 100%)', padding: 22 }}>
            <h3 style={{ marginBottom: 2 }}>💳 {t('payGuideTitle')}</h3>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 4 }}>{guide.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand-700)', marginBottom: 14 }}>ETB {guide.price}</div>
            {!phone && (
              <div className="note-box" style={{ marginBottom: 12, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
                ⚠️ {t('payPhoneMissing')}
              </div>
            )}
            <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
              {[
                t('payStep1', { amount: guide.price, phone }),
                t('payStep2'),
                t('payStep3'),
                t('payStep4')
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.55 }}>
                  <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 99, background: '#0d9488', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800 }}>{i + 1}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn green" onClick={confirmPay}>✓ {t('iPaid')}</button>
              <button className="btn ghost" onClick={() => setGuide(null)}>✕ {t('back')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
