import { askTutor, appIntent, tutorSystemPrompt, tutorMessages, askTutorAI } from '../src/data/tutor.js';
import { nextStudyTarget, lastStudied, targetLabel } from '../src/data/plan.js';
import { subjectsFor } from '../src/data/content.js';

let pass = 0, fail = 0;
const check = (ok, label, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : ' :: ' + extra)); ok ? pass++ : fail++; };

const fresh = { grade: 8, progress: {}, scores: [], points: 0 };

// --- plan helpers ---
const t1 = nextStudyTarget(fresh);
const l1 = targetLabel(t1);
check(t1 && !t1.done && /ch \d+:/.test(l1), 'next target: first unfinished chapter of grade', l1);
const subs = subjectsFor(8);
const first = subs[0].chapters[0];
check(t1.subject.name === first.subject || t1.chapter.index === first.index, 'next target starts at first subject/chapter', JSON.stringify({ s: t1.subject.name, c: t1.chapter.index }));
check(lastStudied(fresh) === null, 'no scores -> no lastStudied');

const scored = { ...fresh, scores: [{ subject: 'English', chapter: 3, score: 4, total: 5, at: 'x' }] };
const last = lastStudied(scored);
check(last && last.subject === 'English' && last.chapter === 3, 'lastStudied reads most recent exam', JSON.stringify(last));

// mark every chapter done -> target.done
const fullProgress = {};
for (const s of subs) for (const c of s.chapters) fullProgress[`${s.name}:${c.index}`] = 'done';
const doneUser = { ...fresh, progress: fullProgress };
const tDone = nextStudyTarget(doneUser);
check(tDone.done === true, 'all done -> target.done true', JSON.stringify(tDone && { s: tDone.subject.name, c: tDone.chapter.index }));

// --- tutor: term answers from curriculum ---
const a1 = askTutor('What is a fraction?', fresh);
check(/part of a whole/i.test(a1), 'term: fraction answered from SSA content', a1.slice(0, 160));
check(/Chapter \d+/.test(a1) && /Mathematics/.test(a1), 'term answer cites subject + chapter', a1.slice(0, 200));
const a2 = askTutor('define percentage', fresh);
check(/out of one hundred/i.test(a2), 'term: percentage definition', a2.slice(0, 160));

// --- tutor: chapter summary ---
const chapTitle = subs[0].chapters[0].title;
const a3 = askTutor('Summarize chapter: ' + chapTitle, fresh);
check(a3.includes('covers') && a3.includes('key terms'), 'chapter summary lists key terms', a3.slice(0, 200));

// --- tutor: intents ---
const a4 = askTutor('What should I study next?', fresh);
check(/next unfinished chapter is/.test(a4) && /ch 1:/.test(a4), 'study-next uses real progress target', a4.slice(0, 200));
const a5 = askTutor('What should I study next?', doneUser);
check(/finished every chapter/.test(a5), 'study-next when everything done', a5.slice(0, 160));
const a6 = askTutor('How do exams work?', fresh);
check(/5-question/.test(a6) && /40-question/.test(a6), 'exam intent explains both checks', a6.slice(0, 160));
const a7 = askTutor('How do I unlock a package?', fresh);
check(/Store page/.test(a7), 'package intent -> store flow', a7.slice(0, 160));
const a8 = askTutor('I forgot my password', fresh);
check(/Forgot password/.test(a8) || /forgot password/i.test(a8), 'password intent -> reset flow', a8.slice(0, 160));
const a9 = askTutor('hello', fresh);
check(/SSA public AI/.test(a9), 'greeting -> intro', a9.slice(0, 120));

// --- tutor: fallback menu ---
const a10 = askTutor('zzz qqq wwww vvvv', fresh);
check(/I can explain curriculum terms/.test(a10), 'unknown question -> capability menu', a10.slice(0, 160));
const a11 = askTutor('', fresh);
check(/SSA public AI/.test(a11), 'empty question -> intro', a11.slice(0, 100));

// --- appIntent: local fast path for app mechanics (real AI handles the rest) ---
const pi = appIntent('How do I unlock a package?', fresh);
check(pi && /Store page/.test(pi), 'appIntent: package question answered locally', pi);
const ei = appIntent('How do exams work?', fresh);
check(ei && /5-question/.test(ei) && /40-question/.test(ei), 'appIntent: exam mechanics', ei);
const wi = appIntent('I forgot my password', fresh);
check(wi && /Forgot password/.test(wi), 'appIntent: password reset', wi);
const si = appIntent('What should I study next?', fresh);
check(si && /ch 1:/.test(si), 'appIntent: study-next uses real target', si);
check(appIntent('What is a fraction?', fresh) === null, 'appIntent: curriculum question -> real AI path');
check(appIntent('hello', fresh) === null, 'appIntent: greeting -> real AI path');
check(appIntent('', fresh) === null, 'appIntent: empty -> null');

// --- tutorSystemPrompt: grounded curriculum + app context ---
const sp = tutorSystemPrompt('What is a fraction?', fresh, 'en');
check(/grade 8/.test(sp) && /Mathematics/.test(sp), 'prompt: grade + subject list', sp.slice(0, 140));
check(/5-question/.test(sp) && /40-question/.test(sp), 'prompt: exam facts included');
check(/next unfinished chapter = [^;]*ch 1:/i.test(sp), 'prompt: next target from real progress', (sp.match(/next unfinished chapter = [^;]+/) || [''])[0]);
check(/fraction = a part of a whole/i.test(sp), 'prompt: matched curriculum material injected', (sp.match(/- [^\n]{0,140}fraction[^\n]{0,80}/i) || [''])[0]);
check(/Reply in English/.test(sp), 'prompt: language instruction');
check(/Answer openly/.test(sp) && !/ONLY from the material/.test(sp), 'prompt: open public AI (not material-locked)');
check(/School-appropriate/.test(sp) && /Never invent phone numbers/.test(sp), 'prompt: safety + no-invented-numbers rules kept');
const spOm = tutorSystemPrompt('hi', fresh, 'om');
check(/Reply in Afaan Oromoo/.test(spOm), 'prompt: om -> Afaan Oromoo');
check(sp.length <= 8000, 'prompt fits proxy limit (len=' + sp.length + ')');

// --- multi-turn history threading (conversation memory) ---
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
check(fb.src === 'local' && /part of a whole/.test(fb.text), 'askTutorAI: unreachable API -> local fallback', JSON.stringify({ src: fb.src, head: fb.text.slice(0, 60) }));

console.log(fail ? `\nTUTOR TEST FAILED (${fail})` : `\nALL ${pass} TUTOR TESTS PASSED`);
process.exit(fail ? 1 : 0);
