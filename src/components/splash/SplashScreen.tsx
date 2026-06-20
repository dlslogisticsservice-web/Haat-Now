import { useEffect, useState } from 'react';
import { Bike } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t0 = setTimeout(() => setVisible(true), 50);
    const t1 = setTimeout(() => setFadeOut(true), 2300);
    const t2 = setTimeout(onComplete, 2750);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  return (
    <div
      className="splash-root"
      style={{
        opacity: fadeOut ? 0 : 1,
        transition: fadeOut ? 'opacity 0.45s ease' : 'none',
      }}
    >
      <div className="splash-orb splash-orb--top" />
      <div className="splash-orb splash-orb--bottom" />
      <div className="splash-light" />

      <div
        className="splash-logo-wrap"
        style={{
          opacity:   visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(12px)',
          transition: 'opacity 0.55s cubic-bezier(0.16,1,0.3,1), transform 0.55s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div className="splash-icon-halo animate-float">
          <Bike
            size={52}
            color="#c8cacc"
            strokeWidth={1.5}
            style={{
              filter: [
                'drop-shadow(0 -1px 1px rgba(255,255,255,0.65))',
                'drop-shadow(0 2px 5px rgba(0,0,0,0.92))',
                'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
              ].join(' '),
            }}
          />
        </div>

        <h1 className="splash-brand" dir="ltr">
          <span className="splash-brand__haat">HAAT</span>
          {' '}
          <span className="splash-brand__now">NOW</span>
        </h1>

        <p
          className="splash-tagline"
          style={{
            opacity:   visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.5s ease 0.35s, transform 0.5s ease 0.35s',
          }}
        >
          فاخر · سريع · حصري
        </p>
      </div>

      <div
        className="splash-dots"
        style={{
          opacity:   visible ? 1 : 0,
          transition: 'opacity 0.4s ease 0.6s',
        }}
      >
        <span className="splash-dot splash-dot--1" />
        <span className="splash-dot splash-dot--2" />
        <span className="splash-dot splash-dot--3" />
      </div>

      <p className="splash-version">Phase 2 · Luminous Precision</p>
    </div>
  );
}
