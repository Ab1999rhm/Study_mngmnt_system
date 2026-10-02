import { useState, useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { store } from './data/store.js';
import { LangSwitch } from './components/Lang.jsx';
import { Stat, PageHead, SegTabs, ChartCard } from './components/ui.jsx';

const MB = 1024 * 1024;
const MAX_STORAGE_MB = 5;
const MAX_FILE_MB = 4;
const MAX_STORAGE_BYTES = MAX_STORAGE_MB * MB;
const MAX_FILE_BYTES = MAX_FILE_MB * MB;

const NAV = [
  { key: 'overview', icon: '📊', label: 'overview' },
  { key: 'students', icon: '👥', label: 'manageStudents' },
  { key: 'uploads', icon: '📤', label: 'manageUploads' },
  { key: 'packages', icon: '📦', label: 'managePackages' },
  { key: 'payments', icon: '💳', label: 'payments' },
  { key: 'reports', icon: '📈', label: 'reports' },
  { key: 'directors', icon: '🎓', label: 'directors' },
  { key: 'settings', icon: '⚙️', label: 'settings' }
];

const NAV_GROUPS = [
  { label: 'navGrpManagement', keys: ['overview', 'students'] },
  { label: 'navGrpStore', keys: ['uploads', 'packages', 'payments'] },
  { label: 'navGrpData', keys: ['reports', 'directors', 'settings'] }
];

function Modal({ children, onClose, wide }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, .6)', zIndex: 200, overflow: 'auto', padding: '30px 14px', animation: 'fadeIn var(--fast) var(--ease) both' }} onClick={onClose}>
      <div className="card" style={{ maxWidth: wide ? 780 : 520, margin: '0 auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button className="btn sm ghost" style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }} onClick={onClose}>✕</button>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({ box, onClose }) {
  const { t } = useTranslation();
  if (!box) return null;
  return (
    <Modal onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '14px 8px 6px' }}>
        <div style={{ fontSize: 40 }}>{box.icon || '⚠️'}</div>
        <h3 style={{ margin: '8px 0 6px' }}>{box.title}</h3>
        <p style={{ color: 'var(--muted)', fontSize: 14.5, margin: '0 auto 18px', maxWidth: 400, lineHeight: 1.55 }}>{box.message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn sm ghost" onClick={onClose}>✕ {t('cancelBtn')}</button>
          <button className="btn sm danger" onClick={() => { const fn = box.onYes; onClose(); if (fn) fn(); }}>{box.yesLabel || ('🗑 ' + t('deleteBtn'))}</button>
        </div>
      </div>
    </Modal>
  );
}

function downloadCsv(name, rows) {
  const csv = rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function AdminDashboard({ onLogout }) {
  const { t } = useTranslation();
  const user = store.currentUser();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const pathTab = pathname.replace('/admin', '').replace('/', '') || 'overview';
  const [tab, setTab] = useState(NAV.some(n => n.key === pathTab) ? pathTab : 'overview');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [, setTick] = useState(0);
  const bump = () => setTick(x => x + 1);

  const EMPTY_UP = { type: 'book', title: '', subject: '', grade: 'all', link: '', body: '', price: 100, free: false, questions: [] };
  const [upForm, setUpForm] = useState(EMPTY_UP);
  const [upFile, setUpFile] = useState(null);
  const [upMsg, setUpMsg] = useState('');
  const [editId, setEditId] = useState(null);
  const [navOpen, setNavOpen] = useState(false);

  const [upQ, setUpQ] = useState('');
  const [upTypeF, setUpTypeF] = useState('all');
  const [upGradeF, setUpGradeF] = useState('all');
  const [upSubF, setUpSubF] = useState('all');
  const [upStatusF, setUpStatusF] = useState('all');
  const [upSort, setUpSort] = useState('newest');
  const [preview, setPreview] = useState(null);
  const [qDraft, setQDraft] = useState({ q: '', o: ['', '', '', ''], a: 0 });

  const [detail, setDetail] = useState(null);
  const [gradeF, setGradeF] = useState('all');
  const [sel, setSel] = useState([]);
  const [repQ, setRepQ] = useState('');
  const [repSub, setRepSub] = useState('all');
  const [repFrom, setRepFrom] = useState('');
  const [repTo, setRepTo] = useState('');
  const [repGrade, setRepGrade] = useState('all');
  const [statusF, setStatusF] = useState('all');
  const [dirF, setDirF] = useState('all');
  const [sort, setSort] = useState({ key: 'joined', dir: 'desc' });

  const [dirForm, setDirForm] = useState(null);
  const [dirQ, setDirQ] = useState('');
  const [assignFor, setAssignFor] = useState(null);
  const [assignIds, setAssignIds] = useState([]);
  const [assignQ, setAssignQ] = useState('');
  const [notesFor, setNotesFor] = useState(null);
  const [confirmBox, setConfirmBox] = useState(null);

  const [payPhone, setPayPhone] = useState(store.settings().payPhone || '');
  const [annText, setAnnText] = useState('');
  const [acctForm, setAcctForm] = useState({ fullName: (user && user.fullName) || '', email: (user && user.email) || '', currentPw: '', newPw: '' });
  const [pkgForm, setPkgForm] = useState({ name: '', price: 1000, days: 30 });
  const [pkgEditId, setPkgEditId] = useState(null);
  const flashTimer = useRef(null);

  useEffect(() => {
    const next = pathname.replace('/admin', '').replace('/', '') || 'overview';
    if (NAV.some(n => n.key === next) && next !== tab) setTab(next);
  }, [pathname]);

  useEffect(() => {
    const h = () => bump();
    window.addEventListener('ssa:db', h);
    return () => window.removeEventListener('ssa:db', h);
  }, []);

  const go = key => { setTab(key); setNavOpen(false); nav(key === 'overview' ? '/admin' : '/admin/' + key); };

  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  const students = store.students();
  const reports = store.reports();

  const pkgActive = s => !!s.packageOpen && (!s.packageExpires || Date.now() < Date.parse(s.packageExpires));
  const pkgChip = s => pkgActive(s)
    ? <span className="chip ok">✓ {t('paid')}</span>
    : s.packageOpen
      ? <span className="chip bad">⏰ {t('expired')}</span>
      : <span className="chip warn">🔒 {t('unpaid')}</span>;

  const statusOk = s => {
    if (statusF === 'all') return true;
    if (statusF === 'paid') return pkgActive(s);
    if (statusF === 'unpaid') return !s.packageOpen;
    if (statusF === 'expired') return !!s.packageOpen && !pkgActive(s);
    if (statusF === 'blocked') return s.active === false;
    if (statusF === 'aioff') return s.aiEnabled === false;
    return true;
  };
  const filtered = students.filter(s =>
    (gradeF === 'all' || String(s.grade) === gradeF) &&
    statusOk(s) &&
    (dirF === 'all' || s.directorId === dirF) &&
    (s.fullName + ' ' + s.schoolName + ' ' + s.grade + ' ' + (s.email || '')).toLowerCase().includes(q.toLowerCase())
  );
  const sorted = [...filtered].sort((a, b) => {
    const d = sort.dir === 'asc' ? 1 : -1;
    if (sort.key === 'name') return a.fullName.localeCompare(b.fullName) * d;
    if (sort.key === 'grade') return String(a.grade).localeCompare(String(b.grade), undefined, { numeric: true }) * d;
    if (sort.key === 'points') return ((a.points || 0) - (b.points || 0)) * d;
    return (new Date(a.joinedAt) - new Date(b.joinedAt)) * d;
  });
  const toggleSort = key => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  const sortArrow = key => sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  const repFiltered = reports.filter(r => {
    const st = students.find(s => s.id === r.studentId);
    const name = (st?.fullName || '').toLowerCase();
    const at = new Date(r.at);
    if (repFrom && at < new Date(repFrom + 'T00:00:00')) return false;
    if (repTo && at > new Date(repTo + 'T23:59:59')) return false;
    if (repGrade !== 'all' && (!st || String(st.grade) !== repGrade)) return false;
    return (!repQ || name.includes(repQ.toLowerCase())) && (repSub === 'all' || r.subject === repSub);
  });

  const paid = students.filter(s => pkgActive(s)).length;
  const avg = reports.length
    ? Math.round(reports.reduce((a, r) => a + r.score / r.total, 0) / reports.length * 100)
    : 0;

  const togglePackage = id => {
    const s = students.find(x => x.id === id);
    if (pkgActive(s)) {
      store.closePackage(id);
      setMsg('');
      clearTimeout(flashTimer.current);
    } else {
      store.openPackage(id);
      flash(t('paymentReceived'));
    }
    bump();
  };

  const uploads = store.uploads();
  const payRequests = store.payRequests();

  const onUpFile = e => {
    const f = e.target.files[0];
    if (!f) { setUpFile(null); return; }
    if (f.size > MAX_FILE_BYTES) { setUpFile(null); setUpMsg(t('upFileTooLarge')); return; }
    const free = MAX_STORAGE_BYTES - store.storageUsed();
    if (Math.ceil(f.size * 1.37) > free) {
      setUpFile(null);
      setUpMsg(t('upStorageFull', { free: (free / MB).toFixed(1) }));
      return;
    }
    const rd = new FileReader();
    rd.onload = () => { setUpFile({ dataUrl: rd.result, name: f.name, size: f.size }); setUpMsg(''); };
    rd.onerror = () => { setUpFile(null); setUpMsg(t('upReadFail')); };
    rd.readAsDataURL(f);
  };

  const submitUpload = e => {
    e.preventDefault();
    const hasContent = !!(upForm.body.trim() || upForm.link.trim() || (upFile && upFile.dataUrl));
    if (['book', 'material', 'library', 'video'].includes(upForm.type) && !hasContent) {
      setUpMsg('❌ ' + t('upNeedContent'));
      return;
    }
    if (['test', 'exam'].includes(upForm.type) && !upForm.questions.length) {
      setUpMsg('❌ ' + t('upNeedQuestions'));
      return;
    }
    if (editId) {
      const res = store.updateUpload(editId, { ...upForm, fileData: upFile?.dataUrl || null, fileName: upFile?.name || null });
      if (!res) { setUpMsg(t('upUpdateFail')); return; }
      setUpMsg(t('upUpdated', { title: res.title }));
      setEditId(null);
      setUpForm(EMPTY_UP);
      setUpFile(null);
      bump();
      return;
    }
    const res = store.addUpload({ ...upForm, fileData: upFile?.dataUrl, fileName: upFile?.name });
    if (!res.ok) { setUpMsg('❌ ' + res.error); return; }
    setUpMsg(t('upUploaded', { title: res.item.title }));
    setUpForm(EMPTY_UP);
    setUpFile(null);
    bump();
  };

  const startEdit = u => {
    setEditId(u.id);
    setUpForm({ type: u.type, title: u.title, subject: u.subject || '', grade: u.grade || 'all', link: u.link || '', body: u.body || '', price: u.price, free: !!u.free, questions: u.questions || [] });
    setUpFile(u.fileData ? { dataUrl: u.fileData, name: u.fileName || 'file' } : null);
    setUpMsg('');
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditId(null);
    setUpForm(EMPTY_UP);
    setUpFile(null);
    setUpMsg('');
  };

  const flash = (text, ok = true) => {
    setMsg({ text, ok });
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setMsg(''), 3500);
  };

  const addQuestion = () => {
    const opts = qDraft.o.map(x => x.trim()).filter(Boolean);
    const answerText = (qDraft.o[qDraft.a] || '').trim();
    if (!qDraft.q.trim() || opts.length < 2 || !answerText || !opts.includes(answerText)) {
      setUpMsg(t('upQuestionNeed'));
      return;
    }
    setUpForm(f => ({ ...f, questions: [...f.questions, { type: 'mcq', q: qDraft.q.trim(), options: opts, answer: answerText }] }));
    setQDraft({ q: '', o: ['', '', '', ''], a: 0 });
    setUpMsg('');
  };
  const removeQuestion = i => setUpForm(f => ({ ...f, questions: f.questions.filter((_, j) => j !== i) }));

  const upStatusOk = u => {
    if (upStatusF === 'all') return true;
    if (upStatusF === 'hidden') return !!u.hidden;
    if (upStatusF === 'free') return !u.hidden && (!!u.free || Number(u.price) === 0);
    if (upStatusF === 'locked') return !u.hidden && !u.free && Number(u.price) > 0;
    return true;
  };
  const filteredUploads = uploads.filter(u =>
    (upTypeF === 'all' || u.type === upTypeF) &&
    (upGradeF === 'all' || String(u.grade) === upGradeF) &&
    (upSubF === 'all' || (u.subject || '') === upSubF) &&
    upStatusOk(u) &&
    (!upQ || (u.title + ' ' + (u.subject || '')).toLowerCase().includes(upQ.toLowerCase()))
  ).sort((a, b) => upSort === 'title'
    ? a.title.localeCompare(b.title)
    : upSort === 'oldest'
      ? new Date(a.createdAt) - new Date(b.createdAt)
      : new Date(b.createdAt) - new Date(a.createdAt));
  const usedBytes = store.storageUsed();
  const quotaPct = Math.min(100, Math.round(usedBytes / MAX_STORAGE_BYTES * 100));
  const quotaMb = (usedBytes / MB).toFixed(2);

  const openDetail = s => setDetail(s.id);

  const studentCsvRows = list => [
    ['Name', 'Email', 'School', 'Grade', 'Points', 'Package', 'AI', 'Login', 'Joined'],
    ...list.map(s => [s.fullName, s.email, s.schoolName, s.grade, s.points || 0, pkgActive(s) ? 'Active' : 'Unpaid', s.aiEnabled !== false ? 'On' : 'Off', s.active === false ? 'Blocked' : 'Active', new Date(s.joinedAt).toLocaleDateString()])
  ];
  const exportStudents = () => downloadCsv('students.csv', studentCsvRows(sorted));
  const exportSelected = () => downloadCsv('students-selected.csv', studentCsvRows(sorted.filter(s => sel.includes(s.id))));

  const bulkPatch = patch => {
    const FIELD_LABELS = { aiEnabled: t('aiWord'), packageOpen: t('packageWord'), active: t('loginWord'), points: t('points'), grade: t('grade'), directorId: t('directorWord') };
    sel.forEach(id => store.updateUser(id, patch));
    setSel([]);
    bump();
    flash(t('bulkUpdated', { fields: Object.keys(patch).map(k => FIELD_LABELS[k] || k).join(', '), n: sel.length }));
  };
  const toggleSel = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const dirSubmit = () => {
    if (dirForm.mode === 'add') {
      const res = store.addDirector(dirForm);
      if (!res.ok) { flash(res.error, false); return; }
      flash(t('directorAdded') + ' — ' + res.user.email + ' / ' + dirForm.password);
    } else {
      store.updateUser(dirForm.id, { fullName: dirForm.fullName, email: dirForm.email, schoolName: dirForm.schoolName });
      flash(t('directorUpdated'));
    }
    setDirForm(null);
    bump();
  };

  const openAssign = d => {
    setAssignFor(d.id);
    setAssignIds(students.filter(s => s.directorId === d.id).map(s => s.id));
    setAssignQ('');
  };
  const saveAssign = () => {
    store.assignStudents(assignFor, assignIds);
    setAssignFor(null);
    bump();
    flash(t('studentsAssigned'));
  };
  const directorNotes = id => {
    const out = [];
    students.filter(s => s.directorId === id).forEach(s => {
      const list = store.directorNotes(s.id);
      if (list.length) out.push({ student: s, notes: list });
    });
    return out;
  };

  const saveSettingsNow = () => {
    store.updateSettings({ payPhone: payPhone.trim() });
    bump();
    flash(t('settingsSaved', { phone: payPhone.trim() }));
  };
  const postAnnouncement = () => {
    if (!store.addAnnouncement(annText)) { flash(t('annRequired'), false); return; }
    setAnnText('');
    bump();
    flash(t('annPosted'));
  };
  const saveAccount = () => {
    if (!acctForm.fullName.trim() || !acctForm.email.trim()) { flash(t('nameEmailRequired'), false); return; }
    if (acctForm.newPw && acctForm.newPw.length < 6) { flash(t('newPwTooShort'), false); return; }
    const res = store.updateAdminProfile({
      userId: user.id,
      fullName: acctForm.fullName,
      email: acctForm.email,
      currentPw: acctForm.currentPw,
      newPw: acctForm.newPw || undefined
    });
    if (!res.ok) { flash(res.error, false); return; }
    setAcctForm(f => ({ ...f, currentPw: '', newPw: '' }));
    bump();
    flash(t('accountUpdated') + ' — ' + res.user.email);
  };

  const pkgSubmit = () => {
    if (!pkgForm.name.trim()) { flash(t('planNameRequired'), false); return; }
    if (pkgEditId) store.updatePackage(pkgEditId, pkgForm);
    else store.addPackage(pkgForm);
    setPkgForm({ name: '', price: 1000, days: 30 });
    setPkgEditId(null);
    bump();
    flash(pkgEditId ? t('planUpdated') : t('planAdded'));
  };

  const toggleAI = id => {
    const s = students.find(x => x.id === id);
    store.updateUser(id, { aiEnabled: s.aiEnabled === false });
    bump();
  };

  const toggleActive = id => {
    const s = students.find(x => x.id === id);
    store.updateUser(id, { active: s.active === false });
    bump();
    flash(s.active === false ? t('studentActivated') : t('studentBlocked'));
  };

  const setDirPassword = d => {
    const pw = window.prompt(t('promptSetPw', { email: d.email }));
    if (pw == null) return;
    const res = store.setUserPassword(d.id, pw);
    bump();
    if (res.ok) flash(t('pwSetLogin', { email: d.email }));
    else flash(res.error, false);
  };
  const deleteDirector = d => {
    const n = students.filter(s => s.directorId === d.id).length;
    setConfirmBox({
      title: '🎓 ' + t('deleteBtn'),
      message: t('confirmDeleteDir', { name: d.fullName }) + (n ? ' ' + t('confirmDeleteDirUnassign', { n }) : ''),
      onYes: () => {
        store.deleteDirector(d.id);
        bump();
        flash(t('directorDeleted') + (n ? ' — ' + t('dirUnassignedTail', { n }) : ''));
      }
    });
  };

  const approveAndOpen = req => {
    const res = store.approveAndGrant(req.id);
    bump();
    if (res && res.granted) {
      const st = students.find(s => s.id === req.studentId);
      const who = st ? st.fullName : t('theStudent');
      flash(req.plan === 'full' ? t('approveFullMsg', { name: who }) : t('approveItemMsg', { name: who }));
    } else {
      flash(t('requestApproved'));
    }
  };

  const byGrade = {};
  students.forEach(s => { byGrade[s.grade] = (byGrade[s.grade] || 0) + 1; });
  const gradeData = Object.entries(byGrade)
    .map(([g, n]) => ({ name: g === 'remedial' ? t('remedial') : 'G' + g, students: n }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const pieData = [
    { name: t('paid'), value: paid },
    { name: t('unpaid'), value: students.length - paid }
  ];
  const PIE = ['#059669', '#f59e0b'];

  const directors = store.directors();
  const dirs = directors.filter(d => !dirQ || (d.fullName + ' ' + (d.email || '') + ' ' + (d.schoolName || '')).toLowerCase().includes(dirQ.toLowerCase()));
  const pendingResets = store.pendingResetCount();
  const me = store.userById(user && user.id) || user;
  const detailStu = detail ? students.find(s => s.id === detail) : null;
  const detailPendFull = !!detailStu && payRequests.some(r => r.studentId === detailStu.id && r.status === 'pending' && r.plan === 'full');

  return (
    <div className="shell">
      <button className="nav-burger" aria-label={t('ariaMenu')} onClick={() => setNavOpen(o => !o)}>
        <i /><i /><i />
      </button>
      <div className={'nav-backdrop' + (navOpen ? ' show' : '')} onClick={() => setNavOpen(false)} />
      <aside className={'sidebar' + (navOpen ? ' open' : '')}>
        <button className="nav-close" aria-label={t('closeLabel')} onClick={() => setNavOpen(false)}>✕</button>
        <div className="logo"><span className="dot">⚙️</span>{t('admin')}</div>
        {NAV_GROUPS.map(g => (
          <div key={g.label} className="nav-grp">
            <div className="grp">{t(g.label)}</div>
            {g.keys.map(k => {
              const n = NAV.find(x => x.key === k);
              return (
                <a key={k} href="#" className={tab === k ? 'active' : ''} onClick={e => { e.preventDefault(); go(k); }}>
                  <span className="ic">{n.icon}</span> {t(n.label)}
                  {k === 'payments' && pendingResets > 0 && (
                    <span className="nav-badge" title={t('resetReqTitle')} data-testid="reset-badge">{pendingResets}</span>
                  )}
                </a>
              );
            })}
          </div>
        ))}
        <div className="spacer" />
        <div className="user"><b>{me.fullName}</b>{t('roleAdmin')}</div>
        <a href="#" onClick={e => { e.preventDefault(); onLogout(); }} style={{ marginTop: 8 }}>
          <span className="ic">🚪</span> {t('logout')}
        </a>
      </aside>

      <main className="main">
        <PageHead
          crumb={<>SSA HUB / <b>{t('admin')}</b></>}
          title={t(NAV.find(n => n.key === tab)?.label || 'overview')}
          right={<LangSwitch />}
        />

        <SegTabs tabs={NAV.map(n => ({ key: n.key, icon: n.icon, label: t(n.label) }))} active={tab} onChange={go} />

        <div className="page-enter" key={tab}>
          {msg && (() => {
            const m = typeof msg === 'string' ? { text: msg, ok: true } : msg;
            return (
              <div className="note-box anim-pop" style={m.ok
                ? { background: '#d1fae5', borderColor: '#6ee7b7', color: '#065f46' }
                : { background: '#fee2e2', borderColor: '#fecaca', color: '#991b1b' }}>
                {m.ok ? '✓ ' : '✕ '}{m.text}
              </div>
            );
          })()}

          {tab === 'overview' && (
            <>
              <div className="grid cols4 stagger" style={{ marginBottom: 22 }}>
                <Stat grad="brand" icon="👥" label={t('totalStudents')} value={students.length} />
                <Stat grad="success" icon="📦" label={t('packageActive')} value={paid} delay={60} />
                <Stat grad="warning" icon="🔒" label={t('unpaid')} value={students.length - paid} delay={120} />
                <Stat grad="accent" icon="🎯" label={t('averageScore')} value={avg} suffix="%" delay={180} />
                <Stat grad="success" icon="💰" label={t('revenue')} value={'ETB ' + store.revenueTotal()} delay={240} />
                <Stat grad="warning" icon="⏳" label={t('pending')} value={payRequests.filter(r => r.status === 'pending').length} delay={300} />
              </div>

              <div className="grid cols2 stagger">
                <ChartCard title={`👥 ${t('totalStudents')} ${t('perGrade')}`} sub={t('distributionSub')}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={gradeData} margin={{ left: -20, top: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} cursor={{ fill: '#f0fdfa' }} />
                      <Bar dataKey="students" fill="#0d9488" radius={[6, 6, 0, 0]} animationDuration={900} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title={`📦 ${t('managePackages')}`} sub={`${paid}/${students.length} ${t('paid')}`}>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={4} animationDuration={900}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                      <Legend wrapperStyle={{ fontSize: 13 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="card" style={{ marginTop: 18 }}>
                <h3 style={{ marginBottom: 14 }}>🆕 {t('latestRegistrations')}</h3>
                <div className="table-wrap" style={{ boxShadow: 'none' }}>
                  <table className="data">
                    <thead><tr><th>{t('name')}</th><th>{t('school')}</th><th>{t('grade')}</th><th>{t('status')}</th><th>{t('joinedLabel')}</th></tr></thead>
                    <tbody>
                      {[...students].sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt)).slice(0, 5).map(s => (
                        <tr key={s.id}>
                          <td><b style={{ color: 'var(--brand-700)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }} onClick={() => { go('students'); openDetail(s); }}>{s.fullName}</b></td>
                          <td>{s.schoolName}</td>
                          <td>{s.grade === 'remedial' ? t('remedial') : s.grade}</td>
                          <td>{pkgChip(s)}</td>
                          <td>{new Date(s.joinedAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {students.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>{t('noStudentsRegistered')}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {tab === 'students' && (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
                <div className="field" style={{ maxWidth: 240, marginBottom: 0 }}>
                  <label>🔍 {t('search')}</label>
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('phNameSchoolEmail')} />
                </div>
                <div className="field" style={{ width: 150, marginBottom: 0 }}>
                  <label>{t('grade')}</label>
                  <select value={gradeF} onChange={e => setGradeF(e.target.value)}>
                    <option value="all">{t('all')}</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => <option key={g} value={String(g)}>{t('grade')} {g}</option>)}
                    <option value="remedial">{t('remedial')}</option>
                  </select>
                </div>
                <div className="field" style={{ width: 150, marginBottom: 0 }}>
                  <label>{t('status')}</label>
                  <select value={statusF} onChange={e => setStatusF(e.target.value)}>
                    <option value="all">{t('all')}</option>
                    <option value="paid">✓ {t('paid')}</option>
                    <option value="unpaid">🔒 {t('unpaid')}</option>
                    <option value="expired">⏰ {t('expired')}</option>
                    <option value="blocked">⛔ {t('blockedLabel')}</option>
                    <option value="aioff">🤖 Off</option>
                  </select>
                </div>
                <div className="field" style={{ width: 170, marginBottom: 0 }}>
                  <label>🎓 {t('directors')}</label>
                  <select value={dirF} onChange={e => setDirF(e.target.value)}>
                    <option value="all">{t('all')}</option>
                    {directors.map(d => <option key={d.id} value={d.id}>{d.fullName}</option>)}
                  </select>
                </div>
                <button className="btn ghost sm" onClick={exportStudents}>⬇️ {t('exportCsv')}</button>
                <span style={{ fontSize: 13, color: 'var(--muted)', paddingBottom: 10 }}>{sorted.length}/{students.length}</span>
              </div>

              {sel.length > 0 && (
                <div className="note-box anim-pop" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <b>{sel.length} {t('selectedColon')}</b>
                  <button className="btn sm ghost" onClick={() => bulkPatch({ aiEnabled: true })}>🤖 On</button>
                  <button className="btn sm ghost" onClick={() => bulkPatch({ aiEnabled: false })}>🤖 Off</button>
                  <button className="btn sm green" onClick={() => bulkPatch({ packageOpen: true, packageExpires: new Date(Date.now() + 30 * 86400000).toISOString() })}>📦 {t('openPackage')}</button>
                  <button className="btn sm danger" onClick={() => bulkPatch({ packageOpen: false, packageExpires: null })}>🔒 {t('closePackage')}</button>
                  <button className="btn sm danger" onClick={() => setConfirmBox({ title: '⛔ ' + t('blockBtn'), message: t('confirmBlockN', { n: sel.length }), yesLabel: '⛔ ' + t('blockBtn'), onYes: () => bulkPatch({ active: false }) })}>⛔ {t('blockBtn')}</button>
                  <button className="btn sm green" onClick={() => bulkPatch({ active: true })}>✅ {t('unblockBtn')}</button>
                  <button className="btn sm ghost" onClick={exportSelected}>⬇️ {t('exportSelected')}</button>
                  <button className="btn sm ghost" onClick={() => setSel([])}>✕</button>
                </div>
              )}

              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th style={{ width: 34 }}>
                        <input type="checkbox"
                          checked={sorted.length > 0 && sorted.every(s => sel.includes(s.id))}
                          onChange={e => setSel(e.target.checked ? sorted.map(s => s.id) : [])} />
                      </th>
                      <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('name')}>{t('name')}{sortArrow('name')}</th>
                      <th>{t('school')}</th>
                      <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('grade')}>{t('grade')}{sortArrow('grade')}</th>
                      <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('points')}>{t('points')}{sortArrow('points')}</th>
                      <th>{t('status')}</th><th>🤖 AI</th><th>🎓 {t('directors')}</th>
                      <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('joined')}>{t('joinedLabel')}{sortArrow('joined')}</th>
                      <th>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(s => (
                      <tr key={s.id}>
                        <td><input type="checkbox" checked={sel.includes(s.id)} onChange={() => toggleSel(s.id)} /></td>
                        <td><b style={{ color: 'var(--brand-700)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }} onClick={() => openDetail(s)}>{s.fullName}</b></td>
                        <td>{s.schoolName}</td>
                        <td>{s.grade === 'remedial' ? t('remedial') : s.grade}</td>
                        <td><span className="chip info">⭐ {s.points || 0}</span></td>
                        <td>{pkgChip(s)}{s.active === false && <span className="chip bad" style={{ marginLeft: 4 }}>⛔ {t('blockedLabel')}</span>}</td>
                        <td>
                          <span className={'chip ' + (s.aiEnabled !== false ? 'ok' : 'bad')}>
                            {s.aiEnabled !== false ? '🤖 On' : '🤖 Off'}
                          </span>
                        </td>
                        <td style={{ fontSize: 13 }}>{s.directorId ? (directors.find(d => d.id === s.directorId)?.fullName || '—') : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                        <td>{new Date(s.joinedAt).toLocaleDateString()}</td>
                        <td>
                          <button className="btn sm ghost" onClick={() => openDetail(s)}>👁 {t('details')}</button>
                        </td>
                      </tr>
                    ))}
                    {sorted.length === 0 && <tr><td colSpan="10" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>{t('noStudentsMatch')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'packages' && (
            <>
              <div className="card" style={{ marginBottom: 18 }}>
                <h3 style={{ marginBottom: 12 }}>📦 {t('managePackages')} — plans</h3>
                <div className="grid cols3" style={{ gap: 14, alignItems: 'end' }}>
                  <div className="field">
                    <label>{t('name')} *</label>
                    <input value={pkgForm.name} onChange={e => setPkgForm({ ...pkgForm, name: e.target.value })} placeholder={t('phPlanName')} />
                  </div>
                  <div className="field">
                    <label>{t('fee')} (ETB)</label>
                    <input type="number" min="0" value={pkgForm.price} onChange={e => setPkgForm({ ...pkgForm, price: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>{t('days')}</label>
                    <input type="number" min="0" value={pkgForm.days} onChange={e => setPkgForm({ ...pkgForm, days: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn green sm" onClick={pkgSubmit}>{pkgEditId ? '💾 ' + t('saveBtn') : '➕ ' + t('addPlan')}</button>
                  {pkgEditId && <button className="btn ghost sm" onClick={() => { setPkgEditId(null); setPkgForm({ name: '', price: 1000, days: 30 }); }}>✕ {t('cancelBtn')}</button>}
                </div>
                <div className="table-wrap" style={{ marginTop: 14, boxShadow: 'none' }}>
                  <table className="data">
                    <thead><tr><th>{t('name')}</th><th>{t('fee')}</th><th>{t('days')}</th><th>{t('actions')}</th></tr></thead>
                    <tbody>
                      {store.packages().map(p => (
                        <tr key={p.id}>
                          <td><b>{p.name}</b></td>
                          <td>ETB {p.price}</td>
                          <td>{p.days || '∞'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="btn sm ghost" style={{ marginRight: 6 }} onClick={() => { setPkgEditId(p.id); setPkgForm({ name: p.name, price: p.price, days: p.days }); }}>✏️ {t('editBtn')}</button>
                            <button className="btn sm danger" onClick={() => setConfirmBox({ title: '📦 ' + t('deleteBtn'), message: t('confirmDeletePlan', { name: p.name }), onYes: () => { if (pkgEditId === p.id) { setPkgEditId(null); setPkgForm({ name: '', price: 1000, days: 30 }); } store.deletePackage(p.id); bump(); } })}>🗑</button>
                          </td>
                        </tr>
                      ))}
                      {store.packages().length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: 22, color: 'var(--muted)' }}>{t('noPlansYet')}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>{t('name')}</th><th>{t('school')}</th><th>{t('grade')}</th><th>{t('status')}</th><th>{t('expiresTh')}</th><th>{t('actions')}</th></tr>
                  </thead>
                  <tbody>
                    {students.map(s => (
                      <tr key={s.id}>
                        <td><b>{s.fullName}</b></td>
                        <td>{s.schoolName}</td>
                        <td>{s.grade === 'remedial' ? t('remedial') : s.grade}</td>
                        <td>{pkgChip(s)}</td>
                        <td>{s.packageExpires && pkgActive(s) ? new Date(s.packageExpires).toLocaleDateString() : '—'}</td>
                        <td>
                          <button className={'btn sm ' + (pkgActive(s) ? 'danger' : 'green')} onClick={() => togglePackage(s.id)}>
                            {pkgActive(s) ? t('closePackage') : '🔓 ' + t('openPackage')}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 26, color: 'var(--muted)' }}>{t('noStudentsYet')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'uploads' && (
            <>
              <div className="card" style={{ marginBottom: 18 }}>
                <h3 style={{ marginBottom: 6 }}>{editId ? t('editContent') : t('uploadNew')}</h3>
                <p style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 14 }}>
                  {t('uploadsIntro')}
                </p>
                {upMsg && <div className="note-box anim-pop" style={{ marginBottom: 14 }}>{upMsg}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)', fontWeight: 600 }}>💾 {t('storageUsed')}</span>
                  <div className="bar-thin" style={{ flex: 1, maxWidth: 240 }}>
                    <i style={{ width: quotaPct + '%', background: quotaPct > 85 ? 'var(--danger, #dc2626)' : 'var(--grad-brand)' }} />
                  </div>
                  <span style={{ color: quotaPct > 85 ? '#dc2626' : 'var(--muted)' }}>{quotaMb} MB / {MAX_STORAGE_MB} MB</span>
                </div>
                <form onSubmit={submitUpload}>
                  <div className="grid cols3" style={{ gap: 14 }}>
                    <div className="field">
                      <label>{t('typeLabel')}</label>
                      <select value={upForm.type} onChange={e => setUpForm({ ...upForm, type: e.target.value })}>
                        <option value="book">{t('typeBook')}</option>
                        <option value="material">{t('typeMaterialFull')}</option>
                        <option value="video">{t('typeVideo')}</option>
                        <option value="library">{t('typeLibraryFull')}</option>
                        <option value="test">{t('typeTestFull')}</option>
                        <option value="exam">{t('typeExam')}</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>{t('labelTitle')}</label>
                      <input required value={upForm.title} onChange={e => setUpForm({ ...upForm, title: e.target.value })} placeholder="e.g. Grade 8 Algebra Workbook" />
                    </div>
                    <div className="field">
                      <label>{t('labelSubject')}</label>
                      <input value={upForm.subject} onChange={e => setUpForm({ ...upForm, subject: e.target.value })} placeholder="Mathematics" />
                    </div>
                    <div className="field">
                      <label>{t('grade')}</label>
                      <select value={upForm.grade} onChange={e => setUpForm({ ...upForm, grade: e.target.value })}>
                        <option value="all">{t('allGrades')}</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => <option key={g} value={String(g)}>{t('grade')} {g}</option>)}
                        <option value="remedial">{t('remedial')}</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>{t('priceLabel')} (ETB)</label>
                      <input type="number" min="0" value={upForm.price} onChange={e => setUpForm({ ...upForm, price: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>{t('accessLabel')}</label>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer', paddingTop: 6 }}>
                        <input type="checkbox" checked={!!upForm.free} onChange={e => setUpForm({ ...upForm, free: e.target.checked })} />
                        {t('freeForEveryone')}
                      </label>
                    </div>
                    <div className="field">
                      <label>{t('labelFile')}</label>
                      <input type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.epub,image/*,audio/*,video/*" onChange={onUpFile} />
                    </div>
                    <div className="field" style={{ gridColumn: 'span 2' }}>
                      <label>{t('labelLinkUrl')}</label>
                      <input value={upForm.link} onChange={e => setUpForm({ ...upForm, link: e.target.value })}
                        placeholder={upForm.type === 'video' ? 'YouTube / Drive / direct video URL (best for big videos)' : 'https://…'} />
                    </div>
                    <div className="field">
                      <label>{t('labelAttachment')}</label>
                      <div style={{ fontSize: 13.5, paddingTop: 6, color: upFile ? 'var(--success, #059669)' : 'var(--muted)' }}>
                        {upFile ? '📎 ' + upFile.name + (upFile.size ? ' (' + (upFile.size / MB).toFixed(1) + ' MB)' : '') : t('noFileSelected')}
                      </div>
                    </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>{t('labelContentText')}</label>
                    <textarea rows={3} value={upForm.body} onChange={e => setUpForm({ ...upForm, body: e.target.value })} placeholder="Write or paste the lesson content…" />
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1', marginTop: -4 }}>
                    <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--muted)', background: 'var(--brand-50)', border: '1px dashed var(--brand-300)', borderRadius: 8, padding: '8px 10px' }}>
                      {upForm.type === 'video'
                        ? t('hintVideo')
                        : upForm.type === 'test' || upForm.type === 'exam'
                          ? t('hintTest')
                          : upForm.type === 'library'
                            ? t('hintLibrary')
                            : t('hintTextbook')}
                    </div>
                  </div>
                </div>

                {(['test', 'exam'].includes(upForm.type)) && (
                  <div style={{ border: '1.5px dashed var(--brand-300)', borderRadius: 12, padding: 14, marginTop: 4, background: 'var(--brand-50)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                      <b>🧪 {t('questions')} ({upForm.questions.length})</b>
                      <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{t('noQuestions')}</span>
                    </div>
                    {upForm.questions.map((qq, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', marginBottom: 8, fontSize: 13.5 }}>
                        <b>{i + 1}.</b>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{qq.q}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                            {qq.options.map((o, oi) => (
                              <span key={oi} style={{ marginRight: 10, color: o === qq.answer ? '#059669' : undefined, fontWeight: o === qq.answer ? 700 : 400 }}>
                                {o === qq.answer ? '✓ ' : '• '}{o}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button type="button" className="btn sm danger" onClick={() => removeQuestion(i)}>🗑</button>
                      </div>
                    ))}
                    <div className="grid cols2" style={{ gap: 10 }}>
                      <div className="field" style={{ gridColumn: '1 / -1', marginBottom: 8 }}>
                        <label>{t('question')} *</label>
                        <input value={qDraft.q} onChange={e => setQDraft({ ...qDraft, q: e.target.value })} placeholder="e.g. What is 2 + 2?" />
                      </div>
                      {qDraft.o.map((o, i) => (
                        <div className="field" key={i} style={{ marginBottom: 8 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="radio" name="correctOpt" checked={qDraft.a === i} onChange={() => setQDraft({ ...qDraft, a: i })} style={{ width: 'auto' }} />
                            {t('optionWord')} {String.fromCharCode(65 + i)}{qDraft.a === i ? ' ✓ ' + t('correctAnswer') : ''}
                          </label>
                          <input value={o} onChange={e => { const no = [...qDraft.o]; no[i] = e.target.value; setQDraft({ ...qDraft, o: no }); }} placeholder={t('optionWord') + ' ' + String.fromCharCode(65 + i)} />
                        </div>
                      ))}
                    </div>
                    <button type="button" className="btn sm" onClick={addQuestion}>➕ {t('addQuestion')}</button>
                  </div>
                )}

                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button className="btn green" type="submit">{editId ? t('saveChanges') : '📤 ' + t('upload')}</button>
                    {editId && <button className="btn ghost" type="button" onClick={cancelEdit}>✕ {t('cancelBtn')}</button>}
                  </div>
                </form>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
                <div className="field" style={{ maxWidth: 240, marginBottom: 0 }}>
                  <label>🔍 {t('search')}</label>
                  <input value={upQ} onChange={e => setUpQ(e.target.value)} placeholder={t('phTitleOrSubject')} />
                </div>
                <div className="field" style={{ width: 180, marginBottom: 0 }}>
                  <label>{t('typeLabel')}</label>
                  <select value={upTypeF} onChange={e => setUpTypeF(e.target.value)}>
                    <option value="all">{t('allTypes')}</option>
                    <option value="book">{t('typeBook')}</option>
                    <option value="material">{t('typeMaterialShort')}</option>
                    <option value="video">{t('typeVideo')}</option>
                    <option value="library">{t('typeLibraryShort')}</option>
                    <option value="test">{t('typeTestShort')}</option>
                    <option value="exam">{t('typeExam')}</option>
                  </select>
                </div>
                <div className="field" style={{ width: 150, marginBottom: 0 }}>
                  <label>{t('grade')}</label>
                  <select value={upGradeF} onChange={e => setUpGradeF(e.target.value)}>
                    <option value="all">{t('all')}</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => <option key={g} value={String(g)}>{t('grade')} {g}</option>)}
                    <option value="remedial">{t('remedial')}</option>
                  </select>
                </div>
                <div className="field" style={{ width: 160, marginBottom: 0 }}>
                  <label>{t('subjects')}</label>
                  <select value={upSubF} onChange={e => setUpSubF(e.target.value)}>
                    <option value="all">{t('all')}</option>
                    {[...new Set(uploads.map(u => u.subject).filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field" style={{ width: 150, marginBottom: 0 }}>
                  <label>{t('status')}</label>
                  <select value={upStatusF} onChange={e => setUpStatusF(e.target.value)}>
                    <option value="all">{t('all')}</option>
                    <option value="locked">🔒 Locked</option>
                    <option value="free">🆓 Free</option>
                    <option value="hidden">🙈 Hidden</option>
                  </select>
                </div>
                <div className="field" style={{ width: 140, marginBottom: 0 }}>
                  <label>{t('sortLabel')}</label>
                  <select value={upSort} onChange={e => setUpSort(e.target.value)}>
                    <option value="newest">{t('newestFirst')}</option>
                    <option value="oldest">{t('oldestFirst')}</option>
                    <option value="title">{t('titleAZ')}</option>
                  </select>
                </div>
                <span style={{ fontSize: 13, color: 'var(--muted)', paddingBottom: 10 }}>{filteredUploads.length}/{uploads.length}</span>
              </div>

              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>{t('name')}</th><th>{t('typeLabel')}</th><th>{t('grade')}</th><th>{t('fee')}</th><th>{t('status')}</th><th>{t('unlockedTh')}</th><th>{t('actions')}</th></tr>
                  </thead>
                  <tbody>
                    {filteredUploads.map(u => {
                      const st = store.itemStats(u.id);
                      return (
                      <tr key={u.id} style={u.hidden ? { opacity: .55 } : undefined}>
                        <td><b>{u.title}</b>{u.subject ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.subject}{u.questions?.length ? ` · 🧪 ${u.questions.length}` : ''}</div> : null}</td>
                        <td>{{ book: t('typeBook'), material: t('typeMaterialShort'), video: t('typeVideo'), library: t('typeLibraryShort'), test: t('typeTestShort'), exam: t('typeExam') }[u.type] || u.type}</td>
                        <td>{u.grade === 'all' ? t('all') : u.grade === 'remedial' ? t('remedial') : 'G' + u.grade}</td>
                        <td>ETB {u.price}</td>
                        <td>
                          <span className={'chip ' + (u.free ? 'info' : 'warn')}>
                            {u.free ? t('free') : '🔒 ' + t('locked')}
                          </span>
                          {u.hidden ? <span className="chip bad" style={{ marginLeft: 4 }}>🙈 {t('hidden')}</span> : null}
                        </td>
                        <td><span className="chip ok">{st.unlocked} 👥</span></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn sm ghost" style={{ marginRight: 6, marginBottom: 4 }} onClick={() => startEdit(u)}>✏️ {t('editBtn')}</button>
                          <button className="btn sm ghost" style={{ marginRight: 6, marginBottom: 4 }} onClick={() => setPreview(u)}>👁 {t('preview')}</button>
                          <button className="btn sm ghost" style={{ marginRight: 6, marginBottom: 4 }} onClick={() => { store.toggleFree(u.id); bump(); }}>
                            {u.free ? t('lockBtn') : t('makeFreeBtn')}
                          </button>
                          <button className="btn sm ghost" style={{ marginRight: 6, marginBottom: 4 }} onClick={() => { store.toggleHidden(u.id); bump(); }}>
                            {u.hidden ? '👁 ' + t('unhide') : '🙈 ' + t('hide')}
                          </button>
                          <button className="btn sm ghost" style={{ marginRight: 6, marginBottom: 4 }} onClick={() => { const r = store.cloneUpload(u.id); bump(); if (r.ok) flash(t('duplicatedN', { title: r.item.title })); else flash(r.error, false); }}>⧉ {t('clone')}</button>
                          <button className="btn sm danger" onClick={() => setConfirmBox({ title: '🗑 ' + t('deleteBtn'), message: t('confirmDeleteUpload', { title: u.title }), onYes: () => { if (editId === u.id) cancelEdit(); store.deleteUpload(u.id); bump(); } })}>🗑 {t('deleteBtn')}</button>
                        </td>
                      </tr>
                      );
                    })}
                    {filteredUploads.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>{t('noUploadsMatch')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'payments' && (
            <>
              <div className="grid cols3 stagger" style={{ marginBottom: 18 }}>
                <Stat grad="success" icon="💰" label={t('revenue')} value={'ETB ' + store.revenueTotal()} />
                <Stat grad="warning" icon="⏳" label={t('pending')} value={payRequests.filter(r => r.status === 'pending').length} delay={60} />
                <Stat grad="brand" icon="📦" label={t('packageActive')} value={students.filter(s => pkgActive(s)).length} delay={120} />
              </div>

              <div className="card" style={{ marginBottom: 18 }}>
                <h3 style={{ marginBottom: 14 }}>🔑 {t('resetReqTitle')}</h3>
                <div className="table-wrap" style={{ boxShadow: 'none' }}>
                  <table className="data">
                    <thead>
                      <tr><th>{t('student')}</th><th>{t('email')}</th><th>{t('dateTh')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr>
                    </thead>
                    <tbody>
                      {store.resetRequests().map(r => {
                        const st = students.find(s => s.id === r.studentId);
                        return (
                          <tr key={r.id}>
                            <td><b>{st?.fullName || '—'}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>{st?.schoolName}</div></td>
                            <td>{r.email}</td>
                            <td>{new Date(r.at).toLocaleDateString()}</td>
                            <td>
                              <span className={'chip ' + (r.status === 'done' ? 'ok' : r.status === 'approved' ? 'info' : 'warn')}>
                                {r.status === 'done' ? t('resetCompleted') : r.status === 'approved' ? t('resetAllowed') : t('resetWaiting')}
                              </span>
                            </td>
                            <td>
                              {r.status === 'pending'
                                ? <button className="btn sm green" onClick={() => { store.approveResetRequest(r.id); bump(); flash(t('resetAllowedFlash')); }}>{t('allowResetBtn')}</button>
                                : <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{r.status === 'done' ? t('pwChangedSmall') : t('waitingStudentSmall')}</span>}
                            </td>
                          </tr>
                        );
                      })}
                      {store.resetRequests().length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: 26, color: 'var(--muted)' }}>{t('noResetReqs')}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card" style={{ marginBottom: 18 }}>
                <h3 style={{ marginBottom: 14 }}>💳 {t('payReqTitle')}</h3>
                <div className="table-wrap" style={{ boxShadow: 'none' }}>
                  <table className="data">
                    <thead>
                      <tr><th>{t('student')}</th><th>{t('planItemTh')}</th><th>{t('fee')}</th><th>{t('dateTh')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr>
                    </thead>
                    <tbody>
                      {[...payRequests].reverse().map(r => {
                        const st = students.find(s => s.id === r.studentId);
                        return (
                          <tr key={r.id}>
                            <td><b>{st?.fullName || '—'}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>{st?.schoolName}</div></td>
                            <td>{r.planLabel}{r.plan === 'full' ? <span className="chip info" style={{ marginLeft: 6 }}>{t('fullBadge')}</span> : null}</td>
                            <td>ETB {r.price}</td>
                            <td>{new Date(r.at).toLocaleDateString()}</td>
                            <td>
                              <span className={'chip ' + (r.status === 'approved' ? 'ok' : r.status === 'rejected' ? 'bad' : 'warn')}>
                                {r.status === 'approved' ? '✓ ' + t('approved') : r.status === 'rejected' ? '✕ ' + t('rejected') : '⏳ ' + t('pending')}
                              </span>
                            </td>
                            <td>
                              {r.status === 'pending'
                                ? (
                                  <span style={{ display: 'inline-flex', gap: 6 }}>
                                    <button className="btn sm green" onClick={() => approveAndOpen(r)}>{r.plan === 'full' ? t('approveOpen') : t('approveUnlock')}</button>
                                    <button className="btn sm danger" onClick={() => { store.rejectRequest(r.id); bump(); flash(t('requestRejected')); }}>✕ {t('reject')}</button>
                                  </span>
                                )
                                : <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{r.status === 'rejected' ? t('rejected') : t('accessOpened')}</span>}
                            </td>
                          </tr>
                        );
                      })}
                      {payRequests.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 26, color: 'var(--muted)' }}>{t('noPayReqs')}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {tab === 'reports' && (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
                <div className="field" style={{ maxWidth: 220, marginBottom: 0 }}>
                  <label>🔍 {t('search')}</label>
                  <input value={repQ} onChange={e => setRepQ(e.target.value)} placeholder={t('phStudentName')} />
                </div>
                <div className="field" style={{ width: 180, marginBottom: 0 }}>
                  <label>{t('subjects')}</label>
                  <select value={repSub} onChange={e => setRepSub(e.target.value)}>
                    <option value="all">{t('all')}</option>
                    {[...new Set(reports.map(r => r.subject))].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field" style={{ width: 150, marginBottom: 0 }}>
                  <label>{t('grade')}</label>
                  <select value={repGrade} onChange={e => setRepGrade(e.target.value)}>
                    <option value="all">{t('all')}</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => <option key={g} value={String(g)}>{t('grade')} {g}</option>)}
                    <option value="remedial">{t('remedial')}</option>
                  </select>
                </div>
                <div className="field" style={{ width: 150, marginBottom: 0 }}>
                  <label>{t('fromLabel')}</label>
                  <input type="date" value={repFrom} onChange={e => setRepFrom(e.target.value)} />
                </div>
                <div className="field" style={{ width: 150, marginBottom: 0 }}>
                  <label>{t('toLabel')}</label>
                  <input type="date" value={repTo} onChange={e => setRepTo(e.target.value)} />
                </div>
                <button className="btn ghost sm" onClick={() => downloadCsv('reports.csv', [
                  ['Student', 'Subject', 'Chapter', 'Score', 'Total', 'Points', 'Date'],
                  ...repFiltered.map(r => {
                    const st = students.find(s => s.id === r.studentId);
                    return [st?.fullName || '—', r.subject, r.chapter, r.score, r.total, r.points, new Date(r.at).toLocaleDateString()];
                  })
                ])}>⬇️ {t('exportCsv')}</button>
                <span style={{ fontSize: 13, color: 'var(--muted)', paddingBottom: 10 }}>
                  {repFiltered.length}/{reports.length}
                  {repFiltered.length > 0 && <> · {t('classAverage')} <b style={{ color: 'var(--brand-700)' }}>{Math.round(repFiltered.reduce((a, r) => a + (r.score / (r.total || 1) * 100), 0) / repFiltered.length)}%</b></>}
                </span>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>{t('name')}</th><th>{t('subjects')}</th><th>{t('chapter')}</th><th>{t('score')}</th><th>{t('points')}</th><th>{t('dateTh')}</th></tr>
                  </thead>
                  <tbody>
                    {[...repFiltered].reverse().map(r => {
                      const st = students.find(s => s.id === r.studentId);
                      const p = Math.round(r.score / r.total * 100);
                      return (
                        <tr key={r.id}>
                          <td><b>{st?.fullName || '—'}</b></td>
                          <td>{r.subject}</td>
                          <td>{r.chapter}</td>
                          <td>
                            <span className={'chip ' + (p >= 60 ? 'ok' : p >= 40 ? 'warn' : 'bad')}>
                              {r.score}/{r.total} · {p}%
                            </span>
                          </td>
                          <td><span className="chip info">+{r.points}</span></td>
                          <td>{new Date(r.at).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                    {repFiltered.length === 0 && reports.length > 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>{t('noReportsMatch')}</td></tr>}
                    {reports.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>{t('noReportsYet')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'directors' && (
            <>
              {!dirForm && (
                <div style={{ marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <button className="btn green sm" onClick={() => setDirForm({ mode: 'add', fullName: '', email: '', schoolName: '', password: '' })}>➕ {t('addDirector')}</button>
                  <div className="field" style={{ maxWidth: 240, marginBottom: 0 }}>
                    <label>🔍 {t('search')}</label>
                    <input value={dirQ} onChange={e => setDirQ(e.target.value)} placeholder={t('phNameEmailSchool')} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--muted)', paddingBottom: 10 }}>{dirs.length}/{directors.length}</span>
                </div>
              )}
              {dirForm && (
                <div className="card" style={{ marginBottom: 18 }}>
                  <h3 style={{ marginBottom: 12 }}>{dirForm.mode === 'add' ? '➕ ' + t('addDirector') : '✏️ ' + t('editDirector')}</h3>
                  <div className="grid cols3" style={{ gap: 14 }}>
                    <div className="field">
                      <label>{t('name')} *</label>
                      <input value={dirForm.fullName} onChange={e => setDirForm({ ...dirForm, fullName: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>{t('email')} *</label>
                      <input value={dirForm.email} onChange={e => setDirForm({ ...dirForm, email: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>{t('school')}</label>
                      <input value={dirForm.schoolName} onChange={e => setDirForm({ ...dirForm, schoolName: e.target.value })} />
                    </div>
                    {dirForm.mode === 'add' && (
                      <div className="field">
                        <label>{t('passwordLabel')}</label>
                        <input value={dirForm.password} onChange={e => setDirForm({ ...dirForm, password: e.target.value })} placeholder="Enter a strong password" />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn green sm" onClick={dirSubmit}>💾 {t('saveBtn')}</button>
                    <button className="btn ghost sm" onClick={() => setDirForm(null)}>✕ {t('cancelBtn')}</button>
                  </div>
                </div>
              )}
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>{t('name')}</th><th>{t('school')}</th><th>{t('email')}</th><th>{t('studentsTh')}</th><th>{t('status')}</th><th>{t('joinedLabel')}</th><th>{t('actions')}</th></tr></thead>
                <tbody>
                  {dirs.map(d => (
                    <tr key={d.id} style={d.active === false ? { opacity: .6 } : undefined}>
                      <td><b>{d.fullName}</b></td>
                      <td>{d.schoolName || '—'}</td>
                      <td>{d.email}</td>
                      <td><span className="chip info">{students.filter(s => s.directorId === d.id).length}</span></td>
                      <td>{d.active === false ? <span className="chip bad">⊘ {t('inactive')}</span> : <span className="chip ok">● {t('active')}</span>}</td>
                      <td>{new Date(d.joinedAt).toLocaleDateString()}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn sm ghost" style={{ marginRight: 6, marginBottom: 4 }} onClick={() => setDirForm({ mode: 'edit', id: d.id, fullName: d.fullName, email: d.email, schoolName: d.schoolName || '' })}>✏️ {t('editBtn')}</button>
                        <button className="btn sm ghost" style={{ marginRight: 6, marginBottom: 4 }} onClick={() => openAssign(d)}>👥 {t('assignStudents')}</button>
                        <button className="btn sm ghost" style={{ marginRight: 6, marginBottom: 4 }} onClick={() => setNotesFor(d.id)}>📝 {t('viewNotes')}</button>
                        <button className="btn sm ghost" style={{ marginRight: 6, marginBottom: 4 }} onClick={() => setDirPassword(d)}>🔑 {t('setPasswordBtn')}</button>
                        <button className={'btn sm ' + (d.active === false ? 'green' : 'danger')} onClick={() => { store.updateUser(d.id, { active: d.active === false }); bump(); flash(d.active === false ? t('directorActivated') : t('directorDeactivated')); }}>
                          {d.active === false ? '✅ ' + t('active') : '🚫 ' + t('inactive')}
                        </button>
                        <button className="btn sm danger" style={{ marginLeft: 6, marginBottom: 4 }} onClick={() => deleteDirector(d)}>🗑</button>
                      </td>
                    </tr>
                  ))}
                  {dirs.length === 0 && directors.length > 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>{t('noDirsMatch')}</td></tr>}
                  {directors.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>{t('noDirsYet')}</td></tr>}
                </tbody>
              </table>
              </div>
            </>
          )}
          {tab === 'settings' && (
            <div className="grid cols2 stagger">
              <div className="card">
                <h3 style={{ marginBottom: 6 }}>💳 {t('paymentPhone')}</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  {t('settingsPhoneSub')}
                </p>
                <div className="field">
                  <input value={payPhone} onChange={e => setPayPhone(e.target.value)} placeholder="+251 9X XXX XXXX" />
                </div>
                {!payPhone.trim() && (
                  <div className="note-box" style={{ marginBottom: 12, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
                    ⚠️ {t('payPhoneAdminWarn')}
                  </div>
                )}
                <button className="btn green sm" onClick={saveSettingsNow}>💾 {t('saveSettings')}</button>
              </div>
              <div className="card">
                <h3 style={{ marginBottom: 6 }}>📣 {t('announcement')}</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  {t('settingsAnnSub')}
                </p>
                <div className="field">
                  <textarea rows={3} value={annText} onChange={e => setAnnText(e.target.value)} placeholder={t('phAnnouncement')} />
                </div>
                <button className="btn sm" onClick={postAnnouncement}>📣 {t('postAnnouncement')}</button>
                <div style={{ marginTop: 14 }}>
                  {store.announcements().map(a => (
                    <div key={a.id} className="note-box" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <span><b>📣</b> {a.text}<div style={{ fontSize: 11.5, opacity: .7 }}>{new Date(a.at).toLocaleString()}</div></span>
                      <button className="btn sm danger" onClick={() => setConfirmBox({ title: '📣 ' + t('deleteBtn'), message: t('confirmDeleteAnn'), onYes: () => { store.deleteAnnouncement(a.id); bump(); } })}>🗑</button>
                    </div>
                  ))}
                  {store.announcements().length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('noAnnouncements')}</div>}
                </div>
              </div>
              <div className="card">
                <h3 style={{ marginBottom: 6 }}>👤 {t('myAccount')}</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  {t('myAccountSub')}
                </p>
                <div className="field">
                  <label>{t('name')}</label>
                  <input value={acctForm.fullName} onChange={e => setAcctForm({ ...acctForm, fullName: e.target.value })} />
                </div>
                <div className="field">
                  <label>{t('email')}</label>
                  <input type="email" value={acctForm.email} onChange={e => setAcctForm({ ...acctForm, email: e.target.value })} />
                </div>
                <div className="grid cols2" style={{ gap: 12 }}>
                  <div className="field">
                    <label>{t('currentPw')}</label>
                    <input type="password" value={acctForm.currentPw} onChange={e => setAcctForm({ ...acctForm, currentPw: e.target.value })} placeholder="••••••" autoComplete="current-password" />
                  </div>
                  <div className="field">
                    <label>{t('newPwLabel')}</label>
                    <input type="password" value={acctForm.newPw} onChange={e => setAcctForm({ ...acctForm, newPw: e.target.value })} placeholder={t('phKeepPw')} autoComplete="new-password" />
                  </div>
                </div>
                <button className="btn green sm" onClick={saveAccount}>{t('saveAccountBtn')}</button>
              </div>
            </div>
          )}
        </div>

        {preview && (
          <Modal wide onClose={() => setPreview(null)}>
            <h3 style={{ marginBottom: 4 }}>👁 {t('preview')} — {preview.title}</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
              {preview.subject || '—'} · {preview.grade === 'all' ? t('all') : 'G' + preview.grade} · ETB {preview.price} · {preview.free ? t('free') : t('locked')}
            </p>
            {preview.fileData && preview.fileData.startsWith('data:image') && (
              <img src={preview.fileData} alt={preview.title} style={{ maxWidth: '100%', borderRadius: 10, marginBottom: 12 }} />
            )}
            {preview.fileData && preview.fileData.startsWith('data:video') && (
              <video controls src={preview.fileData} style={{ width: '100%', maxHeight: 420, background: '#000', borderRadius: 10, marginBottom: 12 }} />
            )}
            {preview.fileData && preview.fileData.startsWith('data:audio') && (
              <audio controls src={preview.fileData} style={{ width: '100%', marginBottom: 12 }} />
            )}
            {preview.fileData && preview.fileData.startsWith('data:application/pdf') && (
              <iframe title="preview" src={preview.fileData} style={{ width: '100%', height: 420, border: '1px solid var(--line)', borderRadius: 10, marginBottom: 12 }} />
            )}
            {preview.fileData && preview.fileName && !/^data:(image|video|audio|application\/pdf)/.test(preview.fileData) && (
              <div className="note-box" style={{ marginBottom: 12 }}>
                📄 <a href={preview.fileData} download={preview.fileName} style={{ fontWeight: 600 }}>{preview.fileName}</a> {t('cantPreview')}
              </div>
            )}
            {preview.link && (
              <div style={{ marginBottom: 12 }}>
                <a href={preview.link} target="_blank" rel="noreferrer" className="btn sm ghost">🔗 {preview.link}</a>
              </div>
            )}
            {preview.body && (
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.65, background: 'var(--brand-50)', padding: 16, borderRadius: 10 }}>{preview.body}</div>
            )}
            {!preview.fileData && !preview.link && !preview.body && (
              <div className="empty"><div className="ico">📄</div>{t('noContentAttached')}</div>
            )}
            {preview.questions?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <b>🧪 {t('questions')} ({preview.questions.length})</b>
                <ol style={{ paddingLeft: 20, marginTop: 8, fontSize: 14 }}>
                  {preview.questions.map((qq, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>{qq.q} <span style={{ color: '#059669', fontWeight: 700 }}>✓ {qq.answer}</span></li>
                  ))}
                </ol>
              </div>
            )}
          </Modal>
        )}

        {detailStu && (
          <Modal wide onClose={() => setDetail(null)}>
            <h3 style={{ marginBottom: 2 }}>👤 {detailStu.fullName}</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
              {detailStu.email} · {t('joinedLabel')} {new Date(detailStu.joinedAt).toLocaleDateString()} · ⭐ {detailStu.points || 0} ·{' '}
              {pkgChip(detailStu)} {detailStu.aiEnabled !== false ? <span className="chip ok">{t('aiOnChip')}</span> : <span className="chip bad">{t('aiOffChip')}</span>}
            </p>

            <div className="grid cols3" style={{ gap: 12, marginBottom: 16 }}>
              {[
                [t('name'), detailStu.fullName],
                [t('school'), detailStu.schoolName || '—'],
                [t('grade'), detailStu.grade === 'remedial' ? t('remedial') : t('grade') + ' ' + detailStu.grade]
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--brand-50, #f0fdfa)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 2 }}>{k}</div>
                  <b style={{ fontSize: 15 }}>{v}</b>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
              {t('detailReadOnlySub')}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <button className="btn ghost sm" onClick={() => {
                const r = store.adminAllowReset(detailStu.email);
                bump();
                if (r) flash(t('resetAllowedFlash2', { email: detailStu.email }));
                else flash(t('emailNotFound'));
              }}>🔑 {t('resetPassword')}</button>
              <button className="btn ghost sm" onClick={() => {
                const pw = window.prompt(t('promptSetPw', { email: detailStu.email }));
                if (pw == null) return;
                const res = store.setUserPassword(detailStu.id, pw);
                bump();
                if (res.ok) flash(t('pwSetLogin2', { email: detailStu.email }));
                else flash(res.error, false);
              }}>🔑 {t('setNewPwBtn')}</button>
              <button className={'btn sm ' + (detailStu.aiEnabled !== false ? 'ghost' : 'green')} onClick={() => { toggleAI(detailStu.id); }}>🤖 {detailStu.aiEnabled !== false ? t('inactive') : t('active')}</button>
              {pkgActive(detailStu) && (
                <button className="btn sm danger" onClick={() => { togglePackage(detailStu.id); }}>{t('closePackage')}</button>
              )}
              {!pkgActive(detailStu) && detailPendFull && (
                <button className="btn sm green" onClick={() => { togglePackage(detailStu.id); }}>🔓 {t('openPackage')}</button>
              )}
              {!pkgActive(detailStu) && !detailPendFull && (
                <span style={{ fontSize: 12.5, color: 'var(--muted)', alignSelf: 'center' }}>
                  {t('noPayReqYet')}
                </span>
              )}
              <button className={'btn sm ' + (detailStu.active === false ? 'green' : 'danger')} onClick={() => { toggleActive(detailStu.id); }}>
                {detailStu.active === false ? '✅ ' + t('unblockBtn') : '⛔ ' + t('blockLoginBtn')}
              </button>
              <button className="btn sm danger" onClick={() => setConfirmBox({
                title: '🗑 ' + t('deleteStudent'),
                message: t('confirmDeleteStudent', { name: detailStu.fullName }),
                onYes: () => {
                  store.removeUser(detailStu.id);
                  setDetail(null);
                  bump();
                  flash(t('studentDeleted'));
                }
              })}>🗑 {t('deleteStudent')}</button>
            </div>

            <h4 style={{ marginBottom: 8 }}>📈 {t('reports')}</h4>
            <div className="table-wrap" style={{ marginBottom: 14, boxShadow: 'none' }}>
              <table className="data">
                <thead><tr><th>{t('subjects')}</th><th>{t('chapter')}</th><th>{t('score')}</th><th>{t('dateTh')}</th></tr></thead>
                <tbody>
                  {reports.filter(r => r.studentId === detailStu.id).slice(-5).reverse().map(r => (
                    <tr key={r.id}>
                      <td>{r.subject}</td>
                      <td>{r.chapter}</td>
                      <td><span className="chip info">{r.score}/{r.total}</span></td>
                      <td>{new Date(r.at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {reports.filter(r => r.studentId === detailStu.id).length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: 18, color: 'var(--muted)' }}>{t('noReportsYet')}</td></tr>}
                </tbody>
              </table>
            </div>

            <h4 style={{ marginBottom: 8 }}>🔓 {t('unlockedItems')}</h4>
            <div style={{ fontSize: 14, marginBottom: 14 }}>
              {detailStu.packageOpen && <span className="chip info" style={{ marginRight: 6 }}>📦 {t('fullPackageChip')}{detailStu.packageExpires ? ' · ' + t('expShort') + ' ' + new Date(detailStu.packageExpires).toLocaleDateString() : ''}</span>}
              {(detailStu.unlocked || []).map(id => {
                const item = uploads.find(u => u.id === id);
                return item ? <span className="chip ok" key={id} style={{ marginRight: 6, marginBottom: 4 }}>✓ {item.title}</span> : null;
              })}
              {!detailStu.packageOpen && !(detailStu.unlocked || []).length && <span style={{ color: 'var(--muted)' }}>{t('nothingUnlocked')}</span>}
            </div>

            <h4 style={{ marginBottom: 8 }}>💳 {t('myRequests')}</h4>
            <div className="table-wrap" style={{ boxShadow: 'none' }}>
              <table className="data">
                <thead><tr><th>{t('name')}</th><th>{t('fee')}</th><th>{t('status')}</th><th>{t('dateTh')}</th></tr></thead>
                <tbody>
                  {store.payRequests().filter(r => r.studentId === detailStu.id).map(r => (
                    <tr key={r.id}>
                      <td>{r.planLabel}</td>
                      <td>ETB {r.price}</td>
                      <td><span className={'chip ' + (r.status === 'approved' ? 'ok' : r.status === 'rejected' ? 'bad' : 'warn')}>{t(r.status)}</span></td>
                      <td>{new Date(r.at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {store.payRequests().filter(r => r.studentId === detailStu.id).length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: 18, color: 'var(--muted)' }}>{t('noRequests')}</td></tr>}
                </tbody>
              </table>
            </div>
          </Modal>
        )}

        {assignFor && (
          <Modal wide onClose={() => setAssignFor(null)}>
            <h3 style={{ marginBottom: 4 }}>👥 {t('assignStudents')}</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              {directors.find(d => d.id === assignFor)?.fullName} · {assignIds.length} {t('selectedWord')}
            </p>
            <div className="field" style={{ maxWidth: 280, marginBottom: 10 }}>
              <input value={assignQ} onChange={e => setAssignQ(e.target.value)} placeholder={t('phAssignSearch')} />
            </div>
            <div style={{ maxHeight: 340, overflow: 'auto', marginBottom: 14 }}>
              {students.filter(s => !assignQ || (s.fullName + ' ' + (s.schoolName || '') + ' ' + s.grade).toLowerCase().includes(assignQ.toLowerCase())).map(s => (
                <label key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid var(--line)', fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={assignIds.includes(s.id)} onChange={() => setAssignIds(a => a.includes(s.id) ? a.filter(x => x !== s.id) : [...a, s.id])} />
                  <b>{s.fullName}</b>
                  <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{s.schoolName} · G{s.grade}</span>
                  {s.directorId && s.directorId !== assignFor && <span className="chip warn">→ {directors.find(d => d.id === s.directorId)?.fullName || '?'}</span>}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn green sm" onClick={saveAssign}>💾 {t('saveBtn')}</button>
              <button className="btn ghost sm" onClick={() => setAssignFor(null)}>✕ {t('cancelBtn')}</button>
            </div>
          </Modal>
        )}

        {notesFor && (
          <Modal wide onClose={() => setNotesFor(null)}>
            <h3 style={{ marginBottom: 4 }}>📝 {t('viewNotes')} — {directors.find(d => d.id === notesFor)?.fullName}</h3>
            <div style={{ maxHeight: 380, overflow: 'auto', marginTop: 12 }}>
              {directorNotes(notesFor).length === 0 && <div className="empty"><div className="ico">📝</div>{t('noNotes')}</div>}
              {directorNotes(notesFor).map(({ student, notes }) => (
                <div key={student.id} style={{ marginBottom: 14 }}>
                  <b>{student.fullName}</b> <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{student.schoolName}</span>
                  {notes.map((n, i) => (
                    <div key={i} className="note-box" style={{ marginTop: 6, marginBottom: 0 }}>
                      {typeof n === 'string' ? n : (n.text || JSON.stringify(n))}
                      <div style={{ fontSize: 11.5, opacity: .7 }}>{n.at ? new Date(n.at).toLocaleString() : ''}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Modal>
        )}

        <ConfirmModal box={confirmBox} onClose={() => setConfirmBox(null)} />
      </main>
    </div>
  );
}