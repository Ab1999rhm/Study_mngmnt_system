import { redeemGraph } from './aiGraph.js';
import bcrypt from 'bcryptjs';

const K = 'ssa_db_v1';
const SK = 'ssa_session_v1';

// passwords are never stored raw: bcrypt (10 rounds) at rest, verified on login
function hashPw(pw) {
  return bcrypt.hashSync(String(pw), 10);
}
function checkPw(pw, stored) {
  if (stored == null) return false;
  const s = String(stored);
  if (s.startsWith('$2')) {
    try { return bcrypt.compareSync(String(pw), s); } catch { return false; }
  }
  return String(pw) === s; // legacy plain-text entry: accepted once, then migrated
}
function upgradePw(u, pw) {
  if (u.password != null && !String(u.password).startsWith('$2')) {
    const h = hashPw(pw);
    if (h) u.password = h;
  }
}

function load() {
  try { return JSON.parse(localStorage.getItem(K)) || {}; } catch { return {}; }
}
function save(db) {
  let ok = true;
  try { localStorage.setItem(K, JSON.stringify(db)); } catch { ok = false; }
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent('ssa:db')); } catch { /* noop */ }
    schedulePush();
  }
  return ok;
}

// session lives in a per-browser key so Chrome and Edge can log in separately
let session = null;
try { session = localStorage.getItem(SK) || null; } catch {}
function setSession(id) {
  session = id || null;
  try {
    if (session) localStorage.setItem(SK, session);
    else localStorage.removeItem(SK);
  } catch {}
}

let syncOn = typeof window !== 'undefined'
  && !(window.location && String(window.location.pathname).includes('seed-test'))
  && !(window.location && String(window.location.search).includes('user='));
let pushTimer = null;
let adopting = false;
let firstPullDone = false;

function schedulePush() {
  if (!syncOn || adopting || !firstPullDone) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushDb, 400);
}
async function pushDb() {
  if (!syncOn || typeof fetch !== 'function') return;
  try {
    const res = await fetch(new URL('/api/db', window.location.origin), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db })
    });
    if (!res.ok) throw new Error('push failed');
  } catch { syncOn = false; }
}
async function pullDb() {
  if (!syncOn || typeof fetch !== 'function') return false;
  try {
    const res = await fetch(new URL('/api/db', window.location.origin), { cache: 'no-store' });
    if (!res.ok) return false;
    let remote = null;
    try { remote = await res.json(); } catch { syncOn = false; return false; }
    firstPullDone = true;
    const fresh = remote && remote.db;
    if (fresh && Array.isArray(fresh.users)) adoptDb(fresh);
    else if (fresh === null) schedulePush();
    return true;
  } catch { syncOn = false; return false; }
}
function adoptDb(fresh) {
  adopting = true;
  db.users = fresh.users || [];
  db.reports = fresh.reports || [];
  db.videos = fresh.videos || [];
  db.uploads = fresh.uploads || [];
  db.codes = fresh.codes || [];
  db.payRequests = fresh.payRequests || [];
  db.resetRequests = fresh.resetRequests || [];
  db.settings = fresh.settings || db.settings;
  db.announcements = fresh.announcements || [];
  db.packages = fresh.packages && fresh.packages.length ? fresh.packages : db.packages;
  db.notes = Array.isArray(fresh.notes) && fresh.notes.length ? fresh.notes : db.notes;
  delete db.session;
  try { localStorage.setItem(K, JSON.stringify(db)); } catch {}
  try { window.dispatchEvent(new CustomEvent('ssa:db')); } catch {}
  adopting = false;
}
async function startSync() {
  const ok = await pullDb();
  if (!ok) { syncOn = false; return; }
  try {
    const es = new EventSource(new URL('/api/db/events', window.location.origin));
    let t = null;
    es.onmessage = () => { clearTimeout(t); t = setTimeout(() => { pullDb(); }, 150); };
  } catch {}
}

