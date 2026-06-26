import React, { useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock, TriangleAlert, CheckCheck, Truck, Receipt } from 'lucide-react';
import { merchantSettingsService } from '../../services/merchant-settings.service';

interface KOrder {
  id: string; status: string; total_amount: number; created_at?: string;
  customers?: { full_name?: string };
  order_items?: Array<{ id?: string; quantity: number }>;
}

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 14, padding: 12 };
const money = (n: number) => Number(n || 0).toFixed(2);

// Kitchen lanes mapped onto the real order lifecycle (no fabricated 'ready' status).
const LANES: { key: string; ar: string; en: string; statuses: string[]; color: string; Icon: typeof ChefHat }[] = [
  { key: 'new', ar: 'جديدة', en: 'New', statuses: ['pending'], color: '#fbbf24', Icon: Receipt },
  { key: 'preparing', ar: 'قيد التحضير', en: 'Preparing', statuses: ['accepted', 'preparing'], color: '#60a5fa', Icon: ChefHat },
  { key: 'dispatch', ar: 'خرجت للتوصيل', en: 'Out for delivery', statuses: ['on_the_way'], color: '#9ed442', Icon: Truck },
  { key: 'done', ar: 'مكتملة', en: 'Completed', statuses: ['delivered'], color: '#4ade80', Icon: CheckCheck },
];
const NEXT: Record<string, { status: string; ar: string; en: string }> = {
  pending: { status: 'accepted', ar: 'قبول', en: 'Accept' },
  accepted: { status: 'preparing', ar: 'بدء التحضير', en: 'Start preparing' },
  preparing: { status: 'on_the_way', ar: 'جاهز / إرسال', en: 'Ready / dispatch' },
};

export const KitchenQueue: React.FC<{ orders: KOrder[]; branchId: string; lang: 'ar' | 'en'; onAdvance: (orderId: string, status: string) => void; actionLoading?: boolean }> = ({ orders, branchId, lang, onAdvance, actionLoading }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [now, setNow] = useState(() => Date.now());
  const [prep, setPrep] = useState(20);

  useEffect(() => { merchantSettingsService.get(branchId).then(s => setPrep(merchantSettingsService.effectivePrepTime(s))); }, [branchId]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(t); }, []);

  const elapsedMin = (o: KOrder) => o.created_at ? Math.max(0, Math.floor((now - new Date(o.created_at).getTime()) / 60000)) : null;
  const isDelayed = (o: KOrder) => (o.status === 'accepted' || o.status === 'preparing') && (elapsedMin(o) ?? 0) > prep;
  const itemCount = (o: KOrder) => (o.order_items || []).reduce((s, it) => s + (it.quantity || 0), 0);

  const delayedCount = useMemo(() => orders.filter(isDelayed).length, [orders, now, prep]);

  return (
    <div id="kitchen_queue" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      <div style={card} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <ChefHat size={18} color="var(--color-primary-fixed)" />
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{L('شاشة المطبخ', 'Kitchen display')}</p>
            <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('عتبة التأخير', 'Delay threshold')}: {prep} {L('د', 'min')}</p>
          </div>
        </div>
        {delayedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: '#f8717122', color: '#f87171' }}>
            <TriangleAlert size={13} />{delayedCount} {L('طلب متأخّر', 'delayed')}
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {LANES.map(lane => {
          const laneOrders = orders.filter(o => lane.statuses.includes(o.status))
            .sort((a, b) => (isDelayed(b) ? 1 : 0) - (isDelayed(a) ? 1 : 0));
          return (
            <div key={lane.key} className="space-y-2" role="region" aria-label={L(lane.ar, lane.en)}>
              <div className="flex items-center justify-between px-1">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: lane.color }}><lane.Icon size={15} />{L(lane.ar, lane.en)}</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${lane.color}22`, color: lane.color }}>{laneOrders.length}</span>
              </div>
              {laneOrders.length === 0 ? (
                <div style={{ ...card, opacity: 0.55 }} className="text-center text-[11px] py-4">{L('لا طلبات', 'No orders')}</div>
              ) : laneOrders.map(o => {
                const delayed = isDelayed(o); const el = elapsedMin(o);
                const nx = NEXT[o.status];
                return (
                  <div key={o.id} style={{ ...card, border: delayed ? '1px solid #f87171' : card.border }} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono" style={{ color: 'var(--color-on-surface-variant)' }}>#{o.id.slice(-6).toUpperCase()}</span>
                      {el != null && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: delayed ? '#f87171' : 'var(--color-on-surface-variant)' }}>
                          <Clock size={11} />{el} {L('د', 'm')}{delayed ? ` · ${L('متأخّر', 'late')}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>{o.customers?.full_name || L('عميل', 'Customer')}</p>
                    <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                      <span>{itemCount(o)} {L('صنف', 'items')}</span>
                      <span className="font-bold" style={{ color: 'var(--color-primary-fixed)' }}>{money(o.total_amount)}</span>
                    </div>
                    {nx && (
                      <button onClick={() => onAdvance(o.id, nx.status)} disabled={actionLoading}
                        className="w-full h-9 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                        style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>
                        {L(nx.ar, nx.en)}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
