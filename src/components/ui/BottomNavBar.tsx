import React from 'react';
import { Icon } from './Icon';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  iconFilled: string;
  badge?: number;
}

interface BottomNavBarProps {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  items,
  activeId,
  onSelect,
  className = '',
}) => {
  return (
    <nav
      className={[
        'fixed bottom-0 inset-x-0 z-40',
        'px-4 pb-safe-area-inset-bottom',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Floating bar */}
      <div
        className="mx-auto max-w-sm mb-4 rounded-[var(--radius-2xl)] flex items-center justify-around py-2 px-2"
        style={{
          background: 'rgba(17, 20, 23, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {items.map((item) => {
          const isActive = item.id === activeId;

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={[
                'relative flex flex-col items-center gap-1 py-2 px-4 rounded-[var(--radius-lg)]',
                'transition-all duration-200 cursor-pointer select-none min-w-[64px]',
                isActive
                  ? 'text-[var(--color-primary-container)]'
                  : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active background pill */}
              {isActive && (
                <div
                  className="absolute inset-0 rounded-[var(--radius-lg)]"
                  style={{
                    background: 'rgba(163, 249, 91, 0.1)',
                  }}
                />
              )}

              {/* Icon */}
              <div className="relative z-10">
                {item.badge && item.badge > 0 ? (
                  <div className="relative">
                    <Icon
                      name={isActive ? item.iconFilled : item.icon}
                      fill={isActive ? 1 : 0}
                      size={24}
                    />
                    <span
                      className="absolute -top-1.5 -end-1.5 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center
                                 bg-[var(--color-error)] text-[var(--color-on-error)]"
                      style={{ fontSize: '9px', fontWeight: 700, lineHeight: 1 }}
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  </div>
                ) : (
                  <Icon
                    name={isActive ? item.iconFilled : item.icon}
                    fill={isActive ? 1 : 0}
                    size={24}
                  />
                )}
              </div>

              {/* Label */}
              <span
                className="relative z-10 text-center leading-none"
                style={{ fontSize: '11px', fontWeight: isActive ? 600 : 400 }}
              >
                {item.label}
              </span>

              {/* Active indicator dot */}
              {isActive && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: 'var(--color-primary-container)' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

// ── Customer nav items ────────────────────────────────────────
export const CUSTOMER_NAV_ITEMS: NavItem[] = [
  { id: 'home',    label: 'الرئيسية', icon: 'home',         iconFilled: 'home' },
  { id: 'orders',  label: 'طلباتي',   icon: 'receipt_long', iconFilled: 'receipt_long' },
  { id: 'wallet',  label: 'المحفظة',  icon: 'account_balance_wallet', iconFilled: 'account_balance_wallet' },
  { id: 'offers',  label: 'العروض',   icon: 'local_offer',  iconFilled: 'local_offer' },
  { id: 'profile', label: 'حسابي',    icon: 'person',       iconFilled: 'person' },
];

export default BottomNavBar;
