import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { store } from '../../data/store.js';
import UploadCard from '../../components/UploadCard.jsx';

export default function VideoHub({ user }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const favs = user.favorites || [];
  const toggle = id => store.toggleFavorite(user.id, id);
  const videos = store.uploads().filter(u => u.type === 'video' && !u.hidden && store.gradeVisible(user, u));
  const favVideos = videos.filter(v => favs.includes(v.id));

  const Card = ({ u }) => (
    <div style={{ position: 'relative' }}>
      <button
        title={favs.includes(u.id) ? t('removeFavorite') : t('addFavorite')}
        aria-label={favs.includes(u.id) ? t('removeFavorite') : t('addFavorite')}
        onClick={() => toggle(u.id)}
        style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, width: 34, height: 34, borderRadius: 9, border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', fontSize: 15, boxShadow: '0 2px 6px rgba(15,23,42,.08)' }}
      >{favs.includes(u.id) ? '❤️' : '🤍'}</button>
      <UploadCard item={u} user={user} onPay={() => nav('/student/store')} />
    </div>
  );

  return (
    <>
      {favVideos.length > 0 && (
        <>
          <h3 className="section-title">❤️ {t('favorites')}</h3>
          <div className="grid cols3 stagger" style={{ marginBottom: 24 }}>
            {favVideos.map(u => <Card key={'f' + u.id} u={u} />)}
          </div>
        </>
      )}
      <h3 className="section-title">🎬 {t('videoHub')}</h3>
      <div className="grid cols3 stagger">
        {videos.map(u => <Card key={u.id} u={u} />)}
      </div>
      {videos.length === 0 && <div className="empty"><div className="ico">🎬</div>No videos yet — the admin can add videos from the dashboard</div>}
    </>
  );
}
