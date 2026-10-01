import { subjectsFor } from './content.js';
import { nextStudyTarget, lastStudied, targetLabel } from './plan.js';
import { store } from './store.js';

const clean = s => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const INTRO = `Hi! I'm your SSA public AI - ask me anything: your course, homework, or any question you're curious about.

Try me:
• "What is a fraction?"
• "Why is the sky blue?"
• "What should I study next?"
• "How do exams work?"`;

const MENU = `I can explain curriculum terms, summarize chapters, and help with studying or the app.

Try:
• "What is a percentage?"
• "Tell me about my next chapter"
• "How do exams and points work?"
• "How do I unlock a package?"`;

function findTerm(q, subjects) {
  const qc = clean(q);
  let best = null;
  for (const s of subjects) {
    for (const c of s.chapters) {
      for (const pair of (c.terms || [])) {
        const [term, def] = pair;
        const t = clean(term);
        if (!t) continue;
        let score = 0;
        if (qc === t) score = 100 + t.length;
        else if (t.length >= 4 && qc.includes(t)) score = 60 + t.length;
        else if (qc.length >= 4 && t.includes(qc)) score = 45 + t.length;
        else {
          const qw = qc.split(' ').filter(w => w.length > 3);
          const hits = qw.filter(w => t.split(' ').includes(w)).length;
          if (hits) score = 12 * hits;
        }
        if (score > 0 && (!best || score > best.score)) best = { term, def, subject: s, chapter: c, score };
      }
    }
  }
  return best && best.score >= 12 ? best : null;
}

function findChapter(q, subjects) {
  const qc = clean(q);
  let best = null;
  for (const s of subjects) {
    for (const c of s.chapters) {
      const tt = clean(c.title);
      if (!tt) continue;
      let score = 0;
      if (qc === tt) score = 100;
      else if (qc.includes(tt)) score = 70;
      else {
        const qw = qc.split(' ').filter(w => w.length > 3);
        const hits = qw.filter(w => tt.split(' ').includes(w)).length;
        if (hits && hits >= Math.min(2, tt.split(' ').length)) score = 20 * hits;
      }
      if (score > 0 && (!best || score > best.score)) best = { chapter: c, subject: s, score };
    }
  }
  return best;
}

const studyNextAnswer = user => {
  const target = nextStudyTarget(user || {});
  if (!target) return 'I could not find your grade content. Check your profile grade.';
  const label = targetLabel(target);
  return target.done
    ? `You have finished every chapter in your grade — great work! Revisit your weakest chapter (${label}), redo its quiz, and keep your streak with the weekly 40-question exam on Saturday.`
    : `Your next unfinished chapter is ${label}.\n\nDo it in this order: watch the lesson, write a 3-line note, then take the 5-question check. Today's plan on your home page is built around exactly this chapter.`;
};

const examAnswer = () => 'Two checks in SSA: a 5-question lesson quiz at the end of each lesson (quick, gives points) and a 40-question chapter exam every Saturday (counts as a full assessment). Scores and points appear on your home page, and your director sees your follow-up status.';

const pointsAnswer = () => 'You earn points from quizzes, chapter exams and completed lessons. Your total shows as ⭐ on the home page, and the progress chart there tracks every assessment. Keep scores above 70% to stay on track.';

const packageAnswer = () => {
  const phone = String((store.settings() || {}).payPhone || '').trim();
  return phone
    ? `Open the Store page, pick a package or item, and pay with telebirr / eBirr / CBE Birr / Awash to ${phone}. Then tap "I have paid" — the school admin approves it and your content unlocks.`
    : `Open the Store page, pick a package or item and follow the payment guide, then tap "I have paid". The school admin approves it and your content unlocks. (The payment number is not configured yet — ask your school admin.)`;
};

const passwordAnswer = () => 'On the login screen press "Forgot password?", enter your email and send the request. The school admin approves it, the page updates automatically, and you choose your new password (min 6 characters). Old password stops working right after.';

const videoAnswer = () => 'Videos live in Materials (Video Hub) and the Store. Locked items unlock after your payment is approved. Add one to your favorites with the ★ button so it is easy to find.';

