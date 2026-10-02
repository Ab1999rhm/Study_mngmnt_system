import fs from 'node:fs';

// in-memory localStorage shim BEFORE importing the store (store loads db at init)
const mem = {};
globalThis.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; }
};

const now = Date.now();
const iso = mins => new Date(now - (60 - mins) * 60000).toISOString();

const seedDb = {
  users: [],
  uploads: [
    { id: 'up1', type: 'book', title: 'Algebra Basics', subject: 'Mathematics', grade: '8', price: 0, free: true, body: 'Algebra body text.', createdAt: iso(1) },
    { id: 'up2', type: 'material', title: 'Grammar Notes', subject: 'English', grade: '8', price: 0, free: true, body: 'Grammar body.', createdAt: iso(2) },
    { id: 'up3', type: 'video', title: 'Photosynthesis Clip', subject: 'Science', grade: 'all', link: 'https://example.com/v', createdAt: iso(3) },
    { id: 'up4', type: 'test', title: 'Mid Quiz', subject: 'Science', grade: '8', questions: [{ type: 'mcq', q: '2+2?', options: ['3', '4'], answer: '4' }], createdAt: iso(4) },
    { id: 'up5', type: 'book', title: 'Other Grade Book', subject: 'Mathematics', grade: '12', body: 'Grade 12 only.', createdAt: iso(5) }
  ],
  settings: {},
  reports: [], videos: [], codes: [], payRequests: [], resetRequests: [], announcements: [], packages: [], notes: []
};
mem['ssa_db_v1'] = JSON.stringify(seedDb);

const { askTutor, appIntent, tutorSystemPrompt, tutorMessages, askTutorAI, bookDigest } = await import('../src/data/tutor.js');
const { nextStudyTarget, lastStudied, targetLabel } = await import('../src/data/plan.js');
const { studentSubjects, subjectItems, itemLabel, studentUploads } = await import('../src/data/curriculum.js');
const { store } = await import('../src/data/store.js');

let pass = 0, fail = 0;
const check = (ok, label, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : ' :: ' + extra)); ok ? pass++ : fail++; };

const fresh = { grade: 8, progress: {}, scores: [], points: 0 };

// --- demo curriculum removed from the app ---
check(!fs.existsSync('src/data/content.js'), 'demo content.js deleted');
const studyAiSrc = fs.readFileSync('src/pages/student/StudyAI.jsx', 'utf8');
check(!studyAiSrc.includes('lessonGraph') && !studyAiSrc.includes('subjectsFor'), 'StudyAI has no demo lesson flow / subjectsFor');
check(!studyAiSrc.includes('LessonFlow'), 'StudyAI LessonFlow component removed');
const tutorSrc = fs.readFileSync('src/data/tutor.js', 'utf8');
check(!tutorSrc.includes('findTerm') && !tutorSrc.includes('subjectsFor'), 'tutor has no demo term/chapter lookup');

// --- curriculum: subjects derived from uploads ---
const subs = studentSubjects(fresh);
check(subs.length === 3, '3 subjects from uploads (grade 8 + all)', JSON.stringify(subs.map(s => s.name)));
check(subs.map(s => s.name).join(',') === 'English,Mathematics,Science', 'subjects sorted alphabetically', subs.map(s => s.name).join(','));
const math = subs.find(s => s.name === 'Mathematics');
check(math && math.total === 1 && math.items[0].id === 'up1', 'grade-12 upload excluded from grade 8', JSON.stringify(math));
const sci = subs.find(s => s.name === 'Science');
check(sci && sci.total === 1 && sci.items[0].id === 'up3', 'tests not grouped as study items', JSON.stringify(sci));
check(studentUploads(fresh).some(u => u.id === 'up4'), 'studentUploads keeps tests (for exams + tutor context)');
check(studentUploads(fresh, ['test']).length === 1, 'studentUploads type filter works');
check(subjectItems(fresh, 'Mathematics').length === 1, 'subjectItems returns uploads');
check(subjectItems(fresh, 'Chemistry').length === 0, 'unknown subject -> empty');
check(itemLabel({ title: 'X' }) === 'X', 'itemLabel without subject');
check(itemLabel({ subject: 'Math', title: 'X' }) === 'Math — X', 'itemLabel with subject');
check(itemLabel(null) === null, 'itemLabel null');

