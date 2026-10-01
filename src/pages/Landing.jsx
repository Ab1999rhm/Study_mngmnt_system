import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LANGS } from '../components/Lang.jsx';
import { setLanguage } from '../i18n.js';
import { store } from '../data/store.js';
import '../landing.css';

const HERO_SLIDES = ['/hero-1.jpg', '/hero-2.jpg', '/hero-3.jpg', '/hero-4.jpg', '/hero-5.jpg'];

const FEATURES = [
  { icon: '🤖', t: 'f_ai_t', d: 'f_ai_d' },
  { icon: '📴', t: 'f_off_t', d: 'f_off_d' },
  { icon: '🌍', t: 'f_lang_t', d: 'f_lang_d' },
  { icon: '📝', t: 'f_exam_t', d: 'f_exam_d' },
  { icon: '🎬', t: 'f_video_t', d: 'f_video_d' },
  { icon: '🗓️', t: 'f_plan_t', d: 'f_plan_d' }
];

const STEPS = [
  { n: 1, t: 'step1_t', d: 'step1_d' },
  { n: 2, t: 'step2_t', d: 'step2_d' },
  { n: 3, t: 'step3_t', d: 'step3_d' },
  { n: 4, t: 'step4_t', d: 'step4_d' }
];

function RotatingQuote({ t }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI(v => (v + 1) % 3), 4500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="quote-box">
      <span className="qmark">”</span>
      <p key={i} className="quote-text">{t('quote_' + (i + 1))}</p>
    </div>
  );
}

