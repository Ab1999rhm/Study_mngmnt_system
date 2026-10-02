import { useState, useEffect } from 'react';
import { Routes, Route, useParams, Link, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { studentSubjects, subjectItems } from '../../data/curriculum.js';
import { askTutor, appIntent, askTutorAI, loadBookCtx, clearBookCtx } from '../../data/tutor.js';
import UploadCard from '../../components/UploadCard.jsx';

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
  const subjects = studentSubjects(user);

  return (
    <>
      <div className="ai-banner">
        <h2>🤖 {t('aiTutor')} — {user.grade === 'remedial' ? t('remedial') : t('grade' + user.grade)}</h2>
        <p>Real content uploaded by your school — pick a subject to read and watch with the study reader. Ask the AI tutor below anything about your course.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {['📘 pick a subject', '📖 study reader', '📝 notes', '🧪 practice test'].map(c => <span key={c} className="chip info" style={{ fontSize: 11 }}>{c}</span>)}
        </div>
      </div>
      {subjects.length === 0 && (
        <div className="empty" data-testid="learn-empty">
          <div className="ico">📭</div>
          {t('noContentYet')}
        </div>
      )}
      <div className="grid cols3">
        {subjects.map(s => (
          <Link key={s.name} to={`/student/learn/${encodeURIComponent(s.name)}`} style={{ textDecoration: 'none' }}>
            <div className="subject-card">
              <div className="ico">📘</div>
              <h3>{s.name}</h3>
              <p>{s.done}/{s.total} {t('completed')} · {s.total} {t('materials')}</p>
              <div className="bar"><i style={{ width: s.pct + '%' }} /></div>
            </div>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 22 }}>
<TutorChat user={user} />
      </div>
    </>
  );
}

function SubjectItems({ user }) {
  const { subject } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const name = decodeURIComponent(subject);
  const items = subjectItems(user, name);
  if (!items.length) return <Navigate to="/student/learn" replace />;

  return (
    <>
      <Link to="/student/learn" style={{ fontSize: 14, color: 'var(--blue)', fontWeight: 600 }}>← {t('back')}</Link>
      <h2 style={{ margin: '14px 0 6px' }}>📘 {name}</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 16 }}>{items.length} {t('materials')} · {t('offlineReady')}</p>
      <div className="grid cols3 stagger">
        {items.map(u => <UploadCard key={u.id} item={u} user={user} onPay={() => nav('/student/store')} />)}
      </div>
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
      <Route path=":subject" element={<SubjectItems user={user} />} />
      <Route path="*" element={<Navigate to="/student/learn" replace />} />
    </Routes>
  );
}