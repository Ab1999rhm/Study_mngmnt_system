import { store } from './store.js';

// The student side is driven only by real admin uploads — no demo curriculum.
// These helpers derive subjects/items from the uploads the student can actually see.

export const STUDY_TYPES = ['book', 'material', 'library', 'video'];

// uploads visible to this student (grade filter + not hidden), in db order
export function studentUploads(user, types) {
  const u = user || {};
  return store.uploads().filter(x =>
    (!types || types.includes(x.type)) && !x.hidden && store.gradeVisible(u, x)
  );
}

// Record that a student opened a simple (non-reader) study item — videos,
// link-only or file items never enter StudyReader, so without this their
// subject progress and the study plan would stay stuck at 0 forever.
// Mirrors StudyReader's completion record: { completedAt, reviews, nextReview }.
export function markOpened(user, item) {
  const u = user || {};
  if (!u.id || !item || !STUDY_TYPES.includes(item.type)) return false;
  if (!(item.body || item.link || item.fileData)) return false;
  const prev = ((u.progress || {})['study:' + item.id]) || {};
  const now = Date.now();
  if (prev.completedAt && !(prev.nextReview && Date.parse(prev.nextReview) <= now)) return false;
  const reviews = (prev.reviews || 0) + (prev.completedAt ? 1 : 0);
  const span = Math.min(8, 1 + reviews);
  store.setProgress(u.id, 'study:' + item.id, {
    ...prev,
    completedAt: prev.completedAt || new Date(now).toISOString(),
    reviews,
    nextReview: new Date(now + span * 86400000).toISOString()
  });
  return true;
}

// study items (read/watch) grouped by subject with per-item read progress
// (subjects grouped case-insensitively: "math" and "Mathematics" merge)
export function studentSubjects(user) {
  const prog = (user && user.progress) || {};
  const by = new Map();
  for (const item of studentUploads(user, STUDY_TYPES)) {
    const name = String(item.subject || '').trim() || 'General';
    const key = name.toLowerCase();
    if (!by.has(key)) by.set(key, { name, items: [], done: 0, total: 0 });
    const g = by.get(key);
    g.items.push(item);
    g.total += 1;
    const sp = prog['study:' + item.id];
    if (sp && sp.completedAt) g.done += 1;
  }
  return [...by.values()]
    .map(g => ({ ...g, pct: g.total ? Math.round((g.done / g.total) * 100) : 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function subjectItems(user, name) {
  const g = studentSubjects(user).find(s => s.name === name);
  return g ? g.items : [];
}

// short human label of an upload: "Mathematics — Test Book"
export function itemLabel(item) {
  if (!item) return null;
  const subject = String(item.subject || '').trim();
  return subject ? `${subject} — ${item.title}` : item.title;
}