// --- plan: next target from uploads ---
const t1 = nextStudyTarget(fresh);
const l1 = targetLabel(t1);
check(t1 && !t1.done && l1 === 'Mathematics — Algebra Basics', 'next target = oldest unread upload', l1);
check(lastStudied(fresh) === null, 'no scores -> no lastStudied');
check(targetLabel(null) === null, 'targetLabel(null) -> null');

const scored = { ...fresh, scores: [{ subject: 'English', chapter: 3, score: 4, total: 5, at: 'x' }] };
const last = lastStudied(scored);
check(last && last.subject === 'English' && last.chapter === 3, 'lastStudied reads most recent exam', JSON.stringify(last));

const readAll = { grade: 8, scores: [], progress: {} };
for (const id of ['up1', 'up2', 'up3']) readAll.progress['study:' + id] = { completedAt: '2026-01-01T00:00:00.000Z' };
const tDone = nextStudyTarget(readAll);
check(tDone.done === true, 'all materials read -> target.done true', targetLabel(tDone));
check(targetLabel(tDone) === 'Science — Photosynthesis Clip', 'done target = newest material', targetLabel(tDone));
check(studentSubjects(readAll).every(s => s.done === s.total && s.pct === 100), 'read progress feeds subject stats');

// --- tutor offline: local answers from real app state ---
const a1 = askTutor('hello', fresh);
check(/Welcome!/.test(a1) && /SSA public AI/.test(a1), 'greeting -> welcome intro', a1.slice(0, 120));
check(askTutor('', fresh) === a1, 'empty question -> intro');
const a2 = askTutor('What should I study next?', fresh);
check(/next material is Mathematics — Algebra Basics/.test(a2), 'study-next cites the real next upload', a2.slice(0, 200));
const a3 = askTutor('What should I study next?', readAll);
check(/finished every uploaded material/.test(a3), 'study-next when everything read', a3.slice(0, 160));
const a4 = askTutor('How do exams work?', fresh);
check(/uploads real tests and model exams/.test(a4) && /Exams page/.test(a4), 'exam intent explains uploaded exams', a4.slice(0, 180));
check(!/40-question|5-question lesson quiz/.test(a4), 'exam intent has no demo exam claims', a4.slice(0, 180));
check(/points/.test(askTutor('How do I earn points?', fresh)), 'points intent answers');
check(/Store page/.test(askTutor('How do I unlock a package?', fresh)), 'package intent -> store flow');
check(/Forgot password/.test(askTutor('I forgot my password', fresh)), 'password intent -> reset flow');
check(/Video Hub/.test(askTutor('Where are my videos?', fresh)), 'video intent -> Video Hub');
const a5 = askTutor('zzz qqq wwww vvvv', fresh);
check(/I can explain curriculum terms/.test(a5), 'unknown question -> capability menu', a5.slice(0, 160));

// no uploads at all -> honest empty-state answer
const savedUploads = store.db.uploads;
store.db.uploads = [];
const a6 = askTutor('What should I study next?', fresh);
check(/No materials have been uploaded/.test(a6), 'study-next with no uploads -> honest answer', a6.slice(0, 160));
const spEmpty = tutorSystemPrompt('q', fresh, 'en');
check(/\(none uploaded yet for this grade\)/.test(spEmpty), 'prompt with no uploads says none uploaded');
store.db.uploads = savedUploads;

// --- appIntent: fast local path only for app mechanics ---
const ei = appIntent('How do exams work?', fresh);
check(ei && /uploads real tests/.test(ei), 'appIntent: exam mechanics', (ei || '').slice(0, 80));
check(appIntent('What is a fraction?', fresh) === null, 'appIntent: course question -> real AI path');
check(appIntent('hello', fresh) === null, 'appIntent: greeting -> real AI path');
check(appIntent('', fresh) === null, 'appIntent: empty -> null');
check(appIntent('I forgot my password', fresh) && /Forgot password/.test(appIntent('I forgot my password', fresh)), 'appIntent: password reset');

