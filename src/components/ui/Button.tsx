import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  /** Neon Lime CTA — solid lime bg, black text, pill shape, neon glow on hover */
  primary:
    'bg-[var(--color-primary-container)] text-[var(--color-on-primary)] ' +
    'font-semibold rounded-full ' +
    'hover:bg-[var(--color-neon-bright)] neon-glow-btn ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none',

  /** Metallic ghost — transparent, 1px lime border, white text */
  secondary:
    'bg-transparent border border-[var(--color-primary-container)] text-[var(--color-primary-container)] ' +
    'font-semibold rounded-full ' +
    'hover:bg-[rgba(163,249,91,0.08)] ' +
    'transition-colors duration-300 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed',

  /** Minimal ghost — no border, muted text, hover fades in */
  ghost:
    'bg-transparent text-[var(--color-on-surface-variant)] ' +
    'font-medium rounded-full ' +
    'hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--color-on-surface)] ' +
    'transition-colors duration-200 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed',

  /** Error/destructive */
  danger:
    'bg-[var(--color-error-container)] text-[var(--color-on-error-container)] ' +
    'font-semibold rounded-full ' +
    'hover:opacity-90 transition-opacity ' +
    'disabled:opacity-40 disabled:cursor-not-allowed',

  /** Icon-only — circular ghost */
  icon:
    'bg-transparent text-[var(--color-on-surface-variant)] ' +
    'rounded-full ' +
    'hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--color-on-surface)] ' +
    'transition-colors duration-200 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-4 text-[var(--text-label-md)] gap-1.5',
  md: 'h-11 px-6 text-[var(--text-label-md)] gap-2',
  lg: 'h-14 px-8 text-[var(--text-body-md)] gap-2',
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const Spinner: React.FC<{ size: ButtonSize }> = ({ size }) => {
  const spinnerSize = size === 'sm' ? 14 : size === 'md' ? 16 : 20;
  return (
    <svg
      width={spinnerSize}
      height={spinnerSize}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      style={{ animation: 'spin-slow 0.8s linear infinite' }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const isIconOnly = variant === 'icon';

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center',
        'select-none cursor-pointer',
        'transition-all',
        variantClasses[variant],
        isIconOnly ? iconSizeClasses[size] : sizeClasses[size],
        fullWidth ? 'w-full' : '',
        loading ? 'cursor-wait' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? (
        <Spinner size={size} />
      ) : (
        <>
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          {children && <span>{children}</span>}
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

export default Button;
