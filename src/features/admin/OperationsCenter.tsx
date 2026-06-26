import React, { useEffect, useState } from 'react';
import { toast } from '../../components/ui/feedback';
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
import { KycCenter } from './KycCenter';
import { FinanceCenter } from './FinanceCenter';
import { OperationsCommandCenter } from './OperationsCommandCenter';
import { GrowthCenter } from './GrowthCenter';
import { CustomerCareCenter } from './CustomerCareCenter';
import { GrowthCenterB } from './GrowthCenterB';
import { Map, Route, MapPin, Truck, BarChart3, Banknote, ShieldCheck, Wallet, Rocket, Headset, Target, Star, LucideIcon } from 'lucide-react';

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
  { id: 'growth', ar: 'محرّك النمو', en: 'Growth Engine', Icon: Rocket },
  { id: 'care', ar: 'رعاية العملاء', en: 'Customer Care', Icon: Headset },
  { id: 'growthb', ar: 'إدارة النمو', en: 'Growth Mgmt', Icon: Target },
];

const money = (n: number) => `${Number(n || 0).toFixed(2)}`;
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;
const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };

export const OperationsCenter: React.FC<{ tab?: OpsTab; onTab?: (t: OpsTab) => void; hideTabs?: boolean }> = ({ tab: extTab, onTab, hideTabs }) => {
  const { lang } = useAppConfig();
  const [intTab, setIntTab] = useState<OpsTab>('command');
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
      {tab === 'growth' && <GrowthCenter />}
      {tab === 'care' && <CustomerCareCenter />}
      {tab === 'growthb' && <GrowthCenterB />}
    </div>
  );
};

