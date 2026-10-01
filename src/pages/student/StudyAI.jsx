import { useState, useMemo, useEffect } from 'react';
import { Routes, Route, useParams, Link, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { subjectsFor, buildAIIntro, buildSubsections, lessonQuiz, chapterExam } from '../../data/content.js';
import { askTutor, appIntent, askTutorAI, loadBookCtx, clearBookCtx } from '../../data/tutor.js';
import { store } from '../../data/store.js';
import { lessonGraph, LESSON_WORKFLOW } from '../../data/aiGraph.js';

export function TutorChat({ user }) {
  const { t, i18n } = useTranslation();
  const [book, setBook] = useState(() => loadBookCtx());
  const [msgs, setMsgs] = useState(() => [{ me: false, text: askTutor('hello', user, book), src: 'local' }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    const onBook = () => setBook(loadBookCtx());
    window.addEventListener('ssa:book', onBook);
    return () => window.removeEventListener('ssa:book', onBook);
  }, []);

  useEffect(() => {
    const el = document.getElementById('tutor-msgs');
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, thinking]);

  const doSend = async q => {
    if (!q || thinking) return;
    setInput('');
    setMsgs(m => [...m, { me: true, text: q }]);
    setThinking(true);
    try {
      const fast = appIntent(q, user);
      const history = msgs.map(m => ({ me: m.me, text: m.text }));
      const reply = fast ? { text: fast, src: 'local' } : await askTutorAI(q, user, i18n.language, history, book);
      setMsgs(m => [...m, { me: false, text: reply.text, src: reply.src, book: !!book }]);
    } finally {
      setThinking(false);
    }
  };

  const send = e => {
    e.preventDefault();
    doSend(input.trim());
  };

  return (
    <div className="card" style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ marginBottom: 4 }}>🧠 {t('aiTutor')} — real AI, offline backup</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>{t('tutorDesc')}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flex: '0 0 auto', flexWrap: 'wrap' }}>
          <span className="chip info">🌐 Real AI</span>
          <span className="chip ok">✓ Works offline</span>
        </div>
      </div>
      {book && (
        <div id="ai-book-ctx" className="note-box" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10, fontSize: 13 }}>
          <b>📘 {t('aiBookUsing')}:</b>
          <span>{book.title}{book.at ? ` · ${book.at}` : ''}</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn ghost sm" onClick={() => { clearBookCtx(); setBook(null); }}>✕ {t('aiBookClear')}</button>
        </div>
      )}
      {book && (
        <div id="ai-book-chips" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {[t('aiAskExplain'), t('aiAskExample'), t('aiAskKey')].map(x => (
            <button key={x} type="button" className="btn ghost sm" onClick={() => doSend(x)}>💡 {x}</button>
          ))}
        </div>
      )}
      <div id="tutor-msgs" style={{ maxHeight: 340, overflowY: 'auto', display: 'grid', gap: 10, padding: 14, background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 12, marginBottom: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} data-src={!m.me && m.src ? m.src : undefined} style={{ justifySelf: m.me ? 'end' : 'start', maxWidth: '85%', background: m.me ? '#0d9488' : '#ffffff', color: m.me ? '#fff' : 'inherit', border: m.me ? 'none' : '1px solid var(--line)', borderRadius: 12, padding: '9px 13px', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {m.text}
            {!m.me && m.src && (
              <div style={{ marginTop: 6, fontSize: 10.5, opacity: 0.65, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
                {m.src === 'ai' ? '🤖 Real AI' : '📴 Offline tutor'}{m.book ? ' · 📘' : ''}
              </div>
            )}
          </div>
        ))}
        {thinking && (
          <div style={{ justifySelf: 'start', background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '9px 13px', fontSize: 13.5, color: 'var(--muted)' }}>
            Thinking…
          </div>
        )}
      </div>
      <form onSubmit={send} style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t('tutorPh')}
          aria-label="Ask the tutor"
          style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, fontSize: 14 }}
        />
        <button className="btn" type="submit" disabled={thinking || !input.trim()}>Ask →</button>
      </form>
    </div>
  );
}
function SubjectList({ user }) {
  const { t } = useTranslation();
  const subjects = subjectsFor(user.grade);
  const progress = user.progress || {};

  return (
    <>
      <div className="ai-banner">
        <h2>🤖 {t('aiTutor')} — {user.grade === 'remedial' ? t('remedial') : t('grade' + user.grade)}</h2>
        <p>Pick a subject. The AI gives you an introduction, a simple study method, a weekly timetable, then teaches the chapter step by step — ending with a 5-question check and a 40-question chapter exam.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {LESSON_WORKFLOW.map(c => <span key={c} className="chip info" style={{ fontSize: 11 }}>{c}</span>)}
        </div>
      </div>
      <div className="grid cols3">
        {subjects.map(s => {
          const done = s.chapters.filter(c => progress[`${s.name}:${c.index}`] === 'done').length;
          const pct = Math.round((done / s.chapters.length) * 100);
          return (
            <Link key={s.name} to={`/student/learn/${encodeURIComponent(s.name)}`} style={{ textDecoration: 'none' }}>
              <div className="subject-card">
                <div className="ico">📘</div>
                <h3>{s.name}</h3>
                <p>{done}/{s.chapters.length} {t('completed')} · {s.chapters.length} {t('chapter')}s</p>
                <div className="bar"><i style={{ width: pct + '%' }} /></div>
              </div>
            </Link>
          );
        })}
      </div>
      <div style={{ marginTop: 22 }}>
<TutorChat user={user} />
      </div>
    </>
  );
}

