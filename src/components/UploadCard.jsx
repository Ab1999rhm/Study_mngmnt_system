import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { store } from '../data/store.js';
import StudyReader from './StudyReader.jsx';

const ICONS = { book: '📕', material: '📝', video: '🎬', library: '📚', test: '🧪', exam: '📋' };

export default function UploadCard({ item, user, onPay }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [study, setStudy] = useState(false);
  const allowed = store.hasAccess(user, item);
  const semi = item.fileData ? item.fileData.indexOf(';') : -1;
  const mime = item.fileData && item.fileData.startsWith('data:') && semi > 5 ? item.fileData.slice(5, semi) : '';
  const isImg = mime.startsWith('image/');
  const isVid = mime.startsWith('video/');
  const isAud = mime.startsWith('audio/');
  const isPdf = mime === 'application/pdf';
  const isTxt = mime.startsWith('text/');
  const typeOk = ['book', 'material', 'library'].includes(item.type);
  const studyable = typeOk && (!!item.body || isImg || isPdf || isTxt);
  const kind = studyable ? 'study' : item.fileData ? 'file' : item.link ? 'link' : item.body ? 'body' : 'empty';

  const me = store.currentUser() || user;
  const sp = me && me.progress && me.progress['study:' + item.id];
  const reviewDue = !!(sp && sp.completedAt && sp.nextReview && Date.parse(sp.nextReview) <= Date.now());

  const openIt = () => {
    if (studyable) { setStudy(true); return; }
    if (item.fileData) { setViewer(true); return; }
    if (item.link) { window.open(item.link, '_blank'); return; }
    setOpen(o => !o);
  };

  const btnLabel =
    kind === 'study' ? '📖 ' + t('study')
      : kind === 'file' ? '📎 ' + t('openItem')
        : kind === 'link' ? t('openItem') + ' ↗'
          : open ? '− ' + t('back')
            : '📖 ' + t('openItem');

  return (
    <div className="subject-card">
      <div className="ico">{ICONS[item.type] || '📦'}</div>
      <h3 style={{ fontSize: 15 }}>{item.title}</h3>
      <p style={{ fontSize: 13 }}>
        {item.subject ? item.subject + ' · ' : ''}
        {item.grade === 'all' ? t('all') : item.grade === 'remedial' ? t('remedial') : t('grade' + item.grade)}
        {item.fileName ? ' · 📎' : ''}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {item.free
          ? <span className="chip info">{t('free')}</span>
          : allowed
            ? <span className="chip ok">✓ {t('unlocked')}</span>
            : <span className="chip warn">🔒 ETB {item.price}</span>}
        {reviewDue && <span className="chip warn">🔁 {t('reviewDue')}</span>}
      </div>
      {allowed ? (
        <button className="btn sm" style={{ marginTop: 12 }} onClick={openIt}>{btnLabel}</button>
      ) : (
        <button className="btn sm green" style={{ marginTop: 12 }} onClick={onPay}>🔒 {t('payToUnlock')}</button>
      )}
      {allowed && open && !item.fileData && !item.link && (
        item.body
          ? <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: '#334155', textAlign: 'left' }}>{item.body}</div>
          : <div style={{ marginTop: 12, fontSize: 13.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px' }}>
              ⚠ This item has no content yet — ask the school admin to add the notes, link, or file.
            </div>
      )}
      {study && createPortal(
        <StudyReader item={item} user={me} onClose={() => setStudy(false)} />,
        document.body
      )}
      {viewer && item.fileData && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
          onClick={() => setViewer(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 14, width: 'min(900px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
              <b style={{ fontSize: 14.5 }}>📎 {item.fileName || item.title}</b>
              <button className="btn ghost sm" onClick={() => setViewer(false)}>✕ {t('back')}</button>
            </div>
            {isPdf
              ? <iframe src={item.fileData} title={item.title} style={{ width: '100%', height: '70vh', border: 0, background: '#f8fafc' }} />
              : isImg
                ? <img src={item.fileData} alt={item.title} style={{ maxWidth: '100%', maxHeight: '70vh', margin: '0 auto', display: 'block', objectFit: 'contain' }} />
                : isVid
                  ? <video controls src={item.fileData} style={{ width: '100%', maxHeight: '70vh', background: '#000', display: 'block' }} />
                  : isAud
                    ? <audio controls src={item.fileData} style={{ width: 'calc(100% - 32px)', margin: '24px 16px', display: 'block' }} />
                    : (
                      <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 42, marginBottom: 8 }}>📄</div>
                        <b style={{ fontSize: 15 }}>{item.fileName || item.title}</b>
                        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0 0' }}>
                          This file type can't be previewed here — download it to open with a local app.
                        </p>
                      </div>
                    )}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <a className="btn sm" href={item.fileData} download={item.fileName || 'content'} style={{ textDecoration: 'none' }}>⬇ Download</a>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