const db = load();
if ('session' in db) {
  session = db.session ? String(db.session) : null;
  try {
    if (session) localStorage.setItem(SK, session);
    else localStorage.removeItem(SK);
  } catch {}
}
delete db.session;
db.users = db.users || [];
db.reports = db.reports || [];
db.videos = db.videos || [];
db.uploads = db.uploads || [];
db.codes = db.codes || [];
db.payRequests = db.payRequests || [];
db.resetRequests = db.resetRequests || [];
if (!Array.isArray(db.notes)) {
  db.notes = db.notes && typeof db.notes === 'object'
    ? Object.keys(db.notes).flatMap(sid => (Array.isArray(db.notes[sid]) ? db.notes[sid].map(n => ({ ...n, studentId: sid })) : []))
    : [];
}
db.settings = db.settings || { payPhone: '' };
db.announcements = db.announcements || [];
db.packages = db.packages && db.packages.length ? db.packages : [
  { id: 'pk_month', name: 'Full access — 30 days', price: 1000, days: 30 },
  { id: 'pk_year', name: 'Full access — 365 days', price: 8000, days: 365 }
];
// migrate legacy per-browser follow-up notes (ssa_notes_<studentId>) into the shared store
try {
  const legacyKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf('ssa_notes_') === 0) legacyKeys.push(k);
  }
  for (const k of legacyKeys) {
    const sid = k.slice('ssa_notes_'.length);
    let list = [];
    try { list = JSON.parse(localStorage.getItem(k) || '[]'); } catch { list = []; }
    if (Array.isArray(list) && list.length && !db.notes.some(n => n.studentId === sid)) {
      for (const n of list) db.notes.push({ studentId: sid, text: n.text, by: n.by, at: n.at });
    }
    try { localStorage.removeItem(k); } catch {}
  }
} catch { /* noop */ }
save(db);

if (typeof window !== 'undefined' && syncOn) setTimeout(startSync, 50);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === SK) {
      session = e.newValue || null;
      try { window.dispatchEvent(new CustomEvent('ssa:db')); } catch { /* noop */ }
      return;
    }
    if (e.key !== K || e.newValue == null) return;
    let fresh;
    try { fresh = JSON.parse(e.newValue); } catch { return; }
    db.users = fresh.users || [];
    db.reports = fresh.reports || [];
    db.videos = fresh.videos || [];
    db.uploads = fresh.uploads || [];
    db.codes = fresh.codes || [];
    db.payRequests = fresh.payRequests || [];
    db.resetRequests = fresh.resetRequests || [];
    db.settings = fresh.settings || db.settings;
    db.announcements = fresh.announcements || [];
    db.packages = fresh.packages || db.packages;
    db.notes = Array.isArray(fresh.notes) ? fresh.notes : db.notes;
    delete db.session;
    try { window.dispatchEvent(new CustomEvent('ssa:db')); } catch { /* noop */ }
  });
}

const CODE_L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_D = '23456789';
function genCodeStr() {
  const pick = s => s[Math.floor(Math.random() * s.length)];
  return pick(CODE_L) + pick(CODE_L) + pick(CODE_L) + pick(CODE_D) + pick(CODE_D) + pick(CODE_D);
}

// Resolve which package plan a payment request selected (falls back to the first plan).
function resolvePkg(r) {
  if (!r || r.plan !== 'full') return null;
  return (r.packageId && db.packages.find(p => p.id === r.packageId))
    || db.packages.find(p => p.name === r.planLabel)
    || db.packages[0] || null;
}
function grantPkg(u, pkg) {
  const d = pkg ? Number(pkg.days) : 30;
  u.packageOpen = true;
  u.packageExpires = d > 0 ? new Date(Date.now() + d * 86400000).toISOString() : null;
  if (pkg) u.packagePlan = { id: pkg.id, label: pkg.name, days: pkg.days };
  else u.packagePlan = u.packagePlan || null;
}