export default function Landing({ onEnter }) {
  const { t, i18n } = useTranslation();
  const [menu, setMenu] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const langRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setSlide(v => (v + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!langOpen) return;
    const onDown = e => { if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [langOpen]);

  const scrollTo = id => e => {
    e.preventDefault();
    setMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const nav = (
    <>
      <a href="#features" onClick={scrollTo('features')}>{t('nav_features')}</a>
      <a href="#how" onClick={scrollTo('how')}>{t('nav_how')}</a>
      <a href="#grades" onClick={scrollTo('grades')}>{t('nav_grades')}</a>
      <a href="#quotes" onClick={scrollTo('quotes')}>{t('nav_quotes')}</a>
    </>
  );

  return (
    <div className="landing">
      <header className="l-header">
        <div className="l-header-inner">
          <Link to="/" className="l-logo" onClick={() => setMenu(false)}>
            <span className="l-logo-mark">🎓</span>
            <span>{t('appName')}</span>
          </Link>

          <nav className={'l-nav' + (menu ? ' open' : '')}>{nav}</nav>

          <div className="l-header-actions">
            <div className={'l-lang' + (langOpen ? ' open' : '')} ref={langRef}>
              <button className="l-lang-btn" onClick={() => setLangOpen(v => !v)} aria-label="Language" aria-expanded={langOpen}>
                🌐 {i18n.language.toUpperCase()} <span className="l-lang-caret">▾</span>
              </button>
              {langOpen && (
                <ul className="l-lang-menu anim-pop">
                  {LANGS.map(l => (
                    <li key={l.code}>
                      <button
                        className={i18n.language === l.code ? 'on' : ''}
                        onClick={() => { setLanguage(l.code); setLangOpen(false); }}
                      >
                        <span className="l-lang-flag">{l.flag}</span>{l.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link to="/auth?mode=login" className="btn ghost l-hide-sm">{t('btn_login')}</Link>
            <Link to="/auth" className="btn amber l-hide-sm">{t('btn_register')}</Link>
            <button className="l-burger" onClick={() => setMenu(v => !v)} aria-label="Menu">
              {menu ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </header>

      <section className="l-hero">
        <div className="l-hero-media" aria-hidden="true">
          {HERO_SLIDES.map((src, i) => (
            <div key={src} className={'l-hero-slide' + (i === slide ? ' on' : '')} style={{ backgroundImage: `url(${src})` }} />
          ))}
          <div className="l-hero-shade" />
        </div>
        <div className="l-hero-inner">
          <span className="l-badge anim-up">✨ {t('hero_badge')}</span>
          <h1 className="anim-up" style={{ animationDelay: '.1s' }}>{t('hero_title')}</h1>
          <p className="l-hero-sub anim-up" style={{ animationDelay: '.2s' }}>{t('hero_sub')}</p>
          <div className="l-hero-cta anim-up" style={{ animationDelay: '.3s' }}>
            <Link to="/auth" className="btn amber l-cta-big">{t('btn_register')} →</Link>
            <a href="#how" className="btn ghost l-cta-big on-dark" onClick={scrollTo('how')}>{t('nav_how')}</a>
          </div>
          <div className="l-hero-stats stagger">
            <div className="l-stat"><b>12</b><span>{t('stat_grades')}</span></div>
            <div className="l-stat"><b>4</b><span>{t('stat_langs')}</span></div>
            <div className="l-stat"><b>10+</b><span>{t('stat_subjects')}</span></div>
            <div className="l-stat"><b>100%</b><span>{t('stat_offline')}</span></div>
          </div>
        </div>
        <div className="l-hero-dots" aria-hidden="true">
          {HERO_SLIDES.map((src, i) => (
            <button key={src} className={i === slide ? 'on' : ''} onClick={() => setSlide(i)} tabIndex={-1} />
          ))}
        </div>
        <div className="l-hero-scroll">↓</div>
      </section>

      <section id="features" className="l-section">
        <div className="l-section-inner">
          <h2 className="anim-up">{t('feat_title')}</h2>
          <p className="l-sub anim-up" style={{ animationDelay: '.08s' }}>{t('feat_sub')}</p>
          <div className="l-feat-grid stagger">
            {FEATURES.map(f => (
              <div className="l-feat card lift" key={f.t}>
                <div className="l-feat-ic">{f.icon}</div>
                <h3>{t(f.t)}</h3>
                <p>{t(f.d)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="l-section l-alt">
        <div className="l-section-inner">
          <h2 className="anim-up">{t('how_title')}</h2>
          <div className="l-steps stagger">
            {STEPS.map(s => (
              <div className="l-step" key={s.n}>
                <div className="l-step-n">{s.n}</div>
                <h3>{t(s.t)}</h3>
                <p>{t(s.d)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="grades" className="l-section">
        <div className="l-section-inner">
          <h2 className="anim-up">{t('grades_title')}</h2>
          <p className="l-sub anim-up" style={{ animationDelay: '.08s' }}>{t('grades_sub')}</p>
          <div className="l-grades stagger">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
              <Link key={g} to="/auth" className="l-grade" title={t('grade' + g)}>
                <b>{g}</b><span>{t('grade' + g)}</span>
              </Link>
            ))}
            <Link to="/auth" className="l-grade l-grade-r" title={t('remedial')}>
              <b>+</b><span>{t('remedial')}</span>
            </Link>
          </div>
        </div>
      </section>

      <section id="quotes" className="l-section l-alt">
        <div className="l-section-inner">
          <h2 className="anim-up">{t('quotes_title')}</h2>
          <RotatingQuote t={t} />
        </div>
      </section>

      <section className="l-cta">
        <div className="l-cta-inner">
          <h2 className="anim-up">{t('cta_title')}</h2>
          <p className="anim-up" style={{ animationDelay: '.1s' }}>{t('cta_sub')}</p>
          <Link to="/auth" className="btn amber l-cta-big anim-up" style={{ animationDelay: '.2s' }}>
            {t('cta_btn')} →
          </Link>
        </div>
      </section>

      <footer className="l-footer">
        <div className="l-footer-inner">
          <div className="l-footer-brand">
            <div className="l-logo"><span className="l-logo-mark">🎓</span><span>{t('appName')}</span></div>
            <p>{t('footer_desc')}</p>
          </div>
          <div className="l-footer-col">
            <h4>{t('footer_product')}</h4>
            <a href="#features" onClick={scrollTo('features')}>{t('nav_features')}</a>
            <a href="#grades" onClick={scrollTo('grades')}>{t('nav_grades')}</a>
            <a href="#how" onClick={scrollTo('how')}>{t('nav_how')}</a>
            <Link to="/auth?mode=login">{t('btn_login')}</Link>
          </div>
          <div className="l-footer-col">
            <h4>{t('footer_support')}</h4>
            <Link to="/auth">{t('btn_register')}</Link>
            <a href="mailto:fikaduabraham093@gmail.com">fikaduabraham093@gmail.com</a>
            {store.settings().payPhone && (
              <a href={'tel:' + String(store.settings().payPhone).replace(/[^+0-9]/g, '')}>{store.settings().payPhone}</a>
            )}
            <a href="https://t.me/maalgodhu" target="_blank" rel="noreferrer">Telegram: @maalgodhu</a>
          </div>
        </div>
        <div className="l-footer-bottom">
          <span>© {new Date().getFullYear()} {t('appName')}. {t('footer_rights')}</span>
          <span>💡 {t('hero_title')}</span>
        </div>
      </footer>
    </div>
  );
}