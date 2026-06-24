import React from 'react';
import { LucideIcon, Loader2, Search } from 'lucide-react';

/**
 * Enterprise admin design-system primitives. Single source of truth for admin layout
 * so panels stop hand-rolling cards/headers/badges. Tokens reference the existing CSS
 * variables (no new colors) to stay on one design language.
 */

const t = {
  surface: 'var(--color-surface-container)',
  surfaceHigh: 'var(--color-surface-container-high)',
  onSurface: 'var(--color-on-surface)',
  muted: 'var(--color-on-surface-variant)',
  primary: 'var(--color-primary-fixed)',
  onPrimary: 'var(--color-on-primary-fixed)',
  outline: 'var(--color-outline-variant)',
};

export type StatusKind = 'active' | 'inactive' | 'pending' | 'success' | 'error' | 'warning';
const STATUS: Record<StatusKind, { bg: string; fg: string }> = {
  active: { bg: 'rgba(74,222,128,0.15)', fg: '#4ade80' },
  success: { bg: 'rgba(74,222,128,0.15)', fg: '#4ade80' },
  inactive: { bg: 'rgba(255,255,255,0.06)', fg: t.muted },
  pending: { bg: 'rgba(251,191,36,0.15)', fg: '#fbbf24' },
  warning: { bg: 'rgba(251,146,60,0.15)', fg: '#fb923c' },
  error: { bg: 'rgba(248,113,113,0.15)', fg: '#f87171' },
};

/** Pill status badge — consistent across every table/list. */
export const StatusBadge: React.FC<{ kind: StatusKind; label: string }> = ({ kind, label }) => {
  const s = STATUS[kind];
  return <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold" style={{ background: s.bg, color: s.fg }}>{label}</span>;
};

/** Base container card for admin content. */
export const AdminCard: React.FC<{ className?: string; children: React.ReactNode; padding?: string }> = ({ className = '', children, padding = 'p-4' }) => (
  <div className={`rounded-2xl ${padding} ${className}`} style={{ background: t.surface, border: `1px solid ${t.outline}` }}>{children}</div>
);

/** KPI / metric tile with optional icon + delta. */
export const MetricCard: React.FC<{ label: string; value: React.ReactNode; Icon?: LucideIcon; accent?: string; hint?: string }> = ({ label, value, Icon, accent, hint }) => (
  <AdminCard padding="p-4">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium" style={{ color: t.muted }}>{label}</p>
        <p className="text-2xl font-bold mt-1" style={{ color: accent || t.onSurface }}>{value}</p>
        {hint && <p className="text-[11px] mt-0.5" style={{ color: t.muted }}>{hint}</p>}
      </div>
      {Icon && <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: t.surfaceHigh }}><Icon size={18} color={accent || t.muted} /></span>}
    </div>
  </AdminCard>
);

/** Compact stat tile (denser than MetricCard). */
export const StatTile: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({ label, value, accent }) => (
  <AdminCard padding="p-3" className="text-center">
    <p className="text-xl font-bold" style={{ color: accent || t.onSurface }}>{value}</p>
    <p className="text-xs" style={{ color: t.muted }}>{label}</p>
  </AdminCard>
);

/** Workspace title bar: icon + title + subtitle + actions. */
export const WorkspaceHeader: React.FC<{ Icon?: LucideIcon; title: string; subtitle?: string; actions?: React.ReactNode }> = ({ Icon, title, subtitle, actions }) => (
  <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
    <div className="flex items-center gap-2.5">
      {Icon && <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: t.surfaceHigh }}><Icon size={20} color={t.primary} /></span>}
      <div>
        <h2 className="text-lg font-bold" style={{ color: t.onSurface }}>{title}</h2>
        {subtitle && <p className="text-xs" style={{ color: t.muted }}>{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

/** Smaller section divider header. */
export const SectionHeader: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <div className="flex items-center justify-between mb-2">
    <h3 className="font-bold text-sm" style={{ color: t.onSurface }}>{title}</h3>
    {action}
  </div>
);

/** Toolbar / filter row with optional search. */
export const Toolbar: React.FC<{ children?: React.ReactNode; onSearch?: (q: string) => void; searchValue?: string; placeholder?: string }> = ({ children, onSearch, searchValue, placeholder }) => (
  <div className="flex items-center gap-2 flex-wrap mb-3">
    {onSearch && (
      <div className="relative flex-1 min-w-[160px]">
        <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-2.5" color={t.muted} />
        <input value={searchValue} onChange={e => onSearch(e.target.value)} placeholder={placeholder}
          className="w-full ps-8 pe-3 py-2 rounded-xl text-sm" style={{ background: t.surface, color: t.onSurface, border: `1px solid ${t.outline}` }} />
      </div>
    )}
    {children}
  </div>
);

/** Primary/secondary action button (consistent sizing). */
export const ActionButton: React.FC<{ children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary'; loading?: boolean; disabled?: boolean; Icon?: LucideIcon }> = ({ children, onClick, variant = 'primary', loading, disabled, Icon }) => (
  <button onClick={onClick} disabled={disabled || loading}
    className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl text-sm font-bold cursor-pointer transition-all disabled:opacity-50"
    style={variant === 'primary' ? { background: t.primary, color: t.onPrimary } : { background: t.surfaceHigh, color: t.onSurface, border: `1px solid ${t.outline}` }}>
    {loading ? <Loader2 size={15} className="animate-spin" /> : Icon && <Icon size={15} />}{children}
  </button>
);

/** Responsive dashboard grid for cards. */
export const DashboardGrid: React.FC<{ children: React.ReactNode; cols?: 2 | 3 | 4 }> = ({ children, cols = 4 }) => (
  <div className={`grid gap-3 grid-cols-2 ${cols >= 3 ? 'sm:grid-cols-3' : ''} ${cols >= 4 ? 'lg:grid-cols-4' : ''}`}>{children}</div>
);

/** Centered loading + empty states. */
export const LoadingState: React.FC<{ label?: string }> = ({ label }) => (
  <div className="py-12 flex flex-col items-center justify-center gap-2">
    <Loader2 size={28} className="animate-spin" color={t.primary} />
    {label && <p className="text-sm" style={{ color: t.muted }}>{label}</p>}
  </div>
);

export const EmptyStateBox: React.FC<{ Icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode }> = ({ Icon, title, description, action }) => (
  <AdminCard className="text-center py-10">
    {Icon && <Icon size={32} color={t.muted} className="mx-auto mb-2" />}
    <p className="font-bold" style={{ color: t.onSurface }}>{title}</p>
    {description && <p className="text-sm mt-1" style={{ color: t.muted }}>{description}</p>}
    {action && <div className="mt-3 flex justify-center">{action}</div>}
  </AdminCard>
);
