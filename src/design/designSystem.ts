// ─────────────────────────────────────────────────────────────────────────────
// HAAT NOW — centralized design system tokens (PHASE A).
// Defaults mirror the CURRENT hardcoded values, so applying the default config
// changes nothing — the system is purely additive / backward compatible.
// applyDesign() writes CSS variables on :root at runtime → live re-theme, no rebuild.
// ─────────────────────────────────────────────────────────────────────────────

export interface DesignConfig {
  branding: { appLogo: string; splashLogo: string; favicon: string; darkLogo: string; lightLogo: string };
  colors: { primary: string; secondary: string; accent: string; success: string; warning: string; danger: string };
  glass: { intensity: number; borderOpacity: number; gradient: string };
  typography: { fontFamily: string; fontScale: number; headerScale: number; bodyScale: number; weight: number; letterSpacing: number; lineHeight: number };
  cards: { radius: number; shadow: number; padding: number; density: 'compact' | 'standard' | 'premium' };
  buttons: { radius: number; height: number; density: 'compact' | 'standard' | 'comfortable' };
  icons: { size: number; weight: number };
  layout: { spacing: number; sectionGap: number; containerWidth: number; density: 'compact' | 'comfortable' };
  animations: { enabled: boolean; speed: number };
}

// Defaults = current production values (from index.css).
export const DEFAULT_DESIGN: DesignConfig = {
  branding: { appLogo: '', splashLogo: '', favicon: '/vite.svg', darkLogo: '', lightLogo: '' },
  colors: { primary: '#a3f95b', secondary: '#a1d667', accent: '#88dc41', success: '#4ade80', warning: '#fbbf24', danger: '#f87171' },
  glass: { intensity: 28, borderOpacity: 0.1, gradient: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(163,249,91,0.05) 0%, transparent 60%)' },
  typography: { fontFamily: 'Cairo', fontScale: 1, headerScale: 1, bodyScale: 1, weight: 600, letterSpacing: 0, lineHeight: 1.5 },
  cards: { radius: 22, shadow: 2, padding: 16, density: 'standard' },
  buttons: { radius: 12, height: 44, density: 'standard' },
  icons: { size: 24, weight: 1.8 },
  layout: { spacing: 1, sectionGap: 16, containerWidth: 1280, density: 'comfortable' },
  animations: { enabled: true, speed: 1 },
};

export function mergeDesign(base: DesignConfig, patch: Partial<DesignConfig>): DesignConfig {
  return {
    branding: { ...base.branding, ...patch.branding },
    colors: { ...base.colors, ...patch.colors },
    glass: { ...base.glass, ...patch.glass },
    typography: { ...base.typography, ...patch.typography },
    cards: { ...base.cards, ...patch.cards },
    buttons: { ...base.buttons, ...patch.buttons },
    icons: { ...base.icons, ...patch.icons },
    layout: { ...base.layout, ...patch.layout },
    animations: { ...base.animations, ...patch.animations },
  };
}

// Apply a config to a root element (default :root). Live, no rebuild.
export function applyDesign(c: DesignConfig, root: HTMLElement = document.documentElement) {
  const s = root.style;
  // Colors — drive the existing brand tokens (backward compatible).
  s.setProperty('--color-primary-fixed', c.colors.primary);
  s.setProperty('--color-primary-container', c.colors.primary);
  s.setProperty('--color-secondary-fixed', c.colors.secondary);
  s.setProperty('--color-primary-fixed-dim', c.colors.accent);
  // New semantic tokens (opt-in for components).
  s.setProperty('--color-accent', c.colors.accent);
  s.setProperty('--color-success', c.colors.success);
  s.setProperty('--color-warning', c.colors.warning);
  s.setProperty('--color-danger', c.colors.danger);
  // Glass / surface.
  s.setProperty('--glass-blur', `${c.glass.intensity}px`);
  s.setProperty('--border-opacity', String(c.glass.borderOpacity));
  // Typography (font family is live; scales are exposed as vars/opt-in).
  const fam = `"${c.typography.fontFamily}", "Cairo", "Tajawal", sans-serif`;
  s.setProperty('--font-display', fam);
  s.setProperty('--font-sans', fam);
  s.setProperty('--font-arabic', fam); // headings re-font too
  s.setProperty('--font-scale', String(c.typography.fontScale));
  s.setProperty('--header-scale', String(c.typography.headerScale));
  s.setProperty('--body-scale', String(c.typography.bodyScale));
  s.setProperty('--font-weight', String(c.typography.weight));
  s.setProperty('--letter-spacing', `${c.typography.letterSpacing}em`);
  s.setProperty('--line-height', String(c.typography.lineHeight));
  // Cards / buttons / icons / layout (vars for opt-in components + presets).
  s.setProperty('--radius-card', `${c.cards.radius / 16}rem`);
  s.setProperty('--card-padding', `${c.cards.padding}px`);
  s.setProperty('--card-shadow-level', String(c.cards.shadow));
  s.setProperty('--btn-radius', `${c.buttons.radius}px`);
  s.setProperty('--btn-height', `${c.buttons.height}px`);
  s.setProperty('--icon-size', `${c.icons.size}px`);
  s.setProperty('--icon-weight', String(c.icons.weight));
  s.setProperty('--space-scale', String(c.layout.spacing));
  s.setProperty('--section-gap', `${c.layout.sectionGap}px`);
  s.setProperty('--anim-speed', c.animations.enabled ? String(c.animations.speed) : '0');
  // Favicon (branding).
  if (c.branding.favicon) {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (link) link.href = c.branding.favicon;
  }
}
