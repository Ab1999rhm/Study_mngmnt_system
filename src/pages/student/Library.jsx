import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { subjectsFor } from '../../data/content.js';
import { store } from '../../data/store.js';
import UploadCard from '../../components/UploadCard.jsx';

export default function Library({ user }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const subjects = subjectsFor(user.grade);
  const gradeLabel = user.grade === 'remedial' ? t('remedial') : t('grade' + user.grade);

  const adminBooks = store.uploads().filter(u =>
    (u.type === 'book' || u.type === 'library') && !u.hidden && store.gradeVisible(user, u) && u.title.toLowerCase().includes(q.toLowerCase())
  );

  const books = subjects.flatMap(s => s.chapters.map(c => ({
    subject: s.name,
    chapterIndex: c.index,
    title: `${s.name} — ${t('chapter')} ${c.index}: ${c.title}`,
    terms: c.terms.length
  }))).filter(b => b.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="field" style={{ maxWidth: 420 }}>
        <label>🔍 {t('search')}</label>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Mathematics, Grammar…" />
      </div>
      <div className="note-box">📚 {gradeLabel} library — books & chapter readers are cached on this device for offline reading.</div>
      {adminBooks.length > 0 && (
        <>
          <h3 className="section-title">🛒 {t('catalog')}</h3>
          <div className="grid cols3 stagger" style={{ marginBottom: 24 }}>
            {adminBooks.map(u => <UploadCard key={u.id} item={u} user={user} onPay={() => nav('/student/store')} />)}
          </div>
        </>
      )}
      <h3 className="section-title">📖 {t('library')}</h3>
      <div className="grid cols3 stagger">
        {books.map((b, i) => (
          <div className="subject-card" key={i}>
            <div className="ico">📕</div>
            <h3 style={{ fontSize: 15 }}>{b.title}</h3>
            <p>{b.terms} key terms · {t('offlineReady')}</p>
            <button className="btn sm" style={{ marginTop: 12 }} onClick={() => nav(`/student/learn/${encodeURIComponent(b.subject)}/${b.chapterIndex}`)}>{t('start')} →</button>
          </div>
        ))}
      </div>
      {books.length === 0 && <div className="empty"><div className="ico">🔍</div>No results</div>}
    </>
  );
}