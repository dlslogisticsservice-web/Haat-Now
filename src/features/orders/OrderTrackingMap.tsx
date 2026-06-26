import React, { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { useTranslation } from 'react-i18next';
import { Bike } from 'lucide-react';
import { cxService, OrderTracking } from '../../services/cx.service';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const ICON = (c: string) => `https://maps.google.com/mapfiles/ms/icons/${c}-dot.png`;

/** Straight route line between driver and destination (road-routing would use the Directions API). */
const RouteLine: React.FC<{ from: { lat: number; lng: number } | null; to: { lat: number; lng: number } }> = ({ from, to }) => {
  const map = useMap();
  const ref = useRef<any>(null);
  useEffect(() => {
    if (!map || !from) return;
    const g = (window as any).google;
    if (!ref.current) ref.current = new g.maps.Polyline({ geodesic: true, strokeColor: '#9ed442', strokeOpacity: 0.9, strokeWeight: 4 });
    ref.current.setPath([from, to]);
    ref.current.setMap(map);
    return () => { ref.current?.setMap(null); };
  }, [map, from, to]);
  return null;
};

/** Live Google-Maps order tracking driven by the order_tracking RPC + realtime. */
export const OrderTrackingMap: React.FC<{ orderId: string }> = ({ orderId }) => {
  const { t: tr } = useTranslation();
  const [t, setT] = useState<OrderTracking | null>(null);

  const refresh = async () => setT(await cxService.tracking(orderId));
  useEffect(() => {
    refresh();
    const unsub = cxService.subscribeTracking(orderId, refresh);
    const poll = setInterval(refresh, 15000);
    return () => { unsub(); clearInterval(poll); };
  }, [orderId]);

  if (!t) return null;
  const dest = t.destination?.lat ? { lat: Number(t.destination.lat), lng: Number(t.destination.lng) } : null;
  const driver = t.driver?.lat ? { lat: Number(t.driver.lat), lng: Number(t.driver.lng) } : null;
  const center = driver ?? dest ?? { lat: 24.7136, lng: 46.6753 };

  return (
    <div className="glass rounded-2xl overflow-hidden mt-4" id="order_tracking_map">
      {/* ETA / distance header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ color: 'white' }}>
        <div>
          <p style={{ fontSize: 13, opacity: 0.8 }}>الوقت المتوقّع للوصول</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#9ed442' }}>{t.eta_minutes != null ? `${t.eta_minutes} دقيقة` : '—'}</p>
        </div>
        {t.remaining_km != null && (
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 13, opacity: 0.8 }}>المسافة المتبقية</p>
            <p style={{ fontSize: 16, fontWeight: 700 }}>{t.remaining_km} كم</p>
          </div>
        )}
      </div>

      {/* Map */}
      {MAPS_KEY && dest ? (
        <div style={{ height: 280 }}>
          <APIProvider apiKey={MAPS_KEY}>
            <Map defaultCenter={center} defaultZoom={13} gestureHandling="greedy" disableDefaultUI={true}>
              <Marker position={dest} icon={ICON('red')} title={tr('orders.homeLocation')} />
              {driver && <Marker position={driver} icon={ICON('green')} title={t.driver?.name ?? tr('orders.driver')} />}
              <RouteLine from={driver} to={dest} />
            </Map>
          </APIProvider>
        </div>
      ) : (
        <div className="flex items-center justify-center text-center p-6" style={{ height: 160, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          {!MAPS_KEY ? 'اضبط مفتاح Google Maps لعرض الخريطة الحيّة.' : 'بانتظار موقع التوصيل.'}
        </div>
      )}

      {/* Driver info */}
      {t.driver && (
        <div className="px-4 py-3 flex items-center justify-between" style={{ color: 'white', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }} className="inline-flex items-center gap-1.5"><Bike size={15} /> {t.driver.name}</span>
          {t.driver.phone && <a href={`tel:${t.driver.phone}`} style={{ color: '#9ed442', fontSize: 13, fontWeight: 700 }}>{tr('orders.call')}</a>}
        </div>
      )}
    </div>
  );
};
