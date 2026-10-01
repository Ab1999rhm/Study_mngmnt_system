const fs = require('fs');
const P = 'src/pages/student/StudyAI.jsx';
const lines = fs.readFileSync(P, 'utf8').split(/\r?\n/);

// sanity anchors (1-based): 8 = GEMMA_SRC, 84 = closing brace of GemmaChat, 86 = SubjectList
if (!lines[7].includes('GEMMA_SRC')) { console.error('anchor line 8 mismatch: ' + lines[7]); process.exit(1); }
if (lines[83].trim() !== '}') { console.error('anchor line 84 mismatch: ' + lines[83]); process.exit(1); }
if (!lines[85].includes('function SubjectList')) { console.error('anchor line 86 mismatch: ' + lines[85]); process.exit(1); }

const COMP = `export function TutorChat({ user }) {
  const { t } = useTranslation();
  const [msgs, setMsgs] = useState(() => [{ me: false, text: askTutor('hello', user) }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    const el = document.getElementById('tutor-msgs');
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, thinking]);

  const send = e => {
    e.preventDefault();
    const q = input.trim();
    if (!q || thinking) return;
    setInput('');
    setMsgs(m => [...m, { me: true, text: q }]);
    setThinking(true);
    window.setTimeout(() => {
      setMsgs(m => [...m, { me: false, text: askTutor(q, user) }]);
      setThinking(false);
    }, 250);
  };

  return (
    <div className="card" style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ marginBottom: 4 }}>🧠 {t('aiTutor')} — offline curriculum tutor</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>{t('gemmaDesc')}</p>
        </div>
        <span className="chip ok" style={{ flex: '0 0 auto' }}>✓ Works offline</span>
      </div>
      <div id="tutor-msgs" style={{ maxHeight: 340, overflowY: 'auto', display: 'grid', gap: 10, padding: 14, background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 12, marginBottom: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ justifySelf: m.me ? 'end' : 'start', maxWidth: '85%', background: m.me ? '#0d9488' : '#ffffff', color: m.me ? '#fff' : 'inherit', border: m.me ? 'none' : '1px solid var(--line)', borderRadius: 12, padding: '9px 13px', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {m.text}
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
}`;

// replace lines 8..84 (idx 7..83) with the new component
lines.splice(7, 84 - 7 + 1, COMP);

// add tutor import after the content import line
const importAt = lines.findIndex(l => l.includes("from '../../data/content.js'"));
if (importAt < 0) { console.error('content import not found'); process.exit(1); }
lines.splice(importAt + 1, 0, "import { askTutor } from '../../data/tutor.js';");

// update usage
const useAt = lines.findIndex(l => l.trim() === '<GemmaChat />');
if (useAt < 0) { console.error('GemmaChat usage not found'); process.exit(1); }
lines[useAt] = '<TutorChat user={user} />';

fs.writeFileSync(P, lines.join('\n'));
console.log('spliced ok; GemmaChat gone:', !lines.join('\n').includes('GemmaChat'), '| GEMMA_SRC gone:', !lines.join('\n').includes('GEMMA_SRC'));
