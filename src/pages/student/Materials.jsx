import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { subjectsFor, buildSubsections } from '../../data/content.js';
import { store } from '../../data/store.js';
import UploadCard from '../../components/UploadCard.jsx';

export default function Materials({ user }) {
  const { t } = useTranslation();
  const subjects = subjectsFor(user.grade);
  const [open, setOpen] = useState(null);
  const nav = useNavigate();

  const notes = subjects.flatMap(s => s.chapters.map(c => ({ subject: s.name, chapter: c, subs: buildSubsections(c) })));
  const adminMats = store.uploads().filter(u => u.type === 'material' && !u.hidden && store.gradeVisible(user, u));

  return (
    <>
      <div className="note-box">📝 Learning materials / notes for {user.grade === 'remedial' ? t('remedial') : t('grade' + user.grade)} — tap a note to read. All notes work offline.</div>
      {adminMats.length > 0 && (
        <>
          <h3 className="section-title">🛒 {t('catalog')}</h3>
          <div className="grid cols3 stagger" style={{ marginBottom: 24 }}>
            {adminMats.map(u => <UploadCard key={u.id} item={u} user={user} onPay={() => nav('/student/store')} />)}
          </div>
        </>
      )}
      <h3 className="section-title">📝 {t('materials')}</h3>
      <div className="grid cols2 stagger">
        {notes.map((n, i) => (
          <div className="card" key={i} style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <b style={{ fontSize: 15 }}>{n.subject} — Ch {n.chapter.index}: {n.chapter.title}</b>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{n.subs.length} {t('subsections')} · {n.chapter.terms.length} terms</p>
              </div>
              <button className="btn sm ghost" onClick={() => setOpen(open === i ? null : i)}>
                {open === i ? '−' : '+'} {open === i ? t('back') : t('view')}
              </button>
            </div>
            {open === i && (
              <div style={{ marginTop: 14 }}>
                {n.subs.map((s, si) => (
                  <div key={si} style={{ marginBottom: 12 }}>
                    <b style={{ fontSize: 14, color: 'var(--purple)' }}>{s.title}</b>
                    <p style={{ fontSize: 14, lineHeight: 1.6, color: '#334155' }}>{s.body}</p>
                  </div>
                ))}
                <div style={{ background: 'var(--blue-light)', borderRadius: 10, padding: 12, fontSize: 13.5 }}>
                  <b>Key terms:</b> {n.chapter.terms.map(x => `${x[0]} — ${x[1]}`).join(' · ')}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}