import { useEffect, useState, ReactNode } from 'react';
import { useExperience } from './ExperienceContext';
import { MediaRenderer } from './blocks/MediaRenderer';
import { VideoBackgroundBlock } from './blocks/VideoBackgroundBlock';
import { SplashExperience, OnboardingExperience, LoginExperience } from './experienceTypes';

const LIME = '#a3f95b';

// ── Splash ───────────────────────────────────────────────────────────────────
// When the published splash is `enabled`, render it schema-driven; otherwise the
// caller's legacy splash (passed as `fallback`) renders unchanged.
export function ExperienceSplash({ onComplete, fallback }: { onComplete: () => void; fallback: ReactNode }) {
  const { experience } = useExperience();
  const cfg = experience.splash;
  if (!cfg.enabled) return <>{fallback}</>;
  return <SchemaSplash cfg={cfg} onComplete={onComplete} />;
}

function SchemaSplash({ cfg, onComplete }: { cfg: SplashExperience; onComplete: () => void }) {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  useEffect(() => {
    const t0 = setTimeout(() => setVisible(true), 50);
    const t1 = setTimeout(() => setFadeOut(true), Math.max(800, cfg.durationMs - 450));
    const t2 = setTimeout(onComplete, cfg.durationMs);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
  }, [cfg.durationMs, onComplete]);

  const enter = cfg.animation === 'scale' ? (visible ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(12px)')
    : cfg.animation === 'slide' ? (visible ? 'translateY(0)' : 'translateY(28px)')
    : 'none';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: cfg.background.color, opacity: fadeOut ? 0 : 1, transition: fadeOut ? 'opacity 0.45s ease' : 'none', overflow: 'hidden' }}>
      {cfg.background.videoUrl && <VideoBackgroundBlock src={cfg.background.videoUrl} poster={cfg.background.posterUrl} overlay="linear-gradient(180deg, rgba(11,14,17,0.55), rgba(11,14,17,0.85))" />}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: cfg.animation === 'none' || cfg.animation === 'fade' ? (visible ? 1 : 0) : (visible ? 1 : 0), transform: enter, transition: 'opacity 0.55s cubic-bezier(0.16,1,0.3,1), transform 0.55s cubic-bezier(0.16,1,0.3,1)' }}>
        <MediaRenderer media={cfg.media} size={96} />
        <h1 dir="ltr" style={{ marginTop: 18, fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', color: '#e8e9eb' }}>{cfg.brandText}</h1>
        <p style={{ marginTop: 8, fontSize: 13, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.55)' }}>{cfg.tagline}</p>
      </div>
      {cfg.showDots && (
        <div style={{ position: 'absolute', bottom: 64, display: 'flex', gap: 6, zIndex: 2, opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease 0.6s' }}>
          {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i === 0 ? LIME : 'rgba(255,255,255,0.25)' }} />)}
        </div>
      )}
      {cfg.footnote && <p style={{ position: 'absolute', bottom: 24, fontSize: 11, color: 'rgba(255,255,255,0.3)', zIndex: 2 }}>{cfg.footnote}</p>}
    </div>
  );
}

// ── Onboarding ───────────────────────────────────────────────────────────────
export function ExperienceOnboarding({ onComplete, fallback }: { onComplete: () => void; fallback: ReactNode }) {
  const { experience } = useExperience();
  const cfg = experience.onboarding;
  if (!cfg.enabled || !cfg.slides.length) return <>{fallback}</>;
  return <SchemaOnboarding cfg={cfg} onComplete={onComplete} />;
}

function SchemaOnboarding({ cfg, onComplete }: { cfg: OnboardingExperience; onComplete: () => void }) {
  const [current, setCurrent] = useState(0);
  const slide = cfg.slides[current];
  const isLast = current === cfg.slides.length - 1;
  const done = () => { try { localStorage.setItem('haat_onboarding_done', '1'); } catch { /* ignore */ } onComplete(); };
  const next = () => { if (isLast) done(); else setCurrent(c => c + 1); };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', flexDirection: 'column', background: cfg.background.color, overflow: 'hidden' }}>
      {cfg.background.videoUrl && <VideoBackgroundBlock src={cfg.background.videoUrl} poster={cfg.background.posterUrl} overlay="linear-gradient(180deg, rgba(11,14,17,0.4), rgba(11,14,17,0.8))" />}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '56px 24px 0' }}>
        <span style={{ fontSize: 16, fontWeight: 900 }}><span style={{ color: '#e8e9eb' }}>HAAT</span><span style={{ color: LIME }}> NOW</span></span>
        <button onClick={done} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '6px 14px', color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer' }}>{cfg.skipLabel}</button>
      </div>
      <div style={{ flex: 1, position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 148, height: 148, borderRadius: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #24282c 0%, #15181b 100%)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 40px rgba(0,0,0,0.55)' }}>
          <MediaRenderer media={slide.media} size={72} />
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 2, background: 'linear-gradient(180deg, rgba(18,22,26,0.94), rgba(11,14,17,0.98))', borderTop: '1px solid rgba(255,255,255,0.08)', borderRadius: '28px 28px 0 0', padding: '22px 28px', paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
          {cfg.slides.map((_, i) => <button key={i} onClick={() => setCurrent(i)} style={{ height: 6, width: i === current ? 26 : 6, borderRadius: 3, background: i === current ? LIME : 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer', transition: 'all 280ms' }} />)}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 13px', borderRadius: 99, marginBottom: 14, background: 'rgba(163,249,91,0.09)', border: '1px solid rgba(163,249,91,0.28)', color: LIME, fontSize: 11, fontWeight: 700 }}>{slide.badge}</div>
        <h1 dir="rtl" style={{ fontSize: 27, fontWeight: 800, color: '#f2f4f6', margin: '0 0 10px' }}>{slide.title}</h1>
        <p dir="rtl" style={{ fontSize: 14, color: 'rgba(255,255,255,0.48)', lineHeight: 1.65, margin: '0 0 22px' }}>{slide.description}</p>
        <button onClick={next} style={{ width: '100%', height: 54, borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #a3f95b 0%, #88dc41 100%)', color: '#0c2000', fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 0 28px rgba(163,249,91,0.4)' }}>
          {isLast ? cfg.ctaStartLabel : cfg.ctaNextLabel}
        </button>
      </div>
    </div>
  );
}

// ── Login ────────────────────────────────────────────────────────────────────
// Auth flows are NEVER modified. When login is `enabled` with a background video,
// we render the legacy login form on top of a video/poster background. Otherwise
// the legacy screen renders unchanged.
export function ExperienceLogin({ fallback }: { fallback: ReactNode }) {
  const { experience } = useExperience();
  const cfg: LoginExperience = experience.login;
  if (!cfg.enabled || cfg.layout !== 'video' || !cfg.background.videoUrl) return <>{fallback}</>;
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <VideoBackgroundBlock src={cfg.background.videoUrl} poster={cfg.background.posterUrl} overlay="linear-gradient(180deg, rgba(11,14,17,0.6), rgba(11,14,17,0.92))" />
      <div style={{ position: 'relative', zIndex: 1 }}>{fallback}</div>
    </div>
  );
}
