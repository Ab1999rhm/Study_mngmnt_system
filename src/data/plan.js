import { subjectsFor } from './content.js';

// first chapter of the student's grade that is not marked done yet
export function nextStudyTarget(user) {
  const subjects = subjectsFor(user.grade);
  if (!subjects.length) return null;
  for (const s of subjects) {
    for (const c of s.chapters) {
      if (user.progress?.[`${s.name}:${c.index}`] !== 'done') return { subject: s, chapter: c, done: false };
    }
  }
  const s = subjects[0];
  return { subject: s, chapter: s.chapters[s.chapters.length - 1], done: true };
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
  return `${target.subject.name} ch ${target.chapter.index}: ${target.chapter.title}`;
}