// ════════════════════════ DISPATCH ════════════════════════
const DispatchPanel: React.FC = () => {
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
    if (error) return toast.error(`فشل الإرسال: ${error.message}`);
    if (!data) return toast.error('لا يوجد مندوب متاح حاليًا.');
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
    if (error) return toast.error(`فشل التعيين: ${error.message}`);
    await load();
  };

  const expire = async () => {
    const { data } = await dispatchService.expireOffers();
    toast.error(`تم إنهاء ${data} عرض منتهي الصلاحية.`);
    await load();
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader size={32} /></div>;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">طابور الطلبات ({queue.length})</h3>
          <Button variant="secondary" size="sm" onClick={expire}>إنهاء العروض المنتهية</Button>
        </div>
        {queue.length === 0 ? <EmptyState title="لا توجد طلبات بانتظار التعيين" /> : queue.map(o => (
          <Card key={o.id} className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold">#{o.id.slice(0, 8)} · {money(o.total_amount)} ر.س</p>
                <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {o.merchant_branches?.name ?? '—'} · {o.merchant_branches?.zones?.name ?? 'بلا منطقة'} · رسوم {money(o.delivery_fee)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" loading={busy === o.id} onClick={() => doAuto(o)}>إرسال تلقائي</Button>
                <Button size="sm" variant="secondary" onClick={() => findDrivers(o)}>تعيين يدوي</Button>
              </div>
            </div>
            {candidates[o.id] && (
              <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: 'var(--color-outline-variant)' }}>
                {candidates[o.id].length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--color-error)' }}>لا يوجد مندوبون متاحون قريبون.</p>
                ) : candidates[o.id].map(c => (
                  <div key={c.driver_id} className="flex items-center justify-between text-sm">
                    <span>{driverNames[c.driver_id] ?? c.driver_id.slice(0, 8)} · {c.distance_km.toFixed(1)} كم · أولوية {c.priority_score} · {c.active_orders} طلب</span>
                    <Button size="sm" onClick={() => doManual(o.id, c.driver_id)}>تعيين</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        <h3 className="font-bold text-lg">سجل الإرسال</h3>
        {feed.length === 0 ? <EmptyState title="لا يوجد نشاط" /> : feed.map(a => (
          <Card key={a.id} className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{a.drivers?.full_name ?? '—'}</span>
              <Badge variant={a.status === 'accepted' ? 'success' : a.status === 'offered' ? 'secondary' : 'error'}>{a.status}</Badge>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              {a.method === 'auto' ? 'تلقائي' : 'يدوي'} · محاولة {a.attempt}{a.distance_km != null ? ` · ${a.distance_km} كم` : ''}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ════════════════════════ ZONES ════════════════════════
const ZonesPanel: React.FC = () => {
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
      {zones.length === 0 ? <EmptyState title="لا توجد مناطق" /> : zones.map(z => (
        <Card key={z.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-bold">{z.name}</p>
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                {z.cities?.name ?? '—'} · {z.polygon ? `مضلّع (${z.polygon.length} نقطة)` : 'بلا حدود مرسومة'}
              </p>
            </div>
            <button onClick={() => toggle(z)} className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer"
              style={{ background: z.is_active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: z.is_active ? '#4ade80' : 'var(--color-on-surface-variant)' }}>
              {z.is_active ? 'نشطة' : 'متوقفة'}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([['base_fee', 'رسوم أساسية'], ['per_km_fee', 'لكل كم'], ['min_fee', 'حد أدنى'], ['eta_minutes', 'وقت (دقيقة)']] as const).map(([key, label]) => (
              <label key={key} className="text-xs">
                <span style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
                <input type="number" value={field(z, key)} onChange={e => set(z.id, key, Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg text-sm" style={surface} />
              </label>
            ))}
          </div>
          {edit[z.id] && <Button size="sm" className="mt-3" onClick={() => save(z)}>حفظ التغييرات</Button>}
        </Card>
      ))}
    </div>
  );
};

// ════════════════════════ VEHICLES ════════════════════════
const VehiclesPanel: React.FC = () => {
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
            <p className="font-bold">{v.name_ar} <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>({v.type})</span></p>
            <Badge variant={v.is_active ? 'success' : 'secondary'}>{v.is_active ? 'مفعّلة' : 'موقوفة'}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([['capacity', 'السعة'], ['speed_kmh', 'السرعة كم/س'], ['pricing_modifier', 'معامل السعر']] as const).map(([key, label]) => (
              <label key={key} className="text-xs">
                <span style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
                <input type="number" step="0.1" value={field(v, key)} onChange={e => set(v.id, key, Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg text-sm" style={surface} />
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            {edit[v.id] && <Button size="sm" onClick={() => save(v)}>حفظ</Button>}
            <Button size="sm" variant="secondary" onClick={async () => { await vehicleService.update(v.id, { is_active: !v.is_active }); await load(); }}>
              {v.is_active ? 'إيقاف' : 'تفعيل'}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

// ════════════════════════ PERFORMANCE ════════════════════════
const PerformancePanel: React.FC = () => {
  const [rows, setRows] = useState<(DriverPerformance & { full_name: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const { data } = await performanceService.leaderboard(50); setRows(data); setLoading(false); };
  useEffect(() => { load(); }, []);
  const recalc = async (id: string) => { await performanceService.recalc(id); await load(); };

  if (loading) return <div className="py-12 flex justify-center"><Loader size={32} /></div>;
  if (rows.length === 0) return <EmptyState title="لا توجد بيانات أداء" />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: 'var(--color-on-surface-variant)' }} className="text-xs">
            {['المندوب', 'مكتملة', 'قبول', 'إكمال', 'إلغاء', 'متوسط (د)', 'تقييم', 'أرباح', ''].map(h => <th key={h} className="px-3 py-2 text-start font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.driver_id} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <td className="px-3 py-2 font-semibold">{r.full_name}</td>
              <td className="px-3 py-2">{r.orders_completed}</td>
              <td className="px-3 py-2">{pct(r.acceptance_rate)}</td>
              <td className="px-3 py-2">{pct(r.completion_rate)}</td>
              <td className="px-3 py-2">{pct(r.cancellation_rate)}</td>
              <td className="px-3 py-2">{r.avg_delivery_minutes.toFixed(0)}</td>
              <td className="px-3 py-2"><span className="inline-flex items-center gap-1"><Star size={13} fill="#fbbf24" color="#fbbf24" />{r.rating.toFixed(1)}</span></td>
              <td className="px-3 py-2">{money(r.total_earnings)}</td>
              <td className="px-3 py-2"><Button size="sm" variant="secondary" onClick={() => recalc(r.driver_id)}>تحديث</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

// ════════════════════════ PAYOUTS ════════════════════════
const PayoutsPanel: React.FC = () => {
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
    const note = prompt('سبب الرفض (اختياري):') ?? undefined;
    setBusy(id); const { error } = await payoutService.reject(id, note); setBusy(null);
    if (error) return toast.error(error.message); await load();
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader size={32} /></div>;
  const pending = reqs.filter(r => r.status === 'pending');
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">طلبات السحب المعلّقة ({pending.length})</h3>
      {pending.length === 0 ? <EmptyState title="لا توجد طلبات معلّقة" /> : pending.map(r => (
        <Card key={r.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-bold">{r.drivers?.full_name ?? r.driver_id.slice(0, 8)} · {money(r.amount)} ر.س</p>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{new Date(r.requested_at).toLocaleString('ar')}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" loading={busy === r.id} onClick={() => approve(r.id)}>موافقة وصرف</Button>
            <Button size="sm" variant="secondary" onClick={() => reject(r.id)}>رفض</Button>
          </div>
        </Card>
      ))}
      <h3 className="font-bold text-lg mt-6">السجل</h3>
      {reqs.filter(r => r.status !== 'pending').map(r => (
        <Card key={r.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{r.drivers?.full_name ?? r.driver_id.slice(0, 8)} · {money(r.amount)} ر.س</span>
          <Badge variant={r.status === 'paid' ? 'success' : 'error'}>{r.status}</Badge>
        </Card>
      ))}
    </div>
  );
};
