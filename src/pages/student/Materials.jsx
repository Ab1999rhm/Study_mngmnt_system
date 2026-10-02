import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { studentUploads } from '../../data/curriculum.js';
import UploadCard from '../../components/UploadCard.jsx';

export default function Materials({ user }) {
  const { t } = useTranslation();
  const nav = useNavigate();

  const adminMats = studentUploads(user, ['material']);

  return (
    <>
      <div className="note-box">📝 Learning materials / notes for {user.grade === 'remedial' ? t('remedial') : t('grade' + user.grade)} — uploaded by your school. Tap a note to read. All notes work offline.</div>
      <h3 className="section-title">📝 {t('materials')}</h3>
      {adminMats.length > 0 ? (
        <div className="grid cols3 stagger">
          {adminMats.map(u => <UploadCard key={u.id} item={u} user={user} onPay={() => nav('/student/store')} />)}
        </div>
      ) : (
        <div className="empty" data-testid="materials-empty">
          <div className="ico">📭</div>
          {t('noMaterialsYet')}
        </div>
      )}
    </>
  );
}
