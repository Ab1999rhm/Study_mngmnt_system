import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { store } from '../../data/store.js';
import UploadCard from '../../components/UploadCard.jsx';

export default function Library({ user }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const gradeLabel = user.grade === 'remedial' ? t('remedial') : t('grade' + user.grade);

  const books = store.uploads().filter(u =>
    (u.type === 'book' || u.type === 'library') && !u.hidden && store.gradeVisible(user, u) && u.title.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <div className="field" style={{ maxWidth: 420 }}>
        <label>🔍 {t('search')}</label>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Mathematics, Grammar…" />
      </div>
      <div className="note-box">📚 {gradeLabel} library — books uploaded by your school for offline reading · ✓ {t('offlineReady')}</div>
      <h3 className="section-title">📖 {t('library')}</h3>
      {books.length > 0 ? (
        <div className="grid cols3 stagger">
          {books.map(u => <UploadCard key={u.id} item={u} user={user} onPay={() => nav('/student/store')} />)}
        </div>
      ) : (
        <div className="empty" data-testid="library-empty">
          <div className="ico">{q ? '🔍' : '📭'}</div>
          {q ? 'No results' : t('noBooksYet')}
        </div>
      )}
    </>
  );
}
