import React, { useEffect, useState } from 'react';
import { ClipboardList, UserRound, Truck, Building2, Clock, CreditCard } from 'lucide-react';
import { Drawer } from '../../../components/ui/Modal';
import { MetricCard, EmptyStateBox, StatusBadge } from '../../../components/admin/EnterpriseUI';
import { toast } from '../../../components/ui/feedback';
import { WsHeader, WsRow, WsTabBar, wsCard, wsFmt, wsResolve, type WsTab } from './shell';
import { adminCrud } from '../../../services/admin-crud.service';

const TABS: WsTab[] = [
  { k: 'summary', ar: 'الملخّص', en: 'Summary', Icon: ClipboardList },
  { k: 'parties', ar: 'الأطراف', en: 'Parties', Icon: UserRound },
  { k: 'payment', ar: 'الدفع', en: 'Payment', Icon: CreditCard },
  { k: 'timeline', ar: 'النشاط', en: 'Timeline', Icon: Clock },
];
const STATUSES = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled'];

/** Order workspace — real order + resolved customer/driver/branch + status quick-action. */
export const OrderWorkspace: React.FC<{ order: any; lang: 'ar' | 'en'; onClose: () => void }> = ({ order, lang, onClose }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tab, setTab] = useState('summary');
  const [status, setStatus] = useState<string>(order.status || 'pending');
  const [parties, setParties] = useState<{ customer: string; driver: string; branch: string }>({ customer: '', driver: '', branch: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [customer, driver, branch] = await Promise.all([
        wsResolve('customers', order.customer_id, 'full_name'),
        wsResolve('drivers', order.driver_id, 'full_name'),
        wsResolve('merchant_branches', order.branch_id, 'name'),
      ]);
      if (alive) setParties({ customer, driver, branch });
    })();
    return () => { alive = false; };
  }, [order.id]);

  const saveStatus = async () => {
    setSaving(true);
    const { error } = await adminCrud('orders').update(order.id, { status });
    setSaving(false);
    if (error) { toast.error(L('تعذّر تحديث الحالة', 'Could not update status')); return; }
    toast.success(L('تم تحديث حالة الطلب', 'Order status updated'));
  };

  return (
    <Drawer open onClose={onClose} heightClass="max-h-[92vh]" title={L('ملف الطلب', 'Order workspace')}
      footer={
        <div className="flex gap-2 items-center">
          <select value={status} onChange={e => setStatus(e.target.value)} className="flex-1 h-11 rounded-xl px-3 text-sm font-semibold" style={{ ...wsCard, color: 'var(--color-on-surface)' }}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={saveStatus} disabled={saving} className="flex-1 h-11 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-40" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>{saving ? L('جارٍ…', 'Saving…') : L('تحديث الحالة', 'Update status')}</button>
        </div>
      }>
      <div className="px-4 pb-4 space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'} id="order_workspace">
        <WsHeader Icon={ClipboardList} title={`#${String(order.id).slice(0, 8)}`} subtitle={wsFmt(lang, order.created_at)}
          badge={<StatusBadge kind={status === 'delivered' ? 'success' : status === 'cancelled' ? 'error' : 'pending'} label={status} />} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <MetricCard label={L('الحالة', 'Status')} value={status} Icon={ClipboardList} />
          <MetricCard label={L('المبلغ', 'Amount')} value={Number(order.total_amount || 0).toFixed(2)} Icon={CreditCard} accent="#9ed442" />
          <MetricCard label={L('العميل', 'Customer')} value={parties.customer || '—'} Icon={UserRound} />
          <MetricCard label={L('المندوب', 'Driver')} value={parties.driver || '—'} Icon={Truck} />
        </div>
        <WsTabBar tabs={TABS} active={tab} onChange={setTab} lang={lang} />
        {tab === 'summary' && (
          <div className="space-y-2">
            <WsRow label={L('رقم الطلب', 'Order ID')} value={`#${String(order.id).slice(0, 8)}`} />
            <WsRow label={L('الحالة', 'Status')} value={status} />
            <WsRow label={L('المبلغ', 'Amount')} value={Number(order.total_amount || 0).toFixed(2)} />
            <WsRow label={L('الفرع', 'Branch')} value={parties.branch || '—'} />
            <WsRow label={L('أُنشئ', 'Created')} value={wsFmt(lang, order.created_at)} />
          </div>
        )}
        {tab === 'parties' && (
          <div className="space-y-2">
            <WsRow label={L('العميل', 'Customer')} value={parties.customer || L('غير معروف', 'Unknown')} />
            <WsRow label={L('المندوب', 'Driver')} value={parties.driver || L('غير معيّن', 'Unassigned')} />
            <WsRow label={L('الفرع', 'Branch')} value={parties.branch || '—'} />
          </div>
        )}
        {tab === 'payment' && (
          <div className="space-y-2">
            <WsRow label={L('الإجمالي', 'Total')} value={Number(order.total_amount || 0).toFixed(2)} />
            <WsRow label={L('طريقة الدفع', 'Payment method')} value={order.payment_method || L('غير محدّد', 'Not set')} />
            <WsRow label={L('حالة الدفع', 'Payment status')} value={order.payment_status || L('غير محدّد', 'Not set')} />
          </div>
        )}
        {tab === 'timeline' && (
          order.created_at ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={wsCard}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--color-primary-fixed)' }} />
                <span className="text-sm flex-1" style={{ color: 'var(--color-on-surface)' }}>{L('أُنشئ الطلب', 'Order created')}</span>
                <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{wsFmt(lang, order.created_at)}</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl" style={wsCard}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--color-primary-fixed)' }} />
                <span className="text-sm flex-1" style={{ color: 'var(--color-on-surface)' }}>{L(`الحالة: ${status}`, `Status: ${status}`)}</span>
              </div>
            </div>
          ) : <EmptyStateBox Icon={Clock} title={L('لا يوجد نشاط', 'No activity')} />
        )}
      </div>
    </Drawer>
  );
};
