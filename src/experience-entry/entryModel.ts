// ─────────────────────────────────────────────────────────────────────────────
// Entry Experience Model (Phase 8I · Entry Experience Runtime).
//
// The Entry Experience (Splash / Intro / Welcome / Auth landing / Onboarding) is DATA, not
// hardcoded markup: a model describes every animated layer, and one renderer (EntryExperience)
// projects it. This is what makes the entry screens part of the Runtime architecture — the
// Studio selects, edits (via the transaction engine) and previews them like any other runtime.
//
// The `renderer` discriminant on each layer keeps the door open for Lottie / Rive / Motion
// timeline / video backgrounds WITHOUT a redesign: today only 'css' is implemented; a future
// phase adds a branch to the renderer for the others, reading extra fields on the same model.
//
// PURE DATA — no React, no DOM, no services, no persistence.
// ─────────────────────────────────────────────────────────────────────────────

export type EntryKind = 'splash' | 'intro' | 'welcome' | 'auth' | 'onboarding';

/** How a layer is drawn. Only 'css' is implemented now; the rest are reserved seams. */
export type LayerRenderer = 'css' | 'lottie' | 'rive' | 'video';

export interface EntryModel {
  kind: EntryKind;
  /** Rendering backend for the animated layers. 'css' today; extensible without redesign. */
  renderer: LayerRenderer;
  logo: { src: string; size: number };
  background: { color: string; gradientFrom: string; gradientTo: string; angle: number };
  glow: { color: string; intensity: number };            // intensity 0..1
  particles: { color: string; count: number; speed: number }; // speed = seconds/loop
  rings: { color: string; count: number; thickness: number }; // thickness = px
  text: { title: string; subtitle: string };
  cta: { label: string; visible: boolean };
  timing: { duration: number; easing: string };          // duration = ms, easing = CSS keyword
}

const LOGO = 'https://haatnow.app/icon-192.png';

/** Per-kind defaults — distinct look for each entry screen; the single source, never hardcoded markup. */
export const ENTRY_DEFAULTS: Record<EntryKind, EntryModel> = {
  splash: {
    kind: 'splash', renderer: 'css',
    logo: { src: LOGO, size: 96 },
    background: { color: '#05130b', gradientFrom: '#0b3d24', gradientTo: '#05130b', angle: 160 },
    glow: { color: '#a3f95b', intensity: 0.55 },
    particles: { color: '#a3f95b', count: 10, speed: 6 },
    rings: { color: '#a3f95b', count: 3, thickness: 2 },
    text: { title: 'HAAT NOW', subtitle: 'Everything, delivered' },
    cta: { label: '', visible: false },
    timing: { duration: 900, easing: 'cubic-bezier(.22,1,.36,1)' },
  },
  intro: {
    kind: 'intro', renderer: 'css',
    logo: { src: LOGO, size: 84 },
    background: { color: '#071016', gradientFrom: '#0d2a3a', gradientTo: '#071016', angle: 150 },
    glow: { color: '#5ad1ff', intensity: 0.5 },
    particles: { color: '#5ad1ff', count: 8, speed: 7 },
    rings: { color: '#5ad1ff', count: 2, thickness: 2 },
    text: { title: 'Discover HAAT', subtitle: 'Food, groceries & more — one app' },
    cta: { label: 'Next', visible: true },
    timing: { duration: 700, easing: 'ease-out' },
  },
  welcome: {
    kind: 'welcome', renderer: 'css',
    logo: { src: LOGO, size: 88 },
    background: { color: '#160a1e', gradientFrom: '#3a1250', gradientTo: '#160a1e', angle: 155 },
    glow: { color: '#c78bff', intensity: 0.6 },
    particles: { color: '#c78bff', count: 12, speed: 5 },
    rings: { color: '#c78bff', count: 3, thickness: 3 },
    text: { title: 'Welcome 👋', subtitle: 'Let’s get you started' },
    cta: { label: 'Get started', visible: true },
    timing: { duration: 800, easing: 'cubic-bezier(.22,1,.36,1)' },
  },
  auth: {
    kind: 'auth', renderer: 'css',
    logo: { src: LOGO, size: 72 },
    background: { color: '#0a0f0c', gradientFrom: '#12291b', gradientTo: '#0a0f0c', angle: 165 },
    glow: { color: '#a3f95b', intensity: 0.4 },
    particles: { color: '#a3f95b', count: 6, speed: 8 },
    rings: { color: '#a3f95b', count: 2, thickness: 2 },
    text: { title: 'Sign in to continue', subtitle: 'Enter your phone number to get an OTP' },
    cta: { label: 'Continue', visible: true },
    timing: { duration: 600, easing: 'ease-out' },
  },
  onboarding: {
    kind: 'onboarding', renderer: 'css',
    logo: { src: LOGO, size: 76 },
    background: { color: '#0a0f0c', gradientFrom: '#0b3d24', gradientTo: '#0a0f0c', angle: 145 },
    glow: { color: '#a3f95b', intensity: 0.45 },
    particles: { color: '#a3f95b', count: 5, speed: 9 },
    rings: { color: '#a3f95b', count: 2, thickness: 2 },
    text: { title: 'Order in three taps', subtitle: 'Browse, add to cart, and track live' },
    cta: { label: 'Continue', visible: true },
    timing: { duration: 700, easing: 'ease-out' },
  },
};

export const ENTRY_KINDS: EntryKind[] = ['splash', 'intro', 'welcome', 'auth', 'onboarding'];

export function entryModel(kind: EntryKind): EntryModel { return ENTRY_DEFAULTS[kind]; }
