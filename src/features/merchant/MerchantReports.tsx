import React, { useMemo } from 'react';
import { Card } from '../../components/ui';
import { TrendingUp, Clock, Users, PieChart, Gauge, BarChart3 } from 'lucide-react';

type Ord = { id: string; status: string; total_amount: number; created_at: string; customers?: { full_name?: string } };

const G = 'var(--color-primary-fixed)';
const VAR = 'var(--color-on-surface-variant)';
const SURF = 'var(--color-on-surface)';

/**
 * Merchant analytics — sales trend, peak hours, best customers, status mix and
 * delivery performance, all computed from the merchant's REAL orders (no mock data).
 * Pure SVG charts (no chart lib), bilingual, dark, responsive. Renders honest empty
 * states when a section has no data yet.
 */
export const MerchantReports: React.FC<{ orders: Ord[]; lang: 'ar' | 'en'; cur: string; money: (n: number) => string }> = ({ orders, lang, cur, money }) => {
  const D = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  const m = useMemo(() => {
    const delivered = orders.filter(o => o.status === 'delivered');
    const completion = orders.length ? Math.round((delivered.length / orders.length) * 100) : 0;

    // 7-day revenue trend
    const days: { label: string; val: number }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const rev = orders.filter(o => { const t = new Date(o.created_at).getTime(); return t >= d.getTime() && t < next.getTime(); })
        .reduce((s, o) => s + (o.total_amount || 0), 0);
      days.push({ label: d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en', { weekday: 'short' }), val: rev });
    }

    // Peak hours (24 buckets)
    const hours = Array.from({ length: 24 }, () => 0);
    orders.forEach(o => { const h = new Date(o.created_at).getHours(); if (h >= 0 && h < 24) hours[h]++; });
    const peakHour = hours.indexOf(Math.max(...hours));

    // Best customers by spend
    const byCust: Record<string, number> = {};
    orders.forEach(o => { const n = o.customers?.full_name || D('عميل', 'Guest'); byCust[n] = (byCust[n] || 0) + (o.total_amount || 0); });
    const best = Object.entries(byCust).map(([name, val]) => ({ name, val })).sort((a, b) => b.val - a.val).slice(0, 5);

    // Status mix
    const statuses: Record<string, number> = {};
    orders.forEach(o => { statuses[o.status] = (statuses[o.status] || 0) + 1; });

    return { delivered, completion, days, hours, peakHour, best, statuses, total: orders.length };
  }, [orders, lang]);

  const Empty = ({ label }: { label: string }) => (
    <div className="h-28 flex items-center justify-center text-sm" style={{ color: VAR }}>{label}</div>
  );
  const SectionTitle = ({ Icon, children }: any) => (
    <div className="flex items-center gap-2 mb-4 justify-end">
      <h3 className="text-headline-sm font-semibold" style={{ color: SURF }}>{children}</h3>
      <Icon size={18} color={G} />
    </div>
  );

  const maxRev = Math.max(1, ...m.days.map(d => d.val));
  const maxHour = Math.max(1, ...m.hours);
  const maxCust = Math.max(1, ...m.best.map(b => b.val));
  const statusColor: Record<string, string> = { delivered: '#4ade80', cancelled: '#f87171', preparing: '#fbbf24', ready: '#38bdf8', on_the_way: '#a78bfa', pending: '#9ca3af', accepted: '#60a5fa' };
  const statusLabel = (s: string) => ({ delivered: D('مكتمل', 'Delivered'), cancelled: D('ملغي', 'Cancelled'), preparing: D('تحضير', 'Preparing'), ready: D('جاهز', 'Ready'), on_the_way: D('بالطريق', 'On way'), pending: D('معلّق', 'Pending'), accepted: D('مقبول', 'Accepted') } as any)[s] || s;

  return (
    <div className="space-y-4" id="merchant_reports">
      {/* Top KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: D('إجمالي الطلبات', 'Total orders'), val: String(m.total), Icon: BarChart3 },
          { label: D('معدل الإكمال', 'Completion rate'), val: `${m.completion}%`, Icon: Gauge },
          { label: D('إيراد 7 أيام', '7-day revenue'), val: money(m.days.reduce((s, d) => s + d.val, 0)), Icon: TrendingUp },
          { label: D('ساعة الذروة', 'Peak hour'), val: m.total ? `${m.peakHour}:00` : '—', Icon: Clock },
        ].map(c => (
          <Card key={c.label} variant="z2" radius="xl" padding="p-4">
            <div className="flex items-center justify-between mb-1"><c.Icon size={15} color={G} /><p className="text-label-sm" style={{ color: VAR }}>{c.label}</p></div>
            <p className="text-title-lg font-bold text-end" style={{ color: 'var(--color-primary-container)' }}>{c.val}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales trend */}
        <Card variant="z3" radius="xl" padding="p-6">
          <SectionTitle Icon={TrendingUp}>{D('مبيعات آخر 7 أيام', 'Sales — last 7 days')}</SectionTitle>
          {m.days.every(d => d.val === 0) ? <Empty label={D('لا توجد مبيعات بعد', 'No sales yet')} /> : (
            <svg viewBox="0 0 100 44" className="w-full" style={{ height: 140 }}>
              {m.days.map((d, i) => {
                const bw = 100 / m.days.length, x = i * bw, h = (d.val / maxRev) * 34;
                return (<g key={i}>
                  <rect x={x + bw * 0.18} y={38 - h} width={bw * 0.64} height={h} rx="1" fill={G} opacity={0.85} />
                  <text x={x + bw / 2} y={43} fontSize="2.6" textAnchor="middle" fill={VAR}>{d.label}</text>
                </g>);
              })}
            </svg>
          )}
        </Card>

        {/* Peak hours */}
        <Card variant="z3" radius="xl" padding="p-6">
          <SectionTitle Icon={Clock}>{D('ساعات الذروة', 'Peak hours')}</SectionTitle>
          {m.total === 0 ? <Empty label={D('لا توجد بيانات', 'No data yet')} /> : (
            <svg viewBox="0 0 100 44" className="w-full" style={{ height: 140 }}>
              {m.hours.map((c, h) => {
                const bw = 100 / 24, x = h * bw, ht = (c / maxHour) * 34;
                return <rect key={h} x={x + bw * 0.12} y={38 - ht} width={bw * 0.76} height={ht} rx="0.5" fill={h === m.peakHour ? G : 'var(--color-surface-container-highest)'} />;
              })}
              {[0, 6, 12, 18].map(h => <text key={h} x={(h / 24) * 100 + 2} y={43} fontSize="2.6" fill={VAR}>{h}h</text>)}
            </svg>
          )}
        </Card>

        {/* Best customers */}
        <Card variant="z3" radius="xl" padding="p-6">
          <SectionTitle Icon={Users}>{D('أفضل العملاء', 'Best customers')}</SectionTitle>
          {m.best.length === 0 ? <Empty label={D('لا يوجد عملاء بعد', 'No customers yet')} /> : (
            <div className="space-y-2.5">
              {m.best.map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-label-sm w-16 shrink-0 text-end" style={{ color: SURF }}>{money(b.val)}</span>
                  <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-highest)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(b.val / maxCust) * 100}%`, background: G }} />
                  </div>
                  <span className="text-label-md truncate max-w-[40%] text-end" style={{ color: VAR }} dir="rtl">{b.name}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Order status mix + delivery performance */}
        <Card variant="z3" radius="xl" padding="p-6">
          <SectionTitle Icon={PieChart}>{D('توزيع الطلبات والأداء', 'Status mix & performance')}</SectionTitle>
          {m.total === 0 ? <Empty label={D('لا توجد طلبات بعد', 'No orders yet')} /> : (
            <div className="space-y-4">
              <div className="flex h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-highest)' }}>
                {Object.entries(m.statuses).map(([s, c]) => (
                  <div key={s} title={statusLabel(s)} style={{ width: `${(c / m.total) * 100}%`, background: statusColor[s] || '#9ca3af' }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-end">
                {Object.entries(m.statuses).map(([s, c]) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <span className="text-label-sm" style={{ color: VAR }}>{statusLabel(s)} · {c}</span>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: statusColor[s] || '#9ca3af' }} />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <span className="text-title-md font-bold" style={{ color: m.completion >= 80 ? '#4ade80' : '#fbbf24' }}>{m.completion}%</span>
                <span className="text-label-md" style={{ color: VAR }}>{D('معدل إكمال التوصيل', 'Delivery completion rate')}</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
