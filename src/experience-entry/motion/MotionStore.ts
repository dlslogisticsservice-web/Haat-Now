// ─────────────────────────────────────────────────────────────────────────────
// Motion Store (Phase 8J).
//
// The single session store for the Motion Studio's design-time model: layers, timeline, effects,
// and presets for the active entry screen. Every op mutates the model and notifies subscribers;
// project(root) writes the model onto the live EntryExperience as CSS custom properties (layer
// visibility, stacking, effect toggles, entrance timing) — reusing the runtime renderer, no second
// rendering system. Session-only, no persistence.
// ─────────────────────────────────────────────────────────────────────────────
import type { EntryKind } from '../entryModel';
import {
  defaultMotion, presetById, MOTION_PRESETS,
  type MotionModel, type MotionLayer, type TimelineStep, type VisualEffects, type MotionPreset, type LayerKind,
} from './motionModel';

type Listener = () => void;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export interface MotionSnapshot { model: MotionModel; presetVars: Record<string, string>; }

export class MotionStore {
  private model: MotionModel;
  private custom: MotionPreset[] = [];
  private presetVars: Record<string, string> = {};
  private listeners = new Set<Listener>();
  private seq = 0;

  constructor(kind: EntryKind) { this.model = defaultMotion(kind); }

  getModel(): MotionModel { return this.model; }
  customPresets(): MotionPreset[] { return [...this.custom]; }
  allPresets(): MotionPreset[] { return [...MOTION_PRESETS, ...this.custom]; }

  /** Switch to a different entry screen (fresh default model). */
  setKind(kind: EntryKind): void {
    if (this.model.kind === kind) return;
    this.model = defaultMotion(kind); this.presetVars = {}; this.emit();
  }

  // ── Layer Manager ──────────────────────────────────────────────────────────
  private layer(id: string): MotionLayer | undefined { return this.model.layers.find(l => l.id === id); }
  toggleVisible(id: string): void { const l = this.layer(id); if (l && !l.locked) { l.visible = !l.visible; this.emit(); } }
  toggleLock(id: string): void { const l = this.layer(id); if (l) { l.locked = !l.locked; this.emit(); } }
  rename(id: string, name: string): void { const l = this.layer(id); if (l) { l.name = name; this.emit(); } }
  duplicate(id: string): void {
    const i = this.model.layers.findIndex(l => l.id === id);
    if (i < 0) return;
    const src = this.model.layers[i];
    this.model.layers.splice(i + 1, 0, { ...src, id: `${src.id}_copy${++this.seq}`, name: `${src.name} copy`, locked: false });
    this.emit();
  }
  reorder(id: string, dir: -1 | 1): void {
    const i = this.model.layers.findIndex(l => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= this.model.layers.length) return;
    const arr = this.model.layers;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    this.emit();
  }

  // ── Animation Timeline ───────────────────────────────────────────────────────
  updateStep(id: string, patch: Partial<TimelineStep>): void {
    const s = this.model.timeline.find(t => t.id === id);
    if (s) { Object.assign(s, patch); this.emit(); }
  }
  addStep(): void {
    this.model.timeline.push({
      id: `ts_${++this.seq}`, label: 'Custom', target: 'foreground', effect: 'fadeIn',
      at: this.model.timeline.length * 0.3, duration: 500, delay: 0, curve: 'ease-out',
      repeat: 0, direction: 'normal', opacity: 1, scale: 1, rotate: 0, translate: 0, blur: 0, glow: 0.5,
    });
    this.emit();
  }
  removeStep(id: string): void { this.model.timeline = this.model.timeline.filter(t => t.id !== id); this.emit(); }

  // ── Visual Effects ────────────────────────────────────────────────────────────
  toggleEffect(name: keyof VisualEffects): void {
    const v = this.model.effects[name];
    if (typeof v === 'boolean') { (this.model.effects as unknown as Record<string, unknown>)[name] = !v; this.emit(); }
  }
  setEffectValue(name: keyof VisualEffects, value: number): void {
    (this.model.effects as unknown as Record<string, unknown>)[name] = value; this.emit();
  }

