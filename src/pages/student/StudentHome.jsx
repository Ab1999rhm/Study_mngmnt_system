import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell
} from 'recharts';
import { studentSubjects } from '../../data/curriculum.js';
import { nextStudyTarget, lastStudied, targetLabel } from '../../data/plan.js';
import { store } from '../../data/store.js';
import { Stat, ChartCard, PageHead } from '../../components/ui.jsx';

export default function StudentHome({ user }) {
  const { t } = useTranslation();
  const subjects = studentSubjects(user);
  const scores = user.scores || [];
  const totalQ = scores.reduce((a, s) => a + (s.total || 0), 0);
  const earned = scores.reduce((a, s) => a + (s.score || 0), 0);
  const pct = totalQ ? Math.round((earned / totalQ) * 100) : 0;
  const gradeLabel = user.grade === 'remedial' ? t('remedial') : t('grade' + user.grade);

  const trend = [...scores].slice(-8).map((s, i) => ({
    name: `#${i + 1}`,
    pct: Math.round((s.score / s.total) * 100)
  }));

  const bySubject = subjects.map(s => {
    const mine = scores.filter(r => r.subject === s.name);
    const q = mine.reduce((a, r) => a + r.total, 0);
    const sc = mine.reduce((a, r) => a + r.score, 0);
    return { name: s.name.length > 11 ? s.name.slice(0, 10) + '…' : s.name, pct: q ? Math.round((sc / q) * 100) : 0 };
  });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[Math.min(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1, 6)];

  const anns = store.announcements();
  const next = nextStudyTarget(user);
  const last = lastStudied(user);
  const label = targetLabel(next) || t('materials');
  const todayRows = [
    { time: '08:00', text: last ? `Review your ${last.subject} material — ${last.chapter} (15 min)` : 'Review your newest notes (15 min)' },
    { time: '16:00', text: next && next.done ? `Revision: ${label} — re-read + 3-line note (30 min)` : `Read: ${label} (30 min)` },
    { time: '19:00', text: 'Practice test: take an uploaded exam from the Exams page (10 min)' }
  ];

  return (
    <>
      {anns.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          {anns.map(a => (
            <div key={a.id} className="note-box anim-pop" style={{ marginBottom: 8 }}>
              📣 <b>{t('announcement')}:</b> {a.text}
              <div style={{ fontSize: 11.5, opacity: .7, marginTop: 2 }}>{new Date(a.at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
      {user.directorName && (
        <div className="note-box" style={{ marginBottom: 18, background: '#f5f3ff', borderColor: '#ddd6fe', color: '#5b21b6' }}>
          🏫 <b>My director:</b> {user.directorName}
        </div>
      )}
      <div className="grid cols4 stagger" style={{ marginBottom: 22 }}>
        <Stat grad="brand" icon="⭐" label={t('myPoints')} value={user.points} />
        <Stat grad="success" icon="🎯" label={t('averageScore')} value={pct} suffix="%" delay={60} />
        <Stat grad="accent" icon="📋" label={t('mockExam')} value={scores.length} delay={120} />
        <Stat grad="warning" icon="❤️" label={t('favorites')} value={(user.favorites || []).length} delay={180} />
      </div>

      <div className="grid cols2 stagger">
        <ChartCard title={`📈 ${t('progress')} — ${t('results')}`} sub={`${scores.length} assessments recorded`}>
          {trend.length > 1 ? (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={trend} margin={{ left: -22, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={.45} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                <Area type="monotone" dataKey="pct" stroke="#0d9488" strokeWidth={2.5} fill="url(#g1)" animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty" style={{ padding: 34 }}>
              <div className="ico">📊</div>
              Complete 2+ exams to see your score trend
            </div>
          )}
        </ChartCard>

        <ChartCard title={`🎯 ${t('subjects')} mastery`} sub={gradeLabel}>
          {bySubject.length === 0 ? (
            <div className="empty" style={{ padding: 34 }}>
              <div className="ico">📭</div>
              {t('noContentYet')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={bySubject} margin={{ left: -22, right: 6, top: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: '#64748b' }} interval={0} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} cursor={{ fill: '#f0fdfa' }} />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]} animationDuration={900}>
                  {bySubject.map((_, i) => (
                    <Cell key={i} fill={['#0d9488', '#115e59', '#059669', '#f59e0b', '#0e7490'][i % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid cols2 stagger" style={{ marginTop: 18 }}>
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>📚 {t('subjects')} — {gradeLabel}</h3>
          {subjects.length === 0 ? (
            <div className="empty" style={{ padding: 26 }}>
              <div className="ico">📭</div>
              {t('noContentYet')}
            </div>
          ) : (
            <div className="grid cols2" style={{ gap: 12 }}>
              {subjects.map(s => (
                <Link key={s.name} to="/student/learn" style={{ textDecoration: 'none' }}>
                  <div className="subject-card" style={{ padding: 15 }}>
                    <div className="ico">📖</div>
                    <h3 style={{ fontSize: 14.5 }}>{s.name}</h3>
                    <p>{s.done}/{s.total} {t('completed')}</p>
                    <div className="bar" style={{ marginTop: 10 }}><i style={{ width: s.pct + '%' }} /></div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 14 }}>🗓️ {t('todayPlan')}</h3>
          <div className="note-box">⏰ {today}: next up — <b>{label}</b>. Continue your study timetable from {t('studyAI')} — 30 focused minutes beats 3 distracted hours.</div>
          <table className="tt-table">
            <tbody>
              {todayRows.map(r => (
                <tr key={r.time}><td><b>{r.time}</b></td><td>{r.text}</td></tr>
              ))}
            </tbody>
          </table>
          <Link to="/student/learn" className="btn" style={{ marginTop: 16, width: '100%', textDecoration: 'none' }}>
            🤖 {t('studyAI')} →
          </Link>
        </div>
      </div>

      <h3 className="section-title">🏆 Recent {t('results')}</h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>{t('subjects')}</th><th>{t('chapter')}</th><th>{t('score')}</th><th>{t('points')}</th><th>Date</th></tr>
          </thead>
          <tbody>
            {scores.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--muted)', padding: 30 }}>No exams yet — take your first uploaded test from the Exams page!</td></tr>
            )}
            {[...scores].reverse().slice(0, 6).map(s => (
              <tr key={s.id}>
                <td><b>{s.subject}</b></td>
                <td>{s.chapter}</td>
                <td>{s.score}/{s.total} ({Math.round((s.score / s.total) * 100)}%)</td>
                <td><span className="chip info">+{s.points}</span></td>
                <td>{new Date(s.at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}