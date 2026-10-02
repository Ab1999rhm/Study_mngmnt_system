import { useTranslation } from 'react-i18next';
import { studentSubjects } from '../../data/curriculum.js';
import { nextStudyTarget, lastStudied, targetLabel } from '../../data/plan.js';

const METHOD = [
  'Read the material once straight through, then again with a pencil — mark anything unclear.',
  'Write a 3-line note after each section in your own words.',
  'Teach the idea back to yourself or a friend — if you can explain it, you know it.',
  'Close the book and recall the key points from memory before checking your notes.',
  'Finish with a practice test from the Exams page, then retry what you missed tomorrow.'
];

export default function StudyPlan({ user }) {
  const { t } = useTranslation();
  const subjects = studentSubjects(user);
  const next = nextStudyTarget(user);
  const last = lastStudied(user);
  const label = targetLabel(next) || t('materials');

  const pi = Math.max(0, subjects.findIndex(s => s.name === (next && next.subject && next.subject.name)));
  const practiceSubject = subjects.length ? subjects[(pi + 1) % subjects.length].name : t('subjects');

  const blocks = [
    { time: '07:30 – 08:00', task: last ? `Wake-up review: re-read your ${last.subject} material — ${last.chapter}` : 'Wake-up review: read your newest notes aloud', tag: 'Review' },
    next && next.done
      ? { time: '16:00 – 16:30', task: `All materials done — revisit ${label} (weakest areas) + 3-line note`, tag: 'Review' }
      : { time: '16:00 – 16:30', task: `Read: ${label} + 3-line note`, tag: 'New learning' },
    { time: '16:30 – 17:00', task: `Practice ${practiceSubject} exercises`, tag: 'Practice' },
    { time: '19:00 – 19:15', task: `Quick recall quiz on ${label}`, tag: 'Quiz' },
    { time: 'Sat 09:00 – 09:45', task: 'Take a practice exam from the Exams page', tag: 'Exam' },
    { time: 'Sun 10:00 – 10:30', task: 'Watch 1 video from Video Hub + summary note', tag: 'Video' }
  ];

  return (
    <>
      <div className="ai-banner">
        <h2>🗓️ {t('studyPlan')} — {user.grade === 'remedial' ? t('remedial') : t('grade' + user.grade)}</h2>
        <p>Built around the AI method: short focused blocks, active recall, and weekly testing. Adjust times to your own schedule but keep the order.</p>
      </div>

      <div className="grid cols2 stagger">
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>⏰ {t('studySchedule')}</h3>
          <table className="tt-table">
            <thead><tr><th>Time</th><th>Task</th><th>Type</th></tr></thead>
            <tbody>
              {blocks.map(b => (
                <tr key={b.time}><td><b>{b.time}</b></td><td>{b.task}</td><td><span className="type-chip">{b.tag}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 14 }}>🧠 {t('studyMethod')}</h3>
          <ol className="method-list">
            {METHOD.map((m, i) => <li key={i}>{m}</li>)}
          </ol>
          <div className="note-box" style={{ marginTop: 16, marginBottom: 0 }}>
              💡 Rule of thumb: 30 minutes of focused study beats 3 hours of distracted study. Take a 5-minute break every 30 minutes.
          </div>
        </div>
      </div>

      <h3 className="section-title">📘 {t('subjects')} covered this week</h3>
      {subjects.length === 0 ? (
        <div className="empty" data-testid="plan-empty">
          <div className="ico">📭</div>
          {t('noContentYet')}
        </div>
      ) : (
        <div className="grid cols4 stagger">
          {subjects.map(s => (
            <div className="subject-card" key={s.name}>
              <div className="ico">📖</div>
              <h3 style={{ fontSize: 15 }}>{s.name}</h3>
              <p>{s.total} {t('materials')} · {s.done} {t('completed')}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
