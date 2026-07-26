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
  font-family: Inter, system-ui, sans-serif; text-align: center; isolation: isolate;
  box-shadow: inset 0 0 0 calc(var(--ee-fx-border-glow,0) * 2px) var(--entry-glow-color,#a3f95b); }
#entry_experience .ee-bg { position: absolute; inset: 0; z-index: var(--ee-z-background,0);
  opacity: var(--ee-show-background,1);
  filter: blur(calc(var(--ee-fx-blur,0px)));
  background: linear-gradient(var(--entry-grad-angle,160deg), var(--entry-grad-a,#0b3d24), var(--entry-grad-b,#05130b)); }
/* Mesh gradient layer */
#entry_experience .ee-mesh { position: absolute; inset: 0; z-index: var(--ee-z-mesh,1); pointer-events: none;
  opacity: calc(var(--ee-fx-mesh,0) * var(--ee-show-mesh,1) * .8);
  background:
    radial-gradient(40% 40% at 20% 20%, var(--entry-glow-color,#a3f95b) 0%, transparent 60%),
    radial-gradient(40% 40% at 80% 30%, var(--entry-particle-color,#5ad1ff) 0%, transparent 60%),
    radial-gradient(50% 50% at 50% 90%, var(--entry-grad-a,#0b3d24) 0%, transparent 60%); }
/* Noise layer */
#entry_experience .ee-noise { position: absolute; inset: 0; z-index: var(--ee-z-noise,1); pointer-events: none; mix-blend-mode: overlay;
  opacity: calc(var(--ee-fx-noise,0) * var(--ee-show-noise,1) * .5);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
/* Glass morphism layer */
#entry_experience .ee-glass { position: absolute; inset: 18px; z-index: var(--ee-z-glass,4); pointer-events: none; border-radius: 28px;
  opacity: calc(var(--ee-fx-glass,0) * var(--ee-show-glass,1));
  background: rgba(255,255,255,.05); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255,255,255,.14); }
#entry_experience .ee-glow { position: absolute; top: 38%; left: 50%; width: 320px; height: 320px; z-index: var(--ee-z-glow,2);
  transform: translate(-50%,-50%); border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, var(--entry-glow-color,#a3f95b) 0%, transparent 66%);
  opacity: calc(var(--entry-glow-intensity, .55) * var(--ee-show-glow,1)); filter: blur(6px);
  animation: ee-pulse calc(var(--ee-fx-pulse,1) * 3.4s) ease-in-out infinite; }
#entry_experience .ee-rings { position: absolute; top: 38%; left: 50%; transform: translate(-50%,-50%); z-index: var(--ee-z-rings,2); opacity: var(--ee-show-rings,1); }
#entry_experience .ee-ring { position: absolute; top: 50%; left: 50%; border-radius: 50%;
  border: var(--entry-ring-thickness,2px) solid var(--entry-ring-color,#a3f95b);
  transform: translate(-50%,-50%); animation: ee-spin 9s linear infinite;
  opacity: clamp(0, calc((var(--entry-rings,3) - var(--i)) * 0.34), .34); }
#entry_experience .ee-particle { position: absolute; width: 7px; height: 7px; border-radius: 50%; z-index: var(--ee-z-particles,1);
  background: var(--entry-particle-color,#a3f95b);
  animation: ee-float calc(var(--ee-fx-floating,1) * var(--entry-particle-speed,6s)) ease-in-out infinite;
  opacity: clamp(0, calc((var(--entry-particles,10) - var(--i)) * var(--ee-show-particles,1)), .8); }
#entry_experience .ee-fg { position: relative; z-index: var(--ee-z-foreground,6); display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 0 24px;
  opacity: var(--ee-fx-opacity,1);
  animation: ee-enter var(--entry-duration,900ms) var(--entry-easing, ease-out) both; }
#entry_experience #entry_logo { display: grid; place-items: center; opacity: var(--ee-show-logo,1);
  width: calc(var(--entry-logo-size,96px) + 26px); height: calc(var(--entry-logo-size,96px) + 26px);
  border-radius: 26px; background: rgba(255,255,255,.06);
  box-shadow: 0 calc(var(--ee-fx-shadow,1) * 20px) 60px -24px var(--entry-glow-color,#a3f95b),
    inset 0 0 calc(var(--ee-fx-inner-shadow,0) * 30px) rgba(0,0,0,.6); }
#entry_experience #entry_logo img { width: var(--entry-logo-size,96px); height: var(--entry-logo-size,96px); object-fit: contain; border-radius: 20px; }
#entry_experience #entry_title { margin: 4px 0 0; font-size: 26px; font-weight: 800; color: #fff; letter-spacing: .3px; opacity: var(--ee-show-text,1); }
#entry_experience #entry_subtitle { margin: 0; font-size: 14px; font-weight: 500; color: rgba(255,255,255,.72); max-width: 280px; opacity: var(--ee-show-text,1); }
#entry_experience .ee-dots { display: flex; gap: 7px; margin-top: 4px; }
#entry_experience .ee-dots span { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.28); }
#entry_experience .ee-dots span.on { background: var(--entry-glow-color,#a3f95b); width: 18px; border-radius: 999px; }
#entry_experience #entry_cta { position: relative; margin-top: 12px; padding: 12px 30px; border: none; border-radius: 999px; cursor: pointer; overflow: hidden;
  font-size: 14px; font-weight: 800; color: #05230f; background: var(--entry-glow-color,#a3f95b);
  opacity: calc(var(--entry-cta-visible,1) * var(--ee-show-button,1)); pointer-events: none;
  box-shadow: 0 14px 34px -14px var(--entry-glow-color,#a3f95b),
    0 0 calc(var(--ee-fx-border-glow,0) * 18px) var(--entry-glow-color,#a3f95b); }
#entry_experience #entry_cta::after { content: ''; position: absolute; inset: 0; border-radius: 999px;
  opacity: var(--ee-fx-ripple,0); background: radial-gradient(circle, rgba(255,255,255,.5), transparent 60%);
  animation: ee-ripple 1.8s ease-out infinite; }
@keyframes ee-pulse { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.12); } }
@keyframes ee-spin  { to { transform: translate(-50%,-50%) rotate(360deg); } }
@keyframes ee-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-22px); } }
@keyframes ee-enter { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes ee-ripple { from { transform: scale(.6); opacity: .5; } to { transform: scale(2.4); opacity: 0; } }
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
      <div className="ee-bg" data-layer="background" />
      <div className="ee-mesh" data-layer="mesh" aria-hidden />
      <div className="ee-noise" data-layer="noise" aria-hidden />
      <div className="ee-glass" data-layer="glass" aria-hidden />
      <div className="ee-glow" data-layer="glow" />
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