export function askTutor(question, user, book) {
  const subjects = subjectsFor(user && user.grade);
  const qc = clean(question);
  const intro = book && book.title
    ? INTRO + `\n\n📘 We are reading "${book.title}" right now — ask me anything from it!`
    : INTRO;
  if (!qc) return intro;
  if (/^(hi|hello|hey|yo|selam|akkam|good morning|good afternoon)\b/.test(qc)) return intro;

  const fromBook = bookAnswer(qc, book);
  if (fromBook && !appIntent(qc, user)) return fromBook;

  const term = findTerm(qc, subjects);
  if (term) {
    return `${term.term}: ${term.def}\n\n📘 From ${term.subject.name} — Chapter ${term.chapter.index}: ${term.chapter.title}. Open that chapter in your lessons to practice it step by step.`;
  }

  const chap = findChapter(qc, subjects);
  if (chap) {
    const names = (chap.chapter.terms || []).slice(0, 6).map(p => p[0]).join(', ');
    return `Chapter ${chap.chapter.index} of ${chap.subject.name} — "${chap.chapter.title}" — covers ${chap.chapter.terms.length} key terms: ${names}${chap.chapter.terms.length > 6 ? ', …' : ''}.\n\nGo to Lessons → ${chap.subject.name} → Chapter ${chap.chapter.index} to work through it, then take the 5-question check.`;
  }

  if (/(study next|what should i study|next chapter|next unfinished|my plan for today|what now)/.test(qc)) return studyNextAnswer(user);
  if (/(exam|quiz|test|assessment)/.test(qc)) return examAnswer();
  if (/(point|score|rank|reward)/.test(qc)) return pointsAnswer();
  if (/(package|unlock|pay|payment|price|fee|subscription|telebirr|ebirr)/.test(qc)) return packageAnswer();
  if (/(password|login|log in|forgot|reset|sign in|account)/.test(qc)) return passwordAnswer();
  if (/(video|watch)/.test(qc)) return videoAnswer();
  if (/(who are you|what can you do|help|how do you work)/.test(qc)) return INTRO;

  const qcWords = qc.split(' ').filter(w => w.length > 3);
  if (qcWords.length) {
    const suggestions = [];
    for (const s of subjects) for (const c of s.chapters) for (const p of (c.terms || [])) {
      const t = clean(p[0]);
      if (qcWords.some(w => t.split(' ').includes(w) || t.includes(w))) suggestions.push(p[0]);
    }
    if (suggestions.length) return `I don't have an exact entry for that, but you may mean: ${[...new Set(suggestions)].slice(0, 3).join(', ')}.\n\nAsk "What is X?" about any of them.`;
  }

  return book && book.title
    ? `${MENU}\n\n📘 We are reading "${book.title}" right now — tell me which part to explain, or paste the passage and I will walk you through it step by step with an example.`
    : MENU;
}

export function appIntent(question, user) {
  const qc = clean(question);
  if (!qc) return null;
  if (/(study next|what should i study|next chapter|next unfinished|my plan for today|what now)/.test(qc)) return studyNextAnswer(user);
  if (/^(how|what|when|why|explain|tell me|do|does|did|can|should|is|are)\b[^.?!]{0,60}\b(exam|quiz|assessment)s?\b/.test(qc)
    || /\b(exam|quiz|assessment)s?\b[^.?!]{0,25}\b(work|structure|format|scored|graded|count)/.test(qc)) return examAnswer();
  if (/(how do i earn|how are points|what are points|my points|total points|points? work|how does scoring|my rank|rank me)/.test(qc)) return pointsAnswer();
  if (/(unlock|package|telebirr|ebirr|subscription|how (do|can|should) i (pay|buy)|payment|pay for|purchase)/.test(qc)) return packageAnswer();
  if (/(forgot|forget|reset|change|lost|new) [^.?!]{0,20}password|password [^.?!]{0,15}(forgot|reset|change)|my password|i forgot|log ?in (problem|issue|help)/.test(qc)) return passwordAnswer();
  if (/(video|watch (a|the|some|my) video|where (are|is|do i find) (the )?video)/.test(qc)) return videoAnswer();
  return null;
}

const LANG_NAMES = { en: 'English', om: 'Afaan Oromoo', am: 'Amharic', so: 'Somali' };

const BOOK_KEY = 'ssa_book_ctx';

export function loadBookCtx() {
  try {
    const raw = localStorage.getItem(BOOK_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw);
    return b && b.title ? b : null;
  } catch { return null; }
}

export function saveBookCtx(ctx) {
  try {
    localStorage.setItem(BOOK_KEY, JSON.stringify(ctx));
    if (typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new CustomEvent('ssa:book'));
    return true;
  } catch { return false; }
}

