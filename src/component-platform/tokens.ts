// ─────────────────────────────────────────────────────────────────────────────
// Design Tokens (Phase 9A · Visual Component Platform).
//
// The single vocabulary every platform component consumes — colours, typography, spacing,
// radius, shadow, animation. Tokens resolve to the app's EXISTING theme CSS custom properties
// (the same ones the Runtime + Motion Studio use), so the platform never introduces a second
// theme system and never hardcodes a colour/size. A component reads `tok('color.primary')`
// → `var(--color-primary-fixed)`; changing the theme re-themes every component live.
//
// PURE DATA — no React, no DOM.
// ─────────────────────────────────────────────────────────────────────────────

export type TokenGroup = 'color' | 'font' | 'space' | 'radius' | 'shadow' | 'motion';

/** token name → CSS custom property (or literal) it resolves to. */
export const TOKENS: Record<string, string> = {
  // Colours (semantic → theme vars)
  'color.primary': '--color-primary-fixed',
  'color.onPrimary': '--color-on-primary-fixed',
  'color.surface': '--color-surface-container',
  'color.surfaceHigh': '--color-surface-container-high',
  'color.background': '--color-background',
  'color.onSurface': '--color-on-surface',
  'color.onSurfaceVariant': '--color-on-surface-variant',
  'color.outline': '--color-outline-variant',
  'color.tertiary': '--color-tertiary-fixed',
  // Typography
  'font.family': '--font-family',
  'font.xs': '11px', 'font.sm': '13px', 'font.md': '15px', 'font.lg': '20px', 'font.xl': '28px', 'font.2xl': '40px',
  'font.weight.regular': '400', 'font.weight.medium': '600', 'font.weight.bold': '800',
  // Spacing scale (4pt)
  'space.0': '0px', 'space.1': '4px', 'space.2': '8px', 'space.3': '12px', 'space.4': '16px',
  'space.5': '24px', 'space.6': '32px', 'space.7': '48px', 'space.8': '64px',
  // Radius
  'radius.none': '0px', 'radius.sm': '8px', 'radius.md': '12px', 'radius.lg': '18px', 'radius.xl': '26px', 'radius.full': '999px',
  // Shadow
  'shadow.none': 'none',
  'shadow.sm': '0 2px 8px -4px rgba(0,0,0,.4)',
  'shadow.md': '0 12px 34px -18px rgba(0,0,0,.5)',
  'shadow.lg': '0 30px 70px -34px rgba(0,0,0,.6)',
  // Motion
  'motion.fast': '120ms', 'motion.base': '240ms', 'motion.slow': '420ms',
  'motion.easing': 'cubic-bezier(.22,1,.36,1)',
};

/** Resolve a token to a CSS value. CSS-var tokens (start with `--`) are wrapped in var(); the
 *  optional fallback is emitted so a component still renders if a var is unset. */
export function tok(name: string, fallback?: string): string {
  const v = TOKENS[name];
  if (!v) return fallback ?? name;
  if (v.startsWith('--')) return `var(${v}${fallback ? `, ${fallback}` : ''})`;
  return v;
}

/** All token names in a group, for the token pickers in the inspector. */
export function tokensIn(group: TokenGroup): string[] {
  return Object.keys(TOKENS).filter(k => k.startsWith(`${group}.`));
}