export const store = {
  get db() { return db; },

  registerStudent({ fullName, schoolName, directorName, grade, email, password }) {
    const user = {
      id: 'stu_' + Date.now(),
      role: 'student',
      fullName, schoolName, directorName, grade,
      email, password: hashPw(password || 'student123'),
      points: 0,
      favorites: [],
      progress: {},
      scores: [],
      unlocked: [],
      directorId: null,
      joinedAt: new Date().toISOString(),
      packageOpen: false,
      aiEnabled: true
    };
    db.users.push(user);
    setSession(user.id);
    save(db);
    return user;
  },

  login(email, password, role) {
    const u = db.users.find(x => x.email === email && (!role || x.role === role));
    if (!u || !checkPw(password, u.password)) return null;
    upgradePw(u, password);
    if (u.active === false) return null;
    setSession(u.id); save(db);
    return u;
  },

  // Returns { user, reason } so callers can distinguish blocked vs wrong-password
  loginWithReason(email, password, role) {
    const u = db.users.find(x => x.email === email && (!role || x.role === role));
    if (!u || !checkPw(password, u.password)) return { user: null, reason: 'invalid' };
    upgradePw(u, password);
    if (u.active === false) return { user: null, reason: 'blocked' };
    setSession(u.id); save(db);
    return { user: u, reason: 'ok' };
  },

  logout() { setSession(null); save(db); },

  currentUser() {
    if (!session) return null;
    return db.users.find(u => u.id === session) || null;
  },

  userById(id) {
    if (!id) return null;
    return db.users.find(u => u.id === id) || null;
  },

  emailTaken(email) {
    const e = (email || '').trim();
    return db.users.some(u => u.email === e);
  },

  updateUser(id, patch) {
    const u = db.users.find(x => x.id === id);
    if (u) { Object.assign(u, patch); save(db); }
    return u;
  },

  students() { return db.users.filter(u => u.role === 'student'); },

  addStudent({ fullName, email, schoolName, grade, password }) {
    if (!fullName || !email) return { ok: false, error: 'Name and email required' };
    if (db.users.some(u => u.email === email)) return { ok: false, error: 'Email already exists' };
    const user = {
      id: 'stu_' + Date.now(), role: 'student',
      fullName, schoolName: schoolName || '', directorName: '', directorId: null,
      grade: grade || '8', email, password: hashPw(password || 'student123'),
      points: 0, favorites: [], progress: {}, scores: [],
      joinedAt: new Date().toISOString(), packageOpen: false, aiEnabled: true
    };
    db.users.push(user);
    if (!save(db)) { db.users.pop(); return { ok: false, error: 'Storage full' }; }
    return { ok: true, user };
  },

  addDirector({ fullName, email, schoolName, password }) {
    if (!fullName || !email) return { ok: false, error: 'Name and email required' };
    if (db.users.some(u => u.email === email)) return { ok: false, error: 'Email already exists' };
    const user = {
      id: 'dir_' + Date.now(), role: 'director',
      fullName, email, schoolName: schoolName || '',
      password: hashPw(password || 'director123'),
      joinedAt: new Date().toISOString(), active: true
    };
    db.users.push(user);
    if (!save(db)) { db.users.pop(); return { ok: false, error: 'Storage full' }; }
    return { ok: true, user };
  },

  removeUser(id) {
    const u = db.users.find(x => x.id === id);
    if (!u || u.role === 'admin') return false;
    db.users = db.users.filter(x => x.id !== id);
    db.users.forEach(x => { if (x.directorId === id) x.directorId = null; });
    if (session === id) setSession(null);
    save(db);
    return true;
  },

  directors() { return db.users.filter(u => u.role === 'director'); },

  assignStudents(directorId, studentIds) {
    db.users.forEach(x => {
      if (x.role !== 'student') return;
      if (studentIds.includes(x.id)) {
        x.directorId = directorId;
        const d = db.users.find(y => y.id === directorId);
        if (d) x.directorName = d.fullName;
      } else if (x.directorId === directorId) {
        x.directorId = null;
        x.directorName = null;
      }
    });
    save(db);
  },

  addScore(studentId, payload) {
    const rec = {
      id: 'sc_' + Date.now(),
      studentId,
      ...payload,
      at: new Date().toISOString()
    };
    db.reports.push(rec);
    const u = db.users.find(x => x.id === studentId);
    if (u) { u.points = (u.points || 0) + (payload.points || 0); u.scores = u.scores || []; u.scores.push(rec); }
    save(db);
    return rec;
  },

  reports() { return db.reports; },

  toggleFavorite(studentId, videoId) {
    const u = db.users.find(x => x.id === studentId);
    if (!u) return [];
    u.favorites = u.favorites || [];
    u.favorites = u.favorites.includes(videoId)
      ? u.favorites.filter(v => v !== videoId)
      : [...u.favorites, videoId];
    save(db);
    return u.favorites;
  },

  setProgress(studentId, key, value) {
    const u = db.users.find(x => x.id === studentId);
    if (!u) return;
    u.progress = u.progress || {};
    u.progress[key] = value;
    save(db);
  },

  uploads() { return db.uploads; },

  addUpload(data) {
    const item = {
      id: 'up_' + Date.now(),
      type: data.type || 'material',
      title: (data.title || '').trim(),
      subject: (data.subject || '').trim(),
      grade: data.grade || 'all',
      link: (data.link || '').trim(),
      body: (data.body || '').trim(),
      fileData: data.fileData || null,
      fileName: data.fileName || null,
      price: Math.max(0, Number(data.price) || 100),
      free: !!data.free,
      hidden: false,
      questions: Array.isArray(data.questions) ? data.questions : [],
      createdAt: new Date().toISOString()
    };
    if (!item.title) return { ok: false, error: 'Title required' };
    db.uploads.unshift(item);
    if (!save(db)) { db.uploads.shift(); return { ok: false, error: 'Storage full — file too large' }; }
    return { ok: true, item };
  },

  deleteUpload(id) {
    db.uploads = db.uploads.filter(u => u.id !== id);
    save(db);
  },

  updateUpload(id, patch) {
    const u = db.uploads.find(x => x.id === id);
    if (!u) return null;
    const next = { ...patch };
    if ('price' in next) next.price = Math.max(0, Number(next.price) || 0);
    Object.assign(u, next);
    save(db);
    return u;
  },

  toggleFree(id) {
    const u = db.uploads.find(x => x.id === id);
    if (u) { u.free = !u.free; save(db); }
    return u;
  },

  toggleHidden(id) {
    const u = db.uploads.find(x => x.id === id);
    if (u) { u.hidden = !u.hidden; save(db); }
    return u;
  },

  cloneUpload(id) {
    const u = db.uploads.find(x => x.id === id);
    if (!u) return { ok: false, error: 'Not found' };
    const copy = { ...u, id: 'up_' + Date.now() + Math.floor(Math.random() * 900 + 100), title: u.title + ' (copy)', free: false, hidden: false, createdAt: new Date().toISOString() };
    db.uploads.unshift(copy);
    if (!save(db)) { db.uploads.shift(); return { ok: false, error: 'Storage full' }; }
    return { ok: true, item: copy };
  },

  itemStats(id) {
    const item = db.uploads.find(u => u.id === id) || null;
    const gradeOk = u => !item || !item.grade || item.grade === 'all' || String(u.grade) === String(item.grade);
    const unlocked = db.users.filter(u => u.role === 'student' && gradeOk(u) && this.hasAccess(u, item)).length;
    const reqs = db.payRequests.filter(r => r.itemId === id && r.status === 'approved');
    const buyers = new Set(reqs.map(r => r.studentId)).size;
    const revenue = reqs.reduce((a, r) => a + (r.price || 0), 0);
    return { unlocked, buyers, revenue };
  },

  revenueTotal() {
    return db.payRequests.filter(r => r.status === 'approved').reduce((a, r) => a + (r.price || 0), 0);
  },

  storageUsed() {
    try { return JSON.stringify(db).length; } catch { return 0; }
  },

  createPayRequest(studentId, { plan, itemId, planLabel, price, packageId, days }) {
    const rec = {
      id: 'pr_' + Date.now(),
      studentId,
      plan: plan || 'item',
      itemId: itemId || null,
      packageId: packageId || null,
      days: days != null ? Number(days) : null,
      planLabel: planLabel || 'Content',
      price: Number(price) || 0,
      status: 'pending',
      at: new Date().toISOString()
    };
    db.payRequests.push(rec);
    save(db);
    return rec;
  },

  payRequests() { return db.payRequests; },

  approveRequest(id) {
    const r = db.payRequests.find(x => x.id === id);
    if (!r) return null;
    r.status = 'approved';
    // Grant access directly — no code needed; the package the student picked is the one that opens.
    const u = db.users.find(x => x.id === r.studentId);
    if (u) {
      if (r.plan === 'full') {
        grantPkg(u, resolvePkg(r));
      } else if (r.plan === 'item' && r.itemId) {
        u.unlocked = u.unlocked || [];
        if (!u.unlocked.includes(r.itemId)) u.unlocked.push(r.itemId);
      }
    }
    save(db);
    return r;
  },

  rejectRequest(id) {
    const r = db.payRequests.find(x => x.id === id);
    if (r) { r.status = 'rejected'; save(db); }
    return r;
  },

  resetRequests() { return db.resetRequests; },

  pendingResetCount() {
    return db.resetRequests.filter(r => r.status === 'pending').length;
  },

  addDirectorNote(studentId, text, by) {
    const body = (text || '').trim();
    if (!studentId || !body) return null;
    if (!Array.isArray(db.notes)) db.notes = [];
    const rec = {
      id: 'nt_' + Date.now() + Math.floor(Math.random() * 900 + 100),
      studentId, text: body, by: by || '', at: new Date().toISOString()
    };
    db.notes.push(rec);
    save(db);
    return rec;
  },

  directorNotes(studentId) {
    if (!studentId || !Array.isArray(db.notes)) return [];
    return db.notes.filter(n => n.studentId === studentId);
  },

  requestPasswordReset(email) {
    const e = (email || '').trim();
    const u = db.users.find(x => x.role === 'student' && x.email && x.email.trim() === e);
    if (!u) return { ok: false, error: 'unknown' };
    let r = db.resetRequests.find(x => x.studentId === u.id && (x.status === 'pending' || x.status === 'approved'));
    if (!r) {
      r = { id: 'rr_' + Date.now(), studentId: u.id, email: u.email, status: 'pending', at: new Date().toISOString() };
      db.resetRequests.unshift(r);
      if (db.resetRequests.length > 50) db.resetRequests.length = 50;
      save(db);
    }
    return { ok: true, status: r.status, request: r };
  },

  approveResetRequest(id) {
    const r = db.resetRequests.find(x => x.id === id);
    if (r && r.status === 'pending') { r.status = 'approved'; save(db); }
    return r || null;
  },

  adminAllowReset(email) {
    const e = (email || '').trim();
    const u = db.users.find(x => x.role === 'student' && x.email && x.email.trim() === e);
    if (!u) return null;
    let r = db.resetRequests.find(x => x.studentId === u.id && (x.status === 'pending' || x.status === 'approved'));
    if (r) {
      r.status = 'approved';
    } else {
      r = { id: 'rr_' + Date.now(), studentId: u.id, email: u.email, status: 'approved', at: new Date().toISOString() };
      db.resetRequests.unshift(r);
    }
    save(db);
    return r;
  },

  setResetPassword(email, password) {
    const e = (email || '').trim();
    const u = db.users.find(x => x.role === 'student' && x.email && x.email.trim() === e);
    if (!u) return null;
    const r = db.resetRequests.find(x => x.studentId === u.id && x.status === 'approved');
    if (!r) return null;
    if (!password || String(password).length < 6) return null;
    u.password = hashPw(password);
    r.status = 'done';
    r.resolvedAt = new Date().toISOString();
    save(db);
    return u;
  },

  openPackage(id, days) {
    const u = db.users.find(x => x.id === id);
    if (!u) return null;
    let pkg = null;
    if (days == null) {
      // Open exactly the plan this student selected (their latest pending package request),
      // and mark that request approved so the student never sees "pending" after opening.
      const pend = db.payRequests.filter(r => r.studentId === id && r.status === 'pending' && r.plan === 'full').slice(-1)[0];
      if (pend) {
        pkg = resolvePkg(pend);
        pend.status = 'approved';
      }
      pkg = pkg || db.packages[0] || null;
    }
    const d = days != null ? Number(days) : (pkg ? Number(pkg.days) : 30);
    u.packageOpen = true;
    u.packageExpires = d > 0 ? new Date(Date.now() + d * 86400000).toISOString() : null;
    if (pkg) u.packagePlan = { id: pkg.id, label: pkg.name, days: pkg.days };
    else u.packagePlan = u.packagePlan || null;
    save(db);
    return u;
  },

  closePackage(id) {
    const u = db.users.find(x => x.id === id);
    if (!u) return null;
    u.packageOpen = false;
    u.packageExpires = null;
    u.packagePlan = null;
    save(db);
    return u;
  },

  setUserPassword(id, pw) {
    const u = db.users.find(x => x.id === id);
    if (!u) return { ok: false, error: 'User not found' };
    if (!pw || String(pw).length < 6) return { ok: false, error: 'Password must be at least 6 characters' };
    u.password = hashPw(pw);
    save(db);
    return { ok: true };
  },

  updateAdminProfile({ userId, fullName, email, currentPw, newPw }) {
    const u = db.users.find(x => x.id === userId && x.role === 'admin');
    if (!u) return { ok: false, error: 'Admin account not found' };
    if (newPw) {
      if (!checkPw(currentPw, u.password)) return { ok: false, error: 'Current password is incorrect' };
      if (String(newPw).length < 6) return { ok: false, error: 'New password must be at least 6 characters' };
    }
    const em = (email || '').trim().toLowerCase();
    if (em && em !== u.email) {
      if (db.users.some(x => x.id !== u.id && x.email && x.email.toLowerCase() === em)) return { ok: false, error: 'Email already in use' };
      u.email = em;
    }
    if (fullName && fullName.trim()) u.fullName = fullName.trim();
    if (newPw) u.password = hashPw(newPw);
    save(db);
    return { ok: true, user: u };
  },

  deleteDirector(id) {
    const d = db.users.find(u => u.id === id && u.role === 'director');
    if (!d) return false;
    db.users = db.users.filter(u => u.id !== id);
    db.users.forEach(u => {
      if (u.directorId === id) { u.directorId = null; u.directorName = null; }
    });
    save(db);
    return true;
  },

  gradeVisible(user, item) {
    if (!user || !item) return true;
    const g = item.grade || 'all';
    return g === 'all' || String(g) === String(user.grade);
  },

  approveAndGrant(id) {
    const r = db.payRequests.find(x => x.id === id);
    if (!r) return null;
    if (r.status !== 'approved') r.status = 'approved';
    const u = db.users.find(x => x.id === r.studentId);
    if (u) {
      if (r.plan === 'full') {
        grantPkg(u, resolvePkg(r));
      } else if (r.itemId) {
        u.unlocked = u.unlocked || [];
        if (!u.unlocked.includes(r.itemId)) u.unlocked.push(r.itemId);
      }
    }
    save(db);
    return { request: r, granted: !!u };
  },

  generateCode({ plan, itemId, planLabel, price, expiresInDays }) {
    let code = genCodeStr();
    let guard = 0;
    while (db.codes.some(c => c.code === code) && guard++ < 50) code = genCodeStr();
    const days = Number(expiresInDays) || 0;
    const rec = {
      code,
      plan: plan || 'full',
      itemId: itemId || null,
      planLabel: planLabel || 'Full access',
      price: Number(price) || 0,
      usedBy: null,
      usedAt: null,
      revoked: false,
      expiresAt: days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
      createdAt: new Date().toISOString()
    };
    db.codes.push(rec);
    save(db);
    return rec;
  },

  codes() { return db.codes; },

  revokeCode(raw) {
    const c = db.codes.find(x => x.code === (raw || '').trim().toUpperCase());
    if (c && !c.usedBy) { c.revoked = true; save(db); }
    return c;
  },

  redeemCode(studentId, raw) {
    const code = (raw || '').trim().toUpperCase();
    const c = db.codes.find(x => x.code === code);
    const u = db.users.find(x => x.id === studentId);
    if (!u) return { ok: false, error: 'invalid' };
    if (c && c.revoked) return { ok: false, error: 'revoked' };
    if (c && c.expiresAt && Date.now() > Date.parse(c.expiresAt)) return { ok: false, error: 'expired' };

    // LangGraph-style routing: validate → reject | unlock_item | unlock_full
    const { state } = redeemGraph.next('validate', {
      found: !!c, used: !!(c && c.usedBy), plan: c ? c.plan : null
    }, 'redeem');

    if (state.stage === 'error') return { ok: false, error: c ? 'used' : 'invalid' };
    if (state.stage !== 'ok') return { ok: false, error: 'invalid' };

    if (state.unlocked === 'full') {
      u.packageOpen = true;
      const plan0 = db.packages[0];
      const d = plan0 ? Number(plan0.days) : 30;
      u.packageExpires = d > 0 ? new Date(Date.now() + d * 86400000).toISOString() : null;
    }
    else {
      u.unlocked = u.unlocked || [];
      if (c.itemId && !u.unlocked.includes(c.itemId)) u.unlocked.push(c.itemId);
    }
    c.usedBy = studentId;
    c.usedAt = new Date().toISOString();
    save(db);
    return { ok: true, planLabel: c.planLabel };
  },

  hasAccess(user, item) {
    if (!user) return false;
    const active = !!user.packageOpen && (!user.packageExpires || Date.now() < Date.parse(user.packageExpires));
    if (!item) return active;
    if (item.free || active) return true;
    return (user.unlocked || []).includes(item.id);
  },

  packages() { return db.packages; },

  addPackage({ name, price, days }) {
    const rec = { id: 'pk_' + Date.now(), name: (name || '').trim(), price: Math.max(0, Number(price) || 0), days: Math.max(0, Number(days) || 0) };
    if (!rec.name) return null;
    db.packages.push(rec);
    save(db);
    return rec;
  },

  updatePackage(id, patch) {
    const p = db.packages.find(x => x.id === id);
    if (!p) return null;
    Object.assign(p, patch, { price: Math.max(0, Number(patch.price) || 0), days: Math.max(0, Number(patch.days) || 0) });
    save(db);
    return p;
  },

  deletePackage(id) {
    db.packages = db.packages.filter(p => p.id !== id);
    save(db);
  },

  settings() { return db.settings; },

  updateSettings(patch) {
    Object.assign(db.settings, patch);
    save(db);
    return db.settings;
  },

  announcements() { return db.announcements; },

  addAnnouncement(text) {
    const rec = { id: 'an_' + Date.now(), text: (text || '').trim(), at: new Date().toISOString() };
    if (!rec.text) return null;
    db.announcements.unshift(rec);
    if (db.announcements.length > 20) db.announcements.length = 20;
    save(db);
    return rec;
  },

  deleteAnnouncement(id) {
    db.announcements = db.announcements.filter(a => a.id !== id);
    save(db);
  },

  seedIfEmpty() {
    const demoIds = new Set(db.users.filter(u => String(u.id).startsWith('stu_seed_')).map(u => u.id));
    const u0 = db.users.length, r0 = db.reports.length, up0 = db.uploads.length, c0 = db.codes.length, p0 = db.payRequests.length;
    if (demoIds.size) {
      db.users = db.users.filter(u => !demoIds.has(u.id));
      db.reports = db.reports.filter(r => !demoIds.has(r.studentId) && !String(r.id).startsWith('sc_seed_'));
      db.payRequests = db.payRequests.filter(p => !demoIds.has(p.studentId));
      db.codes = db.codes.filter(c => !demoIds.has(c.usedBy));
    }
    db.uploads = db.uploads.filter(u => !String(u.id).startsWith('up_seed_'));
    db.codes = db.codes.filter(c => c.code !== 'ARW456');
    if (db.users.length !== u0 || db.reports.length !== r0 || db.uploads.length !== up0 || db.codes.length !== c0 || db.payRequests.length !== p0) save(db);
  },

  needsSetup() {
    return db.users.length === 0;
  },

  // first-boot setup wizard: admin account is chosen by the operator, never baked into source
  createFirstAdmin({ fullName, email, password } = {}) {
    if (db.users.length > 0) return { ok: false, error: 'Setup already completed.' };
    const nm = String(fullName || '').trim();
    const em = String(email || '').trim();
    const pw = String(password || '');
    if (!nm) return { ok: false, error: 'Full name is required.' };
    if (!/.+@.+\..+/.test(em)) return { ok: false, error: 'Valid email address is required.' };
    if (pw.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
    const user = { id: 'adm_' + Date.now(), role: 'admin', fullName: nm, email: em, password: hashPw(pw), joinedAt: new Date().toISOString() };
    db.users.push(user);
    if (!save(db)) {
      db.users.pop();
      return { ok: false, error: 'Could not save to local storage.' };
    }
    setSession(user.id);
    return { ok: true, user };
  }
};