function ChapterList({ user }) {
  const { subject } = useParams();
  const { t } = useTranslation();
  const name = decodeURIComponent(subject);
  const sub = subjectsFor(user.grade).find(s => s.name === name);
  if (!sub) return <Navigate to="/student/learn" replace />;
  const progress = user.progress || {};

  return (
    <>
      <Link to="/student/learn" style={{ fontSize: 14, color: 'var(--blue)', fontWeight: 600 }}>← {t('back')}</Link>
      <h2 style={{ margin: '14px 0 18px' }}>📘 {sub.name}</h2>
      {sub.chapters.map(c => {
        const done = progress[`${sub.name}:${c.index}`] === 'done';
        const quizDone = progress[`${sub.name}:${c.index}:quiz`];
        return (
          <div className="chapter-row" key={c.index}>
            <div>
              <h4>{t('chapter')} {c.index}: {c.title}</h4>
              <div className="meta">
                {t('lessons')}: {buildSubsections(c).length} · {t('lessonQuiz')}: {quizDone ? `${quizDone}/5 ✓` : '—'} · {t('chapterExam')}: {done ? '✓' : '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link className="btn sm" to={`/student/learn/${encodeURIComponent(sub.name)}/${c.index}`} style={{ textDecoration: 'none' }}>
                {quizDone || done ? t('continue') : t('start')}
              </Link>
            </div>
          </div>
        );
      })}
    </>
  );
}

function LessonFlow({ user }) {
  const { subject, chapterIndex } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const name = decodeURIComponent(subject);
  const sub = subjectsFor(user.grade).find(s => s.name === name);
  const chapter = sub?.chapters.find(c => c.index === Number(chapterIndex));
  const [node, setNode] = useState('welcome');
  const [wf, setWf] = useState({ step: 0, lastScore: 0, review: false });
  const step = wf.step;

  if (!sub || !chapter) return <Navigate to="/student/learn" replace />;

  const ai = buildAIIntro(sub.name, chapter, user.grade);
  const subs = buildSubsections(chapter);
  const quiz = useMemo(() => lessonQuiz(chapter), [chapter]);
  const exam = useMemo(() => chapterExam(chapter), [chapter]);

  // LangGraph-style transitions: nodes = UI stages, edges = events with
  // conditional routing (quiz score < 3/5 → remediate node → exam).
  const go = (event, payload) => {
    const res = lessonGraph.next(node, { ...wf, ...(payload || {}) }, event);
    if (res.node === 'END') return;
    setNode(res.node);
    setWf(res.state);
  };

  const steps = ['ai', 'subs', 'quiz', 'exam', 'done'];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Link to={`/student/learn/${encodeURIComponent(sub.name)}`} style={{ fontSize: 14, color: 'var(--blue)', fontWeight: 600 }}>← {sub.name}</Link>
        <div style={{ display: 'flex', gap: 6 }}>
          {steps.map((s, i) => (
            <span key={s} style={{
              width: 30, height: 6, borderRadius: 4,
              background: i <= step ? 'var(--blue)' : 'var(--line)', display: 'block'
            }} />
          ))}
        </div>
      </div>

      {step === 0 && (
        <>
          <div className="ai-banner">
            <h2>🤖 {ai.welcome}</h2>
            <p>All content for {sub.name} is cached for offline use.</p>
          </div>
          <div className="grid cols2">
            <div className="card">
              <h3 style={{ marginBottom: 14 }}>🧠 {t('introduction')}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#334155' }}>
                {chapter.title} is one of the core topics in {sub.name} for this grade. You will master {chapter.terms.length} key terms
                ({chapter.terms.slice(0, 4).map(x => x[0]).join(', ')}…) through a guided path: read → take notes → practice → test yourself.
                The goal is understanding, not memorising: every term connects to the next.
              </p>
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 14 }}>✅ {t('studyMethod')}</h3>
              <ol className="method-list">
                {ai.method.map((m, i) => <li key={i}>{m}</li>)}
              </ol>
            </div>
          </div>
          <div className="card" style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 14 }}>⏰ {t('timetable')}</h3>
            <table className="tt-table">
              <thead><tr><th>Day</th><th>Task</th><th>Time</th></tr></thead>
              <tbody>
                {ai.timetable.map(r => (
                  <tr key={r.day}><td><b>{r.day}</b></td><td>{r.task}</td><td>{r.mins} min</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn" style={{ marginTop: 18 }} onClick={() => go('begin')}>{t('startLesson')} →</button>
        </>
      )}

      {step === 1 && (
        <>
          <h2 style={{ marginBottom: 16 }}>📖 {t('subsections')} — {t('chapter')} {chapter.index}</h2>
          {node === 'remediate' && (
            <div className="note-box anim-pop">🔁 <b>AI review ({wf.lastScore}/5):</b> {t('aiReviewNote')}</div>
          )}
          {subs.map((s, i) => (
            <div className="subsection" key={i}>
              <h4>{s.title}</h4>
              <p>{s.body}</p>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn ghost" onClick={() => go('back')}>← {t('back')}</button>
            {node === 'remediate' ? (
              <>
                <button className="btn ghost" onClick={() => go('next')}>🔁 {t('lessonQuiz')}</button>
                <button className="btn" onClick={() => go('review-done')}>{t('continue')} →</button>
              </>
            ) : (
              <button className="btn" onClick={() => go('next')}>{t('lessonQuiz')} →</button>
            )}
          </div>
        </>
      )}

      {step === 2 && (
        <Quiz
          title={t('lessonQuiz')}
          questions={quiz}
          onDone={score => {
            store.setProgress(user.id, `${sub.name}:${chapter.index}:quiz`, score);
            store.addScore(user.id, {
              subject: sub.name, chapter: `Ch ${chapter.index} lesson quiz`,
              score, total: 5, points: score * 4, kind: 'lesson-quiz'
            });
            go('quiz-done', { lastScore: score });
          }}
          back={() => go('back')}
        />
      )}

      {step === 3 && (
        <Quiz
          title={t('chapterExam')}
          questions={exam}
          isExam
          onDone={score => {
            const pts = score * 5;
            store.setProgress(user.id, `${sub.name}:${chapter.index}`, 'done');
            store.addScore(user.id, {
              subject: sub.name, chapter: `Chapter ${chapter.index}: ${chapter.title}`,
              score, total: 40, points: pts, kind: 'chapter-exam'
            });
            go('exam-done');
          }}
          back={() => go('back')}
        />
      )}

      {step === 4 && (
        <div className="result-box ok">
          <div style={{ fontSize: 46 }}>🎉</div>
          <div className="big">{t('completed')}!</div>
          <p style={{ margin: '12px 0 20px', fontSize: 16 }}>
            Your points were reported to the admin & director dashboards.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn amber" onClick={() => nav(`/student/learn/${encodeURIComponent(sub.name)}`)}>{t('back')} to {sub.name}</button>
            <Link className="btn" style={{ textDecoration: 'none' }} to="/student">{t('home')}</Link>
          </div>
        </div>
      )}
    </>
  );
}

export function Quiz({ title, questions, onDone, back, isExam }) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);

  const q = questions[idx];
  const last = idx === questions.length - 1;

  const setA = (i, val) => setAnswers(a => ({ ...a, [i]: val }));

  const grade = () => {
    let score = 0;
    questions.forEach((qq, i) => {
      const ans = answers[i];
      if (!ans) return;
      if (qq.type === 'matching') {
        const ok = qq.answers.every((right, pi) => ans[pi] === right);
        if (ok) score++;
      } else if (qq.type === 'open') {
        const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
        const keyWords = norm(qq.answer).split(' ').filter(w => w.length > 4);
        const hits = keyWords.filter(w => norm(ans).includes(w)).length;
        if (keyWords.length && hits / keyWords.length >= 0.4) score++;
      } else if (String(ans).trim().toLowerCase() === String(qq.answer).trim().toLowerCase()) {
        score++;
      }
    });
    return score;
  };

  const finish = () => { setShowResult(true); };

  if (showResult) {
    const score = grade();
    return (
      <div className="result-box">
        <div className="big">{score}/{questions.length}</div>
        <p style={{ fontSize: 17, margin: '8px 0 4px' }}>
          {Math.round((score / questions.length) * 100)}% — {score >= questions.length * 0.6 ? t('correct') : t('incorrect')}
        </p>
        <p style={{ opacity: .9, marginBottom: 18 }}>
          {t('points')}: +{isExam ? score * 5 : score * 4} ⭐
        </p>
        <button className="btn amber" onClick={() => onDone(score)}>{t('finish')} →</button>
      </div>
    );
  }

  const typeLabel = { mcq: t('multipleChoice'), blank: t('fillBlank'), tf: t('trueFalse'), matching: t('matching'), open: t('openQuestion') };

  return (
    <>
      <h2 style={{ marginBottom: 6 }}>{title}</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 18, fontSize: 14 }}>
        {t('question')} {idx + 1} / {questions.length}
      </p>

      <div className="quiz-q">
        <span className="qnum">{t('question')} {idx + 1} <span className="type-chip">{typeLabel[q.type]}</span></span>
        <div className="qtext">{q.q}</div>

        {q.type === 'mcq' && q.options.map((o, i) => (
          <button key={i} className={'opt' + (answers[idx] === o ? ' sel' : '')} onClick={() => setA(idx, o)}>{o}</button>
        ))}

        {q.type === 'tf' && ['True', 'False'].map(o => (
          <button key={o} className={'opt' + (answers[idx] === o ? ' sel' : '')} onClick={() => setA(idx, o)}>
            {o === 'True' ? '✅ ' : '❌ '}{o}
          </button>
        ))}

        {q.type === 'blank' && (
          <input
            style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--line)', borderRadius: 10, fontSize: 15 }}
            placeholder={t('yourAnswer')}
            value={answers[idx] || ''}
            onChange={e => setA(idx, e.target.value)}
          />
        )}

        {q.type === 'open' && (
          <textarea
            rows={4}
            style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--line)', borderRadius: 10, fontSize: 15, resize: 'vertical' }}
            placeholder={t('yourAnswer')}
            value={answers[idx] || ''}
            onChange={e => setA(idx, e.target.value)}
          />
        )}

        {q.type === 'matching' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {q.pairs.map((p, pi) => (
              <div className="match-grid" key={pi}>
                <div className="match-left">{p.left}</div>
                <div className="match-right">
                  <select
                    value={(answers[idx] || [])[pi] || ''}
                    onChange={e => {
                      const cur = [...(answers[idx] || q.pairs.map(() => ''))];
                      cur[pi] = e.target.value;
                      setA(idx, cur);
                    }}
                  >
                    <option value="">— {t('selectAnswer')} —</option>
                    {q.options.map((o, oi) => <option key={oi} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn ghost" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}>← {t('back')}</button>
        {last
          ? <button className="btn green" onClick={finish}>{t('submit')} ✓</button>
          : <button className="btn" onClick={() => setIdx(i => i + 1)}>{t('next')} →</button>}
      </div>
    </>
  );
}

export default function StudyAI({ user }) {
  const { t } = useTranslation();
  if (user.aiEnabled === false) {
    return (
      <div className="card" style={{ marginBottom: 22, textAlign: 'center', padding: '30px 22px' }}>
        <div style={{ fontSize: 46 }}>🔒</div>
        <h2 style={{ margin: '10px 0 6px' }}>{t('aiInactiveTitle')}</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14.5 }}>{t('aiInactiveDesc')}</p>
      </div>
    );
  }
  return (
    <Routes>
      <Route index element={<SubjectList user={user} />} />
      <Route path=":subject" element={<ChapterList user={user} />} />
      <Route path=":subject/:chapterIndex" element={<LessonFlow user={user} />} />
      <Route path="*" element={<Navigate to="/student/learn" replace />} />
    </Routes>
  );
}