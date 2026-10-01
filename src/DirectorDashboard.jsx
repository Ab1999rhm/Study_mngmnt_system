import { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import { store } from './data/store.js';
import { LangSwitch } from './components/Lang.jsx';
import { Stat, PageHead, SegTabs, ChartCard } from './components/ui.jsx';

const NAV = [
  { key: 'overview', icon: '📊', label: 'overview' },
  { key: 'students', icon: '👥', label: 'studentStatus' },
  { key: 'follow', icon: '📞', label: 'followUp' },
  { key: 'analytics', icon: '📈', label: 'reports' }
];

// enum keys for comparisons — never compare translated display strings
const STATUS = { ACTIVE: 'active', NEEDS: 'needs', NOT_STARTED: 'not_started' };
const STATUS_META = [
  { key: STATUS.ACTIVE, cls: 'ok', color: '#059669', labelKey: 'stActive' },
  { key: STATUS.NEEDS, cls: 'warn', color: '#f59e0b', labelKey: 'stNeedsFollow' },
  { key: STATUS.NOT_STARTED, cls: 'bad', color: '#dc2626', labelKey: 'stNotStarted' }
];

export default function DirectorDashboard({ onLogout }) {
  const { t } = useTranslation();
  const user = store.currentUser();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const pathTab = pathname.replace('/director', '').replace('/', '') || 'overview';
  const [tab, setTab] = useState(NAV.some(n => n.key === pathTab) ? pathTab : 'overview');
  const [note, setNote] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const next = pathname.replace('/director', '').replace('/', '') || 'overview';
    if (NAV.some(n => n.key === next) && next !== tab) setTab(next);
  }, [pathname]);

  useEffect(() => {
    const h = () => setRefresh(r => r + 1);
    window.addEventListener('ssa:db', h);
    return () => window.removeEventListener('ssa:db', h);
  }, []);

  const go = key => { setTab(key); setNavOpen(false); nav(key === 'overview' ? '/director' : '/director/' + key); };

  if (!user || user.role !== 'director') return <Navigate to="/" replace />;

  const allStudents = store.students();
  const assigned = allStudents.filter(s => s.directorId === user.id);
  const students = assigned.length ? assigned : allStudents;
  const scopedIds = new Set(students.map(s => s.id));
  const reports = store.reports().filter(r => scopedIds.has(r.studentId));

  const avg = reports.length
    ? Math.round(reports.reduce((a, r) => a + r.score / r.total, 0) / reports.length * 100)
    : 0;

  const statusOf = s => {
    const mine = reports.filter(r => r.studentId === s.id);
    let key = STATUS.ACTIVE;
    if (!mine.length) key = STATUS.NOT_STARTED;
    else {
      const recent = Math.max(...mine.map(r => new Date(r.at).getTime()));
      if (Date.now() - recent > 7 * 86400000) key = STATUS.NEEDS;
    }
    return { key, cls: STATUS_META.find(m => m.key === key).cls };
  };
  const statusLabel = key => t(STATUS_META.find(m => m.key === key).labelKey);

  const byGrade = {};
  students.forEach(s => { byGrade[s.grade] = (byGrade[s.grade] || 0) + 1; });
  const gradeData = Object.entries(byGrade)
    .map(([g, n]) => ({ name: g === 'remedial' ? 'Remedial' : 'G' + g, students: n }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const statusData = STATUS_META.map(m => ({
    name: statusLabel(m.key),
    value: students.filter(st => statusOf(st).key === m.key).length
  }));
  const STATUS_COLORS = STATUS_META.map(m => m.color);

  const trend = reports.slice(-10).map((r, i) => ({
    name: `#${i + 1}`,
    pct: Math.round((r.score / r.total) * 100)
  }));

  const addFollowNote = () => {
    if (!note.trim() || !selected) return;
    store.addDirectorNote(selected.id, note, user.fullName);
    setNote('');
    setRefresh(r => r + 1);
  };

  const selectedNotes = selected ? store.directorNotes(selected.id) : [];

  return (
    <div className="shell">
      <button className="nav-burger" aria-label="Menu" onClick={() => setNavOpen(o => !o)}>
        <i /><i /><i />
      </button>
      <div className={'nav-backdrop' + (navOpen ? ' show' : '')} onClick={() => setNavOpen(false)} />
      <aside className={'sidebar' + (navOpen ? ' open' : '')}>
        <button className="nav-close" aria-label="Close" onClick={() => setNavOpen(false)}>✕</button>
        <div className="logo"><span className="dot">🎓</span>{t('director')}</div>
        <div className="grp">{t('grpMonitoring')}</div>
        {NAV.slice(0, 2).map(n => (
          <a key={n.key} href="#" className={tab === n.key ? 'active' : ''} onClick={e => { e.preventDefault(); go(n.key); }}>
            <span className="ic">{n.icon}</span> {t(n.label)}
          </a>
        ))}
        <div className="grp">{t('grpEngagement')}</div>
        {NAV.slice(2).map(n => (
          <a key={n.key} href="#" className={tab === n.key ? 'active' : ''} onClick={e => { e.preventDefault(); go(n.key); }}>
            <span className="ic">{n.icon}</span> {t(n.label)}
          </a>
        ))}
        <div className="spacer" />
        <div className="user"><b>{user.fullName}</b>{user.schoolName}</div>
        <a href="#" onClick={e => { e.preventDefault(); onLogout(); }} style={{ marginTop: 8 }}>
          <span className="ic">🚪</span> {t('logout')}
        </a>
      </aside>

      <main className="main">
        <PageHead
          crumb={<>SSA HUB / <b>{t('director')}</b></>}
          title={t(NAV.find(n => n.key === tab)?.label || 'overview')}
          right={
            <>
              <span className="chip ok"><span className="live-dot" /> LIVE</span>
              <LangSwitch />
            </>
          }
        />

        <SegTabs tabs={NAV.map(n => ({ key: n.key, icon: n.icon, label: t(n.label) }))} active={tab} onChange={go} />

        <div className="page-enter" key={tab}>
          <div className="grid cols4 stagger" style={{ marginBottom: 22 }}>
            <Stat grad="brand" icon="👥" label={t('totalStudents')} value={students.length} />
            <Stat grad="success" icon="⚡" label={t('activeStudents')} value={students.filter(s => statusOf(s).key === STATUS.ACTIVE).length} delay={60} />
            <Stat grad="accent" icon="🎯" label={t('averageScore')} value={avg} suffix="%" delay={120} />
            <Stat grad="danger" icon="📞" label={t('needFollowUp')} value={students.filter(s => statusOf(s).key === STATUS.NEEDS).length} delay={180} />
          </div>

          {tab === 'overview' && (
            <div className="grid cols2 stagger">
              <ChartCard title="👥 Students per grade" sub="School-wide distribution">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={gradeData} margin={{ left: -20, top: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} cursor={{ fill: '#f0fdfa' }} />
                    <Bar dataKey="students" fill="#0d9488" radius={[6, 6, 0, 0]} animationDuration={900} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="❤️ Student engagement" sub="Status based on recent activity">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={4} animationDuration={900}>
                      {statusData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <h3 style={{ marginBottom: 14 }}>🏆 {t('topStudents')}</h3>
                {[...students].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 5).map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--line)', fontSize: 14.5 }}>
                    <span style={{ fontWeight: 600 }}>{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]} {s.fullName}</span>
                    <span className="chip info">⭐ {s.points || 0}</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <h3 style={{ marginBottom: 14 }}>📈 Recent exam performance</h3>
                {trend.length > 1 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trend} margin={{ left: -22, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                      <Line type="monotone" dataKey="pct" stroke="#0d9488" strokeWidth={3} dot={{ r: 4, fill: '#0d9488' }} animationDuration={1000} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty" style={{ padding: 30 }}><div className="ico">📈</div>Not enough exam data yet</div>
                )}
              </div>
            </div>
          )}

          {tab === 'students' && (
            <>
              {assigned.length > 0 && (
                <div className="note-box anim-pop" style={{ marginBottom: 14 }}>
                  👥 Showing your <b>{assigned.length} assigned student(s)</b> — the school admin manages assignments.
                </div>
              )}
              <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>{t('name')}</th><th>{t('school')}</th><th>{t('grade')}</th><th>{t('points')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const st = statusOf(s);
                    return (
                      <tr key={s.id}>
                        <td><b>{s.fullName}</b></td>
                        <td>{s.schoolName}</td>
                        <td>{s.grade === 'remedial' ? t('remedial') : s.grade}</td>
                        <td><span className="chip info">⭐ {s.points || 0}</span></td>
                        <td><span className={'chip ' + st.cls}>{statusLabel(st.key)}</span></td>
                        <td>
                          <button className="btn sm ghost" onClick={() => { setSelected(s); go('follow'); }}>{t('view')}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}

          {tab === 'follow' && (
            <div className="grid cols2" key={refresh}>
              <div className="card">
                <h3 style={{ marginBottom: 14 }}>📞 {t('followUp')}</h3>
                <div className="field">
                  <label>{t('selectStudent')}</label>
                  <select value={selected?.id || ''} onChange={e => setSelected(students.find(s => s.id === e.target.value))}>
                    <option value="">{t('chooseOption')}</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.fullName} ({s.grade === 'remedial' ? t('remedial') : 'G' + s.grade})</option>)}
                  </select>
                </div>
                {selected && (
                  <>
                    <div className="note-box anim-up">
                      📊 <b>{selected.fullName}</b> — ⭐ {selected.points || 0} pts ·{' '}
                      {reports.filter(r => r.studentId === selected.id).length} exams ·{' '}
                      package {selected.packageOpen ? 'active ✓' : 'locked 🔒'}
                    </div>
                    <div className="field">
                      <label>{t('followUpNote')}</label>
                      <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Called parent; student needs support with Mathematics…" />
                    </div>
                    <button className="btn" onClick={addFollowNote}>💾 {t('saveNote')}</button>
                    <h4 style={{ margin: '20px 0 10px' }}>{t('historyLabel')}</h4>
                    {selectedNotes.length === 0 && <p style={{ fontSize: 14, color: 'var(--muted)' }}>No notes yet.</p>}
                    {selectedNotes.slice().reverse().map((n, i) => (
                      <div key={i} className="anim-up" style={{ background: '#f8fafc', borderRadius: 9, padding: 11, marginBottom: 8, fontSize: 13.5, animationDelay: `${i * 60}ms` }}>
                        <b>{n.by}</b> · {new Date(n.at).toLocaleString()}<br />{n.text}
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="card">
                <h3 style={{ marginBottom: 14 }}>📈 {t('reports')} — Recent exam results</h3>
                <div style={{ maxHeight: 460, overflowY: 'auto' }}>
                  {[...reports].reverse().slice(0, 15).map((r, i) => {
                    const st = students.find(s => s.id === r.studentId);
                    const p = Math.round(r.score / r.total * 100);
                    return (
                      <div key={r.id} className="anim-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--line)', fontSize: 14, animationDelay: `${i * 40}ms` }}>
                        <span><b>{st?.fullName}</b> — {r.subject}<br /><span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{r.chapter}</span></span>
                        <span style={{ textAlign: 'right' }}>
                          <span className={'chip ' + (p >= 60 ? 'ok' : p >= 40 ? 'warn' : 'bad')}>{p}%</span>
                          <br /><span style={{ color: 'var(--green)', fontSize: 12.5 }}>+{r.points} pts</span>
                        </span>
                      </div>
                    );
                  })}
                  {reports.length === 0 && <div className="empty"><div className="ico">📈</div>No reports yet</div>}
                </div>
              </div>
            </div>
          )}

          {tab === 'analytics' && (
            <>
              <div className="chart-card" style={{ marginBottom: 18 }}>
                <h3>📉 Score trend across all recent exams</h3>
                <div className="sub">Last {Math.min(reports.length, 10)} assessments school-wide</div>
                {trend.length > 1 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={trend} margin={{ left: -22, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                      <Line type="monotone" dataKey="pct" stroke="#0d9488" strokeWidth={3} dot={{ r: 4, fill: '#0d9488' }} animationDuration={1000} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty"><div className="ico">📉</div>Not enough data yet</div>
                )}
              </div>

              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>{t('name')}</th><th>{t('grade')}</th><th>{t('subjects')}</th><th>{t('score')}</th><th>{t('points')}</th><th>{t('dateTh')}</th></tr>
                  </thead>
                  <tbody>
                    {[...reports].reverse().map(r => {
                      const st = students.find(s => s.id === r.studentId);
                      const p = Math.round(r.score / r.total * 100);
                      return (
                        <tr key={r.id}>
                          <td><b>{st?.fullName || '—'}</b></td>
                          <td>{st?.grade === 'remedial' ? t('remedial') : st?.grade}</td>
                          <td>{r.subject}</td>
                          <td><span className={'chip ' + (p >= 60 ? 'ok' : p >= 40 ? 'warn' : 'bad')}>{r.score}/{r.total} · {p}%</span></td>
                          <td><span className="chip info">+{r.points}</span></td>
                          <td>{new Date(r.at).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}