import { studentUploads, STUDY_TYPES, itemLabel } from './curriculum.js';
import { nextStudyTarget, lastStudied, targetLabel } from './plan.js';
import { store } from './store.js';

const clean = s => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const INTRO = `Welcome! I'm your SSA public AI - ask me anything: your course, homework, or any question you're curious about.

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

const studyNextAnswer = user => {
  const target = nextStudyTarget(user || {});
  if (!target) return 'No materials have been uploaded for your grade yet. Ask your school admin to upload books or notes — I can still help with any question in the meantime.';
  const label = targetLabel(target);
  if (target.done) return `You have finished every uploaded material — great work! Revisit ${label} for revision, and take a practice test from the Exams page to keep your streak.`;
  const vid = target.item && target.item.type === 'video';
  return `Your next material is ${label}.\n\nDo it in this order: open it in Study with AI, ${vid ? 'watch it all the way through' : 'read it with the study reader'}, write a 3-line note, then take a practice test from the Exams page. Today's plan on your home page is built around exactly this material.`;
};

const examAnswer = () => 'Your school uploads real tests and model exams — open the Exams page, pick one, and answer it. Every correct answer gives points; the score is recorded on your home page and reported to the admin & director dashboards.';

const pointsAnswer = () => 'You earn points from the tests and exams your school uploads. Your total shows as ⭐ on the home page, and the progress chart there tracks every assessment. Keep scores above 70% to stay on track.';

const packageAnswer = () => {
  const phone = String((store.settings() || {}).payPhone || '').trim();
  return phone
    ? `Open the Store page, pick a package or item, and pay with telebirr / eBirr / CBE Birr / Awash to ${phone}. Then tap "I have paid" — the school admin approves it and your content unlocks.`
    : `Open the Store page, pick a package or item and follow the payment guide, then tap "I have paid". The school admin approves it and your content unlocks. (The payment number is not configured yet — ask your school admin.)`;
};

const passwordAnswer = () => 'On the login screen press "Forgot password?", enter your email and send the request. The school admin approves it, the page updates automatically, and you choose your new password (min 6 characters). Old password stops working right after.';

const videoAnswer = () => 'Videos live in Materials (Video Hub) and the Store. Locked items unlock after your payment is approved. Add one to your favorites with the ★ button so it is easy to find.';

