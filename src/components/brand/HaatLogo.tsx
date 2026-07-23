import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// HaatLogo — the platform brand mark. Lives in the shared brand module (not inside any
// feature) so any feature/channel may render it without a cross-feature import. Moved
// from features/website/icons.tsx in migration M1 (see STUDIO_RUNTIME_ARCHITECTURE.md).
// ─────────────────────────────────────────────────────────────────────────────
export const HaatLogo: React.FC<{ height?: number; showWordmark?: boolean; mono?: boolean }> = ({ height = 30, showWordmark = true, mono = false }) => {
  const primary = mono ? 'currentColor' : 'var(--color-primary-fixed, #a3f95b)';
  const onPrimary = mono ? 'var(--color-surface-container, #10160f)' : 'var(--color-on-primary-fixed, #0c2000)';
  const ink = 'currentColor';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: height * 0.34, height, lineHeight: 1 }} aria-label="HaaT Now">
      <svg width={height} height={height} viewBox="0 0 40 40" fill="none" role="img" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill={primary} />
        {/* stylised H + motion mark */}
        <path d="M13 11v18M27 11v18M13 20h14" stroke={onPrimary} strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="20" cy="20" r="2.4" fill={onPrimary} />
      </svg>
      {showWordmark && (
        <span style={{ fontWeight: 900, letterSpacing: '-0.02em', fontSize: height * 0.6, color: ink, whiteSpace: 'nowrap' }}>
          HaaT<span style={{ color: primary }}> Now</span>
        </span>
      )}
    </span>
  );
};

export default HaatLogo;
