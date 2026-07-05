import React, { useEffect, useState } from 'react';
import { UserRound, Wallet, Package, Star, FileText, Clock, Power, Phone, CreditCard } from 'lucide-react';
import { Drawer } from '../../../components/ui/Modal';
import { MetricCard, EmptyStateBox, StatusBadge } from '../../../components/admin/EnterpriseUI';
import { toast } from '../../../components/ui/feedback';
import { walletService } from '../../../services/wallet.service';
import { driverService } from '../../../services/driver.service';
import { adminCrud } from '../../../services/admin-crud.service';

type Tab = 'overview' | 'orders' | 'wallet' | 'documents' | 'timeline';
const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };

/**
 * Driver enterprise workspace — a real operational dashboard for one driver.
 * All panels read real services (wallet, active jobs, earnings, assigned vehicle);
 * empty states where there is no data. No fake charts. Reuses existing services.
 */
export const DriverWorkspace: React.FC<{ driver: any; lang: 'ar' | 'en'; onClose: () => void }> = ({ driver, lang, onClose }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tab, setTab] = useState<Tab>('overview');
  const [online, setOnline] = useState<boolean>(driver.is_online === true || driver.is_online === 'true');
  const [vehicle, setVehicle] = useState<any | null>(null);
  const [wallet, setWallet] = useState<any | null>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [veh, w, j, e] = await Promise.all([
        adminCrud('vehicles').list().then(r => r.data.find((v: any) => v.driver_id === driver.id) || null).catch(() => null),
        walletService.getWallet('driver', driver.id).then(r => r.data).catch(() => null),
        driverService.getActiveJobs(driver.id).then(r => r.data || []).catch(() => []),
        driverService.getEarnings(driver.id).then(r => r.data || []).catch(() => []),
      ]);
      if (!alive) return;
      setVehicle(veh); setWallet(w); setJobs(j); setEarnings(e);
      if (w?.id) { const t = await walletService.getTransactions(w.id).then(r => r.data || []).catch(() => []); if (alive) setTxns(t); }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [driver.id]);

  const totalEarnings = earnings.reduce((s, x: any) => s + (Number(x.amount) || 0), 0);
  const fmt = (d?: string) => d ? new Date(d).toLocaleString(L('ar', 'en'), { dateStyle: 'medium', timeStyle: 'short' }) : '';

  const toggleOnline = async () => {
    const next = !online;
    // Persist via the sandbox-safe CRUD service (real `drivers.is_online` update in production).
    const { error } = await adminCrud('drivers').update(driver.id, { is_online: next });
    if (error) { toast.error(L('تعذّر تغيير الحالة', 'Could not change status')); return; }
    setOnline(next); toast.success(next ? L('المندوب متصل الآن', 'Driver is now online') : L('المندوب غير متصل', 'Driver is now offline'));
  };

  const tabs: { k: Tab; ar: string; en: string; Icon: typeof UserRound }[] = [
    { k: 'overview', ar: 'نظرة عامة', en: 'Overview', Icon: UserRound },
    { k: 'orders', ar: 'الطلبات', en: 'Orders', Icon: Package },
    { k: 'wallet', ar: 'المحفظة', en: 'Wallet', Icon: Wallet },
    { k: 'documents', ar: 'المستندات', en: 'Documents', Icon: FileText },
    { k: 'timeline', ar: 'النشاط', en: 'Timeline', Icon: Clock },
  ];

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={card}>
      <span className="text-xs font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{value ?? '—'}</span>
    </div>
  );

  return (
    <Drawer open onClose={onClose} heightClass="max-h-[92vh]"
      title={L('ملف المندوب', 'Driver workspace')}
      footer={
        <div className="flex gap-2">
          <button onClick={toggleOnline} className="flex-1 h-11 rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-2"
            style={online ? { background: 'rgba(74,222,128,0.15)', color: '#4ade80' } : card}>
            <Power size={15} />{online ? L('إيقاف الاتصال', 'Set offline') : L('تفعيل الاتصال', 'Set online')}
          </button>
          <button onClick={onClose} className="flex-1 h-11 rounded-xl text-sm font-bold cursor-pointer" style={card}>{L('إغلاق', 'Close')}</button>
        </div>
      }>
      <div className="px-4 pb-4 space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'} id="driver_workspace">
        {/* Profile header */}
        <div className="flex items-center gap-3 p-3 rounded-2xl" style={card}>
          <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--color-primary-fixed)' }}><UserRound size={22} color="var(--color-on-primary-fixed)" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold truncate" style={{ color: 'var(--color-on-surface)' }}>{driver.full_name || L('بدون اسم', 'Unnamed')}</p>
            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-on-surface-variant)' }}><Phone size={11} />{driver.phone_number || '—'}</p>
          </div>
          <StatusBadge kind={online ? 'success' : 'inactive'} label={online ? L('متصل', 'Online') : L('غير متصل', 'Offline')} />
        </div>

        {/* Statistics (real) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <MetricCard label={L('طلبات نشطة', 'Active jobs')} value={jobs.length} Icon={Package} />
          <MetricCard label={L('إجمالي الأرباح', 'Total earnings')} value={totalEarnings.toFixed(2)} Icon={CreditCard} accent="#9ed442" />
          <MetricCard label={L('رصيد المحفظة', 'Wallet balance')} value={wallet ? Number(wallet.balance || 0).toFixed(2) : '0.00'} Icon={Wallet} />
          <MetricCard label={L('التقييم', 'Rating')} value={driver.rating ?? '—'} Icon={Star} accent="#fbbf24" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              style={tab === t.k ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : card}>
              <t.Icon size={14} />{L(t.ar, t.en)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          <div className="space-y-2">
            <Row label={L('الاسم', 'Full name')} value={driver.full_name} />
            <Row label={L('الجوال', 'Phone')} value={driver.phone_number} />
            <Row label={L('الحالة', 'Status')} value={online ? L('متصل', 'Online') : L('غير متصل', 'Offline')} />
            <Row label={L('المركبة المعيّنة', 'Assigned vehicle')} value={vehicle ? `${vehicle.plate} · ${vehicle.vehicle_type || ''}` : L('غير معيّنة', 'None assigned')} />
            <Row label={L('المنطقة', 'Zone')} value={driver.zone_id ? String(driver.zone_id).slice(0, 8) : '—'} />
          </div>
        )}
        {tab === 'orders' && (
          loading ? <p className="text-sm text-center py-6" style={{ color: 'var(--color-on-surface-variant)' }}>…</p>
          : jobs.length === 0 ? <EmptyStateBox Icon={Package} title={L('لا توجد طلبات نشطة', 'No active orders')} description={L('ستظهر مهام التوصيل الحالية هنا.', 'Current delivery jobs appear here.')} />
          : <div className="space-y-2">{jobs.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-xl" style={card}>
                <StatusBadge kind="pending" label={o.status || '—'} />
                <div className="text-end"><p className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>#{String(o.id).slice(0, 8)}</p>
                <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{Number(o.total_amount || 0).toFixed(2)}</p></div>
              </div>))}</div>
        )}
        {tab === 'wallet' && (
          <div className="space-y-2">
            <Row label={L('الرصيد الحالي', 'Current balance')} value={wallet ? Number(wallet.balance || 0).toFixed(2) : '0.00'} />
            {txns.length === 0 ? <EmptyStateBox Icon={Wallet} title={L('لا توجد حركات', 'No transactions')} description={L('حركات المحفظة ستظهر هنا.', 'Wallet transactions appear here.')} />
              : txns.slice(0, 12).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl" style={card}>
                  <span className="text-sm font-bold" style={{ color: (Number(t.amount) || 0) >= 0 ? '#4ade80' : '#f87171' }}>{(Number(t.amount) || 0).toFixed(2)}</span>
                  <div className="text-end"><p className="text-xs font-semibold" style={{ color: 'var(--color-on-surface)' }}>{t.type || t.description || '—'}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{fmt(t.created_at)}</p></div>
                </div>))}
          </div>
        )}
        {tab === 'documents' && (
          <div className="space-y-2">
            <Row label={L('رقم الرخصة', 'License number')} value={driver.license_number} />
            <Row label={L('الهوية الوطنية', 'National ID')} value={driver.national_id_number} />
            <Row label={L('لوحة المركبة', 'Vehicle plate')} value={driver.vehicle_plate || vehicle?.plate} />
            <Row label={L('انتهاء رخصة المركبة', 'Vehicle license expiry')} value={vehicle?.license_expiry} />
            <Row label={L('انتهاء التأمين', 'Insurance expiry')} value={vehicle?.insurance_expiry} />
          </div>
        )}
        {tab === 'timeline' && (
          (() => {
            const events = [
              ...jobs.map((o: any) => ({ at: o.created_at, label: L(`طلب #${String(o.id).slice(0, 6)} — ${o.status}`, `Order #${String(o.id).slice(0, 6)} — ${o.status}`) })),
              ...earnings.map((e: any) => ({ at: e.created_at, label: L(`ربح ${Number(e.amount || 0).toFixed(2)}`, `Earned ${Number(e.amount || 0).toFixed(2)}`) })),
            ].filter(e => e.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
            return events.length === 0
              ? <EmptyStateBox Icon={Clock} title={L('لا يوجد نشاط', 'No activity yet')} description={L('سجل نشاط المندوب سيظهر هنا.', 'Driver activity log appears here.')} />
              : <div className="space-y-2">{events.slice(0, 20).map((e, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={card}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--color-primary-fixed)' }} />
                    <span className="text-sm flex-1" style={{ color: 'var(--color-on-surface)' }}>{e.label}</span>
                    <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{fmt(e.at)}</span>
                  </div>))}</div>;
          })()
        )}
      </div>
    </Drawer>
  );
};
