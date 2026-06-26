import React, { useEffect, useRef, useState } from 'react';
import { toast } from '../../components/ui/feedback';
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { commandService, LiveDriver, LiveOrder, LiveMerchant, OpsSummary, ZoneAnalytics } from '../../services/ops/command.service';
import { dispatchService } from '../../services/ops/dispatch.service';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };
const ICON = (c: string) => `https://maps.google.com/mapfiles/ms/icons/${c}-dot.png`;
const driverIcon = (s: string) => ICON(s === 'available' ? 'green' : s === 'busy' ? 'orange' : 'ltblue');

/** Google Maps heatmap layer driven by order coordinates. */
const HeatLayer: React.FC<{ points: { lat: number; lng: number }[]; enabled: boolean }> = ({ points, enabled }) => {
  const map = useMap();
  const viz = useMapsLibrary('visualization') as any;
  const layerRef = useRef<any>(null);
  useEffect(() => {
    if (!map || !viz) return;
    if (!layerRef.current) layerRef.current = new viz.HeatmapLayer({ radius: 30 });
    layerRef.current.setData(points.map(p => ({ location: new (window as any).google.maps.LatLng(p.lat, p.lng), weight: 1 })));
    layerRef.current.setMap(enabled ? map : null);
    return () => { layerRef.current?.setMap(null); };
  }, [map, viz, points, enabled]);
  return null;
};

export const OperationsCommandCenter: React.FC = () => {
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [merchants, setMerchants] = useState<LiveMerchant[]>([]);
  const [zones, setZones] = useState<ZoneAnalytics[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [layers, setLayers] = useState({ drivers: true, orders: true, merchants: true, heat: false });
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [s, d, o, m, z, { data: f }] = await Promise.all([
      commandService.summary(), commandService.liveDrivers(), commandService.liveOrders(),
      commandService.liveMerchants(), commandService.zoneAnalytics(), dispatchService.recentAssignments(15),
    ]);
    setSummary(s); setDrivers(d); setOrders(o); setMerchants(m); setZones(z.data); setFeed(f);
  };
  useEffect(() => {
    refresh();
    const unsub = commandService.subscribeLive(refresh);
    const t = setInterval(refresh, 15000); // safety poll
    return () => { unsub(); clearInterval(t); };
  }, []);

  const batch = async () => {
    setBusy(true); const { count, error } = await commandService.batchDispatch(20); setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`تم إرسال ${count} طلب تلقائيًا.`); await refresh();
  };

  const center = merchants[0] ?? drivers[0] ?? { lat: 24.7136, lng: 46.6753 }; // Riyadh fallback
  const stat = (label: string, val: number | undefined, color?: string) => (
    <Card className="p-3 text-center">
      <p className="text-headline-sm font-bold" style={color ? { color } : {}}>{val ?? 0}</p>
      <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p>
    </Card>
  );

  return (
    <div id="ops_command_center" dir="rtl" className="space-y-4">
      {/* live summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {stat('طلبات نشطة', summary?.active_orders)}
        {stat('غير معيّنة', summary?.unassigned_orders, 'var(--color-error)')}
        {stat('قيد التوصيل', summary?.in_transit)}
        {stat('مندوبون متصلون', summary?.online_drivers, 'var(--color-lime-vb, #9ed442)')}
        {stat('متاحون', summary?.available_drivers)}
        {stat('عروض معلّقة', summary?.pending_offers)}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* MAP */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden" padding="p-0">
            <div className="flex items-center gap-2 p-2 flex-wrap" style={surface}>
              {(['drivers', 'orders', 'merchants', 'heat'] as const).map(k => (
                <button key={k} onClick={() => setLayers(l => ({ ...l, [k]: !l[k] }))}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer"
                  style={layers[k] ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : { background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                  {k === 'drivers' ? 'المندوبون' : k === 'orders' ? 'الطلبات' : k === 'merchants' ? 'المتاجر' : 'خريطة حرارية'}
                </button>
              ))}
            </div>
            {MAPS_KEY ? (
              <div style={{ height: 460 }}>
                <APIProvider apiKey={MAPS_KEY}>
                  <Map defaultCenter={center} defaultZoom={11} gestureHandling="greedy" disableDefaultUI={false}>
                    {layers.drivers && drivers.map(d => <Marker key={d.id} position={{ lat: d.lat, lng: d.lng }} icon={driverIcon(d.status)} title={`${d.full_name ?? 'مندوب'} (${d.status})`} />)}
                    {layers.orders && orders.map(o => <Marker key={o.id} position={{ lat: o.lat, lng: o.lng }} icon={ICON('blue')} title={`طلب ${o.status} · ${o.total_amount}`} />)}
                    {layers.merchants && merchants.map(m => <Marker key={m.id} position={{ lat: m.lat, lng: m.lng }} icon={ICON('red')} title={m.name} />)}
                    <HeatLayer points={orders.map(o => ({ lat: o.lat, lng: o.lng }))} enabled={layers.heat} />
                  </Map>
                </APIProvider>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-center p-8" style={{ height: 460 }}>
                <p className="font-bold">الخريطة الحيّة جاهزة — يلزم مفتاح Google Maps</p>
                <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  اضبط <code>VITE_GOOGLE_MAPS_API_KEY</code> لعرض المندوبين ({drivers.length}) والطلبات ({orders.length}) والمتاجر ({merchants.length}) على الخريطة.
                  البيانات الحيّة تعمل في اللوحات المجاورة.
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* monitoring + dispatch */}
        <div className="space-y-3">
          <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">الإرسال الجماعي</span>
              <Button size="sm" loading={busy} onClick={batch}>إرسال {summary?.unassigned_orders ?? 0} طلب</Button>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>أرسل الطلبات غير المعيّنة لأقرب المندوبين تلقائيًا.</p>
          </Card>
          <Card className="p-3">
            <p className="font-bold text-sm mb-2">مراقبة الإرسال</p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {feed.length === 0 ? <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>لا يوجد نشاط</p>
                : feed.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-xs">
                    <span>{a.drivers?.full_name ?? '—'} · {a.method === 'auto' ? 'تلقائي' : 'يدوي'}</span>
                    <Badge variant={a.status === 'accepted' ? 'success' : a.status === 'offered' ? 'secondary' : 'error'}>{a.status}</Badge>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      </div>

      {/* zone analytics */}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr style={{ color: 'var(--color-on-surface-variant)' }} className="text-xs">
            {['المنطقة', 'الحالة', 'طلبات نشطة', 'متصلون', 'متاحون', 'مكتمل اليوم', 'ETA'].map(h => <th key={h} className="px-3 py-2 text-start font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>
            {zones.map(z => (
              <tr key={z.zone_id} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <td className="px-3 py-2 font-semibold">{z.zone_name}</td>
                <td className="px-3 py-2"><Badge variant={z.is_active ? 'success' : 'secondary'}>{z.is_active ? 'نشطة' : 'متوقفة'}</Badge></td>
                <td className="px-3 py-2">{z.active_orders}</td>
                <td className="px-3 py-2">{z.online_drivers}</td>
                <td className="px-3 py-2">{z.available_drivers}</td>
                <td className="px-3 py-2">{z.delivered_today}</td>
                <td className="px-3 py-2">{z.avg_eta} د</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
