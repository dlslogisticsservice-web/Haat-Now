// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Premium UX primitives (Wave 3, Part 2).
// A small, reusable, accessible component library for the official website: glass
// surfaces, skeleton loading, smart empty states, spinner, buttons, badges. CSS-var
// themed (reuses the platform's design tokens) so every white-label tenant re-skins for
// free. No lib/supabase import (architecture guard safe). Light + dark aware.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';

const radius = 16;

export const GlassCard: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties; interactive?: boolean; ariaLabel?: string }>> = ({ children, style, interactive, ariaLabel }) => (
  <div
    aria-label={ariaLabel}
    style={{
      background: 'color-mix(in srgb, var(--color-surface-container) 78%, transparent)',
      backdropFilter: 'blur(18px) saturate(1.2)',
      WebkitBackdropFilter: 'blur(18px) saturate(1.2)',
      border: '1px solid var(--color-outline-variant)',
      borderRadius: radius,
      boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
      transition: 'transform .18s ease, box-shadow .18s ease',
      ...(interactive ? { cursor: 'pointer' } : {}),
      ...style,
    }}
    onMouseEnter={interactive ? e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; } : undefined}
    onMouseLeave={interactive ? e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; } : undefined}
  >
    {children}
  </div>
);

/** Shimmer skeleton for loading states. */
export const Skeleton: React.FC<{ width?: number | string; height?: number | string; radius?: number; style?: React.CSSProperties }> = ({ width = '100%', height = 16, radius: r = 8, style }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'block', width, height, borderRadius: r,
      background: 'linear-gradient(90deg, var(--color-surface-container-high) 25%, var(--color-surface-container) 37%, var(--color-surface-container-high) 63%)',
      backgroundSize: '400% 100%', animation: 'wp-shimmer 1.4s ease infinite', ...style,
    }}
  />
);

/** A skeleton grid for browse/list loading. */
export const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
    {Array.from({ length: count }).map((_v, i) => (
      <GlassCard key={i} style={{ padding: 14 }}>
        <Skeleton height={120} radius={12} />
        <Skeleton width="70%" style={{ marginTop: 12 }} />
        <Skeleton width="40%" style={{ marginTop: 8 }} />
      </GlassCard>
    ))}
  </div>
);

export const Spinner: React.FC<{ size?: number; label?: string }> = ({ size = 22, label = 'Loading' }) => (
  <span role="status" aria-label={label} style={{ display: 'inline-block', width: size, height: size, border: '2.5px solid var(--color-outline-variant)', borderTopColor: 'var(--color-primary-fixed)', borderRadius: '50%', animation: 'wp-spin .7s linear infinite' }} />
);

/** A smart, delightful empty state. */
export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; hint?: string; action?: { label: string; onClick: () => void } }> = ({ icon, title, hint, action }) => (
  <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-on-surface-variant)' }}>
    {icon && <div style={{ fontSize: 40, opacity: 0.7, marginBottom: 8 }}>{icon}</div>}
    <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-on-surface)' }}>{title}</p>
    {hint && <p style={{ fontSize: 13, marginTop: 4 }}>{hint}</p>}
    {action && <PrimaryButton onClick={action.onClick} style={{ marginTop: 16 }}>{action.label}</PrimaryButton>}
  </div>
);

export const PrimaryButton: React.FC<React.PropsWithChildren<{ onClick?: () => void; style?: React.CSSProperties; variant?: 'primary' | 'ghost'; ariaLabel?: string; type?: 'button' | 'submit' }>> = ({ children, onClick, style, variant = 'primary', ariaLabel, type = 'button' }) => (
  <button
    type={type}
    aria-label={ariaLabel}
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '11px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
      border: variant === 'ghost' ? '1px solid var(--color-outline-variant)' : 'none',
      background: variant === 'ghost' ? 'transparent' : 'var(--color-primary-fixed)',
      color: variant === 'ghost' ? 'var(--color-on-surface)' : 'var(--color-on-primary-fixed)',
      transition: 'filter .15s ease, transform .12s ease',
      ...style,
    }}
    onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
    onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
  >
    {children}
  </button>
);

export const Badge: React.FC<React.PropsWithChildren<{ tone?: 'default' | 'success' | 'promo' }>> = ({ children, tone = 'default' }) => {
  const bg = tone === 'success' ? 'rgba(52,199,89,0.16)' : tone === 'promo' ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)';
  const fg = tone === 'success' ? '#34c759' : tone === 'promo' ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)';
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: bg, color: fg }}>{children}</span>;
};

/** Fade/slide-in wrapper for premium micro-interactions (respects reduced motion). */
export const AnimateIn: React.FC<React.PropsWithChildren<{ delayMs?: number }>> = ({ children, delayMs = 0 }) => (
  <div style={{ animation: 'wp-in .5s ease both', animationDelay: `${delayMs}ms` }}>{children}</div>
);

/** Injects the keyframes once (call near the site root). */
export const SiteKeyframes: React.FC = () => (
  <style>{`
    @keyframes wp-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
    @keyframes wp-spin { to { transform: rotate(360deg); } }
    @keyframes wp-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; } }
  `}</style>
);
