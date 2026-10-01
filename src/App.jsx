import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { store } from './data/store.js';
import Landing from './pages/Landing.jsx';
import Auth from './pages/Auth.jsx';
import Setup from './pages/Setup.jsx';
import StudentShell from './pages/student/StudentShell.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import DirectorDashboard from './DirectorDashboard.jsx';
import InstallPWA from './components/InstallPWA.jsx';

export default function App() {
  const [user, setUser] = useState(() => {
    store.seedIfEmpty();
    return store.currentUser();
  });

  const [online, setOnline] = useState(() => navigator.onLine);
  const [setupAbandoned, setSetupAbandoned] = useState(false);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const login = u => setUser(u);
  const logout = () => { store.logout(); setUser(null); };

  const banner = !online && (
    <div style={{ background: '#fef3c7', color: '#92400e', textAlign: 'center', padding: '8px', fontSize: '13.5px', fontWeight: 600, position: 'sticky', top: 0, zIndex: 80 }}>
      📴 Offline mode — cached lessons, notes and videos still work. Progress syncs when you reconnect.
    </div>
  );

  if (!user && !setupAbandoned && store.needsSetup()) {
    return (
      <>
        {banner}
        <Setup onDone={u => { if (u) setUser(u); else setSetupAbandoned(true); }} />
        <InstallPWA />
      </>
    );
  }

  if (!user) {
    return (
      <>
        {banner}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth onLogin={login} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <InstallPWA />
      </>
    );
  }

  const home = user.role === 'admin' ? '/admin' : user.role === 'director' ? '/director' : '/student';

  return (
    <>
      {banner}
      <Routes>
        <Route path="/" element={<Navigate to={home} replace />} />
        <Route path="/auth" element={<Navigate to={home} replace />} />
        <Route path="/student/*" element={<StudentShell onLogout={logout} />} />
        <Route path="/admin/*" element={<AdminDashboard onLogout={logout} />} />
        <Route path="/director/*" element={<DirectorDashboard onLogout={logout} />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
      <InstallPWA />
    </>
  );
}