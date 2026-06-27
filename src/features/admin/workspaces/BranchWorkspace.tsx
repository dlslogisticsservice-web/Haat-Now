import React, { useEffect, useState } from 'react';
import { Building2, Store, MapPin, Package } from 'lucide-react';
import { Drawer } from '../../../components/ui/Modal';
import { MetricCard, EmptyStateBox, StatusBadge } from '../../../components/admin/EnterpriseUI';
import { WsHeader, WsRow, WsTabBar, wsCard, wsResolve, type WsTab } from './shell';
import { merchantService } from '../../../services/merchant.service';

const TABS: WsTab[] = [
  { k: 'overview', ar: 'نظرة عامة', en: 'Overview', Icon: Building2 },
  { k: 'orders', ar: 'الطلبات', en: 'Orders', Icon: Package },
];

/** Branch workspace — real branch orders + resolved merchant/zone. */
export const BranchWorkspace: React.FC<{ branch: any; lang: 'ar' | 'en'; onClose: () => void }> = ({ branch, lang, onClose }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tab, setTab] = useState('overview');
  const [orders, setOrders] = useState<any[]>([]);
  const [rel, setRel] = useState<{ merchant: string; zone: string }>({ merchant: '', zone: '' });
  const active = branch.is_active === true || branch.is_active === 'true';

  useEffect(() => {
    let alive = true;
    (async () => {
      const [o, merchant, zone] = await Promise.all([
        merchantService.getBranchOrders(branch.id).then(r => r.data || []).catch(() => []),
        wsResolve('merchants', branch.merchant_id, 'business_name'),
        wsResolve('zones', branch.zone_id, 'name'),
      ]);
      if (alive) { setOrders(o); setRel({ merchant, zone }); }
    })();
    return () => { alive = false; };
  }, [branch.id]);

  return (
    <Drawer open onClose={onClose} heightClass="max-h-[92vh]" title={L('ملف الفرع', 'Branch workspace')}
      footer={<button onClick={onClose} className="w-full h-11 rounded-xl text-sm font-bold cursor-pointer" style={wsCard}>{L('إغلاق', 'Close')}</button>}>
      <div className="px-4 pb-4 space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'} id="branch_workspace">
        <WsHeader Icon={Building2} title={branch.name || L('بدون اسم', 'Unnamed')} subtitle={rel.merchant}
          badge={<StatusBadge kind={active ? 'success' : 'inactive'} label={active ? L('نشط', 'Active') : L('متوقف', 'Inactive')} />} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <MetricCard label={L('الطلبات', 'Orders')} value={orders.length} Icon={Package} />
          <MetricCard label={L('الإيراد', 'Revenue')} value={orders.reduce((s, o: any) => s + (Number(o.total_amount) || 0), 0).toFixed(2)} accent="#9ed442" />
          <MetricCard label={L('التاجر', 'Merchant')} value={rel.merchant || '—'} Icon={Store} />
          <MetricCard label={L('المنطقة', 'Zone')} value={rel.zone || '—'} Icon={MapPin} />
        </div>
        <WsTabBar tabs={TABS} active={tab} onChange={setTab} lang={lang} />
        {tab === 'overview' && (
          <div className="space-y-2">
            <WsRow label={L('اسم الفرع', 'Branch name')} value={branch.name} />
            <WsRow label={L('التاجر', 'Merchant')} value={rel.merchant || '—'} />
            <WsRow label={L('المنطقة', 'Zone')} value={rel.zone || '—'} />
            <WsRow label={L('الحالة', 'Status')} value={active ? L('نشط', 'Active') : L('متوقف', 'Inactive')} />
          </div>
        )}
        {tab === 'orders' && (
          orders.length === 0 ? <EmptyStateBox Icon={Package} title={L('لا توجد طلبات', 'No orders')} description={L('طلبات هذا الفرع ستظهر هنا.', "This branch's orders appear here.")} />
          : <div className="space-y-2">{orders.slice(0, 15).map((o: any) => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-xl" style={wsCard}>
                <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{o.status}</span>
                <span className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>#{String(o.id).slice(0, 8)} · {Number(o.total_amount || 0).toFixed(2)}</span>
              </div>))}</div>
        )}
      </div>
    </Drawer>
  );
};
