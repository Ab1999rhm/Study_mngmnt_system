import { NavLink, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { store } from '../../data/store.js';
import { LangSwitch } from '../../components/Lang.jsx';
import { SegTabs, PageHead } from '../../components/ui.jsx';
import StudentHome from './StudentHome.jsx';
import StudyAI from './StudyAI.jsx';
import Library from './Library.jsx';
import Materials from './Materials.jsx';
import MockExam from './MockExam.jsx';
import VideoHub from './VideoHub.jsx';
import StudyPlan from './StudyPlan.jsx';
import Store from './Store.jsx';

const GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/student', end: true, icon: '🏠', key: 'home' }]
  },
  {
    label: 'Learning',
    items: [
      { to: '/student/learn', end: true, icon: '🤖', key: 'studyAI' },
      { to: '/student/library', icon: '📚', key: 'library' },
      { to: '/student/materials', icon: '📝', key: 'materials' }
    ]
  },
  {
    label: 'Practice & Media',
    items: [
      { to: '/student/exams', icon: '📋', key: 'mockExam' },
      { to: '/student/videos', icon: '🎬', key: 'videoHub' }
    ]
  },
  {
    label: 'Store',
    items: [{ to: '/student/store', icon: '🛒', key: 'store' }]
  },
  {
    label: 'Planning',
    items: [{ to: '/student/plan', icon: '🗓️', key: 'studyPlan' }]
  }
];

const SUBS = [
  { to: '/student', icon: '🏠', key: 'home' },
  { to: '/student/learn', icon: '🤖', key: 'studyAI' },
  { to: '/student/exams', icon: '📋', key: 'mockExam' },
  { to: '/student/videos', icon: '🎬', key: 'videoHub' },
  { to: '/student/store', icon: '🛒', key: 'store' },
  { to: '/student/plan', icon: '🗓️', key: 'studyPlan' }
];

function currentSub(pathname) {
  if (pathname.startsWith('/student/library') || pathname.startsWith('/student/materials')) return '/student/learn';
  if (pathname === '/student') return '/student';
  return SUBS.find(s => pathname.startsWith(s.to))?.to || '/student';
}

export default function StudentShell({ onLogout }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const h = () => setTick(x => x + 1);
    window.addEventListener('ssa:db', h);
    return () => window.removeEventListener('ssa:db', h);
  }, []);
  const user = store.currentUser();
  if (!user) return <Navigate to="/" replace />;

  const gradeLabel = user.grade === 'remedial' ? t('remedial') : t('grade' + user.grade);
  const pkgActive = !!user.packageOpen && (!user.packageExpires || Date.now() < Date.parse(user.packageExpires));
  const pkgExpired = !!user.packageOpen && !!user.packageExpires && Date.now() >= Date.parse(user.packageExpires);

  return (
    <div className="shell">
      <button className="nav-burger" aria-label="Menu" onClick={() => setNavOpen(o => !o)}>
        <i /><i /><i />
      </button>
      <div className={'nav-backdrop' + (navOpen ? ' show' : '')} onClick={() => setNavOpen(false)} />
      <aside className={'sidebar' + (navOpen ? ' open' : '')}>
        <button className="nav-close" aria-label="Close" onClick={() => setNavOpen(false)}>✕</button>
        <div className="logo"><span className="dot">🎓</span>{t('appName')}</div>
        {GROUPS.map(g => (
          <div key={g.label} className="nav-grp">
            <div className="grp">{g.label}</div>
            {g.items.map(n => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setNavOpen(false)}>
                <span className="ic">{n.icon}</span> {t(n.key)}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="spacer" />
        <div className="user">
          <b>{user.fullName}</b>
          {gradeLabel} · {user.points} ⭐
        </div>
        <a href="#" onClick={e => { e.preventDefault(); onLogout(); }} style={{ marginTop: 8 }}>
          <span className="ic">🚪</span> {t('logout')}
        </a>
      </aside>

      <main className="main">
        <PageHead
          crumb={<>SSA HUB / <b>{gradeLabel}</b></>}
          title={t('dashboard')}
          right={
            <>
              <span className="pill amber">⭐ <b>{user.points}</b> {t('points')}</span>
              {pkgActive
                ? <span className="chip ok">● {t('packageActive')}</span>
                : pkgExpired
                  ? <span className="chip bad">⏰ {t('expired')}</span>
                  : <span className="chip warn">🔒 {t('packageLocked')}</span>}
              <LangSwitch />
            </>
          }
        />

        <SegTabs
          tabs={SUBS.map(s => ({ key: s.to, icon: s.icon, label: t(s.key) }))}
          active={currentSub(pathname)}
          onChange={k => nav(k)}
        />

        <div className="page-enter" key={pathname}>
          <Routes>
            <Route index element={<StudentHome user={user} />} />
            <Route path="learn/*" element={<StudyAI user={user} />} />
            <Route path="library" element={<Library user={user} />} />
            <Route path="materials" element={<Materials user={user} />} />
            <Route path="exams" element={<MockExam user={user} />} />
            <Route path="videos" element={<VideoHub user={user} />} />
            <Route path="store" element={<Store user={user} />} />
            <Route path="plan" element={<StudyPlan user={user} />} />
            <Route path="*" element={<Navigate to="/student" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}