import React, { useState, useEffect, useCallback } from 'react';
import { AlertOctagon, RefreshCw, Store, Bike, UserX, PackageX, ShieldAlert } from 'lucide-react';
import { MetricCard, EmptyStateBox, SectionHeader } from '../../components/admin/EnterpriseUI';
import { sandboxStore } from '../../services/sandboxStore';
import { adminCrud } from '../../services/admin-crud.service';
import { useAppConfig } from '../../contexts/AppConfigContext';

// Sandbox = demo failed-order store. Production = real cancelled orders from the orders table
// (never read the sandbox store in live runtime).
const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };

const REASON: Record<string, { ar: string; en: string; Icon: typeof Store; accent: string }> = {
  merchant_rejected: { ar: 'رفض المتجر', en: 'Merchant rejected', Icon: Store, accent: '#f87171' },
  merchant_cancelled: { ar: 'إلغاء المتجر', en: 'Merchant cancelled', Icon: Store, accent: '#fb923c' },
  driver_rejected: { ar: 'رفض الكابتن', en: 'Driver rejected', Icon: Bike, accent: '#fbbf24' },
  failed_pickup: { ar: 'فشل الاستلام', en: 'Failed pickup', Icon: PackageX, accent: '#fb923c' },
  failed_delivery: { ar: 'فشل التسليم', en: 'Failed delivery', Icon: PackageX, accent: '#f87171' },
  customer_refused: { ar: 'رفض العميل الاستلام', en: 'Customer refused', Icon: UserX, accent: '#a78bfa' },
  customer_no_show: { ar: 'العميل غير متواجد', en: 'Customer no-show', Icon: UserX, accent: '#a78bfa' },
};

/**
 * Failed-order / delivery incident log — real failures from the order lifecycle
 * (cancellations carrying a typed failure reason), grouped by cause. Recovery
 * (reassignment) is performed in the Execution Console. Polls every 30s.
 */
export const OpsIncidentLog: React.FC = () => {
  const { lang } = useAppConfig();
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [failed, setFailed] = useState<any[]>([]);
  const load = useCallback(async () => {
    if (SANDBOX) { try { setFailed(sandboxStore.getFailedOrders()); } catch { setFailed([]); } return; }
    // Production: real failed/cancelled orders from the orders table (defensive column mapping).
    try {
      const { data: rows } = await adminCrud('orders').list();
      setFailed(((rows as any[]) || [])
        .filter(o => o.status === 'cancelled')
        .map(o => ({
          id: o.id,
          failureReason: o.failure_reason ?? o.failureReason ?? o.cancellation_reason ?? '',
          failedBy: o.failed_by ?? o.failedBy ?? '—',
          customer_name: o.customer_name,
          total_amount: o.total_amount,
          history: o.history,
        })));
    } catch { setFailed([]); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const byReason = (r: string) => failed.filter(o => o.failureReason === r).length;
  const fmt = (d?: string) => d ? new Date(d).toLocaleString(L('ar', 'en'), { dateStyle: 'short', timeStyle: 'short' }) : '';

  return (
    <div className="space-y-4" id="ops_incident_log" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <SectionHeader title={L('سجل الحوادث والطلبات الفاشلة', 'Failed Orders & Incident Log')}
        action={<button onClick={load} className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-sm font-bold cursor-pointer" style={card}><RefreshCw size={14} />{L('تحديث', 'Refresh')}</button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label={L('إجمالي الفشل', 'Total failures')} value={failed.length} Icon={AlertOctagon} accent={failed.length ? '#f87171' : undefined} />
        <MetricCard label={L('رفض المتجر', 'Merchant rejects')} value={byReason('merchant_rejected') + byReason('merchant_cancelled')} Icon={Store} accent="#fb923c" />
        <MetricCard label={L('فشل التوصيل', 'Delivery failures')} value={byReason('failed_pickup') + byReason('failed_delivery')} Icon={PackageX} accent="#f87171" />
        <MetricCard label={L('مشاكل العميل', 'Customer issues')} value={byReason('customer_refused') + byReason('customer_no_show')} Icon={UserX} accent="#a78bfa" />
      </div>

      <div className="rounded-2xl p-4" style={card}>
        <p className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}><ShieldAlert size={15} color="#f87171" />{L('الحوادث', 'Incidents')}</p>
        {failed.length === 0
          ? <EmptyStateBox Icon={AlertOctagon} title={L('لا توجد حوادث', 'No incidents')} description={L('الطلبات الفاشلة (رفض/تعذّر تسليم) ستظهر هنا للمعالجة.', 'Failed orders (rejected / failed delivery) appear here for recovery.')} />
          : <div className="space-y-2">{failed.slice(0, 20).map(o => {
              const meta = REASON[o.failureReason] || { ar: o.failureReason, en: o.failureReason, Icon: AlertOctagon, accent: '#f87171' };
              return (
                <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--color-surface-container-high)' }}>
                  <meta.Icon size={16} color={meta.accent} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>#{String(o.id).toUpperCase()} · {L(meta.ar, meta.en)}</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{o.customer_name || '—'} · {Number(o.total_amount || 0).toFixed(2)} · {fmt(o.history?.[o.history.length - 1]?.at)}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(248,113,113,0.12)', color: meta.accent }}>{o.failedBy}</span>
                </div>
              );
            })}
            <p className="text-[11px] pt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{L('المعالجة: أعد الإسناد من كونسول التنفيذ أعلاه.', 'Recovery: reassign from the Execution Console above.')}</p>
          </div>}
      </div>
    </div>
  );
};
