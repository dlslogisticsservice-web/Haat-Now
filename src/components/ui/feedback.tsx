import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

// ── Unified, design-system feedback layer ────────────────────────────────────
// Imperative `toast.*` + promise-based `confirmDialog` replace browser
// alert()/window.confirm() everywhere. A single <FeedbackHost/> mounted at the
// app root renders them. Module-level store so any module can call without props.

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string }
interface ConfirmReq {
  id: number; title?: string; message: string; confirmText?: string; cancelText?: string;
  danger?: boolean; resolve: (v: boolean) => void;
}

let _id = 0;
let toasts: ToastItem[] = [];
let confirms: ConfirmReq[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const toast = {
  show(message: string, kind: ToastKind = 'info') {
    const id = ++_id;
    toasts = [...toasts, { id, kind, message }];
    emit();
    setTimeout(() => { toasts = toasts.filter(t => t.id !== id); emit(); }, 4200);
  },
  success(m: string) { this.show(m, 'success'); },
  error(m: string) { this.show(m, 'error'); },
  info(m: string) { this.show(m, 'info'); },
};

/** Promise-based confirmation. Resolves true on confirm, false on cancel/esc. */
export function confirmDialog(opts: { title?: string; message: string; confirmText?: string; cancelText?: string; danger?: boolean }): Promise<boolean> {
  return new Promise(resolve => {
    const id = ++_id;
    confirms = [...confirms, { id, ...opts, resolve }];
    emit();
  });
}
const settle = (id: number, val: boolean) => {
  const c = confirms.find(x => x.id === id);
  if (c) { c.resolve(val); confirms = confirms.filter(x => x.id !== id); emit(); }
};

const TOAST_CFG: Record<ToastKind, { Icon: typeof Info; color: string }> = {
  success: { Icon: CheckCircle2, color: '#4ade80' },
  error: { Icon: AlertCircle, color: '#f87171' },
  info: { Icon: Info, color: 'var(--color-on-surface-variant)' },
};

const ConfirmModal: React.FC<{ req: ConfirmReq; lang: 'ar' | 'en' }> = ({ req, lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(req.id, false);
      if (e.key === 'Enter') settle(req.id, true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [req.id]);
  const accent = req.danger ? '#f87171' : 'var(--color-primary-fixed)';
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={() => settle(req.id, false)} role="dialog" aria-modal="true" aria-label={req.title || req.message} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1f` }}>
            <AlertTriangle size={20} color={accent} />
          </span>
          <div className="min-w-0">
            {req.title && <p className="font-bold text-[15px]" style={{ color: 'var(--color-on-surface)' }}>{req.title}</p>}
            <p className="text-sm mt-0.5 leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{req.message}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => settle(req.id, false)} className="px-4 py-2 rounded-xl text-sm font-bold cursor-pointer"
            style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
            {req.cancelText || L('إلغاء', 'Cancel')}
          </button>
          <button ref={confirmRef} onClick={() => settle(req.id, true)} className="px-4 py-2 rounded-xl text-sm font-bold cursor-pointer outline-none focus:ring-2"
            style={{ background: accent, color: req.danger ? '#fff' : 'var(--color-on-primary-fixed)' }}>
            {req.confirmText || (req.danger ? L('حذف', 'Delete') : L('تأكيد', 'Confirm'))}
          </button>
        </div>
      </div>
    </div>
  );
};

export const FeedbackHost: React.FC<{ lang?: 'ar' | 'en' }> = ({ lang = 'ar' }) => {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(x => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      {/* Toasts */}
      <div className="fixed inset-x-0 z-[210] flex flex-col items-center gap-2 px-4 pointer-events-none"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {toasts.map(t => {
          const { Icon, color } = TOAST_CFG[t.kind];
          return (
            <div key={t.id} role="status" className="pointer-events-auto w-full max-w-sm rounded-xl px-3.5 py-3 flex items-center gap-2.5 animate-[fadeIn_.2s_ease]"
              style={{ background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}>
              <Icon size={18} color={color} className="shrink-0" />
              <p className="text-sm flex-1" style={{ color: 'var(--color-on-surface)' }}>{t.message}</p>
              <button onClick={() => { toasts = toasts.filter(x => x.id !== t.id); emit(); }} aria-label="dismiss" className="cursor-pointer shrink-0">
                <X size={15} color="var(--color-on-surface-variant)" />
              </button>
            </div>
          );
        })}
      </div>
      {/* Confirm dialogs (one at a time) */}
      {confirms.length > 0 && <ConfirmModal req={confirms[confirms.length - 1]} lang={lang} />}
    </>,
    document.body,
  );
};
