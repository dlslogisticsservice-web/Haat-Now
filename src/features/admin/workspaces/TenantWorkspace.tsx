import React, { useEffect, useState } from 'react';
import { Building2, Palette, Globe, CreditCard, BarChart3, Power, PauseCircle, Archive } from 'lucide-react';
import { Drawer } from '../../../components/ui/Modal';
import { MetricCard, EmptyStateBox, StatusBadge } from '../../../components/admin/EnterpriseUI';
import { toast } from '../../../components/ui/feedback';
import { WsHeader, WsRow, WsTabBar, wsCard, type WsTab } from './shell';
import { tenantService } from '../../../services/tenant.service';
import { adminCrud } from '../../../services/admin-crud.service';

const TABS: WsTab[] = [
  { k: 'branding', ar: 'الهوية', en: 'Branding', Icon: Palette },
  { k: 'domains', ar: 'النطاقات', en: 'Domains', Icon: Globe },
  { k: 'subscription', ar: 'الاشتراك', en: 'Subscription', Icon: CreditCard },
  { k: 'usage', ar: 'الاستخدام', en: 'Usage', Icon: BarChart3 },
];

const statusKind = (s: string) => s === 'active' ? 'success' : s === 'suspended' ? 'warning' : s === 'archived' ? 'inactive' : 'pending';

/** Tenant workspace — branding, domains, subscription, usage + lifecycle actions. */
export const TenantWorkspace: React.FC<{ tenant: any; lang: 'ar' | 'en'; onClose: () => void; onChanged?: () => void }> = ({ tenant, lang, onClose, onChanged }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tab, setTab] = useState('branding');
  const [status, setStatus] = useState<string>(tenant.status || 'draft');
  const [usage, setUsage] = useState<{ orders: number; drivers: number; merchants: number; customers: number } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [o, d, m, c] = await Promise.all([
        adminCrud('orders').list().then(r => r.data.length).catch(() => 0),
        adminCrud('drivers').list().then(r => r.data.length).catch(() => 0),
        adminCrud('merchants').list().then(r => r.data.length).catch(() => 0),
        adminCrud('customers').list().then(r => r.data.length).catch(() => 0),
      ]);
      if (alive) setUsage({ orders: o, drivers: d, merchants: m, customers: c });
    })();
    return () => { alive = false; };
  }, [tenant.id]);

  const transition = async (fn: () => Promise<{ error: any }>, next: string, okAr: string, okEn: string) => {
    const { error } = await fn();
    if (error) { toast.error(L('تعذّر تغيير حالة المستأجر', 'Could not change tenant status')); return; }
    setStatus(next); toast.success(L(okAr, okEn)); onChanged?.();
  };

  return (
    <Drawer open onClose={onClose} heightClass="max-h-[92vh]" title={L('مساحة المستأجر', 'Tenant workspace')}
      footer={
        <div className="flex gap-2">
          {status !== 'active' && <button onClick={() => transition(() => tenantService.activate(tenant.id), 'active', 'تم تفعيل المستأجر', 'Tenant activated')} className="flex-1 h-11 rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}><Power size={15} />{L('تفعيل', 'Activate')}</button>}
          {status === 'active' && <button onClick={() => transition(() => tenantService.suspend(tenant.id), 'suspended', 'تم تعليق المستأجر', 'Tenant suspended')} className="flex-1 h-11 rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5" style={wsCard}><PauseCircle size={15} />{L('تعليق', 'Suspend')}</button>}
          {status !== 'archived' && <button onClick={() => transition(() => tenantService.archive(tenant.id), 'archived', 'تمت أرشفة المستأجر', 'Tenant archived')} className="flex-1 h-11 rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5" style={wsCard}><Archive size={15} />{L('أرشفة', 'Archive')}</button>}
          <button onClick={onClose} className="flex-1 h-11 rounded-xl text-sm font-bold cursor-pointer" style={wsCard}>{L('إغلاق', 'Close')}</button>
        </div>
      }>
      <div className="px-4 pb-4 space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'} id="tenant_workspace">
        <WsHeader Icon={Building2} title={tenant.brand_name || L('بدون اسم', 'Unnamed')} subtitle={tenant.slug}
          badge={<StatusBadge kind={statusKind(status) as any} label={status} />} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <MetricCard label={L('الخطة', 'Plan')} value={tenant.plan || '—'} Icon={CreditCard} accent="#9ed442" />
          <MetricCard label={L('الحالة', 'Status')} value={status} />
          <MetricCard label={L('الدولة', 'Country')} value={tenant.country_code || '—'} Icon={Globe} />
          <MetricCard label={L('SSL', 'SSL')} value={tenant.ssl_status || 'pending'} accent="#60a5fa" />
        </div>
        <WsTabBar tabs={TABS} active={tab} onChange={setTab} lang={lang} />
        {tab === 'branding' && (
          <div className="space-y-2">
            <WsRow label={L('اسم العلامة', 'Brand name')} value={tenant.brand_name} />
            <WsRow label={L('الشعار', 'Logo URL')} value={tenant.logo_url || L('غير محدّد', 'Not set')} />
            <WsRow label={L('اللون الأساسي', 'Primary color')} value={<span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded" style={{ background: tenant.primary_color || '#A3F95B' }} />{tenant.primary_color || '#A3F95B'}</span>} />
            <WsRow label={L('اللون الثانوي', 'Secondary color')} value={tenant.secondary_color || '—'} />
            <WsRow label={L('الخط', 'Font')} value={tenant.font_family || L('الافتراضي', 'Default')} />
          </div>
        )}
        {tab === 'domains' && (
          <div className="space-y-2">
            <WsRow label={L('النطاق الفرعي', 'Subdomain')} value={tenant.subdomain ? `${tenant.subdomain}.haatnow.app` : L('غير محدّد', 'Not set')} />
            <WsRow label={L('النطاق المخصّص', 'Custom domain')} value={tenant.custom_domain || L('غير محدّد', 'Not set')} />
            <WsRow label={L('حالة SSL', 'SSL status')} value={tenant.ssl_status || 'pending'} />
          </div>
        )}
        {tab === 'subscription' && (
          <div className="space-y-2">
            <WsRow label={L('الخطة', 'Plan')} value={tenant.plan} />
            <WsRow label={L('حد الطلبات', 'Order limit')} value={tenant.order_limit ?? L('غير محدود', 'Unlimited')} />
            <WsRow label={L('حد المندوبين', 'Driver limit')} value={tenant.driver_limit ?? L('غير محدود', 'Unlimited')} />
            <WsRow label={L('حد التجّار', 'Merchant limit')} value={tenant.merchant_limit ?? L('غير محدود', 'Unlimited')} />
          </div>
        )}
        {tab === 'usage' && (
          usage ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <MetricCard label={L('الطلبات', 'Orders')} value={usage.orders} />
                <MetricCard label={L('المندوبون', 'Drivers')} value={usage.drivers} />
                <MetricCard label={L('التجّار', 'Merchants')} value={usage.merchants} />
                <MetricCard label={L('العملاء', 'Customers')} value={usage.customers} />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                {L('إجماليات المنصّة — تصبح مقصورة على المستأجر بعد تفعيل عزل البيانات (tenant_id + RLS).', 'Platform totals — become per-tenant once data isolation (tenant_id + RLS) is enabled.')}
              </p>
            </div>
          ) : <EmptyStateBox Icon={BarChart3} title={L('جارٍ التحميل…', 'Loading…')} />
        )}
      </div>
    </Drawer>
  );
};
