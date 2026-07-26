// ─────────────────────────────────────────────────────────────────────────────
// Motion Model (Phase 8J · Motion Studio).
//
// The design-time model behind the Motion Studio: the LAYER stack, the animation TIMELINE, the
// VISUAL EFFECTS, and the active PRESET for one entry screen. It is DATA — the EntryExperience
// renderer projects it (via CSS custom properties + layer-visibility vars), so editing the model
// updates the live runtime with no second rendering system.
//
// PURE DATA — no React, no DOM, no services, no persistence.
// ─────────────────────────────────────────────────────────────────────────────
import type { EntryKind } from '../entryModel';

export type LayerKind =
  | 'background' | 'gradient' | 'mesh' | 'particles' | 'rings' | 'glow'
  | 'noise' | 'blur' | 'glass' | 'logo' | 'text' | 'button' | 'foreground';

export interface MotionLayer {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
}

export type TimelineEffect = 'fadeIn' | 'scale' | 'glow' | 'particles' | 'cta' | 'navigate';

export interface TimelineStep {
  id: string;
  label: string;
  target: LayerKind;      // which layer this step animates
  effect: TimelineEffect;
  at: number;             // start time (seconds)
  duration: number;       // ms
  delay: number;          // ms
  curve: string;          // CSS easing
  repeat: number;         // 0 = once
  direction: 'normal' | 'reverse' | 'alternate';
  opacity: number;        // 0..1 target
  scale: number;          // target scale
  rotate: number;         // deg
  translate: number;      // px (y)
  blur: number;           // px
  glow: number;           // 0..1
}

export interface VisualEffects {
  animatedGradient: boolean;
  glow: boolean;
  particles: boolean;
  noise: boolean;
  mesh: boolean;
  glass: boolean;
  shadow: boolean;
  innerShadow: boolean;
  borderGlow: boolean;
  animatedBorder: boolean;
  ripple: boolean;
  pulse: boolean;
  floating: boolean;
  parallax: boolean;
  blur: number;           // px (0 = none)
  opacity: number;        // 0..1 foreground
}

export interface MotionModel {
  kind: EntryKind;
  layers: MotionLayer[];
  timeline: TimelineStep[];
  effects: VisualEffects;
  presetId: string | null;
}

export interface MotionPreset {
  id: string;
  name: string;
  builtIn: boolean;
  /** Effect toggles this preset turns on. */
  effects: Partial<VisualEffects>;
  /** CSS-var overrides applied to the entry root (colours, easing…). */
  vars: Record<string, string>;
  /** Base easing for the timeline steps. */
  curve: string;
}

const layer = (kind: LayerKind, name: string, visible = true): MotionLayer =>
  ({ id: `ly_${kind}`, name, kind, visible, locked: false });

// The canonical layer stack, painted back-to-front (index 0 = back).
const DEFAULT_LAYERS: MotionLayer[] = [
  layer('background', 'Background'),
  layer('mesh', 'Mesh Gradient', false),
  layer('particles', 'Particles'),
  layer('rings', 'Animated Rings'),
  layer('glow', 'Glow'),
  layer('noise', 'Noise', false),
  layer('blur', 'Blur', false),
  layer('glass', 'Glass', false),
  layer('logo', 'Logo'),
  layer('text', 'Texts'),
  layer('button', 'CTA Button'),
  layer('foreground', 'Foreground'),
];

const step = (p: Partial<TimelineStep> & Pick<TimelineStep, 'id' | 'label' | 'target' | 'effect'>): TimelineStep => ({
  at: 0, duration: 600, delay: 0, curve: 'cubic-bezier(.22,1,.36,1)', repeat: 0, direction: 'normal',
  opacity: 1, scale: 1, rotate: 0, translate: 0, blur: 0, glow: 0.5, ...p,
});

// The default entrance timeline: Fade In → Scale → Glow → Particles → CTA → Navigate.
const DEFAULT_TIMELINE: TimelineStep[] = [
  step({ id: 'ts_fade', label: 'Fade In', target: 'foreground', effect: 'fadeIn', at: 0, duration: 500, opacity: 1 }),
  step({ id: 'ts_scale', label: 'Scale', target: 'logo', effect: 'scale', at: 0.2, duration: 600, scale: 1 }),
  step({ id: 'ts_glow', label: 'Glow', target: 'glow', effect: 'glow', at: 0.5, duration: 900, glow: 0.6, repeat: -1, direction: 'alternate' }),
  step({ id: 'ts_particles', label: 'Particles', target: 'particles', effect: 'particles', at: 0.6, duration: 6000, repeat: -1 }),
  step({ id: 'ts_cta', label: 'CTA', target: 'button', effect: 'cta', at: 1.0, duration: 500, opacity: 1 }),
  step({ id: 'ts_nav', label: 'Navigate', target: 'foreground', effect: 'navigate', at: 2.0, duration: 400 }),
];

const DEFAULT_EFFECTS: VisualEffects = {
  animatedGradient: true, glow: true, particles: true, noise: false, mesh: false, glass: false,
  shadow: true, innerShadow: false, borderGlow: false, animatedBorder: false, ripple: false,
  pulse: true, floating: true, parallax: false, blur: 0, opacity: 1,
};

