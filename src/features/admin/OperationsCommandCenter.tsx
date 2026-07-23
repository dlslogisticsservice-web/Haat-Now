import React, { useEffect, useRef, useState } from 'react';
import { toast } from '../../components/ui/feedback';
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { commandService, LiveDriver, LiveOrder, LiveMerchant, OpsSummary, ZoneAnalytics } from '../../services/ops/command.service';
import { dispatchService } from '../../services/ops/dispatch.service';
import { OpsSlaMonitor } from './OpsSlaMonitor';
import { OpsExecutionConsole } from './OpsExecutionConsole';
import { OpsIncidentLog } from './OpsIncidentLog';
import { OpsSvgMap } from './OpsSvgMap';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { AdminDataTable, Column } from '../../components/admin/AdminDataTable';
import { capabilities as providerCapabilities, declaredEmailVendor } from '../../providers/registry';
import { monitoring } from '../../services/monitoring.service';

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
  const { lang } = useAppConfig();
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
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
    toast.success(`${L('تم إرسال','Dispatched')} ${count} ${L('طلب تلقائيًا.','orders automatically.')}`); await refresh();
  };

  const center = merchants[0] ?? drivers[0] ?? { lat: 24.7136, lng: 46.6753 }; // Riyadh fallback
  const stat = (label: string, val: number | undefined, color?: string) => (
    <Card className="p-3 text-center">
      <p className="text-headline-sm font-bold" style={color ? { color } : {}}>{val ?? 0}</p>
      <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p>
    </Card>
  );

  return (
    <div id="ops_command_center" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      {/* live summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {stat(L('طلبات نشطة','Active orders'), summary?.active_orders)}
        {stat(L('غير معيّنة','Unassigned'), summary?.unassigned_orders, 'var(--color-error)')}
        {stat(L('قيد التوصيل','In transit'), summary?.in_transit)}
        {stat(L('مندوبون متصلون','Online drivers'), summary?.online_drivers, 'var(--color-lime-vb, #9ed442)')}
        {stat(L('متاحون','Available'), summary?.available_drivers)}
        {stat(L('عروض معلّقة','Pending offers'), summary?.pending_offers)}
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
                  {k === 'drivers' ? L('المندوبون','Drivers') : k === 'orders' ? L('الطلبات','Orders') : k === 'merchants' ? L('المتاجر','Merchants') : L('خريطة حرارية','Heatmap')}
                </button>
              ))}
            </div>
            {MAPS_KEY ? (
              <div style={{ height: 460 }}>
                <APIProvider apiKey={MAPS_KEY}>
                  <Map defaultCenter={center} defaultZoom={11} gestureHandling="greedy" disableDefaultUI={false}>
                    {layers.drivers && drivers.map(d => <Marker key={d.id} position={{ lat: d.lat, lng: d.lng }} icon={driverIcon(d.status)} title={`${d.full_name ?? L('مندوب','Driver')} (${d.status})`} />)}
                    {layers.orders && orders.map(o => <Marker key={o.id} position={{ lat: o.lat, lng: o.lng }} icon={ICON('blue')} title={`${L('طلب','Order')} ${o.status} · ${o.total_amount}`} />)}
                    {layers.merchants && merchants.map(m => <Marker key={m.id} position={{ lat: m.lat, lng: m.lng }} icon={ICON('red')} title={m.name} />)}
                    <HeatLayer points={orders.map(o => ({ lat: o.lat, lng: o.lng }))} enabled={layers.heat} />
                  </Map>
                </APIProvider>
              </div>
            ) : (
              <OpsSvgMap drivers={drivers} orders={orders} merchants={merchants} layers={layers} lang={lang} />
            )}
          </Card>
        </div>

        {/* monitoring + dispatch */}
        <div className="space-y-3">
          <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">{L('الإرسال الجماعي','Batch dispatch')}</span>
              <Button size="sm" loading={busy} onClick={batch}>{L('إرسال','Dispatch')} {summary?.unassigned_orders ?? 0} {L('طلب','orders')}</Button>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{L('أرسل الطلبات غير المعيّنة لأقرب المندوبين تلقائيًا.','Auto-dispatch unassigned orders to the nearest drivers.')}</p>
          </Card>
          <Card className="p-3">
            <p className="font-bold text-sm mb-2">{L('مراقبة الإرسال','Dispatch monitor')}</p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {feed.length === 0 ? <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لا يوجد نشاط','No activity')}</p>
                : feed.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-xs">
                    <span>{a.drivers?.full_name ?? '—'} · {a.method === 'auto' ? L('تلقائي','Auto') : L('يدوي','Manual')}</span>
                    <Badge variant={a.status === 'accepted' ? 'success' : a.status === 'offered' ? 'secondary' : 'error'}>{a.status}</Badge>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      </div>

      {/* zone analytics */}
      <AdminDataTable
        lang={lang}
        rows={zones}
        rowKey={z => z.zone_id}
        search={z => z.zone_name}
        searchPlaceholder={L('ابحث عن منطقة…', 'Search zone…')}
        exportName="zone_analytics"
        emptyTitle={L('لا توجد مناطق', 'No zones')}
        columns={[
          { key: 'zone', header: L('المنطقة', 'Zone'), sortable: true, sortValue: z => z.zone_name, csv: z => z.zone_name, render: z => <span className="font-semibold">{z.zone_name}</span> },
          { key: 'status', header: L('الحالة', 'Status'), render: z => <Badge variant={z.is_active ? 'success' : 'secondary'}>{z.is_active ? L('نشطة', 'Active') : L('متوقفة', 'Paused')}</Badge> },
          { key: 'active', header: L('طلبات نشطة', 'Active orders'), sortable: true, sortValue: z => z.active_orders, csv: z => z.active_orders },
          { key: 'online', header: L('متصلون', 'Online'), sortable: true, sortValue: z => z.online_drivers, csv: z => z.online_drivers },
          { key: 'available', header: L('متاحون', 'Available'), sortable: true, sortValue: z => z.available_drivers, csv: z => z.available_drivers },
          { key: 'delivered', header: L('مكتمل اليوم', 'Delivered today'), sortable: true, sortValue: z => z.delivered_today, csv: z => z.delivered_today },
          { key: 'eta', header: 'ETA', sortable: true, sortValue: z => z.avg_eta, csv: z => z.avg_eta, render: z => `${z.avg_eta} ${L('د', 'min')}` },
        ] as Column<ZoneAnalytics>[]}
      />

      <EmailOperations L={L} />

      <OpsSlaMonitor />
      <OpsExecutionConsole />
      <OpsIncidentLog />
    </div>
  );
};

