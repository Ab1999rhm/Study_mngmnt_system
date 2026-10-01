import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { subjectsFor, lessonQuiz } from '../../data/content.js';
import { store } from '../../data/store.js';
import { Quiz } from './StudyAI.jsx';
import UploadCard from '../../components/UploadCard.jsx';

export default function MockExam({ user }) {
  const { t } = useTranslation();
  const [stage, setStage] = useState('pick'); // pick | exam | done
  const [exam, setExam] = useState(null);
  const nav = useNavigate();

  const subjects = subjectsFor(user.grade);
  const adminTests = store.uploads().filter(u => (u.type === 'test' || u.type === 'exam') && !u.hidden && store.gradeVisible(user, u));

  const buildExam = subjectName => {
    const sub = subjects.find(s => s.name === subjectName);
    const questions = [];
    sub.chapters.forEach(ch => questions.push(...lessonQuiz(ch)));
    setExam({ subject: sub.name, questions: questions.slice(0, 20) });
    setStage('exam');
  };

  const buildFull = () => {
    const questions = [];
    subjects.forEach(s => s.chapters.forEach(ch => questions.push(...lessonQuiz(ch))));
    questions.sort(() => Math.random() - 0.5);
    setExam({ subject: t('all'), questions: questions.slice(0, 30) });
    setStage('exam');
  };

  if (stage === 'exam' && exam) {
    return (
      <Quiz
        title={`📋 ${t('mockExam')} — ${exam.subject}`}
        questions={exam.questions}
        isExam
        onDone={score => {
          store.addScore(user.id, {
            subject: exam.subject, chapter: exam.chapter || t('mockExam'),
            score, total: exam.questions.length,
            points: score * 3, kind: 'mock-exam'
          });
          setStage('done');
        }}
        back={() => setStage('pick')}
      />
    );
  }

  if (stage === 'done') {
    return (
      <div className="result-box ok">
        <div style={{ fontSize: 46 }}>🏁</div>
        <div className="big">{t('completed')}!</div>
        <p style={{ margin: '12px 0 20px' }}>Your mock exam result was sent to the admin & director dashboards.</p>
        <button className="btn amber" onClick={() => setStage('pick')}>{t('back')}</button>
      </div>
    );
  }

  return (
    <>
      <div className="note-box">📋 {t('mockExam')} — model questions drawn from every chapter of your grade ({user.grade === 'remedial' ? t('remedial') : t('grade' + user.grade)}).</div>
      {adminTests.length > 0 && (
        <>
          <h3 className="section-title">🛒 {t('catalog')}</h3>
          <div className="grid cols3 stagger" style={{ marginBottom: 24 }}>
            {adminTests.map(u => store.hasAccess(user, u) && (u.questions || []).length > 0 ? (
              <div className="subject-card" key={u.id} onClick={() => {
                setExam({ subject: u.subject || u.title, questions: u.questions, chapter: u.type === 'exam' ? 'Model Exam' : 'Admin Test' });
                setStage('exam');
              }}>
                <div className="ico">{u.type === 'exam' ? '📋' : '🧪'}</div>
                <h3>{u.title}</h3>
                <p>{(u.questions || []).length} {t('questions')} · {u.subject || u.type}</p>
                <button className="btn sm" style={{ marginTop: 12 }}>{t('start')} →</button>
              </div>
            ) : (
              <UploadCard key={u.id} item={u} user={user} onPay={() => nav('/student/store')} />
            ))}
          </div>
        </>
      )}
      <h3 className="section-title">📋 {t('mockExam')}</h3>
      <div className="grid cols3 stagger">
        <div className="subject-card" onClick={buildFull}>
          <div className="ico">🏁</div>
          <h3>Full Mock Exam</h3>
          <p>30 mixed questions across all subjects · timed style</p>
          <button className="btn sm" style={{ marginTop: 12 }}>{t('start')} →</button>
        </div>
        {subjects.map(s => (
          <div className="subject-card" key={s.name} onClick={() => buildExam(s.name)}>
            <div className="ico">📝</div>
            <h3>{s.name} Model Exam</h3>
            <p>{Math.min(s.chapters.length * 5, 20)} questions · one per lesson skill</p>
            <button className="btn sm" style={{ marginTop: 12 }}>{t('start')} →</button>
          </div>
        ))}
      </div>
    </>
  );
}