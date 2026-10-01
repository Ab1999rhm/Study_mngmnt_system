import { useEffect, useRef, useState } from 'react';

export function AnimatedNumber({ value, duration = 900, suffix = '', prefix = '' }) {
  const [shown, setShown] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const to = Number(value) || 0;
    prev.current = to;
    let raf; const t0 = performance.now();
    const tick = now => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{prefix}{shown}{suffix}</>;
}

export function Stat({ grad = 'brand', icon, label, value, suffix, delay = 0 }) {
  return (
    <div className={`stat g-${grad}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="num"><AnimatedNumber value={value} suffix={suffix || ''} /></div>
      <div className="lbl">{icon} {label}</div>
    </div>
  );
}

export function PageHead({ crumb, title, right }) {
  return (
    <div className="page-head">
      <div>
        {crumb && <div className="crumb">{crumb}</div>}
        <h1>{title}</h1>
      </div>
      {right && <div className="right" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{right}</div>}
    </div>
  );
}

export function SegTabs({ tabs, active, onChange }) {
  const refs = useRef({});
  const [thumb, setThumb] = useState({ left: 0, width: 0 });
  const layout = () => {
    const el = refs.current[active];
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  };
  useEffect(() => {
    layout();
    window.addEventListener('resize', layout);
    return () => window.removeEventListener('resize', layout);
  }, [active, tabs]);
  return (
    <div className="seg">
      <span className="thumb" style={{ left: thumb.left, width: thumb.width }} />
      {tabs.map(t => (
        <button
          key={t.key}
          ref={el => (refs.current[t.key] = el)}
          className={active === t.key ? 'on' : ''}
          onClick={() => onChange(t.key)}
        >
          <span>{t.icon}</span> {t.label}
        </button>
      ))}
    </div>
  );
}

export function ChartCard({ title, sub, children, style }) {
  return (
    <div className="chart-card" style={style}>
      <h3>{title}</h3>
      {sub && <div className="sub">{sub}</div>}
      {children}
    </div>
  );
}

export function Bar({ label, value, max, hint }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 5 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <b style={{ color: 'var(--brand-600)' }}>{hint ?? `${value} · ${pct}%`}</b>
      </div>
      <div className="bar-thin"><i style={{ width: pct + '%' }} /></div>
    </div>
  );
}

export function Confetti() {
  const colors = ['#0d9488', '#115e59', '#f59e0b', '#059669', '#ec4899'];
  return (
    <>
      {Array.from({ length: 26 }).map((_, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${(i * 3.9) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 7) * 0.12}s`
          }}
        />
      ))}
    </>
  );
}