/**
 * Executive Command Center — Transactional Email operations. Read-only extension of the
 * Operations Dashboard (no redesign). Provider status comes from the Provider Registry;
 * delivery/failure signals come from the monitoring seam ([email] events). Live queue/
 * retry counts require the server-side email worker (not yet running), so they read 0
 * honestly rather than inventing traffic.
 */
const EmailOperations: React.FC<{ L: (ar: string, en: string) => string }> = ({ L }) => {
  const cap = providerCapabilities().find(c => c.capability === 'email');
  const evts = monitoring.recentEvents().filter(e => typeof e.message === 'string' && e.message.includes('[email]'));
  const count = (needle: string) => evts.filter(e => e.message.includes(needle)).length;
  const sends = count('send_failed');
  const templates = count('template_failed');
  const bounces = count('bounce');
  const total = evts.length;
  const failRate = total > 0 ? Math.round(((sends + templates) / total) * 100) : 0;
  const statusColor = cap?.status === 'active' ? 'var(--color-lime-vb, #9ed442)' : cap?.status === 'demo' ? '#fbbf24' : 'var(--color-on-surface-variant)';

  return (
    <Card className="p-4" id="ecc_email_ops">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-headline-sm font-bold">{L('عمليات البريد المعاملاتي', 'Transactional Email Ops')}</h3>
        <Badge variant={cap?.status === 'active' ? 'success' : cap?.status === 'demo' ? 'warning' : 'secondary'}>
          {L('المزوّد', 'Provider')}: {declaredEmailVendor() || cap?.status || 'none'}
        </Badge>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          [L('المزوّد', 'Provider'), cap?.status ?? 'none', statusColor],
          [L('قائمة الانتظار', 'Queue'), '0', undefined],
          [L('في إعادة المحاولة', 'Retry queue'), '0', undefined],
          [L('فشل الإرسال', 'Send failures'), String(sends), sends ? 'var(--color-error)' : undefined],
          [L('الارتداد', 'Bounces'), String(bounces), bounces ? '#fbbf24' : undefined],
          [L('نسبة الفشل', 'Failure rate'), `${failRate}%`, failRate ? 'var(--color-error)' : undefined],
        ].map(([label, val, color], i) => (
          <Card key={i} className="p-3 text-center">
            <p className="text-headline-sm font-bold" style={color ? { color: color as string } : {}}>{val}</p>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p>
          </Card>
        ))}
      </div>
      <div className="mt-3">
        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>{L('أحدث أحداث التسليم', 'Recent delivery events')}</p>
        {evts.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            {L('لا أحداث بريد في هذه الجلسة. يتطلّب البثّ الحيّ عامل الإرسال من جهة الخادم.', 'No email events this session. Live delivery requires the server-side send worker.')}
          </p>
        ) : (
          <div className="space-y-0.5 font-mono text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            {evts.slice(0, 6).map((e, i) => <div key={i}>{new Date(e.at).toLocaleTimeString()} · {e.message.slice(0, 80)}</div>)}
          </div>
        )}
      </div>
    </Card>
  );
};