export function clearBookCtx() {
  try { localStorage.removeItem(BOOK_KEY); } catch { /* noop */ }
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    try { window.dispatchEvent(new CustomEvent('ssa:book')); } catch { /* noop */ }
  }
}

function bookAnswer(qc, book) {
  if (!book || !book.hasText || !book.text) return null;
  if (appIntent(qc, null)) return null;
  const qb = clean(qc).split(' ').filter(w => w.length > 3);
  if (!qb.length) return null;
  const sents = String(book.text).replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter(Boolean);
  const hits = sents.filter(s => {
    const cs = ' ' + clean(s) + ' ';
    return qb.some(w => cs.includes(w));
  }).slice(0, 2);
  if (!hits.length) return null;
  return `📘 From your book "${book.title}"${book.at ? ` — ${book.at}` : ''}:\n\n${hits.join(' ')}\n\nFor a simple step-by-step explanation with an example, tap 🤖 Ask AI about this book — the AI reads this book together with you.`;
}

// Build an ordered, question-relevant digest of the selected book that always fits
// the /api/ai per-message limit (8000 chars). Keeps the book's own order and wording.
export function bookDigest(book, question, budget) {
  if (!book) return null;
  const lines = [];
  const head = `"${book.title}"${book.subject ? ` — ${book.subject}` : ''}${book.grade && book.grade !== 'all' ? ` — grade ${book.grade}` : ''}`;
  lines.push(head);
  if (Array.isArray(book.sections) && book.sections.length) {
    lines.push('Sections: ' + book.sections.map((s, i) => `${i + 1}. ${s || 'Part ' + (i + 1)}`).join('; ').slice(0, 600));
  }
  if (book.at) lines.push(`Student is currently reading: ${book.at}`);
  if (!book.hasText || !book.text) {
    lines.push('Note: this book is a scanned image/PDF — its pages are not text here, so you cannot quote it. Ask the student to paste the passage they want taught, and meanwhile explain the topic simply from general knowledge matching the book\u2019s title and subject.');
    return lines.join('\n');
  }
  const paras = String(book.text).split(/\n{2,}/).map(p => p.replace(/\s+/g, ' ').trim()).filter(p => p.length > 30);
  const qw = clean(question).split(' ').filter(w => w.length > 3);
  const atw = clean(book.at).split(' ').filter(w => w.length > 3);
  const scored = paras.map((p, i) => {
    const c = ' ' + clean(p) + ' ';
    let sc = 0;
    for (const w of qw) if (c.includes(w)) sc += 3;
    for (const w of atw) if (c.includes(w)) sc += 2;
    if (!qw.length && !atw.length) sc = 1;
    return { p, i, sc };
  });
  let used = lines.join('\n').length + 80;
  const picked = [];
  const fill = arr => {
    for (const x of arr) {
      if (used + x.p.length + 2 > budget) continue;
      picked.push(x);
      used += x.p.length + 2;
    }
  };
  fill(scored.filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc || a.i - b.i));
  if (!picked.length) fill(scored);
  picked.sort((a, b) => a.i - b.i);
  const dropped = paras.length - picked.length;
  if (picked.length) {
    lines.push('');
    lines.push('Book content (keep every point it makes):');
    lines.push(picked.map(x => x.p).join('\n\n'));
  }
  if (dropped > 0) lines.push(`(${dropped} more paragraph(s) did not fit — if the answer needs them, ask the student to paste that part of the book.)`);
  return lines.join('\n');
}

