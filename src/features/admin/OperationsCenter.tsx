import React, { useEffect, useState } from 'react';
import { toast, inputDialog } from '../../components/ui/feedback';
import { supabase } from '../../lib/supabase';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { dispatchService, NearestDriver } from '../../services/ops/dispatch.service';
import { zoneService, DeliveryZone } from '../../services/ops/zone.service';
import { vehicleService, Vehicle } from '../../services/ops/vehicle.service';
import { performanceService, DriverPerformance } from '../../services/ops/performance.service';
import { payoutService, PayoutRequest } from '../../services/ops/payout.service';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Loader, EmptyState } from '../../components/ui/Primitives';
import { AdminDataTable, Column } from '../../components/admin/AdminDataTable';
import { KycCenter } from './KycCenter';
import { FinanceCenter } from './FinanceCenter';
import { OperationsCommandCenter } from './OperationsCommandCenter';
import { GrowthCenter } from './GrowthCenter';
import { CustomerCareCenter } from './CustomerCareCenter';
import { GrowthCenterB } from './GrowthCenterB';
import { Map, Route, MapPin, Truck, BarChart3, Banknote, ShieldCheck, Wallet, Headset, Target, Star, LucideIcon } from 'lucide-react';

export type OpsTab = 'command' | 'dispatch' | 'zones' | 'vehicles' | 'performance' | 'payouts' | 'kyc' | 'finance' | 'growth' | 'care' | 'growthb';

const TABS: { id: OpsTab; ar: string; en: string; Icon: LucideIcon }[] = [
  { id: 'command', ar: 'غرفة العمليات', en: 'Command Center', Icon: Map },
  { id: 'dispatch', ar: 'مركز الإرسال', en: 'Dispatch', Icon: Route },
  { id: 'zones', ar: 'مناطق التوصيل', en: 'Delivery Zones', Icon: MapPin },
  { id: 'vehicles', ar: 'المركبات', en: 'Vehicles', Icon: Truck },
  { id: 'performance', ar: 'أداء المندوبين', en: 'Driver Performance', Icon: BarChart3 },
  { id: 'payouts', ar: 'المدفوعات', en: 'Payouts', Icon: Banknote },
  { id: 'kyc', ar: 'التحقق والامتثال', en: 'KYC & Compliance', Icon: ShieldCheck },
  { id: 'finance', ar: 'المركز المالي', en: 'Finance', Icon: Wallet },
  { id: 'care', ar: 'رعاية العملاء', en: 'Customer Care', Icon: Headset },
  { id: 'growthb', ar: 'النمو', en: 'Growth', Icon: Target },
];

const money = (n: number) => `${Number(n || 0).toFixed(2)}`;
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;
const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };

export const OperationsCenter: React.FC<{ tab?: OpsTab; onTab?: (t: OpsTab) => void; hideTabs?: boolean }> = ({ tab: extTab, onTab, hideTabs }) => {
  const { lang } = useAppConfig();
  const [intTab, setIntTab] = useState<OpsTab>('command');
  const [growthSub, setGrowthSub] = useState<'mgmt' | 'engine'>('mgmt');
  const tab = extTab ?? intTab;
  const setTab = (t: OpsTab) => { onTab ? onTab(t) : setIntTab(t); };
  return (
    <div id="operations_center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {!hideTabs && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-3 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all"
              style={tab === t.id
                ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }
                : { background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
              <t.Icon size={15} className="me-1 inline-block align-text-bottom" />{lang === 'ar' ? t.ar : t.en}
            </button>
          ))}
        </div>
      )}
      {tab === 'command' && <OperationsCommandCenter />}
      {tab === 'dispatch' && <DispatchPanel />}
      {tab === 'zones' && <ZonesPanel />}
      {tab === 'vehicles' && <VehiclesPanel />}
      {tab === 'performance' && <PerformancePanel />}
      {tab === 'payouts' && <PayoutsPanel />}
      {tab === 'kyc' && <KycCenter />}
      {tab === 'finance' && <FinanceCenter />}
      {tab === 'care' && <CustomerCareCenter />}
      {/* Unified Growth: one nav entry, two sub-views (Mgmt = coupons/offers; Engine = affiliates/influencers/segments/loyalty). */}
      {(tab === 'growthb' || tab === 'growth') && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            {([['mgmt', 'إدارة النمو', 'Growth Mgmt'], ['engine', 'محرّك النمو', 'Growth Engine']] as const).map(([k, ar, en]) => (
              <button key={k} onClick={() => setGrowthSub(k)}
                className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer transition-all"
                style={growthSub === k
                  ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }
                  : { background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                {lang === 'ar' ? ar : en}
              </button>
            ))}
          </div>
          {growthSub === 'mgmt' ? <GrowthCenterB /> : <GrowthCenter />}
        </div>
      )}
    </div>
  );
};

