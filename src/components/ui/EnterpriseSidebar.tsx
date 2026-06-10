import React from 'react';
import { Icon } from './Icon';

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  badge?: number | string;
  danger?: boolean;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

interface EnterpriseSidebarProps {
  sections: SidebarSection[];
  activeId: string;
  onSelect: (id: string) => void;
  logo?: React.ReactNode;
  brandName?: string;
  brandSubtitle?: string;
  userInfo?: {
    name: string;
    role: string;
    avatarUrl?: string;
  };
  footer?: React.ReactNode;
  className?: string;
}

export const EnterpriseSidebar: React.FC<EnterpriseSidebarProps> = ({
  sections,
  activeId,
  onSelect,
  logo,
  brandName = 'HAAT NOW',
  brandSubtitle,
  userInfo,
  footer,
  className = '',
}) => {
  return (
    <aside
      className={[
        'hidden md:flex flex-col',
        'fixed top-0 start-0 h-screen z-40',
        'py-6 px-4',
        'border-e border-[rgba(255,255,255,0.05)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        width: 'var(--spacing-sidebar)',
        background: 'var(--color-surface-container-low)',
      }}
    >
      {/* Brand */}
      <div className="px-2 mb-8">
        {logo ? (
          logo
        ) : (
          <div>
            <p
              className="text-display-md font-bold tracking-tighter text-[var(--color-primary)]"
              style={{ lineHeight: '1.1' }}
            >
              {brandName}
            </p>
            {brandSubtitle && (
              <p className="text-label-sm text-[var(--color-on-surface-variant)] mt-1">
                {brandSubtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* User info */}
      {userInfo && (
        <div
          className="flex items-center gap-3 p-3 rounded-[var(--radius-lg)] mb-6"
          style={{
            background: 'rgba(163, 249, 91, 0.06)',
            border: '1px solid rgba(163, 249, 91, 0.12)',
          }}
        >
          {userInfo.avatarUrl ? (
            <img
              src={userInfo.avatarUrl}
              alt={userInfo.name}
              className="w-9 h-9 rounded-full object-cover border border-[rgba(255,255,255,0.1)]"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-on-primary)] text-headline-sm font-bold"
              style={{ background: 'var(--color-primary-container)' }}
            >
              {userInfo.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-label-md font-semibold text-[var(--color-on-surface)] truncate">
              {userInfo.name}
            </p>
            <p className="text-label-sm text-[var(--color-on-surface-variant)] truncate" style={{ textTransform: 'none' }}>
              {userInfo.role}
            </p>
          </div>
        </div>
      )}

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto space-y-6">
        {sections.map((section, si) => (
          <div key={si}>
            {section.title && (
              <p className="text-label-sm text-[var(--color-on-surface-variant)] px-3 mb-2">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={[
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-lg)]',
                      'text-label-md font-medium text-start',
                      'transition-all duration-200 cursor-pointer',
                      isActive
                        ? 'bg-[var(--color-secondary-container)] text-[var(--color-on-secondary-container)]'
                        : item.danger
                        ? 'text-[var(--color-error)] hover:bg-[rgba(255,180,171,0.08)]'
                        : 'text-[var(--color-on-surface-variant)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--color-on-surface)]',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <Icon
                      name={item.icon}
                      fill={isActive ? 1 : 0}
                      size={20}
                      className="shrink-0"
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className="text-label-sm px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                        style={{
                          background: isActive
                            ? 'rgba(163,249,91,0.2)'
                            : 'rgba(255,255,255,0.08)',
                          color: isActive
                            ? 'var(--color-primary-container)'
                            : 'var(--color-on-surface-variant)',
                          textTransform: 'none',
                          letterSpacing: 0,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {footer && (
        <div className="pt-4 border-t border-[rgba(255,255,255,0.05)]">{footer}</div>
      )}
    </aside>
  );
};

export default EnterpriseSidebar;
