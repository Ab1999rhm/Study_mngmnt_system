import { askTutor, appIntent, tutorSystemPrompt, tutorMessages, askTutorAI, bookDigest } from '../src/data/tutor.js';

let pass = 0, fail = 0;
const check = (ok, label, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : ' :: ' + extra)); ok ? pass++ : fail++; };

const fresh = { grade: 8, progress: {}, scores: [], points: 0 };

const book = {
  id: 'b1', title: 'Kobo Volcano Atlas', type: 'book', subject: 'Science', grade: '8',
  at: 'Page 3',
  sections: ['Intro', 'Eruption Facts', 'Soil and Farming'],
  text: 'The volcano named Kobo Xaltaha erupts every seven years and its warm ash makes the valley soil rich for yams.\n\nFarmers near Kobo Xaltaha watch the smoke color to predict the next eruption.',
  hasText: true, savedAt: Date.now()
};

// --- baseline: no book -> no book block ---
const p0 = tutorSystemPrompt('What is a fraction?', fresh, 'en');
check(!/Selected book/.test(p0), 'prompt without book has no book block');
check(!/Kobo/.test(p0), 'prompt without book leaks nothing');

// --- with book ---
const q1 = 'What does the book say about Kobo Xaltaha?';
const p1 = tutorSystemPrompt(q1, fresh, 'en', book);
check(/Selected book — the student picked this book/.test(p1), 'book block present');
check(p1.includes('Kobo Volcano Atlas'), 'title in prompt');
check(/Sections: 1\. Intro; 2\. Eruption Facts; 3\. Soil and Farming/.test(p1), 'section outline present');
check(/Student is currently reading: Page 3/.test(p1), 'current position present');
check(/keep every point the book makes/.test(p1), 'keep-every-point rule');
check(/everyday example/.test(p1), 'simple example + illustration rule');
check(p1.includes(`Book: "Kobo Volcano Atlas"`), 'book citation rule');
check(/seven years/.test(p1) && /smoke color/.test(p1), 'full book paragraphs included');
check(/Reply in English/.test(p1), 'reply language kept');
check(p1.length <= 7900, 'book prompt within proxy budget', String(p1.length));

// --- huge book: budget + relevance + order ---
const paras = [];
for (let i = 1; i <= 120; i++) paras.push(`Filler paragraph number ${i} ` + 'lorem ipsum dolor sit amet consectetur adipiscing elit '.repeat(8));
paras.splice(40, 0, 'The Gwalion Ridge exploded in 1902 and its ash layer is still visible today along ZORBLAX creek where scientists sample it every year.');
paras.push('Later surveys confirmed that ZORBLAX creek sediments hold ash from the same 1902 eruption, proving the two valleys shared one event.');
const bigBook = { ...book, title: 'Gwalion Atlas', text: paras.join('\n\n') };
const q2 = 'Tell me about ZORBLAX';
const p2 = tutorSystemPrompt(q2, fresh, 'en', bigBook);
check(p2.length <= 7900, 'huge book prompt within budget', String(p2.length));
check(/ZORBLAX/.test(p2), 'question-relevant paragraph kept despite huge book');
const iA = p2.indexOf('exploded in 1902'), iB = p2.indexOf('shared one event');
check(iA > -1 && iB > -1 && iA < iB, 'excerpts keep the book own order', JSON.stringify({ iA, iB }));
check(!/Filler paragraph number 50 /.test(p2), 'irrelevant paragraphs excluded');
check(/more paragraph\(s\) did not fit/.test(p2), 'dropped-paragraph note present');
check(/end your reply with: Book: "Gwalion Atlas"/.test(p2), 'citation rule survives budget tail');
check(/simple illustration/.test(p2), 'teaching rules survive budget tail');

// --- scanned / image book ---
const scanned = { ...book, text: '', hasText: false };
const p3 = tutorSystemPrompt('What is in this book?', fresh, 'en', scanned);
check(/scanned image\/PDF/.test(p3), 'scanned-book note present');
check(/pages are images/.test(p3), 'scanned-book citation rule swaps');
check(p3.length <= 7900, 'scanned prompt within budget', String(p3.length));

// --- digest edge: empty book ---
check(bookDigest(null, 'x', 1000) === null, 'digest null book -> null');

// --- local askTutor with book ---
const a1 = askTutor(q1, fresh, book);
check(/📘 From your book "Kobo Volcano Atlas" — Page 3/.test(a1), 'local answer quotes book + position', a1.slice(0, 140));
check(/seven years/.test(a1) && /smoke color/.test(a1), 'local answer quotes matching sentences');
check(/Ask AI about this book/.test(a1), 'local answer points to AI hand-off');

const a2 = askTutor('hello', fresh, book);
check(a2.includes('We are reading "Kobo Volcano Atlas"'), 'intro greets with current book');
check(askTutor('hello', fresh).includes('We are reading') === false, 'intro without book unchanged');

// --- app intents win over book ---
const pwBook = { ...book, text: 'Never share your password with anyone. Choose a strong password for your account.' };
const a3 = askTutor('i forgot my password', fresh, pwBook);
check(/Forgot password\?/.test(a3) && !/📘 From your book/.test(a3), 'password question not hijacked by book', a3.slice(0, 120));
check(appIntent('i forgot my password', fresh) !== null, 'appIntent matches password question');

// --- book wins over generic curriculum ---
const a4 = askTutor('What does the book say about smoke color?', fresh, book);
check(/📘 From your book/.test(a4), 'book question beats fallback', a4.slice(0, 120));

// --- offline MENU fallback still book-aware ---
const a5 = askTutor('Explain this section simply', fresh, book);
check(/We are reading "Kobo Volcano Atlas"/.test(a5), 'menu fallback mentions current book', a5.slice(-140));

// --- no book: course questions fall through to the real AI (local menu fallback offline) ---
const a6 = askTutor('What is a fraction?', fresh);
check(/I can explain curriculum terms/.test(a6) && !/📘/.test(a6), 'no-book course question -> local menu fallback', a6.slice(0, 140));
check(!/📘 We are reading/.test(askTutor('hi', fresh)), 'no-book intro unchanged');

// --- tutorMessages threads the book ---
const msgs = tutorMessages(q1, fresh, 'en', [{ me: true, text: 'hi' }, { me: false, text: 'hello there' }], book);
check(msgs.length === 4, 'messages: system + history + question', String(msgs.length));
check(msgs[0].role === 'system' && /Selected book/.test(msgs[0].content), 'system message carries book');
check(msgs[0].content.length <= 7900, 'system message within budget', String(msgs[0].content.length));
const msgs0 = tutorMessages(q1, fresh, 'en', [], undefined);
check(!/Selected book/.test(msgs0[0].content), 'system message without book unchanged');

// --- askTutorAI offline fallback carries the book (node: relative fetch throws -> catch) ---
const r = await askTutorAI(q1, fresh, 'en', [], book);
check(r.src === 'local', 'no server -> local fallback');
check(/📘 From your book/.test(r.text), 'fallback answer is book-grounded', r.text.slice(0, 140));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