// ════════════════════════ DISPATCH ════════════════════════
const DispatchPanel: React.FC = () => {
  const { lang } = useAppConfig(); const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [queue, setQueue] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Record<string, NearestDriver[]>>({});
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: q }, { data: f }] = await Promise.all([
      dispatchService.unassignedOrders(),
      dispatchService.recentAssignments(25),
    ]);
    setQueue(q); setFeed(f); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const coords = (o: any) => ({
    lat: Number(o.delivery_lat ?? o.branch_lat_snapshot),
    lng: Number(o.delivery_lng ?? o.branch_lng_snapshot),
  });

  const doAuto = async (o: any) => {
    setBusy(o.id);
    const { data, error } = await dispatchService.autoDispatch(o.id);
    setBusy(null);
    if (error) return toast.error(`${L('فشل الإرسال','Dispatch failed')}: ${error.message}`);
    if (!data) return toast.error(L('لا يوجد مندوب متاح حاليًا.','No driver available right now.'));
    await load();
  };

  const findDrivers = async (o: any) => {
    setBusy(o.id);
    const { lat, lng } = coords(o);
    const { data } = await dispatchService.findNearestDrivers(lat, lng, 5, o.id);
    if (data.length) {
      const ids = data.map(d => d.driver_id);
      const { data: drv } = await supabase.from('drivers').select('id, full_name').in('id', ids);
      const names: Record<string, string> = {};
      (drv || []).forEach((d: any) => { names[d.id] = d.full_name; });
      setDriverNames(prev => ({ ...prev, ...names }));
    }
    setCandidates(prev => ({ ...prev, [o.id]: data }));
    setBusy(null);
  };

  const doManual = async (orderId: string, driverId: string) => {
    setBusy(orderId);
    const { error } = await dispatchService.manualDispatch(orderId, driverId);
    setBusy(null);
    if (error) return toast.error(`${L('فشل التعيين','Assignment failed')}: ${error.message}`);
    await load();
  };

  const expire = async () => {
    const { data } = await dispatchService.expireOffers();
    toast.error(`${L('تم إنهاء','Expired')} ${data} ${L('عرض منتهي الصلاحية.','expired offers.')}`);
    await load();
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader size={32} /></div>;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{L('طابور الطلبات','Order queue')} ({queue.length})</h3>
          <Button variant="secondary" size="sm" onClick={expire}>{L('إنهاء العروض المنتهية','Expire stale offers')}</Button>
        </div>
        {queue.length === 0 ? <EmptyState title={L('لا توجد طلبات بانتظار التعيين','No orders awaiting assignment')} /> : queue.map(o => (
          <Card key={o.id} className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold">#{o.id.slice(0, 8)} · {money(o.total_amount)} {L('ر.س','SAR')}</p>
                <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {o.merchant_branches?.name ?? '—'} · {o.merchant_branches?.zones?.name ?? L('بلا منطقة','No zone')} · {L('رسوم','Fee')} {money(o.delivery_fee)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" loading={busy === o.id} onClick={() => doAuto(o)}>{L('إرسال تلقائي','Auto dispatch')}</Button>
                <Button size="sm" variant="secondary" onClick={() => findDrivers(o)}>{L('تعيين يدوي','Manual assign')}</Button>
              </div>
            </div>
            {candidates[o.id] && (
              <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: 'var(--color-outline-variant)' }}>
                {candidates[o.id].length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--color-error)' }}>{L('لا يوجد مندوبون متاحون قريبون.','No nearby available drivers.')}</p>
                ) : candidates[o.id].map(c => (
                  <div key={c.driver_id} className="flex items-center justify-between text-sm">
                    <span>{driverNames[c.driver_id] ?? c.driver_id.slice(0, 8)} · {c.distance_km.toFixed(1)} {L('كم','km')} · {L('أولوية','priority')} {c.priority_score} · {c.active_orders} {L('طلب','orders')}</span>
                    <Button size="sm" onClick={() => doManual(o.id, c.driver_id)}>{L('تعيين','Assign')}</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        <h3 className="font-bold text-lg">{L('سجل الإرسال','Dispatch log')}</h3>
        {feed.length === 0 ? <EmptyState title={L('لا يوجد نشاط','No activity')} /> : feed.map(a => (
          <Card key={a.id} className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{a.drivers?.full_name ?? '—'}</span>
              <Badge variant={a.status === 'accepted' ? 'success' : a.status === 'offered' ? 'secondary' : 'error'}>{a.status}</Badge>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              {a.method === 'auto' ? L('تلقائي','Auto') : L('يدوي','Manual')} · {L('محاولة','attempt')} {a.attempt}{a.distance_km != null ? ` · ${a.distance_km} ${L('كم','km')}` : ''}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ════════════════════════ ZONES ════════════════════════
const ZonesPanel: React.FC = () => {
  const { lang } = useAppConfig(); const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Record<string, Partial<DeliveryZone>>>({});

  const load = async () => { setLoading(true); const { data } = await zoneService.list(); setZones(data); setLoading(false); };
  useEffect(() => { load(); }, []);

  const save = async (z: DeliveryZone) => {
    const patch = edit[z.id]; if (!patch) return;
    const { error } = await zoneService.update(z.id, patch);
    if (error) return toast.error(error.message);
    setEdit(prev => { const n = { ...prev }; delete n[z.id]; return n; });
    await load();
  };
  const toggle = async (z: DeliveryZone) => { await zoneService.setActive(z.id, !z.is_active); await load(); };
  const field = (z: DeliveryZone, key: keyof DeliveryZone) => (edit[z.id]?.[key] ?? (z as any)[key]) as any;
  const set = (id: string, key: keyof DeliveryZone, val: any) => setEdit(p => ({ ...p, [id]: { ...p[id], [key]: val } }));

  if (loading) return <div className="py-12 flex justify-center"><Loader size={32} /></div>;
  return (
    <div className="space-y-3">
      {zones.length === 0 ? <EmptyState title={L('لا توجد مناطق','No zones')} /> : zones.map(z => (
        <Card key={z.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-bold">{z.name}</p>
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                {z.cities?.name ?? '—'} · {z.polygon ? `${L('مضلّع','Polygon')} (${z.polygon.length} ${L('نقطة','pts')})` : L('بلا حدود مرسومة','No drawn boundary')}
              </p>
            </div>
            <button onClick={() => toggle(z)} className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer"
              style={{ background: z.is_active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: z.is_active ? '#4ade80' : 'var(--color-on-surface-variant)' }}>
              {z.is_active ? L('نشطة','Active') : L('متوقفة','Paused')}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([['base_fee', 'رسوم أساسية', 'Base fee'], ['per_km_fee', 'لكل كم', 'Per km'], ['min_fee', 'حد أدنى', 'Min fee'], ['eta_minutes', 'وقت (دقيقة)', 'ETA (min)']] as const).map(([key, ar, en]) => (
              <label key={key} className="text-xs">
                <span style={{ color: 'var(--color-on-surface-variant)' }}>{L(ar, en)}</span>
                <input type="number" value={field(z, key)} onChange={e => set(z.id, key, Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg text-sm" style={surface} />
              </label>
            ))}
          </div>
          {edit[z.id] && <Button size="sm" className="mt-3" onClick={() => save(z)}>{L('حفظ التغييرات','Save changes')}</Button>}
        </Card>
      ))}
    </div>
  );
};

// ════════════════════════ VEHICLES ════════════════════════
const VehiclesPanel: React.FC = () => {
  const { lang } = useAppConfig(); const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Record<string, Partial<Vehicle>>>({});

  const load = async () => { setLoading(true); const { data } = await vehicleService.list(); setVehicles(data); setLoading(false); };
  useEffect(() => { load(); }, []);
  const set = (id: string, key: keyof Vehicle, val: any) => setEdit(p => ({ ...p, [id]: { ...p[id], [key]: val } }));
  const field = (v: Vehicle, key: keyof Vehicle) => (edit[v.id]?.[key] ?? (v as any)[key]) as any;
  const save = async (v: Vehicle) => {
    const patch = edit[v.id]; if (!patch) return;
    const { error } = await vehicleService.update(v.id, patch as any);
    if (error) return toast.error(error.message);
    setEdit(p => { const n = { ...p }; delete n[v.id]; return n; });
    await load();
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader size={32} /></div>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {vehicles.map(v => (
        <Card key={v.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold">{lang === 'ar' ? v.name_ar : v.name_en} <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>({v.type})</span></p>
            <Badge variant={v.is_active ? 'success' : 'secondary'}>{v.is_active ? L('مفعّلة','Active') : L('موقوفة','Disabled')}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([['capacity', 'السعة', 'Capacity'], ['speed_kmh', 'السرعة كم/س', 'Speed km/h'], ['pricing_modifier', 'معامل السعر', 'Price modifier']] as const).map(([key, ar, en]) => (
              <label key={key} className="text-xs">
                <span style={{ color: 'var(--color-on-surface-variant)' }}>{L(ar, en)}</span>
                <input type="number" step="0.1" value={field(v, key)} onChange={e => set(v.id, key, Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg text-sm" style={surface} />
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            {edit[v.id] && <Button size="sm" onClick={() => save(v)}>{L('حفظ','Save')}</Button>}
            <Button size="sm" variant="secondary" onClick={async () => { await vehicleService.update(v.id, { is_active: !v.is_active }); await load(); }}>
              {v.is_active ? L('إيقاف','Disable') : L('تفعيل','Enable')}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

// ════════════════════════ PERFORMANCE ════════════════════════
const PerformancePanel: React.FC = () => {
  const { lang } = useAppConfig();
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  type Row = DriverPerformance & { full_name: string };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const { data } = await performanceService.leaderboard(50); setRows(data); setLoading(false); };
  useEffect(() => { load(); }, []);
  const recalc = async (id: string) => { await performanceService.recalc(id); await load(); };

  const columns: Column<Row>[] = [
    { key: 'name', header: L('المندوب', 'Driver'), sortable: true, sortValue: r => r.full_name, csv: r => r.full_name, render: r => <span className="font-semibold">{r.full_name}</span> },
    { key: 'completed', header: L('مكتملة', 'Completed'), sortable: true, sortValue: r => r.orders_completed, csv: r => r.orders_completed },
    { key: 'accept', header: L('قبول', 'Accept'), sortable: true, sortValue: r => r.acceptance_rate, csv: r => r.acceptance_rate, render: r => pct(r.acceptance_rate) },
    { key: 'complete', header: L('إكمال', 'Complete'), sortable: true, sortValue: r => r.completion_rate, csv: r => r.completion_rate, render: r => pct(r.completion_rate) },
    { key: 'cancel', header: L('إلغاء', 'Cancel'), sortable: true, sortValue: r => r.cancellation_rate, csv: r => r.cancellation_rate, render: r => pct(r.cancellation_rate) },
    { key: 'avg', header: L('متوسط (د)', 'Avg (min)'), sortable: true, sortValue: r => r.avg_delivery_minutes, csv: r => r.avg_delivery_minutes, render: r => r.avg_delivery_minutes.toFixed(0) },
    { key: 'rating', header: L('تقييم', 'Rating'), sortable: true, sortValue: r => r.rating, csv: r => r.rating, render: r => <span className="inline-flex items-center gap-1"><Star size={13} fill="#fbbf24" color="#fbbf24" />{r.rating.toFixed(1)}</span> },
    { key: 'earnings', header: L('أرباح', 'Earnings'), sortable: true, sortValue: r => r.total_earnings, csv: r => r.total_earnings, render: r => money(r.total_earnings) },
    { key: 'action', header: '', render: r => <Button size="sm" variant="secondary" onClick={() => recalc(r.driver_id)}>{L('تحديث', 'Refresh')}</Button> },
  ];
  return (
    <AdminDataTable
      columns={columns} rows={rows} loading={loading} rowKey={r => r.driver_id} lang={lang}
      search={r => r.full_name} searchPlaceholder={L('ابحث باسم المندوب…', 'Search driver…')}
      exportName="driver_performance" emptyTitle={L('لا توجد بيانات أداء', 'No performance data')} pageSize={15}
    />
  );
};

// ════════════════════════ PAYOUTS ════════════════════════
const PayoutsPanel: React.FC = () => {
  const { lang } = useAppConfig(); const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [reqs, setReqs] = useState<(PayoutRequest & { drivers?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const load = async () => { setLoading(true); const { data } = await payoutService.listRequests(); setReqs(data as any); setLoading(false); };
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    setBusy(id); const { error } = await payoutService.approve(id); setBusy(null);
    if (error) return toast.error(error.message); await load();
  };
  const reject = async (id: string) => {
    const note = (await inputDialog({ title: L('سبب الرفض (اختياري)','Rejection reason (optional)'), placeholder: L('اكتب السبب…','Enter the reason…') })) ?? undefined;
    setBusy(id); const { error } = await payoutService.reject(id, note); setBusy(null);
    if (error) return toast.error(error.message); await load();
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader size={32} /></div>;
  const pending = reqs.filter(r => r.status === 'pending');
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">{L('طلبات السحب المعلّقة','Pending withdrawals')} ({pending.length})</h3>
      {pending.length === 0 ? <EmptyState title={L('لا توجد طلبات معلّقة','No pending requests')} /> : pending.map(r => (
        <Card key={r.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-bold">{r.drivers?.full_name ?? r.driver_id.slice(0, 8)} · {money(r.amount)} {L('ر.س','SAR')}</p>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{new Date(r.requested_at).toLocaleString(L('ar','en'))}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" loading={busy === r.id} onClick={() => approve(r.id)}>{L('موافقة وصرف','Approve & pay')}</Button>
            <Button size="sm" variant="secondary" onClick={() => reject(r.id)}>{L('رفض','Reject')}</Button>
          </div>
        </Card>
      ))}
      <h3 className="font-bold text-lg mt-6">{L('السجل','History')}</h3>
      {reqs.filter(r => r.status !== 'pending').map(r => (
        <Card key={r.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{r.drivers?.full_name ?? r.driver_id.slice(0, 8)} · {money(r.amount)} {L('ر.س','SAR')}</span>
          <Badge variant={r.status === 'paid' ? 'success' : 'error'}>{r.status}</Badge>
        </Card>
      ))}
    </div>
  );
};
