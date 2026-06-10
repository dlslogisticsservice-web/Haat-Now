import React from 'react';
import { Icon } from './Icon';

// ── Progress Steps ────────────────────────────────────────────
interface ProgressStep {
  label: string;
  completed?: boolean;
}

interface ProgressStepsProps {
  steps: ProgressStep[];
  currentStep: number; // 0-indexed
  className?: string;
}

export const ProgressSteps: React.FC<ProgressStepsProps> = ({
  steps,
  currentStep,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-0 ${className}`}>
      {steps.map((step, i) => {
        const isCompleted = i < currentStep;
        const isActive = i === currentStep;
        const isLast = i === steps.length - 1;

        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1.5">
              {/* Circle */}
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  'transition-all duration-300',
                  isCompleted
                    ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
                    : isActive
                    ? 'border-2 border-[var(--color-primary-container)] text-[var(--color-primary-container)] bg-transparent'
                    : 'border border-[rgba(255,255,255,0.15)] text-[var(--color-on-surface-variant)] bg-transparent',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {isCompleted ? (
                  <Icon name="check" size={16} />
                ) : (
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{i + 1}</span>
                )}
              </div>
              {/* Label */}
              <span
                className={`text-label-sm text-center max-w-[64px] leading-tight ${
                  isActive
                    ? 'text-[var(--color-primary-container)]'
                    : isCompleted
                    ? 'text-[var(--color-on-surface)]'
                    : 'text-[var(--color-on-surface-variant)]'
                }`}
                style={{ textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className="flex-1 h-px mx-1 mb-5 transition-all duration-500"
                style={{
                  background: isCompleted
                    ? 'var(--color-primary-container)'
                    : 'rgba(255,255,255,0.1)',
                  minWidth: '20px',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── Progress Bar ──────────────────────────────────────────────
interface ProgressBarProps {
  value: number; // 0–100
  max?: number;
  label?: string;
  showValue?: boolean;
  accentColor?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showValue = false,
  accentColor = 'var(--color-primary-container)',
  className = '',
}) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-label-md text-[var(--color-on-surface-variant)]">{label}</span>}
          {showValue && (
            <span className="text-label-sm text-[var(--color-primary-container)]" style={{ textTransform: 'none' }}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.08)' }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemax={max}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${accentColor}, var(--color-tertiary-container))`,
          }}
        />
      </div>
    </div>
  );
};

// ── Divider ───────────────────────────────────────────────────
interface DividerProps {
  label?: string;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export const Divider: React.FC<DividerProps> = ({
  label,
  className = '',
  orientation = 'horizontal',
}) => {
  if (orientation === 'vertical') {
    return (
      <div
        className={`w-px self-stretch ${className}`}
        style={{ background: 'rgba(255,255,255,0.08)' }}
      />
    );
  }

  if (label) {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <span className="text-label-sm text-[var(--color-on-surface-variant)] shrink-0">
          {label}
        </span>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
      </div>
    );
  }

  return (
    <hr
      className={`border-0 h-px ${className}`}
      style={{ background: 'rgba(255,255,255,0.08)' }}
    />
  );
};

// ── Loader / Spinner ──────────────────────────────────────────
interface LoaderProps {
  size?: number;
  color?: string;
  className?: string;
}

export const Loader: React.FC<LoaderProps> = ({
  size = 32,
  color = 'var(--color-primary-container)',
  className = '',
}) => (
  <div className={`flex items-center justify-center ${className}`}>
    <div
      className="rounded-full border-2 border-transparent animate-spin"
      style={{
        width: size,
        height: size,
        borderTopColor: color,
        borderRightColor: `${color}40`,
        animationDuration: '0.7s',
      }}
    />
  </div>
);

// ── Avatar ────────────────────────────────────────────────────
interface AvatarProps {
  src?: string;
  name?: string;
  size?: number;
  className?: string;
  online?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = '?',
  size = 40,
  className = '',
  online,
}) => {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-semibold text-[var(--color-on-primary)]"
          style={{
            background: 'var(--color-primary-container)',
            fontSize: size * 0.35,
          }}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className="absolute bottom-0 end-0 rounded-full border-2 border-[var(--color-background)]"
          style={{
            width: size * 0.28,
            height: size * 0.28,
            background: online ? 'var(--color-tertiary-container)' : 'var(--color-outline)',
          }}
        />
      )}
    </div>
  );
};

// ── Empty State ───────────────────────────────────────────────
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  description,
  action,
  className = '',
}) => (
  <div className={`flex flex-col items-center justify-center gap-4 py-16 text-center ${className}`}>
    <div
      className="w-20 h-20 rounded-full flex items-center justify-center"
      style={{ background: 'rgba(255,255,255,0.04)' }}
    >
      <Icon name={icon} size={40} className="text-[var(--color-on-surface-variant)]" />
    </div>
    <div className="space-y-1.5">
      <h3 className="text-headline-sm text-[var(--color-on-surface)]">{title}</h3>
      {description && (
        <p className="text-body-md text-[var(--color-on-surface-variant)] max-w-xs mx-auto">
          {description}
        </p>
      )}
    </div>
    {action}
  </div>
);

export default ProgressSteps;
