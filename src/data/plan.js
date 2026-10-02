import { studentUploads, itemLabel } from './curriculum.js';

// first uploaded material of the student's grade that is not read yet
export function nextStudyTarget(user) {
  const items = studentUploads(user, ['book', 'material', 'library', 'video'])
    .slice()
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  if (!items.length) return null;
  const prog = (user && user.progress) || {};
  for (const item of items) {
    const sp = prog['study:' + item.id];
    if (!(sp && sp.completedAt)) {
      return { item, subject: { name: String(item.subject || '').trim() || 'General' }, done: false };
    }
  }
  const last = items[items.length - 1];
  return { item: last, subject: { name: String(last.subject || '').trim() || 'General' }, done: true };
}

// most recent exam the student took (for review blocks); null on a fresh account
export function lastStudied(user) {
  const sc = user.scores || [];
  if (!sc.length) return null;
  const last = sc[sc.length - 1];
  return { subject: last.subject, chapter: last.chapter };
}

export function targetLabel(target) {
  if (!target) return null;
  return itemLabel(target.item);
}
