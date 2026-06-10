/**
 * HAAT NOW — Luminous Precision Design System
 * TypeScript Token Reference v1.0.0
 *
 * Source of truth for all design decisions.
 * CSS custom properties in index.css mirror these values.
 * Use CSS vars in className; use these consts in JS logic only.
 */

export const colors = {
  // Backgrounds & Surfaces
  background: '#111417',
  surface: '#111417',
  surfaceDim: '#111417',
  surfaceBright: '#37393d',
  surfaceContainerLowest: '#0b0e11',
  surfaceContainerLow: '#191c1f',
  surfaceContainer: '#1d2023',
  surfaceContainerHigh: '#272a2e',
  surfaceContainerHighest: '#323538',
  surfaceVariant: '#323538',
  surfaceTint: '#88dc41',

  // On-surface Text
  onBackground: '#e1e2e7',
  onSurface: '#e1e2e7',
  onSurfaceVariant: '#c0cab2',
  inverseSurface: '#e1e2e7',
  inverseOnSurface: '#2e3134',

  // Outline
  outline: '#8a947e',
  outlineVariant: '#414a37',

  // Primary — Neon Lime
  primary: '#ffffff',
  onPrimary: '#193700',
  primaryContainer: '#a3f95b',
  onPrimaryContainer: '#3a7100',
  primaryFixed: '#a3f95b',
  primaryFixedDim: '#88dc41',
  onPrimaryFixed: '#0c2000',
  inversePrimary: '#366b00',

  // Secondary — Soft Lime
  secondary: '#a1d667',
  onSecondary: '#1e3700',
  secondaryContainer: '#406c01',
  onSecondaryContainer: '#b7ed7a',

  // Tertiary — Emerald
  tertiary: '#ffffff',
  onTertiary: '#003920',
  tertiaryContainer: '#65fdaf',
  onTertiaryContainer: '#007347',

  // Error
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',

  // Neon shorthands
  neon: '#a3f95b',
  neonDim: '#88dc41',
  neonBright: '#c4ff7a',
} as const;

export const typography = {
  displayLg:       { fontSize: '48px', lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' },
  displayMd:       { fontSize: '36px', lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '700' },
  headlineLg:      { fontSize: '32px', lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' },
  headlineLgMobile:{ fontSize: '28px', lineHeight: '36px', letterSpacing: '-0.01em', fontWeight: '600' },
  headlineSm:      { fontSize: '20px', lineHeight: '28px', letterSpacing: '0em',    fontWeight: '600' },
  bodyLg:          { fontSize: '18px', lineHeight: '28px', letterSpacing: '0em',    fontWeight: '400' },
  bodyMd:          { fontSize: '16px', lineHeight: '24px', letterSpacing: '0em',    fontWeight: '400' },
  labelMd:         { fontSize: '14px', lineHeight: '20px', letterSpacing: '0.01em', fontWeight: '500' },
  labelSm:         { fontSize: '12px', lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' },
} as const;

export const spacing = {
  unit: '4px',
  stackSm: '8px',
  stackMd: '16px',
  gutter: '16px',
  stackLg: '32px',
  containerMargin: '24px',
  sectionGap: '64px',
  sidebar: '280px',
} as const;

export const radius = {
  sm:   '0.25rem',
  base: '0.5rem',
  md:   '0.75rem',
  lg:   '1rem',
  xl:   '1.5rem',
  '2xl':'2rem',
  full: '9999px',
} as const;

export const shadows = {
  card:    '0 4px 24px rgba(0, 0, 0, 0.4)',
  overlay: '0 20px 50px rgba(0, 0, 0, 0.5)',
  neonSm:  '0 0 12px rgba(163, 249, 91, 0.15)',
  neon:    '0 0 20px rgba(163, 249, 91, 0.2)',
  neonLg:  '0 0 30px rgba(163, 249, 91, 0.3)',
  emerald: '0 0 20px rgba(0, 194, 122, 0.2)',
} as const;

export const glass = {
  base:  'rgba(29, 32, 35, 0.4)',
  sm:    'rgba(29, 32, 35, 0.6)',
  heavy: 'rgba(17, 20, 23, 0.8)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(163, 249, 91, 0.35)',
} as const;

export const transitions = {
  fast:   '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow:   '500ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;
