// ─────────────────────────────────────────────────────────────────────────────
// Entry Experience Renderer (Phase 8I).
//
// ONE renderer for every entry screen (Splash / Intro / Welcome / Auth / Onboarding). It reads
// the EntryModel and projects each animated layer, exposing every editable value as a CSS custom
// property on the root (#entry_experience). Because the layers read those vars, the Studio's
// transaction engine can edit them LIVE (write the var → the animation updates instantly) and the
// reconciler re-applies them across re-renders — the exact same mechanism as theme colours.
//
// Counts (particles / rings) are live-editable too: a fixed pool renders, and a per-item index
// (--i) vs the count var (--entry-particles / --entry-rings) gates each item's opacity via calc(),
// so dragging the count slider shows/hides items without a React re-render.
//
// Renderer backends beyond 'css' (Lottie / Rive / Motion / video) are reserved on the model; this
// component only implements 'css' today and can branch on model.renderer later without a redesign.
// Pure presentational — no services, no persistence, no side-effects.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { entryModel, type EntryKind } from './entryModel';

const PARTICLE_POOL = 16;
const RING_POOL = 5;

const CSS = `
#entry_experience { position: relative; width: 100%; min-height: 720px; overflow: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  background: var(--entry-bg, #05130b);
  font-family: Inter, system-ui, sans-serif; text-align: center; isolation: isolate; }
#entry_experience .ee-bg { position: absolute; inset: 0; z-index: 0;
  background: linear-gradient(var(--entry-grad-angle,160deg), var(--entry-grad-a,#0b3d24), var(--entry-grad-b,#05130b)); }
#entry_experience .ee-glow { position: absolute; top: 38%; left: 50%; width: 320px; height: 320px; z-index: 1;
  transform: translate(-50%,-50%); border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, var(--entry-glow-color,#a3f95b) 0%, transparent 66%);
  opacity: var(--entry-glow-intensity, .55); filter: blur(6px);
  animation: ee-pulse 3.4s ease-in-out infinite; }
#entry_experience .ee-rings { position: absolute; top: 38%; left: 50%; transform: translate(-50%,-50%); z-index: 1; }
#entry_experience .ee-ring { position: absolute; top: 50%; left: 50%; border-radius: 50%;
  border: var(--entry-ring-thickness,2px) solid var(--entry-ring-color,#a3f95b);
  transform: translate(-50%,-50%); animation: ee-spin 9s linear infinite;
  opacity: clamp(0, calc((var(--entry-rings,3) - var(--i)) * 0.34), .34); }
#entry_experience .ee-particle { position: absolute; width: 7px; height: 7px; border-radius: 50%; z-index: 1;
  background: var(--entry-particle-color,#a3f95b);
  animation: ee-float var(--entry-particle-speed,6s) ease-in-out infinite;
  opacity: clamp(0, calc(var(--entry-particles,10) - var(--i)), .8); }
#entry_experience .ee-fg { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 0 24px;
  animation: ee-enter var(--entry-duration,900ms) var(--entry-easing, ease-out) both; }
#entry_experience #entry_logo { display: grid; place-items: center;
  width: calc(var(--entry-logo-size,96px) + 26px); height: calc(var(--entry-logo-size,96px) + 26px);
  border-radius: 26px; background: rgba(255,255,255,.06); box-shadow: 0 20px 60px -24px var(--entry-glow-color,#a3f95b); }
#entry_experience #entry_logo img { width: var(--entry-logo-size,96px); height: var(--entry-logo-size,96px); object-fit: contain; border-radius: 20px; }
#entry_experience #entry_title { margin: 4px 0 0; font-size: 26px; font-weight: 800; color: #fff; letter-spacing: .3px; }
#entry_experience #entry_subtitle { margin: 0; font-size: 14px; font-weight: 500; color: rgba(255,255,255,.72); max-width: 280px; }
#entry_experience .ee-dots { display: flex; gap: 7px; margin-top: 4px; }
#entry_experience .ee-dots span { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.28); }
#entry_experience .ee-dots span.on { background: var(--entry-glow-color,#a3f95b); width: 18px; border-radius: 999px; }
#entry_experience #entry_cta { margin-top: 12px; padding: 12px 30px; border: none; border-radius: 999px; cursor: pointer;
  font-size: 14px; font-weight: 800; color: #05230f; background: var(--entry-glow-color,#a3f95b);
  opacity: var(--entry-cta-visible,1); pointer-events: none; box-shadow: 0 14px 34px -14px var(--entry-glow-color,#a3f95b); }
@keyframes ee-pulse { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.12); } }
@keyframes ee-spin  { to { transform: translate(-50%,-50%) rotate(360deg); } }
@keyframes ee-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-22px); } }
@keyframes ee-enter { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { #entry_experience * { animation: none !important; } }
`;

/** Deterministic scatter for the particle pool (no Math.random → stable across renders). */
const px = (i: number, seed: number) => ((i * 61 + seed * 29) % 92) + 4;

export const EntryExperience: React.FC<{ kind: EntryKind }> = ({ kind }) => {
  const m = entryModel(kind);
  // Seed every editable value as a CSS custom property on the root; the Studio overrides these
  // (scope:'self') to edit live, and the model provides the initial/preview value.
  const vars: React.CSSProperties = {
    '--entry-bg': m.background.color,
    '--entry-grad-a': m.background.gradientFrom,
    '--entry-grad-b': m.background.gradientTo,
    '--entry-grad-angle': `${m.background.angle}deg`,
    '--entry-glow-color': m.glow.color,
    '--entry-glow-intensity': m.glow.intensity,
    '--entry-particle-color': m.particles.color,
    '--entry-particle-speed': `${m.particles.speed}s`,
    '--entry-particles': m.particles.count,
    '--entry-ring-color': m.rings.color,
    '--entry-ring-thickness': `${m.rings.thickness}px`,
    '--entry-rings': m.rings.count,
    '--entry-logo-size': `${m.logo.size}px`,
    '--entry-cta-visible': m.cta.visible ? 1 : 0,
    '--entry-duration': `${m.timing.duration}ms`,
    '--entry-easing': m.timing.easing,
  } as React.CSSProperties;

  return (
    <div id="entry_experience" data-entry-kind={kind} style={vars}>
      <style>{CSS}</style>
      <div className="ee-bg" />
      <div className="ee-glow" />
      <div className="ee-rings" aria-hidden>
        {Array.from({ length: RING_POOL }).map((_, i) => (
          <span key={i} className="ee-ring" style={{ '--i': i, width: 150 + i * 56, height: 150 + i * 56 } as React.CSSProperties} />
        ))}
      </div>
      {Array.from({ length: PARTICLE_POOL }).map((_, i) => (
        <span key={i} className="ee-particle" aria-hidden
          style={{ '--i': i, left: `${px(i, 3)}%`, top: `${px(i, 7)}%`, animationDelay: `${(i % 6) * 0.5}s` } as React.CSSProperties} />
      ))}
      <div className="ee-fg">
        <div id="entry_logo"><img src={m.logo.src} alt="logo" /></div>
        <h1 id="entry_title">{m.text.title}</h1>
        <p id="entry_subtitle">{m.text.subtitle}</p>
        {kind === 'onboarding' && (
          <div className="ee-dots" aria-hidden><span className="on" /><span /><span /></div>
        )}
        <button id="entry_cta" type="button" tabIndex={-1}>{m.cta.label || 'Continue'}</button>
      </div>
    </div>
  );
};

export default EntryExperience;
