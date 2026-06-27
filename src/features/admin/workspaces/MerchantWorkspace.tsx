import React, { useEffect, useState } from 'react';
import { Store, Building2, Wallet, Package, FileText } from 'lucide-react';
import { Drawer } from '../../../components/ui/Modal';
import { MetricCard, EmptyStateBox } from '../../../components/admin/EnterpriseUI';
import { WsHeader, WsRow, WsTabBar, wsCard, wsFmt, type WsTab } from './shell';
import { adminCrud } from '../../../services/admin-crud.service';
import { walletService } from '../../../services/wallet.service';
import { merchantService } from '../../../services/merchant.service';

const TABS: WsTab[] = [
  { k: 'overview', ar: 'نظرة عامة', en: 'Overview', Icon: Store },
  { k: 'branches', ar: 'الفروع', en: 'Branches', Icon: Building2 },
  { k: 'wallet', ar: 'المحفظة', en: 'Wallet', Icon: Wallet },
  { k: 'orders', ar: 'الطلبات', en: 'Orders', Icon: Package },
  { k: 'documents', ar: 'المستندات', en: 'Documents', Icon: FileText },
];

/** Merchant workspace — real branches, wallet, and aggregated branch orders. */
export const MerchantWorkspace: React.FC<{ merchant: any; lang: 'ar' | 'en'; onClose: () => void }> = ({ merchant, lang, onClose }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tab, setTab] = useState('overview');
  const [branches, setBranches] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any | null>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const br = await adminCrud('merchant_branches').list().then(r => r.data.filter((b: any) => b.merchant_id === merchant.id)).catch(() => []);
      if (!alive) return; setBranches(br);
      const w = await walletService.getWallet('merchant', merchant.id).then(r => r.data).catch(() => null);
      if (!alive) return; setWallet(w);
      if (w?.id) { const t = await walletService.getTransactions(w.id).then(r => r.data || []).catch(() => []); if (alive) setTxns(t); }
      const ordLists = await Promise.all(br.map((b: any) => merchantService.getBranchOrders(b.id).then(r => r.data || []).catch(() => [])));
      if (alive) setOrders(ordLists.flat());
    })();
    return () => { alive = false; };
  }, [merchant.id]);

  return (
    <Drawer open onClose={onClose} heightClass="max-h-[92vh]" title={L('ملف التاجر', 'Merchant workspace')}
      footer={<button onClick={onClose} className="w-full h-11 rounded-xl text-sm font-bold cursor-pointer" style={wsCard}>{L('إغلاق', 'Close')}</button>}>
      <div className="px-4 pb-4 space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'} id="merchant_workspace">
        <WsHeader Icon={Store} title={merchant.business_name || L('بدون اسم', 'Unnamed')} subtitle={merchant.contact_email} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <MetricCard label={L('الفروع', 'Branches')} value={branches.length} Icon={Building2} />
          <MetricCard label={L('الطلبات', 'Orders')} value={orders.length} Icon={Package} accent="#60a5fa" />
          <MetricCard label={L('رصيد المحفظة', 'Wallet')} value={wallet ? Number(wallet.balance || 0).toFixed(2) : '0.00'} Icon={Wallet} accent="#9ed442" />
          <MetricCard label={L('الإيراد', 'Revenue')} value={orders.reduce((s, o: any) => s + (Number(o.total_amount) || 0), 0).toFixed(2)} />
        </div>
        <WsTabBar tabs={TABS} active={tab} onChange={setTab} lang={lang} />
        {tab === 'overview' && (
          <div className="space-y-2">
            <WsRow label={L('اسم النشاط', 'Business name')} value={merchant.business_name} />
            <WsRow label={L('البريد', 'Email')} value={merchant.contact_email} />
            <WsRow label={L('الجوال', 'Phone')} value={merchant.contact_phone} />
            <WsRow label={L('عدد الفروع', 'Branch count')} value={branches.length} />
          </div>
        )}
        {tab === 'branches' && (
          branches.length === 0 ? <EmptyStateBox Icon={Building2} title={L('لا توجد فروع', 'No branches')} description={L('أضف فروعًا من صفحة الفروع.', 'Add branches from the Branches page.')} />
          : <div className="space-y-2">{branches.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-xl" style={wsCard}>
                <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{b.is_active ? L('نشط', 'Active') : L('متوقف', 'Inactive')}</span>
                <span className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>{b.name || '—'}</span>
              </div>))}</div>
        )}
        {tab === 'wallet' && (
          <div className="space-y-2">
            <WsRow label={L('الرصيد', 'Balance')} value={wallet ? Number(wallet.balance || 0).toFixed(2) : '0.00'} />
            {txns.length === 0 ? <EmptyStateBox Icon={Wallet} title={L('لا توجد حركات', 'No transactions')} />
              : txns.slice(0, 12).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl" style={wsCard}>
                  <span className="text-sm font-bold" style={{ color: (Number(t.amount) || 0) >= 0 ? '#4ade80' : '#f87171' }}>{(Number(t.amount) || 0).toFixed(2)}</span>
                  <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{t.type || '—'} · {wsFmt(lang, t.created_at)}</span>
                </div>))}
          </div>
        )}
        {tab === 'orders' && (
          orders.length === 0 ? <EmptyStateBox Icon={Package} title={L('لا توجد طلبات', 'No orders')} description={L('طلبات فروع التاجر ستظهر هنا.', 'Orders across the merchant branches appear here.')} />
          : <div className="space-y-2">{orders.slice(0, 15).map((o: any) => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-xl" style={wsCard}>
                <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{o.status}</span>
                <span className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>#{String(o.id).slice(0, 8)} · {Number(o.total_amount || 0).toFixed(2)}</span>
              </div>))}</div>
        )}
        {tab === 'documents' && (
          <div className="space-y-2">
            <WsRow label={L('الرقم الضريبي', 'Tax number')} value={merchant.tax_number} />
            <WsRow label={L('السجل التجاري', 'Commercial registration')} value={merchant.commercial_registration_number} />
          </div>
        )}
      </div>
    </Drawer>
  );
};
