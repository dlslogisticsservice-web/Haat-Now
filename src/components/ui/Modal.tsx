import React, { useEffect } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';

// ── Modal ─────────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

const modalSizes = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-2xl',
  full: 'max-w-full mx-4',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className = '',
}) => {
  // Trap focus / prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      />

      {/* Panel */}
      <div
        className={[
          'relative z-10 w-full rounded-[var(--radius-2xl)]',
          'animate-slide-up',
          modalSizes[size],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          background: 'var(--color-surface-container-high)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || onClose) && (
          <div className="flex items-start justify-between p-6 pb-0">
            <div className="flex-1">
              {title && (
                <h2 className="text-headline-sm text-[var(--color-on-surface)] font-semibold">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-body-md text-[var(--color-on-surface-variant)] mt-1">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center
                         text-[var(--color-on-surface-variant)]
                         hover:bg-[rgba(255,255,255,0.07)] hover:text-[var(--color-on-surface)]
                         transition-colors ml-4 shrink-0 cursor-pointer"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        )}

        {/* Body */}
        {children && <div className="p-6">{children}</div>}

        {/* Footer */}
        {footer && (
          <div className="px-6 pb-6 pt-2 flex gap-3 justify-end border-t border-[rgba(255,255,255,0.06)] pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Drawer — slides up from bottom (mobile) ───────────────────
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  heightClass?: string; // e.g. 'h-[85vh]', 'max-h-[90vh]'
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  heightClass = 'max-h-[90vh]',
}) => {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end" onClick={onClose}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      />

      {/* Sheet */}
      <div
        className={[
          'relative z-10 w-full flex flex-col',
          'rounded-t-[var(--radius-2xl)]',
          'animate-slide-up',
          heightClass,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          background: 'var(--color-surface-container)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-12 h-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-3">
            <h2 className="text-headline-sm text-[var(--color-on-surface)] font-semibold">{title}</h2>
            <Button variant="icon" size="sm" onClick={onClose}>
              <Icon name="close" size={18} />
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 pt-3 border-t border-[rgba(255,255,255,0.06)] safe-sheet-action">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Toast ─────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
}

const toastStyles: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: 'rgba(101,253,175,0.15)', icon: 'check_circle' },
  error:   { bg: 'rgba(255,180,171,0.15)', icon: 'error' },
  info:    { bg: 'rgba(163,249,91,0.12)',  icon: 'info' },
};

const toastTextColor: Record<ToastType, string> = {
  success: 'var(--color-tertiary-container)',
  error:   'var(--color-error)',
  info:    'var(--color-primary-container)',
};

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', visible }) => {
  if (!visible) return null;
  const { bg, icon } = toastStyles[type];
  const color = toastTextColor[type];

  return (
    <div
      className="fixed bottom-24 inset-x-0 flex justify-center z-[200] px-6 animate-slide-up"
    >
      <div
        className="flex items-center gap-3 px-5 py-3 rounded-full"
        style={{
          background: bg,
          border: `1px solid ${color}40`,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          color,
        }}
      >
        <Icon name={icon} size={18} fill={1} />
        <span className="text-label-md font-medium" style={{ color }}>{message}</span>
      </div>
    </div>
  );
};

export default Modal;
