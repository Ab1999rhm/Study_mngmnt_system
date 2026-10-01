import { useTranslation } from 'react-i18next';
import { subjectsFor, buildAIIntro } from '../../data/content.js';
import { nextStudyTarget, lastStudied, targetLabel } from '../../data/plan.js';

export default function StudyPlan({ user }) {
  const { t } = useTranslation();
  const subjects = subjectsFor(user.grade);
  const next = nextStudyTarget(user);
  const last = lastStudied(user);
  const label = targetLabel(next);
  const ai = buildAIIntro(next ? next.subject.name : subjects[0].name, next ? next.chapter : subjects[0].chapters[0], user.grade);

  const practiceIdx = next ? (subjects.indexOf(next.subject) + 1) % subjects.length : 1 % subjects.length;
  const practiceSubject = subjects[practiceIdx];

  const blocks = [
    { time: '07:30 – 08:00', task: last ? `Wake-up review: re-read your ${last.subject} ch ${last.chapter} notes aloud` : 'Wake-up review: read your newest notes aloud', tag: 'Review' },
    next && next.done
      ? { time: '16:00 – 16:30', task: `All chapters done — revisit ${label} (weakest areas) + 3-line note`, tag: 'Review' }
      : { time: '16:00 – 16:30', task: `New sub-section: ${label} + 3-line note`, tag: 'New learning' },
    { time: '16:30 – 17:00', task: `Practice ${practiceSubject.name} exercises`, tag: 'Practice' },
    { time: '19:00 – 19:15', task: `5-question lesson quiz on ${label}`, tag: 'Quiz' },
    { time: 'Sat 09:00 – 09:45', task: '40-question chapter exam (weekly)', tag: 'Exam' },
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
            {ai.method.map((m, i) => <li key={i}>{m}</li>)}
          </ol>
          <div className="note-box" style={{ marginTop: 16, marginBottom: 0 }}>
              💡 Rule of thumb: 30 minutes of focused study beats 3 hours of distracted study. Take a 5-minute break every 30 minutes.
          </div>
        </div>
      </div>

      <h3 className="section-title">📘 {t('subjects')} covered this week</h3>
      <div className="grid cols4 stagger">
        {subjects.map(s => (
          <div className="subject-card" key={s.name}>
            <div className="ico">📖</div>
            <h3 style={{ fontSize: 15 }}>{s.name}</h3>
            <p>{s.chapters.length} {t('chapter')}s · {s.chapters.reduce((a, c) => a + c.terms.length, 0)} terms</p>
          </div>
        ))}
      </div>
    </>
  );
}