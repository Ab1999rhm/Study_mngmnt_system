import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { store } from '../../data/store.js';
import { studentUploads } from '../../data/curriculum.js';
import { Quiz } from './StudyAI.jsx';
import UploadCard from '../../components/UploadCard.jsx';

export default function MockExam({ user }) {
  const { t } = useTranslation();
  const [stage, setStage] = useState('pick'); // pick | exam | done
  const [exam, setExam] = useState(null);
  const nav = useNavigate();

  const adminTests = studentUploads(user, ['test', 'exam']);

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
        <p style={{ margin: '12px 0 20px' }}>Your exam result was sent to the admin & director dashboards.</p>
        <button className="btn amber" onClick={() => setStage('pick')}>{t('back')}</button>
      </div>
    );
  }

  return (
    <>
      <div className="note-box">📋 {t('mockExam')} — real tests and model exams uploaded by your school for {user.grade === 'remedial' ? t('remedial') : t('grade' + user.grade)}. Scores and points are reported to the admin & director dashboards.</div>
      {adminTests.length === 0 && (
        <div className="empty" data-testid="exams-empty">
          <div className="ico">📭</div>
          {t('noExamsYet')}
        </div>
      )}
      {adminTests.length > 0 && (
        <>
          <h3 className="section-title">📋 {t('mockExam')}</h3>
          <div className="grid cols3 stagger">
            {adminTests.map(u => store.hasAccess(user, u) && (u.questions || []).length > 0 ? (
              <div className="subject-card" key={u.id} onClick={() => {
                setExam({ subject: u.subject || u.title, questions: u.questions, chapter: u.title });
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
    </>
  );
}
