import React, { useEffect, useState } from 'react';
import { Users, Package, Wallet, MapPin, Star } from 'lucide-react';
import { Drawer } from '../../../components/ui/Modal';
import { MetricCard, EmptyStateBox } from '../../../components/admin/EnterpriseUI';
import { WsHeader, WsRow, WsTabBar, wsCard, wsFmt, type WsTab } from './shell';
import { orderService } from '../../../services/order.service';
import { walletService } from '../../../services/wallet.service';
import { customerService } from '../../../services/customer.service';
import { adminCrud } from '../../../services/admin-crud.service';

const TABS: WsTab[] = [
  { k: 'overview', ar: 'نظرة عامة', en: 'Overview', Icon: Users },
  { k: 'orders', ar: 'الطلبات', en: 'Orders', Icon: Package },
  { k: 'wallet', ar: 'المحفظة', en: 'Wallet', Icon: Wallet },
  { k: 'addresses', ar: 'العناوين', en: 'Addresses', Icon: MapPin },
  { k: 'reviews', ar: 'التقييمات', en: 'Reviews', Icon: Star },
];

/** Customer 360 workspace — real orders, wallet, addresses, reviews. */
export const CustomerWorkspace: React.FC<{ customer: any; lang: 'ar' | 'en'; onClose: () => void }> = ({ customer, lang, onClose }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tab, setTab] = useState('overview');
  const [orders, setOrders] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any | null>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [o, w, a, rv] = await Promise.all([
        orderService.getCustomerOrders(customer.id).then(r => r.data || []).catch(() => []),
        walletService.getWallet('customer', customer.id).then(r => r.data).catch(() => null),
        customerService.getAddresses(customer.id).then(r => r.data || []).catch(() => []),
        adminCrud('reviews').list().then(r => r.data.filter((x: any) => x.customer_id === customer.id)).catch(() => []),
      ]);
      if (!alive) return; setOrders(o); setWallet(w); setAddresses(a); setReviews(rv);
      if (w?.id) { const t = await walletService.getTransactions(w.id).then(r => r.data || []).catch(() => []); if (alive) setTxns(t); }
    })();
    return () => { alive = false; };
  }, [customer.id]);

  const spent = orders.reduce((s, o: any) => s + (Number(o.total_amount) || 0), 0);

  return (
    <Drawer open onClose={onClose} heightClass="max-h-[92vh]" title={L('ملف العميل', 'Customer workspace')}
      footer={<button onClick={onClose} className="w-full h-11 rounded-xl text-sm font-bold cursor-pointer" style={wsCard}>{L('إغلاق', 'Close')}</button>}>
      <div className="px-4 pb-4 space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'} id="customer_workspace">
        <WsHeader Icon={Users} title={customer.full_name || L('بدون اسم', 'Unnamed')} subtitle={customer.phone_number} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <MetricCard label={L('الطلبات', 'Orders')} value={orders.length} Icon={Package} />
          <MetricCard label={L('إجمالي الإنفاق', 'Total spent')} value={spent.toFixed(2)} accent="#9ed442" />
          <MetricCard label={L('المحفظة', 'Wallet')} value={wallet ? Number(wallet.balance || 0).toFixed(2) : '0.00'} Icon={Wallet} />
          <MetricCard label={L('العناوين', 'Addresses')} value={addresses.length} Icon={MapPin} />
        </div>
        <WsTabBar tabs={TABS} active={tab} onChange={setTab} lang={lang} />
        {tab === 'overview' && (
          <div className="space-y-2">
            <WsRow label={L('الاسم', 'Name')} value={customer.full_name} />
            <WsRow label={L('الجوال', 'Phone')} value={customer.phone_number} />
            <WsRow label={L('البريد', 'Email')} value={customer.email} />
            <WsRow label={L('عضو منذ', 'Member since')} value={wsFmt(lang, customer.created_at)} />
          </div>
        )}
        {tab === 'orders' && (
          orders.length === 0 ? <EmptyStateBox Icon={Package} title={L('لا توجد طلبات', 'No orders')} description={L('طلبات العميل ستظهر هنا.', "The customer's orders appear here.")} />
          : <div className="space-y-2">{orders.slice(0, 15).map((o: any) => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-xl" style={wsCard}>
                <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{o.status}</span>
                <span className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>#{String(o.id).slice(0, 8)} · {Number(o.total_amount || 0).toFixed(2)}</span>
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
        {tab === 'addresses' && (
          addresses.length === 0 ? <EmptyStateBox Icon={MapPin} title={L('لا توجد عناوين', 'No addresses')} />
          : <div className="space-y-2">{addresses.map((a: any) => (
              <div key={a.id} className="p-3 rounded-xl text-end" style={wsCard}>
                <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>{a.label || L('عنوان', 'Address')}</p>
                <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{a.address_line || '—'}</p>
              </div>))}</div>
        )}
        {tab === 'reviews' && (
          reviews.length === 0 ? <EmptyStateBox Icon={Star} title={L('لا توجد تقييمات', 'No reviews')} />
          : <div className="space-y-2">{reviews.map((r: any) => (
              <div key={r.id} className="p-3 rounded-xl" style={wsCard}>
                <div className="flex items-center justify-between"><span className="text-sm font-bold" style={{ color: '#fbbf24' }}>{'★'.repeat(Number(r.rating) || 0)}</span></div>
                <p className="text-[11px] mt-1 text-end" style={{ color: 'var(--color-on-surface-variant)' }}>{r.comment || '—'}</p>
              </div>))}</div>
        )}
      </div>
    </Drawer>
  );
};