export function tutorSystemPrompt(question, user, language, book) {
  const u = user || {};
  const subjects = subjectsFor(u.grade);
  const lines = [];
  lines.push('You are the public AI assistant of SSA Learning Hub, a learning app for Ethiopian students (Grades 1-12). Students may ask you anything - their course, homework, or general questions - not only the listed material.');
  lines.push(`The student studies grade ${u.grade === 'remedial' ? 'remedial' : u.grade}. Reply in ${LANG_NAMES[language] || 'English'} with short, simple sentences a student can understand.`);
  lines.push('');
  lines.push('SSA curriculum (subject — chapter list):');
  for (const s of subjects) lines.push(`- ${s.name}: ${s.chapters.map(c => `Ch ${c.index} ${c.title}`).join('; ')}`);
  const target = nextStudyTarget(u);
  const last = lastStudied(u);
  lines.push('');
  lines.push(`Student state: next unfinished chapter = ${target ? targetLabel(target) : 'unknown'}; points = ${u.points || 0}; last studied = ${last ? `${last.subject} Ch ${last.chapter}` : 'nothing yet'}; completed = ${subjects.reduce((n, s) => n + s.chapters.filter(c => (u.progress || {})[`${s.name}:${c.index}`] === 'done').length, 0)} chapters.`);
  lines.push('');
  lines.push('App facts (answer exactly these when asked):');
  lines.push('- Lesson quiz: a 5-question check at the end of each lesson (+4 points each). Chapter exam: a 40-question exam every Saturday (+5 points each).');
  lines.push('- Packages are bought in the Store; the student taps "I have paid"; the school admin approves and unlocks the content.');
  const phone = String((store.settings() || {}).payPhone || '').trim();
  if (phone) lines.push(`- Payment phone shown in the Store: ${phone}. Never invent another number.`);
  else lines.push('- No payment phone is configured yet; tell the student to ask the school admin.');
  lines.push('- Password: login screen -> "Forgot password?" -> admin approves -> student chooses a new password (min 6 characters).');
  lines.push('- Videos live in Materials (Video Hub) and the Store; locked until a payment is approved.');
  lines.push('');
  const qc = clean(question);
  const term = findTerm(qc, subjects);
  const chap = findChapter(qc, subjects);
  const material = [];
  if (term) material.push(`${term.subject.name}, Chapter ${term.chapter.index} "${term.chapter.title}": ${term.term} = ${term.def}`);
  if (chap) material.push(`${chap.subject.name}, Chapter ${chap.chapter.index} "${chap.chapter.title}" key terms: ${(chap.chapter.terms || []).slice(0, 14).map(p => `${p[0]} = ${p[1]}`).join('; ')}`);
  if (material.length) {
    lines.push('Curriculum material for this question:');
    material.forEach(m => lines.push(`- ${m}`));
    lines.push('');
  }
  lines.push('Rules:');
  lines.push('- Answer openly: course topics, homework, science, everyday life, technology or general knowledge are all fine.');
  lines.push('- When the question is about the SSA course, ground the answer in the material/chapter list above and end with a plain citation line like "Mathematics - Chapter 1: Numbers & Operations".');
  lines.push('- Never invent phone numbers or prices; for app questions use the app facts above. If you do not know, say so honestly.');
  lines.push('- School-appropriate: friendly and honest; decline harmful, explicit or dangerous requests politely and offer study help instead.');
  lines.push('- Plain text only: no markdown, no headings, no asterisks. Usually under 150 words unless the student needs a longer explanation.');
  let out = lines.join('\n');
  if (book && book.title) {
    const fixed = [
      '',
      'Selected book — the student picked this book and wants to be taught FROM it:',
      '{DIGEST}',
      '',
      'Book teaching rules:',
      `- Treat "${book.title}" as the student's current book. When the question is about it or one of its sections, teach from the book content above: keep every point the book makes — never contradict or silently drop it.`,
      '- Teach simply: short sentences, step by step, with one everyday example and one simple illustration (analogy or word-picture) for each idea.',
      `- If the book does not cover the question, say that plainly, then answer from general knowledge and note what is missing from the book.`,
      book.hasText ? `- When you used the book, end your reply with: Book: "${book.title}".` : `- The book pages are images, so you cannot quote them; ask the student to paste the passage you should teach.`
    ].join('\n');
    const budget = Math.max(500, 7900 - out.length - fixed.replace('{DIGEST}', '').length - 140);
    out = out + fixed.replace('{DIGEST}', bookDigest(book, question, budget));
    if (out.length > 7900) out = out.slice(0, 7900);
  }
  return out;
}

export function tutorMessages(question, user, language, history, book) {
  const msgs = [{ role: 'system', content: tutorSystemPrompt(question, user, language, book) }];
  for (const h of (Array.isArray(history) ? history : []).slice(-8)) {
    if (!h || !h.text) continue;
    msgs.push({ role: h.me ? 'user' : 'assistant', content: String(h.text).slice(0, 2000) });
  }
  msgs.push({ role: 'user', content: String(question || '').slice(0, 3000) });
  return msgs.slice(0, 10);
}

export async function askTutorAI(question, user, language, history, book) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const r = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: tutorMessages(question, user, language, history, book) }),
        signal: ctrl.signal
      });
      if (!r.ok) throw new Error('ai http ' + r.status);
      const data = await r.json();
      const text = String((data && data.text) || '').trim();
      if (!text) throw new Error('ai empty');
      return { text, src: 'ai' };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { text: askTutor(question, user, book), src: 'local' };
  }
}
