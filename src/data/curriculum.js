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

// study items (read/watch) grouped by subject with per-item read progress
export function studentSubjects(user) {
  const prog = (user && user.progress) || {};
  const by = new Map();
  for (const item of studentUploads(user, STUDY_TYPES)) {
    const name = String(item.subject || '').trim() || 'General';
    if (!by.has(name)) by.set(name, { name, items: [], done: 0, total: 0 });
    const g = by.get(name);
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
