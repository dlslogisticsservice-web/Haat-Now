import React from 'react';

type CardVariant = 'glass' | 'glass-sm' | 'glass-heavy' | 'surface' | 'elevated';
type CardRadius = 'sm' | 'base' | 'lg' | 'xl' | '2xl';

interface CardProps {
  variant?: CardVariant;
  radius?: CardRadius;
  padding?: string;
  hover?: boolean;
  neonGlow?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
}

const variantStyles: Record<CardVariant, React.CSSProperties> = {
  glass: {
    background: 'rgba(29, 32, 35, 0.4)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  'glass-sm': {
    background: 'rgba(29, 32, 35, 0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  'glass-heavy': {
    background: 'rgba(17, 20, 23, 0.8)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: '1px solid rgba(255, 255, 255, 0.10)',
  },
  surface: {
    background: 'var(--color-surface-container)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  elevated: {
    background: 'var(--color-surface-container-high)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
  },
};

const radiusClasses: Record<CardRadius, string> = {
  sm: 'rounded-[var(--radius-sm)]',
  base: 'rounded-[var(--radius)]',
  lg: 'rounded-[var(--radius-lg)]',
  xl: 'rounded-[var(--radius-xl)]',
  '2xl': 'rounded-[var(--radius-2xl)]',
};

export const Card: React.FC<CardProps> = ({
  variant = 'glass',
  radius = 'xl',
  padding,
  hover = false,
  neonGlow = false,
  className = '',
  style,
  onClick,
  children,
  as: Tag = 'div',
}) => {
  const isInteractive = hover || !!onClick;

  return (
    <Tag
      onClick={onClick}
      className={[
        radiusClasses[radius],
        isInteractive
          ? 'transition-all duration-300 cursor-pointer hover:border-[rgba(163,249,91,0.35)] hover:bg-[rgba(29,32,35,0.65)]'
          : '',
        neonGlow ? 'neon-glow' : '',
        padding ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </Tag>
  );
};

// ── Stat Card — for dashboards ───────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  accentColor?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  icon,
  trend,
  accentColor = 'var(--color-primary-container)',
  className = '',
}) => {
  return (
    <Card variant="glass" radius="xl" padding="p-5" className={className}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <p className="text-label-sm text-[var(--color-on-surface-variant)]">{label}</p>
        {icon && (
          <div
            className="w-9 h-9 rounded-[var(--radius)] flex items-center justify-center"
            style={{ background: `${accentColor}20` }}
          >
            <span style={{ color: accentColor }}>{icon}</span>
          </div>
        )}
      </div>

      {/* Value */}
      <p className="text-display-md font-bold text-[var(--color-on-surface)] mb-1">
        {value}
      </p>

      {/* Sub-value / trend */}
      <div className="flex items-center gap-2">
        {subValue && (
          <p className="text-label-md text-[var(--color-on-surface-variant)]">{subValue}</p>
        )}
        {trend && (
          <span
            className="text-label-sm px-2 py-0.5 rounded-full"
            style={{
              background: trend.value >= 0 ? 'rgba(163, 249, 91, 0.12)' : 'rgba(255, 180, 171, 0.12)',
              color: trend.value >= 0 ? 'var(--color-primary-container)' : 'var(--color-error)',
            }}
          >
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
          </span>
        )}
      </div>
    </Card>
  );
};

export default Card;
