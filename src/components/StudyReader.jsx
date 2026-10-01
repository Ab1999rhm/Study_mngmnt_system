import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { store } from '../data/store.js';
import { saveBookCtx } from '../data/tutor.js';
import { keyPoints, makeQuestions, buildBook } from '../data/study.js';

const TIPS = ['captureTip1', 'captureTip2', 'captureTip3'];

export default function StudyReader({ item, user, onClose }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const book = useMemo(() => buildBook(item), [item.body, item.fileData, item.fileName, item.title]);
  const pkey = 'study:' + item.id;
  const saved = ((user && user.progress) || {})[pkey] || null;

  const [phase, setPhase] = useState('plan');
  const [secIdx, setSecIdx] = useState(Math.min(saved && saved.sec != null ? saved.sec : 0, book.sections.length - 1));
  const [pageIdx, setPageIdx] = useState(saved && saved.page != null ? saved.page : 0);
  const [done, setDone] = useState((saved && saved.done) || []);
  const [qStats, setQStats] = useState((saved && saved.q) || { c: 0, t: 0 });
  const [reveal, setReveal] = useState(true);
  const [qIdx, setQIdx] = useState(0);
  const [choice, setChoice] = useState(null);
  const [wrong, setWrong] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [conf, setConf] = useState('');
  const [err, setErr] = useState('');
  const timer = useRef(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const section = book.sections[Math.min(secIdx, book.sections.length - 1)];
  const questions = useMemo(() => makeQuestions(section), [section]);
  const keys = useMemo(() => keyPoints(section), [section]);
  const tipKey = TIPS[secIdx % TIPS.length];
  const total = book.sections.length;
  const pct = Math.round((done.length / total) * 100);
  const resumable = !!(saved && !saved.completedAt && saved.phase && saved.phase !== 'plan');
  const reviewable = !!(saved && saved.completedAt);

  const persist = (over = {}) => store.setProgress(user.id, pkey, {
    sec: secIdx, page: pageIdx, phase, done, q: qStats, ...over
  });

  const close = () => { persist(); onClose(); };

  const askAi = () => {
    persist();
    const labels = book.sections.map(s => sectionLabel(s));
    const text = book.sections
      .map(s => s.media ? '' : (s.pages || []).map(p => (Array.isArray(p) ? p.join('\n') : String(p))).join('\n\n'))
      .join('\n\n').trim();
    saveBookCtx({
      id: item.id,
      title: item.title,
      type: item.type,
      subject: item.subject || '',
      grade: item.grade === 'all' ? 'all' : String(item.grade || ''),
      at: (phase === 'plan' || phase === 'done') ? '' : sectionLabel(section),
      sections: labels,
      text: text.slice(0, 120000),
      hasText: !!text,
      savedAt: Date.now()
    });
    onClose();
    nav('/student/learn');
  };

  const start = () => {
    const target = resumable && saved.phase && saved.phase !== 'plan' ? saved.phase : 'read';
    setPhase(target);
    setErr('');
    persist({ phase: target });
  };

  const review = () => {
    setSecIdx(0);
    setPageIdx(0);
    setPhase('read');
    setErr('');
    store.setProgress(user.id, pkey, { ...saved, sec: 0, page: 0, phase: 'read' });
  };

  const prevPage = () => {
    if (pageIdx > 0) { const p = pageIdx - 1; setPageIdx(p); persist({ page: p }); }
  };

  const nextPage = () => {
    if (pageIdx < section.pages.length - 1) {
      const p = pageIdx + 1;
      setPageIdx(p);
      persist({ page: p, phase: 'read' });
    } else {
      setPhase('capture');
      setReveal(true);
      persist({ phase: 'capture' });
    }
  };

  const confirmCapture = () => {
    const next = questions.length ? 'question' : 'explain';
    setPhase(next);
    setQIdx(0);
    setChoice(null);
    setWrong(false);
    setErr('');
    persist({ phase: next });
  };

  const pick = opt => {
    if (choice && choice === questions[qIdx].answer) return;
    setChoice(opt);
    const q = questions[qIdx];
    if (opt === q.answer) {
      setWrong(false);
      const nq = { c: qStats.c + 1, t: qStats.t + 1 };
      setQStats(nq);
      timer.current = setTimeout(() => {
        if (qIdx < questions.length - 1) {
          setQIdx(i => i + 1);
          setChoice(null);
        } else {
          setPhase('explain');
          setErr('');
          persist({ phase: 'explain', q: nq });
        }
      }, 700);
    } else {
      setWrong(true);
      setQStats(s => ({ c: s.c, t: s.t + 1 }));
    }
  };

  const saveExplain = () => {
    if (!conf) { setErr(t('confRequired')); return; }
    const prev = ((user.progress || {})[pkey]) || {};
    const nd = done.includes(secIdx) ? done : [...done, secIdx];
    const reflections = { ...(prev.reflections || {}), [secIdx]: { conf, text: answerText } };
    setDone(nd);
    if (secIdx >= total - 1) {
      const reviews = (prev.reviews || 0) + (prev.completedAt ? 1 : 0);
      const span = Math.min(8, 1 + reviews);
      store.setProgress(user.id, pkey, {
        sec: secIdx, page: pageIdx, phase: 'done', done: nd, q: qStats, reflections,
        completedAt: prev.completedAt || new Date().toISOString(),
        reviews,
        nextReview: new Date(Date.now() + span * 86400000).toISOString()
      });
      setPhase('done');
    } else {
      const n = secIdx + 1;
      setSecIdx(n);
      setPageIdx(0);
      setPhase('read');
      setAnswerText('');
      setConf('');
      setErr('');
      store.setProgress(user.id, pkey, { sec: n, page: 0, phase: 'read', done: nd, q: qStats, reflections });
    }
  };

  const sectionLabel = s => s.title || (t('partLabel') + ' ' + (s.num || (book.sections.indexOf(s) + 1)));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 240, background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid var(--line)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 15 }}>📖 {item.title}</b>
        <div style={{ flex: '0 1 240px', height: 8, background: '#e2e8f0', borderRadius: 99, minWidth: 90 }}>
          <div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg,#0d9488,#14b8a6)', borderRadius: 99, transition: 'width .3s' }} />
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{done.length}/{total} ✓</span>
        <span style={{ flex: 1 }} />
        <button className="btn sm" data-testid="ask-ai-book" onClick={askAi}>🤖 {t('askAiBook')}</button>
        <button className="btn sm ghost" onClick={close}>✕ {t('studyClose')}</button>
      </header>

      <div className="study-layout" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <aside className="study-aside" style={{ width: 252, background: '#fff', borderRight: '1px solid var(--line)', overflowY: 'auto', padding: '12px 10px', flexShrink: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .7, color: 'var(--muted)', marginBottom: 8 }}>📋 {t('studyPlan')}</div>
          {book.sections.map((s, i) => {
            const state = done.includes(i) ? 'done' : i === secIdx && phase !== 'plan' && phase !== 'done' ? 'now' : 'todo';
            return (
              <div key={i} style={{
                display: 'flex', gap: 7, alignItems: 'flex-start', padding: '6px 7px', marginBottom: 3, borderRadius: 8,
                background: state === 'now' ? '#ccfbf1' : 'transparent',
                fontWeight: state === 'now' ? 700 : 500, fontSize: 13,
                paddingLeft: 7 + Math.min(s.level - 1, 2) * 12
              }}>
                <span>{state === 'done' ? '✅' : state === 'now' ? '📖' : '▫️'}</span>
                <span style={{ flex: 1, lineHeight: 1.35 }}>{sectionLabel(s)}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{s.pageCount}p</span>
              </div>
            );
          })}
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px dashed var(--line)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, color: '#334155', marginBottom: 4 }}>{t('methodsNote')}:</div>
            <div>{t('methodRead')}</div>
            <div>{t('methodCapture')}</div>
            <div>{t('methodQuiz')}</div>
            <div>{t('methodExplain')}</div>
          </div>
        </aside>

        <main style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 26px', minWidth: 0 }}>
          {phase === 'plan' && (
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <h2 style={{ marginBottom: 6 }}>📚 {t('studyPlan')} — {item.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 14 }}>{t('planIntro')}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <span className="chip">🗂 {total} {t('studySections')}</span>
                <span className="chip">📄 {book.pages} {t('studyPages')}</span>
                <span className="chip">⏱ {t('estMin', { n: book.estMin })}</span>
                {reviewable && saved.nextReview && (
                  <span className={'chip ' + (Date.parse(saved.nextReview) <= Date.now() ? 'warn' : 'info')}>
                    🔁 {t('reviewDue')} — {new Date(saved.nextReview).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="card" style={{ padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 13, lineHeight: 1.9, color: '#334155' }}>
                  <div>📖 {t('methodRead')}</div>
                  <div>🧠 {t('methodCapture')}</div>
                  <div>❓ {t('methodQuiz')}</div>
                  <div>✍️ {t('methodExplain')}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn green" onClick={start}>
                  {resumable ? '▶ ' + t('resumeStudy') : '▶ ' + t('startStudying')}
                </button>
                {reviewable && <button className="btn amber" onClick={review}>🔁 {t('reviewNow')}</button>}
              </div>
            </div>
          )}

          {phase === 'read' && (
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>{sectionLabel(section)}</h3>
                <span className="chip info">{t('secN')} {secIdx + 1}/{total} · {t('page')} {pageIdx + 1}/{section.pages.length}</span>
              </div>
              <div className="card" style={{ padding: section.media ? 12 : '18px 20px', lineHeight: 1.8, fontSize: 15.5 }}>
                {section.media ? (
                  section.media.kind === 'image' ? (
                    <img src={section.media.src} alt={section.media.name} style={{ width: '100%', maxHeight: '58vh', objectFit: 'contain', display: 'block', margin: '0 auto', background: '#fff', borderRadius: 8 }} />
                  ) : section.media.kind === 'pdf' ? (
                    <iframe title={section.media.name} src={section.media.src} style={{ width: '100%', height: '58vh', border: 0, borderRadius: 8, background: '#fff' }} />
                  ) : section.media.kind === 'video' ? (
                    <video controls src={section.media.src} style={{ width: '100%', maxHeight: '58vh', background: '#000', borderRadius: 8, display: 'block' }} />
                  ) : section.media.kind === 'audio' ? (
                    <audio controls src={section.media.src} style={{ width: '100%', display: 'block', margin: '8px 0' }} />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px 10px' }}>
                      <div style={{ fontSize: 42, marginBottom: 8 }}>📄</div>
                      <div style={{ fontWeight: 700, marginBottom: 12 }}>{section.media.name}</div>
                      <a className="btn sm green" href={section.media.src} download={section.media.name}>⬇️ {t('download')}</a>
                    </div>
                  )
                ) : section.pages[pageIdx].map((p, i) => (
                  <p key={i} style={{ margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{p}</p>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
                <button className="btn ghost sm" onClick={prevPage} disabled={pageIdx === 0}>‹ {t('back')}</button>
                <span style={{ flex: 1 }} />
                {pageIdx < section.pages.length - 1
                  ? <button className="btn green" onClick={nextPage}>{t('nextPage')} ›</button>
                  : <button className="btn green" onClick={nextPage}>{t('finishSection')} →</button>}
              </div>
            </div>
          )}

          {phase === 'capture' && (
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
              <h3 style={{ marginBottom: 4 }}>🧠 {t('captureTitle')} — {sectionLabel(section)}</h3>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 12 }}>💡 {t(tipKey)}</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {keys.length === 0 ? (
                  <div className="card" style={{ padding: '12px 14px', fontSize: 14.5, lineHeight: 1.65, borderLeft: '4px solid #0d9488', color: 'var(--muted)' }}>
                    {t('captureEmpty')}
                  </div>
                ) : keys.map((k, i) => (
                  <div key={i} className="card" style={{
                    padding: '12px 14px', fontSize: 14.5, lineHeight: 1.65, borderLeft: '4px solid #0d9488',
                    filter: reveal ? 'none' : 'blur(7px)', transition: 'filter .25s', userSelect: reveal ? 'text' : 'none'
                  }}>
                    {k}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <button className="btn ghost sm" onClick={() => setReveal(r => !r)}>
                  {reveal ? '🙈 Hide & recall' : '👁 Show'}
                </button>
                <span style={{ flex: 1 }} />
                <button className="btn green" onClick={confirmCapture}>✓ {t('capturedBtn')}</button>
              </div>
            </div>
          )}

          {phase === 'question' && questions[qIdx] && (
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <h3 style={{ marginBottom: 4 }}>❓ {t('questionnaire')}</h3>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
                {t('question')} {qIdx + 1}/{questions.length} · ✓ {qStats.c}/{qStats.t}
              </div>
              <div className="card" style={{ padding: 16, fontSize: 15.5, lineHeight: 1.7, marginBottom: 14 }}>
                {questions[qIdx].q}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {questions[qIdx].options.map(opt => {
                  const isPicked = choice === opt;
                  const isAnswer = opt === questions[qIdx].answer;
                  const style = isPicked
                    ? (isAnswer
                      ? { borderColor: '#059669', background: '#d1fae5', color: '#065f46' }
                      : { borderColor: '#dc2626', background: '#fee2e2', color: '#991b1b' })
                    : {};
                  return (
                    <button key={opt} className="btn ghost" style={{ textAlign: 'left', ...style }} onClick={() => pick(opt)}>
                      {opt}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, fontSize: 13.5, minHeight: 20, fontWeight: 600 }}>
                {wrong && <span style={{ color: '#dc2626' }}>✕ {t('tryAgain')}</span>}
                {choice && choice === questions[qIdx].answer && <span style={{ color: '#059669' }}>✓ {t('correctMsg')}</span>}
              </div>
            </div>
          )}

          {phase === 'explain' && (
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <h3 style={{ marginBottom: 4 }}>✍️ {t('selfExplain')} — {sectionLabel(section)}</h3>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 12 }}>{t('methodExplain')}</p>
              <textarea
                rows={5}
                value={answerText}
                onChange={e => setAnswerText(e.target.value)}
                placeholder={t('explainPh')}
                style={{ width: '100%', resize: 'vertical', padding: 12, fontSize: 14.5, lineHeight: 1.6, borderRadius: 10, border: '1px solid var(--line)' }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>
                {[['clear', t('confClear')], ['partial', t('confPartial')], ['review', t('confReview')]].map(([k, label]) => (
                  <button
                    key={k}
                    className={'btn sm ' + (conf === k ? 'green' : 'ghost')}
                    onClick={() => { setConf(k); setErr(''); }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {err && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 10 }}>✕ {err}</div>}
              <button className="btn green" onClick={saveExplain}>→ {t('saveNext')}</button>
            </div>
          )}

          {phase === 'done' && (() => {
            const doneProg = ((user && user.progress) || {})[pkey] || saved || {};
            return (
              <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', paddingTop: 24 }}>
                <div style={{ fontSize: 54, marginBottom: 8 }}>🎉</div>
                <h2 style={{ marginBottom: 8 }}>{t('bookDone')}</h2>
                <p style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 16 }}>{t('doneMsg')}</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
                  <span className="chip ok">🗂 {total}/{total} ✓</span>
                  <span className="chip info">❓ {qStats.c}/{qStats.t}</span>
                  {doneProg.nextReview && (
                    <span className="chip warn">🔁 {t('reviewDue')}: {new Date(doneProg.nextReview).toLocaleDateString()}</span>
                  )}
                </div>
                <button className="btn green" onClick={close}>✓ {t('studyClose')}</button>
              </div>
            );
          })()}
        </main>
      </div>
    </div>
  );
}