export function defaultMotion(kind: EntryKind): MotionModel {
  return {
    kind,
    layers: DEFAULT_LAYERS.map(l => ({ ...l })),
    timeline: DEFAULT_TIMELINE.map(s => ({ ...s })),
    effects: { ...DEFAULT_EFFECTS },
    presetId: null,
  };
}

// ── Built-in presets — a recognisable design language each. Applying one sets effect toggles +
// CSS-var overrides (glow/bg/easing) on the live entry root, so the change is immediately visible.
const P = (id: string, name: string, curve: string, effects: Partial<VisualEffects>, vars: Record<string, string>): MotionPreset =>
  ({ id, name, builtIn: true, effects, vars, curve });

export const MOTION_PRESETS: MotionPreset[] = [
  P('luxury', 'Luxury', 'cubic-bezier(.2,.8,.2,1)', { glow: true, glass: true, floating: true, shadow: true }, { '--entry-glow-color': '#d4af37', '--entry-grad-a': '#1a1206', '--entry-grad-b': '#05040a', '--entry-particle-color': '#d4af37' }),
  P('luxury-neon', 'Luxury Neon', 'cubic-bezier(.16,1,.3,1)', { glow: true, borderGlow: true, animatedBorder: true, pulse: true }, { '--entry-glow-color': '#00e5ff', '--entry-grad-a': '#0a0f2a', '--entry-grad-b': '#05040a', '--entry-particle-color': '#00e5ff' }),
  P('minimal', 'Minimal', 'ease-out', { glow: false, particles: false, shadow: false, floating: false }, { '--entry-glow-color': '#ffffff', '--entry-grad-a': '#111315', '--entry-grad-b': '#0a0c0e' }),
  P('corporate', 'Corporate', 'ease-in-out', { glow: true, particles: false, shadow: true }, { '--entry-glow-color': '#2f6bff', '--entry-grad-a': '#0c1830', '--entry-grad-b': '#070c16', '--entry-particle-color': '#2f6bff' }),
  P('elegant', 'Elegant', 'cubic-bezier(.22,1,.36,1)', { glow: true, glass: true, floating: true }, { '--entry-glow-color': '#c78bff', '--entry-grad-a': '#241033', '--entry-grad-b': '#0a0714' }),
  P('apple', 'Apple', 'cubic-bezier(.28,.11,.32,1)', { glow: true, glass: true, blur: 8, particles: false }, { '--entry-glow-color': '#ffffff', '--entry-grad-a': '#1c1c1e', '--entry-grad-b': '#000000' }),
  P('material', 'Material', 'cubic-bezier(.4,0,.2,1)', { glow: false, shadow: true, ripple: true }, { '--entry-glow-color': '#00c853', '--entry-grad-a': '#0e3b1f', '--entry-grad-b': '#0a0f0c', '--entry-particle-color': '#00c853' }),
  P('tesla', 'Tesla', 'cubic-bezier(.4,0,0,1)', { glow: true, particles: false, mesh: true }, { '--entry-glow-color': '#e82127', '--entry-grad-a': '#1a0405', '--entry-grad-b': '#000000', '--entry-particle-color': '#e82127' }),
  P('spotify', 'Spotify', 'cubic-bezier(.3,0,0,1)', { glow: true, floating: true, particles: true }, { '--entry-glow-color': '#1db954', '--entry-grad-a': '#0a2e1a', '--entry-grad-b': '#000000', '--entry-particle-color': '#1db954' }),
  P('netflix', 'Netflix', 'cubic-bezier(.4,0,.2,1)', { glow: true, pulse: true, particles: false }, { '--entry-glow-color': '#e50914', '--entry-grad-a': '#1a0406', '--entry-grad-b': '#000000', '--entry-particle-color': '#e50914' }),
  P('oneui', 'Samsung OneUI', 'cubic-bezier(.22,.61,.36,1)', { glow: true, glass: true, floating: true }, { '--entry-glow-color': '#1a73e8', '--entry-grad-a': '#0c1830', '--entry-grad-b': '#080a0f' }),
  P('glass', 'Glass', 'cubic-bezier(.22,1,.36,1)', { glass: true, blur: 12, glow: true, borderGlow: true }, { '--entry-glow-color': '#a3f95b', '--entry-grad-a': '#0e2418', '--entry-grad-b': '#0a0f0c' }),
  P('soft-motion', 'Soft Motion', 'cubic-bezier(.34,1.56,.64,1)', { floating: true, glow: true, pulse: true }, { '--entry-glow-color': '#7dd3fc', '--entry-grad-a': '#0c2233', '--entry-grad-b': '#0a0f14' }),
  P('premium-black', 'Premium Black', 'cubic-bezier(.16,1,.3,1)', { glow: true, glass: true, innerShadow: true, shadow: true }, { '--entry-glow-color': '#c0a062', '--entry-grad-a': '#0a0a0a', '--entry-grad-b': '#000000', '--entry-particle-color': '#c0a062' }),
];

export function presetById(id: string, custom: MotionPreset[] = []): MotionPreset | undefined {
  return [...MOTION_PRESETS, ...custom].find(p => p.id === id);
}