export function askTutor(question, user, book) {
  const qc = clean(question);
  const intro = book && book.title
    ? INTRO + `\n\n📘 We are reading "${book.title}" right now — ask me anything from it!`
    : INTRO;
  if (!qc) return intro;
  if (/^(hi|hello|hey|yo|selam|akkam|good morning|good afternoon)\b/.test(qc)) return intro;

  const fromBook = bookAnswer(qc, book);
  if (fromBook && !appIntent(qc, user)) return fromBook;

  if (/(study next|what should i study|next chapter|next unfinished|my plan for today|what now)/.test(qc)) return studyNextAnswer(user);
  if (/(exam|quiz|test|assessment)/.test(qc)) return examAnswer();
  if (/(point|score|rank|reward)/.test(qc)) return pointsAnswer();
  if (/(package|unlock|pay|payment|price|fee|subscription|telebirr|ebirr)/.test(qc)) return packageAnswer();
  if (/(password|login|log in|forgot|reset|sign in|account)/.test(qc)) return passwordAnswer();
  if (/(video|watch)/.test(qc)) return videoAnswer();
  if (/(who are you|what can you do|help|how do you work)/.test(qc)) return INTRO;

  if (!(book && book.title)) {
    const fromMat = materialAnswer(qc, user);
    if (fromMat) return fromMat;
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

// Offline fallback: quote the matching sentence straight from an uploaded school
// material the student can open (mirrors bookAnswer). Returns null when nothing
// matches so the normal menu/AI path stays intact.
function materialAnswer(qc, user) {
  const qb = clean(qc).split(' ').filter(w => w.length > 3);
  if (!qb.length) return null;
  const u = user || {};
  const items = studentUploads(u, STUDY_TYPES).filter(x => x.body && store.hasAccess(u, x));
  let best = null;
  for (const x of items) {
    const sents = String(x.body).replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter(Boolean);
    const hits = sents.filter(s => {
      const cs = ' ' + clean(s) + ' ';
      return qb.some(w => cs.includes(w));
    }).slice(0, 2);
    if (hits.length && (!best || hits.length > best.hits.length)) best = { x, hits };
  }
  if (!best) return null;
  const subj = String(best.x.subject || '').trim();
  return `📘 From your school material "${subj ? subj + ' — ' : ''}${best.x.title}":\n\n${best.hits.join(' ')}\n\nFor a simple step-by-step explanation with an example, ask the AI tutor — it reads this material together with you.`;
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
    lines.push('Note: this book is a scanned image/PDF — its pages are not text here, so you cannot quote it. Ask the student to paste the passage they want taught, then teach from the pasted text; do not invent what the book says.');
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

// real content uploaded by the school, grouped by subject (case-insensitive)
function materialGroups(u) {
  const by = new Map();
  for (const x of studentUploads(u)) {
    const n = String(x.subject || '').trim() || 'General';
    const k = n.toLowerCase();
    if (!by.has(k)) by.set(k, { name: n, titles: [] });
    const kind = x.type === 'test' ? ' (test)' : x.type === 'exam' ? ' (model exam)' : '';
    by.get(k).titles.push(`${String(x.title).slice(0, 70)}${kind}`);
  }
  return by;
}

// Question-relevant excerpt of the school's uploaded study materials, used when
// no book is selected. Only content this student can actually open is included.
// Returns null when no paragraph matches the question keywords, so prompts
// stay byte-identical for unrelated questions.
export function materialDigest(u, question, budget) {
  const user = u || {};
  const qw = clean(question).split(' ').filter(w => w.length > 3);
  if (!qw.length) return null;
  const items = studentUploads(user, STUDY_TYPES).filter(x => x.body && store.hasAccess(user, x));
  if (!items.length) return null;
  const blocks = [];
  for (const x of items) {
    const paras = String(x.body).split(/\n{2,}/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const hits = paras.filter(p => {
      const c = ' ' + clean(p) + ' ';
      return qw.some(w => c.includes(w));
    });
    if (hits.length) blocks.push(`${itemLabel(x)}:\n${hits.join('\n\n')}`);
  }
  if (!blocks.length) return null;
  const head = 'School material content (ground the answer in it; cite the material title at the end):';
  let used = head.length + 2;
  const out = [head, ''];
  for (const b of blocks) {
    if (used + b.length + 2 > budget) continue;
    out.push(b, '');
    used += b.length + 2;
  }
  if (out.length === 2) return null;
  return out.join('\n').trim();
}

export function tutorSystemPrompt(question, user, language, book) {
  const u = user || {};
  const lines = [];
  lines.push('You are the public AI assistant of SSA Learning Hub, a learning app for Ethiopian students (Grades 1-12). Students may ask you anything - their course, homework, or general questions - not only the listed material.');
  lines.push(`The student studies grade ${u.grade === 'remedial' ? 'remedial' : u.grade}. Reply in ${LANG_NAMES[language] || 'English'} with short, simple sentences a student can understand.`);
  lines.push('');
  lines.push('School learning materials (real content uploaded by the school for this grade):');
  const groups = materialGroups(u);
  if (!groups.size) lines.push('- (none uploaded yet for this grade)');
  else {
    let shown = 0;
    for (const g of groups.values()) {
      if (shown >= 10) break;
      lines.push(`- ${g.name}: ${g.titles.join('; ').slice(0, 400)}`);
      shown += 1;
    }
  }
  const target = nextStudyTarget(u);
  const last = lastStudied(u);
  const prog = u.progress || {};
  const uploads = studentUploads(u);
  const readDone = uploads.filter(x => prog['study:' + x.id] && prog['study:' + x.id].completedAt).length;
  lines.push('');
  lines.push(`Student state: next material = ${target ? targetLabel(target) : 'none uploaded yet'}; points = ${u.points || 0}; last studied = ${last ? `${last.subject} — ${last.chapter}` : 'nothing yet'}; materials read = ${readDone} of ${uploads.length}.`);
  lines.push('');
  lines.push('App facts (answer exactly these when asked):');
  lines.push('- Exams: the school uploads real tests and model exams (Exams page). Each correct answer awards points; scores go to the admin & director dashboards.');
  lines.push('- Packages are bought in the Store; the student taps "I have paid"; the school admin approves and unlocks the content.');
  const phone = String((store.settings() || {}).payPhone || '').trim();
  if (phone) lines.push(`- Payment phone shown in the Store: ${phone}. Never invent another number.`);
  else lines.push('- No payment phone is configured yet; tell the student to ask the school admin.');
  lines.push('- Password: login screen -> "Forgot password?" -> admin approves -> student chooses a new password (min 6 characters).');
  lines.push('- Videos live in Materials (Video Hub) and the Store; locked until a payment is approved.');
  lines.push('');
  lines.push('Rules:');
  lines.push('- Answer openly: course topics, homework, science, everyday life, technology or general knowledge are all fine.');
  lines.push('- When the question is about one of the school materials above, ground the answer in it and end with a plain citation line like "Mathematics - Test Book".');
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
      `- Teach only from this book for questions about it: if the book does not cover the question, say plainly that it is not in this book — never answer from general knowledge — then offer the closest section from the book above and teach that instead.`,
      book.hasText ? `- When you used the book, end your reply with: Book: "${book.title}".` : `- The book pages are images, so you cannot quote them; ask the student to paste the passage you should teach.`
    ].join('\n');
    const budget = Math.max(500, 7900 - out.length - fixed.replace('{DIGEST}', '').length - 140);
    out = out + fixed.replace('{DIGEST}', bookDigest(book, question, budget));
    if (out.length > 7900) out = out.slice(0, 7900);
  } else {
    const dig = materialDigest(u, question, Math.max(300, 7850 - out.length));
    if (dig) out = out + '\n\n' + dig;
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