// --- tutorSystemPrompt: grounded in uploaded materials ---
const sp = tutorSystemPrompt('What is photosynthesis?', fresh, 'en');
check(/grade 8/.test(sp) && /Reply in English/.test(sp), 'prompt: grade + language', sp.slice(0, 140));
check(/School learning materials/.test(sp), 'prompt: uploads section present');
check(/Mathematics: Algebra Basics/.test(sp) && /English: Grammar Notes/.test(sp), 'prompt: uploaded titles listed by subject', (sp.match(/- (Mathematics|English|Science)[^\n]*/) || [''])[0]);
check(/Science: Photosynthesis Clip; Mid Quiz \(test\)/.test(sp), 'prompt: video + test listed with kind hint', (sp.match(/- Science[^\n]*/) || [''])[0]);
check(!/Other Grade Book/.test(sp), 'prompt: other-grade upload excluded');
check(!/Ch \d+ /.test(sp), 'prompt: no demo chapter list');
check(/next material = Mathematics — Algebra Basics/.test(sp), 'prompt: next target from uploads', (sp.match(/next material = [^;]+/) || [''])[0]);
check(/materials read = 0 of 4/.test(sp), 'prompt: read progress counted', (sp.match(/materials read = [^.;]+/) || [''])[0]);
check(/Exams: the school uploads real tests and model exams/.test(sp), 'prompt: exam app fact is uploads-based');
check(!/5-question|40-question/.test(sp), 'prompt: no demo quiz/exam claims');
check(/Answer openly/.test(sp) && /School-appropriate/.test(sp) && /Never invent phone numbers/.test(sp), 'prompt: open AI + safety + no invented numbers rules kept');
check(/Mathematics - Test Book/.test(sp) && !/ONLY from the material/.test(sp), 'prompt: citation rule uses real material example');
const spOm = tutorSystemPrompt('hi', fresh, 'om');
check(/Reply in Afaan Oromoo/.test(spOm), 'prompt: om -> Afaan Oromoo');
check(sp.length <= 8000, 'prompt fits proxy limit (len=' + sp.length + ')');

// --- book-aware prompt (selected book still drives teaching) ---
const book = { title: 'Test Book', subject: 'Mathematics', grade: 'all', at: 'Part 1', sections: ['Part 1'], hasText: true, text: 'Water is essential for life. H2O is the chemical name for water.' };
const spBook = tutorSystemPrompt('What is water?', fresh, 'en', book);
check(/Selected book/.test(spBook) && /Book teaching rules/.test(spBook), 'prompt: book block present');
check(spBook.includes('Water is essential for life.'), 'prompt: book digest embedded');
check(spBook.length <= 7900, 'prompt+book fits 7900 cap (len=' + spBook.length + ')');
const dig = bookDigest(book, 'What is water?', 500);
check(dig && dig.includes('Test Book') && dig.includes('Water is essential'), 'bookDigest keeps book content', (dig || '').slice(0, 80));
const fromBook = askTutor('why is water essential?', fresh, book);
check(/From your book "Test Book"/.test(fromBook), 'offline book answer quotes matching sentence', fromBook.slice(0, 120));

// --- multi-turn history threading ---
const hist = [
  { me: false, text: 'Welcome!' },
  { me: true, text: 'My favourite subject is Biology' },
  { me: false, text: 'Noted' }
];
const msgs = tutorMessages('What is my favourite subject?', fresh, 'en', hist);
check(msgs.length === 5, 'messages: system + 3 history + new question', 'len=' + msgs.length);
check(msgs[0].role === 'system' && msgs[1].role === 'assistant' && msgs[2].role === 'user' && msgs[4].role === 'user', 'messages: roles alternate correctly', JSON.stringify(msgs.map(m => m.role)));
check(msgs.some(m => m.content.includes('Biology')), 'messages: earlier turns included for memory');
const longHist = Array.from({ length: 30 }, (_, i) => ({ me: i % 2 === 0, text: 'm' + i }));
const msgs2 = tutorMessages('q', fresh, 'en', longHist);
check(msgs2.length <= 10, 'messages: capped at proxy limit (10)', 'len=' + msgs2.length);
check(msgs2[msgs2.length - 1].content === 'q', 'messages: newest question always last');
const noHist = tutorMessages('q', fresh, 'en', undefined);
check(noHist.length === 2 && noHist[1].content === 'q', 'messages: history optional -> system + question');

// --- askTutorAI: network failure -> local fallback object (no throw) ---
const fb = await askTutorAI('What is a fraction?', fresh, 'en');
check(fb.src === 'local' && /I can explain curriculum terms/.test(fb.text), 'askTutorAI: unreachable API -> local fallback', JSON.stringify({ src: fb.src, head: fb.text.slice(0, 60) }));

console.log(fail ? `\nTUTOR TEST FAILED (${fail})` : `\nALL ${pass} TUTOR TESTS PASSED`);
process.exit(fail ? 1 : 0);