  // ── Presets ─────────────────────────────────────────────────────────────────
  applyPreset(id: string): void {
    const p = presetById(id, this.custom);
    if (!p) return;
    this.model.effects = { ...this.model.effects, ...p.effects };
    this.model.timeline = this.model.timeline.map(s => ({ ...s, curve: p.curve }));
    this.presetVars = { ...p.vars };
    this.model.presetId = id;
    this.emit();
  }
  duplicatePreset(id: string): MotionPreset | undefined {
    const p = presetById(id, this.custom); if (!p) return;
    const dup: MotionPreset = { ...clone(p), id: `custom_${++this.seq}`, name: `${p.name} copy`, builtIn: false };
    this.custom.push(dup); this.emit(); return dup;
  }
  renamePreset(id: string, name: string): void {
    const p = this.custom.find(c => c.id === id); if (p) { p.name = name; this.emit(); }
  }
  /** Save the CURRENT model state as a new custom preset. */
  savePreset(name: string): MotionPreset {
    const p: MotionPreset = {
      id: `custom_${++this.seq}`, name: name || `Preset ${this.seq}`, builtIn: false,
      effects: { ...this.model.effects }, vars: { ...this.presetVars }, curve: this.model.timeline[0]?.curve ?? 'ease-out',
    };
    this.custom.push(p); this.emit(); return p;
  }

  // ── Projection onto the live runtime ─────────────────────────────────────────
  project(root: Element | null): void {
    if (!root) return;
    const host = root as HTMLElement;
    const set = (k: string, v: string | number) => host.style.setProperty(k, String(v));
    // Layer visibility + stacking order.
    this.model.layers.forEach((l, i) => {
      set(`--ee-show-${l.kind}`, l.visible ? 1 : 0);
      set(`--ee-z-${l.kind}`, i);
    });
    // Visual effects.
    const e = this.model.effects;
    const bool = (b: boolean) => (b ? 1 : 0);
    set('--ee-fx-noise', bool(e.noise));
    set('--ee-fx-mesh', bool(e.mesh));
    set('--ee-fx-glass', bool(e.glass));
    set('--ee-fx-shadow', bool(e.shadow));
    set('--ee-fx-inner-shadow', bool(e.innerShadow));
    set('--ee-fx-border-glow', bool(e.borderGlow));
    set('--ee-fx-animated-border', bool(e.animatedBorder));
    set('--ee-fx-ripple', bool(e.ripple));
    set('--ee-fx-pulse', bool(e.pulse));
    set('--ee-fx-floating', bool(e.floating));
    set('--ee-fx-parallax', bool(e.parallax));
    set('--ee-fx-blur', `${e.blur}px`);
    set('--ee-fx-opacity', e.opacity);
    set('--ee-show-glow', bool(e.glow && (this.layer('ly_glow')?.visible ?? true)));
    set('--ee-show-particles', bool(e.particles && (this.layer('ly_particles')?.visible ?? true)));
    // Entrance timing from the Fade In step.
    const fade = this.model.timeline.find(s => s.effect === 'fadeIn');
    if (fade) { set('--entry-duration', `${fade.duration}ms`); set('--entry-easing', fade.curve); }
    // Preset colour/gradient overrides.
    for (const [k, v] of Object.entries(this.presetVars)) set(k, v);
  }

  // ── Versioning support ────────────────────────────────────────────────────────
  snapshot(): MotionSnapshot { return { model: clone(this.model), presetVars: { ...this.presetVars } }; }
  restore(s: MotionSnapshot): void { this.model = clone(s.model); this.presetVars = { ...s.presetVars }; this.emit(); }

  subscribe(l: Listener): () => void { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  private emit(): void { this.listeners.forEach(l => l()); }

  /** Reserved layer kinds for the Layer panel labels. */
  static layerKinds(): LayerKind[] {
    return ['background', 'mesh', 'particles', 'rings', 'glow', 'noise', 'blur', 'glass', 'logo', 'text', 'button', 'foreground'];
  }
}
