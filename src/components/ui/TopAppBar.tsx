import React from 'react';
import { Icon } from './Icon';

interface TopAppBarProps {
  /** Large HAAT NOW wordmark variant */
  variant?: 'app' | 'portal' | 'simple';
  title?: string;
  /** Show back button */
  onBack?: () => void;
  /** Right actions */
  rightActions?: React.ReactNode;
  /** Show cart icon with badge */
  cartCount?: number;
  onCartOpen?: () => void;
  /** User avatar + location line (customer app) */
  userGreeting?: string;
  locationLabel?: string;
  avatarUrl?: string;
  className?: string;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  variant = 'app',
  title,
  onBack,
  rightActions,
  cartCount = 0,
  onCartOpen,
  userGreeting,
  locationLabel,
  avatarUrl,
  className = '',
}) => {
  return (
    <header
      className={[
        'fixed top-0 inset-x-0 z-50',
        'h-16 px-6',
        'flex items-center justify-between',
        'border-b border-[rgba(255,255,255,0.08)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        background: 'rgba(17, 20, 23, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* ── Left side ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {onBack ? (
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full flex items-center justify-center
                       text-[var(--color-on-surface-variant)]
                       hover:bg-[rgba(255,255,255,0.07)] hover:text-[var(--color-on-surface)]
                       transition-colors duration-200 cursor-pointer"
            aria-label="Back"
          >
            <Icon name="arrow_back" size={22} />
          </button>
        ) : variant === 'app' && userGreeting ? (
          /* Customer app: avatar + greeting + location */
          <div className="flex items-center gap-2.5">
            {avatarUrl && (
              <div className="w-9 h-9 rounded-full overflow-hidden border border-[rgba(163,249,91,0.2)] shrink-0">
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex flex-col leading-none gap-0.5">
              <span className="text-label-sm text-[var(--color-on-surface-variant)]">{userGreeting}</span>
              {locationLabel && (
                <div className="flex items-center gap-0.5">
                  <Icon name="location_on" size={13} className="text-[var(--color-primary-container)]" />
                  <span className="text-label-md text-[var(--color-on-surface)]">{locationLabel}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* No back + no greeting → optional title */
          title && (
            <h1 className="text-headline-sm text-[var(--color-on-surface)] font-semibold">{title}</h1>
          )
        )}
      </div>

      {/* ── Center wordmark (app variants) ───────────────────── */}
      {variant === 'app' && (
        <div
          className="absolute left-1/2 -translate-x-1/2 text-display-md font-bold tracking-tighter text-[var(--color-primary)]"
          style={{ textShadow: '0 0 20px rgba(255,255,255,0.15)' }}
        >
          HAAT NOW
        </div>
      )}

      {/* ── Right side ────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {rightActions}

        {onCartOpen && (
          <button
            onClick={onCartOpen}
            className="relative w-10 h-10 rounded-full flex items-center justify-center
                       text-[var(--color-on-surface-variant)]
                       hover:bg-[rgba(255,255,255,0.07)] hover:text-[var(--color-on-surface)]
                       transition-colors duration-200 cursor-pointer"
            aria-label={`Cart (${cartCount} items)`}
          >
            <Icon name="shopping_bag" size={22} />
            {cartCount > 0 && (
              <span
                className="absolute -top-0.5 -end-0.5 w-5 h-5 rounded-full flex items-center justify-center
                           text-[var(--color-on-primary)] bg-[var(--color-primary-container)]"
                style={{ fontSize: '10px', fontWeight: 700 }}
              >
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
};

export default TopAppBar;
