import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Search, X, Clock, User, Truck, Store, Package, Receipt, CornerDownLeft } from 'lucide-react';
import { adminService, GlobalSearchResult, GlobalSearchType } from '../../services/admin.service';
import type { NavKey } from './AdminSidebar';

const RECENT_KEY = 'haat_admin_recent_search';
const typeIcon: Record<GlobalSearchType, typeof User> = { customer: User, driver: Truck, merchant: Store, product: Package, order: Receipt };
const typeLabel = (t: GlobalSearchType, ar: boolean): string => ({
  customer: ar ? 'عميل' : 'Customer', driver: ar ? 'سائق' : 'Driver', merchant: ar ? 'متجر' : 'Merchant',
  product: ar ? 'منتج' : 'Product', order: ar ? 'طلب' : 'Order',
}[t]);

const highlight = (text: string, q: string): React.ReactNode => {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', borderRadius: 3, padding: '0 1px' }}>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
};

export const GlobalSearch: React.FC<{ open: boolean; onClose: () => void; lang: 'ar' | 'en'; onNavigate: (k: NavKey) => void }> = ({ open, onClose, lang, onNavigate }) => {
  const ar = lang === 'ar';
  const L = (a: string, e: string) => (ar ? a : e);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')); } catch { /* ignore */ }
    } else { setQ(''); setResults([]); setActive(0); }
  }, [open]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const { data } = await adminService.globalSearch(q);
      setResults(data); setActive(0); setLoading(false);
    }, 220);
    return () => clearTimeout(timer.current);
  }, [q]);

  const saveRecent = (term: string) => {
    const next = [term, ...recent.filter(r => r !== term)].slice(0, 6);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const pick = useCallback((r: GlobalSearchResult) => {
    saveRecent(q.trim());
    onNavigate(r.navKey as NavKey);
    onClose();
  }, [q, recent, onNavigate, onClose]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return onClose();
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && results[active]) { e.preventDefault(); pick(results[active]); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div dir={ar ? 'rtl' : 'ltr'} className="w-full max-w-xl rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
          <Search size={18} color="var(--color-on-surface-variant)" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder={L('ابحث في الطلبات والعملاء والسائقين والمتاجر…', 'Search orders, customers, drivers, merchants…')}
            className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--color-on-surface)' }} />
          {loading && <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('بحث…', 'Searching…')}</span>}
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-[var(--color-surface-container-high)]"><X size={15} color="var(--color-on-surface-variant)" /></button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <div className="p-4">
              {recent.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--color-on-surface-variant)' }}>{L('ابدأ الكتابة للبحث في كل المنصة', 'Type to search across the whole platform')}</p>
              ) : (
                <>
                  <p className="text-[11px] font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-on-surface-variant)' }}><Clock size={12} />{L('عمليات بحث سابقة', 'Recent searches')}</p>
                  <div className="flex flex-wrap gap-2">
                    {recent.map(r => <button key={r} onClick={() => setQ(r)} className="px-2.5 py-1 rounded-lg text-xs cursor-pointer" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>{r}</button>)}
                  </div>
                </>
              )}
            </div>
          ) : results.length === 0 && !loading ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لا توجد نتائج', 'No results')}</p>
          ) : (
            <div className="py-1.5">
              {results.map((r, i) => {
                const Icon = typeIcon[r.type];
                return (
                  <button key={`${r.type}-${r.id}`} onClick={() => pick(r)} onMouseEnter={() => setActive(i)}
                    className="w-full text-start px-4 py-2.5 flex items-center gap-3 cursor-pointer" style={{ background: i === active ? 'var(--color-surface-container-high)' : 'transparent' }}>
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-surface-container-lowest)' }}><Icon size={15} color="var(--color-on-surface-variant)" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>{highlight(r.title || '', q)}</p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--color-on-surface-variant)' }}>{r.subtitle}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0" style={{ background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface-variant)' }}>{typeLabel(r.type, ar)}</span>
                    {i === active && <CornerDownLeft size={13} color="var(--color-on-surface-variant)" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-4 py-2 flex items-center gap-3 text-[10px]" style={{ borderTop: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
          <span>↑↓ {L('تنقّل', 'navigate')}</span><span>↵ {L('فتح', 'open')}</span><span>esc {L('إغلاق', 'close')}</span>
        </div>
      </div>
    </div>
  );
};
