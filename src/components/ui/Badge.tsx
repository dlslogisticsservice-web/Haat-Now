import React from 'react';

// ── Badge ─────────────────────────────────────────────────────
type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

const badgeStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  primary:   { bg: 'rgba(163, 249, 91, 0.15)',  text: 'var(--color-primary-container)' },
  secondary: { bg: 'rgba(161, 214, 103, 0.12)', text: 'var(--color-secondary)' },
  success:   { bg: 'rgba(101, 253, 175, 0.12)', text: 'var(--color-tertiary-container)' },
  warning:   { bg: 'rgba(255, 200, 80, 0.15)',  text: '#ffc850' },
  error:     { bg: 'rgba(255, 180, 171, 0.12)', text: 'var(--color-error)' },
  neutral:   { bg: 'rgba(255, 255, 255, 0.08)', text: 'var(--color-on-surface-variant)' },
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  dot = false,
  className = '',
}) => {
  const { bg, text } = badgeStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-label-sm px-2.5 py-1 rounded-full ${className}`}
      style={{ background: bg, color: text }}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: text }}
        />
      )}
      {children}
    </span>
  );
};

// ── Chip — interactive, selectable ───────────────────────────
interface ChipProps {
  label: string;
  selected?: boolean;
  onSelect?: () => void;
  icon?: React.ReactNode;
  count?: number;
  className?: string;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onSelect,
  icon,
  count,
  className = '',
}) => {
  return (
    <button
      onClick={onSelect}
      className={[
        'inline-flex items-center gap-2 px-4 h-9 rounded-full',
        'text-label-md font-medium',
        'transition-all duration-200',
        'cursor-pointer select-none',
        selected
          ? 'bg-[var(--color-secondary-container)] text-[var(--color-on-secondary-container)] border border-[var(--color-primary-container)]'
          : 'bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(163,249,91,0.3)] hover:text-[var(--color-on-surface)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && <span className="inline-flex">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className="text-label-sm px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
          style={{
            background: selected ? 'rgba(163,249,91,0.2)' : 'rgba(255,255,255,0.08)',
            color: selected ? 'var(--color-primary-container)' : 'var(--color-on-surface-variant)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
};

// ── Notification Dot ──────────────────────────────────────────
interface NotifDotProps {
  count?: number;
  visible?: boolean;
}

export const NotifDot: React.FC<NotifDotProps> = ({ count, visible = true }) => {
  if (!visible) return null;
  return (
    <span
      className="absolute -top-1 -end-1 flex items-center justify-center rounded-full text-[var(--color-on-error)] bg-[var(--color-error)]"
      style={{
        minWidth: count ? '18px' : '8px',
        height: count ? '18px' : '8px',
        fontSize: '10px',
        fontWeight: 700,
        lineHeight: 1,
        padding: count ? '0 4px' : '0',
      }}
    >
      {count && count > 0 ? (count > 99 ? '99+' : count) : null}
    </span>
  );
};

export default Badge;
