import React, { useEffect, useState, useCallback } from 'react';
import { Timer, AlertTriangle, XCircle, CheckCircle2, RefreshCw, Activity } from 'lucide-react';
import { MetricCard, EmptyStateBox, SectionHeader } from '../../components/admin/EnterpriseUI';
import { adminCrud } from '../../services/admin-crud.service';
import { useAppConfig } from '../../contexts/AppConfigContext';

// Fallback only. The real target now lives in the `sla_targets` table and is loaded
// below, so operations can retune the threshold without a redeploy.
const SLA_FALLBACK_MINUTES = 45;
// These MUST match the order status vocabulary the database actually uses
// (services/types.ts + 20260614000012). The previous list contained 'confirmed' and
// 'delivering', which exist nowhere in this schema, and omitted 'accepted' and
// 'on_the_way' — the two states most likely to be breaching SLA. The monitor was
// therefore silently blind to in-flight orders.
const ACTIVE = ['pending', 'accepted', 'preparing', 'on_the_way'];
const FAILED = ['cancelled', 'rejected'];
const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };

/**
 * SLA & Incident monitor — real operational health computed from actual order rows
 * (status + created_at). Delayed = active order older than the SLA. Failed = cancelled/
 * rejected. Success rate = delivered / (delivered + failed). No fake statistics.
 * Polls every 30s. Reuses EnterpriseUI primitives. Responsive · RTL/LTR · dark.
 */
export const OpsSlaMonitor: React.FC = () => {
  const { lang } = useAppConfig();
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // The delivery SLA is operator-configurable (sla_targets). Falls back to the
  // previously hardcoded 45 minutes if the row is absent, so this never renders blank.
  const [slaMinutes, setSlaMinutes] = useState(SLA_FALLBACK_MINUTES);

  const load = useCallback(async () => {
    const { data } = await adminCrud('orders').list();
    setOrders(data); setLoading(false);
    try {
      const { data: targets } = await adminCrud('sla_targets').list();
      const t = (targets ?? []).find((r: any) => r.metric === 'order_delivery' && !r.zone_id && r.is_active !== false);
      if (t?.target_minutes) setSlaMinutes(Number(t.target_minutes));
    } catch { /* targets unavailable — the fallback threshold still applies */ }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const now = Date.now();
  const ageMin = (o: any) => (o.created_at ? Math.max(0, Math.round((now - new Date(o.created_at).getTime()) / 60000)) : null);
  const active = orders.filter(o => ACTIVE.includes(o.status));
  const delayed = active.map(o => ({ ...o, _age: ageMin(o) })).filter(o => o._age !== null && o._age > slaMinutes).sort((a, b) => (b._age || 0) - (a._age || 0));
  const failed = orders.filter(o => FAILED.includes(o.status));
  const delivered = orders.filter(o => o.status === 'delivered');
  const successRate = (delivered.length + failed.length) > 0 ? Math.round((delivered.length / (delivered.length + failed.length)) * 100) : 100;

  return (
    <div className="space-y-4" id="ops_sla_monitor" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <SectionHeader title={L('مراقبة SLA والحوادث', 'SLA & Incident Monitor')}
        action={<button onClick={load} className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-sm font-bold cursor-pointer" style={card}><RefreshCw size={14} />{L('تحديث', 'Refresh')}</button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label={L('طلبات متأخرة', 'Delayed orders')} value={delayed.length} Icon={Timer} accent={delayed.length ? '#f87171' : undefined} hint={L(`> ${slaMinutes} دقيقة`, `> ${slaMinutes} min`)} />
        <MetricCard label={L('توصيلات فاشلة', 'Failed deliveries')} value={failed.length} Icon={XCircle} accent="#fb923c" />
        <MetricCard label={L('طلبات نشطة', 'Active orders')} value={active.length} Icon={Activity} accent="#60a5fa" />
        <MetricCard label={L('نسبة النجاح', 'Success rate')} value={`${successRate}%`} Icon={CheckCircle2} accent="#9ed442" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Delayed orders */}
        <div className="rounded-2xl p-4" style={card}>
          <p className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}><AlertTriangle size={15} color="#f87171" />{L('الطلبات المتأخرة', 'Delayed orders')}</p>
          {loading ? <p className="text-xs text-center py-4" style={{ color: 'var(--color-on-surface-variant)' }}>…</p>
            : delayed.length === 0 ? <EmptyStateBox Icon={CheckCircle2} title={L('لا توجد طلبات متأخرة', 'No delayed orders')} description={L('كل الطلبات النشطة ضمن SLA.', 'All active orders are within SLA.')} />
            : <div className="space-y-2">{delayed.slice(0, 10).map(o => (
                <div key={o.id} className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: 'var(--color-surface-container-high)' }}>
                  <span className="text-xs font-bold" style={{ color: '#f87171' }}>{o._age} {L('دقيقة', 'min')}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>#{String(o.id).slice(0, 8)} · {o.status}</span>
                </div>))}</div>}
        </div>
        {/* Failed deliveries */}
        <div className="rounded-2xl p-4" style={card}>
          <p className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}><XCircle size={15} color="#fb923c" />{L('التوصيلات الفاشلة', 'Failed deliveries')}</p>
          {loading ? <p className="text-xs text-center py-4" style={{ color: 'var(--color-on-surface-variant)' }}>…</p>
            : failed.length === 0 ? <EmptyStateBox Icon={CheckCircle2} title={L('لا توجد توصيلات فاشلة', 'No failed deliveries')} />
            : <div className="space-y-2">{failed.slice(0, 10).map(o => (
                <div key={o.id} className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: 'var(--color-surface-container-high)' }}>
                  <span className="text-xs font-bold" style={{ color: '#fb923c' }}>{o.status}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>#{String(o.id).slice(0, 8)} · {Number(o.total_amount || 0).toFixed(2)}</span>
                </div>))}</div>}
        </div>
      </div>
    </div>
  );
};
