import React from 'react';

// ── Shared skeleton-loading primitives (design-token driven) ─────────────────
// Replaces bare centered spinners with shape-matched placeholders + a subtle
// shimmer, giving the enterprise "content is loading" feel of Talabat/Deliveroo.

const base: React.CSSProperties = {
  background: 'var(--color-surface-container-high)',
  borderRadius: 'var(--radius-lg, 12px)',
};

/** A single shimmer block. Pass width/height via className or style. */
export const Skeleton: React.FC<{ className?: string; style?: React.CSSProperties; rounded?: boolean }> = ({ className = '', style, rounded }) => (
  <div className={`animate-pulse ${className}`} style={{ ...base, ...(rounded ? { borderRadius: 999 } : null), ...style }} />
);

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };

/** A metric/stat card placeholder. */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded-2xl p-4 space-y-3 ${className}`} style={card}>
    <Skeleton className="h-3.5 w-1/2" />
    <Skeleton className="h-7 w-2/3" />
    <Skeleton className="h-2.5 w-1/3" />
  </div>
);

/** A responsive grid of metric cards. */
export const SkeletonMetrics: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
    {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
  </div>
);

/** A list of rows (e.g. notifications, tickets). */
export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="rounded-2xl p-3.5 flex items-center gap-3" style={card}>
        <Skeleton className="w-9 h-9 shrink-0" rounded />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

/** A data-table placeholder with header + rows. */
export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ rows = 8, cols = 4 }) => (
  <div className="rounded-2xl overflow-hidden" style={card}>
    <div className="flex gap-4 px-4 py-3" style={{ background: 'var(--color-surface-container-high)' }}>
      {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 flex-1" />)}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex gap-4 px-4 py-3" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
        {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} className="h-3.5 flex-1" style={{ opacity: c === 0 ? 1 : 0.7 }} />)}
      </div>
    ))}
  </div>
);

/** A chart-card placeholder with title + plot area. */
export const SkeletonChart: React.FC<{ height?: number }> = ({ height = 180 }) => (
  <div className="rounded-2xl p-4 space-y-3" style={card}>
    <Skeleton className="h-3.5 w-1/3" />
    <Skeleton className="w-full" style={{ height }} />
  </div>
);
