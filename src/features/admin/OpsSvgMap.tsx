import React, { useEffect, useRef, useState } from 'react';

type Pt = { x: number; y: number };
type LiveDriver = { id: string; full_name: string | null; lat: number; lng: number; status: string };
type LiveOrder = { id: string; status: string; lat: number; lng: number };
type LiveMerchant = { id: string; name: string; lat: number; lng: number };

const VW = 100, VH = 60;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

// Deterministic pseudo-random (seeded) so the simulated fleet is stable across renders.
function seeded(n: number) { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }

type SimDriver = { id: string; name: string; from: Pt; to: Pt; pos: Pt; t: number; speed: number; status: 'available' | 'busy' | 'in_transit'; idle: number };

// Build a simulated fleet: fixed merchants + N drivers each running a merchant→customer route.
function buildFleet(merchants: Pt[]): SimDriver[] {
  const N = 14;
  return Array.from({ length: N }, (_, i) => {
    const from = merchants[i % merchants.length];
    const to = { x: 8 + seeded(i + 1) * 84, y: 8 + seeded(i + 7) * 44 };
    const t = seeded(i + 3);
    return { id: `sim-${i}`, name: `#${1000 + i}`, from, to, pos: { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) }, t, speed: 0.06 + seeded(i + 5) * 0.07, status: 'in_transit', idle: 0 };
  });
}

/**
 * OpsSvgMap — a fully-functional animated operations map that works with NO Google Maps
 * key. It renders merchant / customer / driver markers and animates a moving fleet along
 * merchant→customer routes (route animation + live ETA), overlaying any real live data
 * passed in. This is the "SVG simulation" fallback: every map control stays functional.
 */
export const OpsSvgMap: React.FC<{
  drivers: LiveDriver[]; orders: LiveOrder[]; merchants: LiveMerchant[];
  layers: { drivers: boolean; orders: boolean; merchants: boolean; heat: boolean };
  lang: 'ar' | 'en';
}> = ({ drivers, orders, merchants, layers, lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  // Fixed simulated merchant anchors (spread across the canvas).
  const simMerchants: Pt[] = [
    { x: 18, y: 16 }, { x: 50, y: 12 }, { x: 82, y: 18 }, { x: 26, y: 44 }, { x: 62, y: 48 }, { x: 86, y: 40 },
  ];
  const [fleet, setFleet] = useState<SimDriver[]>(() => buildFleet(simMerchants));
  const [tick, setTick] = useState(0);
  const raf = useRef<number>(0);

  // Animation loop — advance each driver along its route; on arrival, start a new delivery.
  useEffect(() => {
    let last = 0;
    const step = (ts: number) => {
      if (ts - last >= 140) {
        last = ts;
        setTick(k => k + 1);
        setFleet(prev => prev.map((d, i) => {
          if (d.status === 'available') {
            const idle = d.idle - 1;
            if (idle <= 0) {
              const from = simMerchants[(i + tick) % simMerchants.length];
              const to = { x: 8 + seeded(i + tick + 1) * 84, y: 8 + seeded(i + tick + 9) * 44 };
              return { ...d, from, to, pos: { ...from }, t: 0, status: 'in_transit', idle: 0 };
            }
            return { ...d, idle };
          }
          const t = d.t + d.speed * 0.12;
          if (t >= 1) return { ...d, t: 1, pos: { ...d.to }, status: 'available', idle: 10 + Math.floor(seeded(i + tick) * 16) };
          return { ...d, t, pos: { x: lerp(d.from.x, d.to.x, t), y: lerp(d.from.y, d.to.y, t) }, status: t > 0.08 ? 'in_transit' : 'busy' };
        }));
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Project real lat/lng (if present) into the viewBox by fitting bounds — overlaid on the sim.
  const realPts = [...drivers, ...orders, ...merchants].filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const project = (lat: number, lng: number): Pt => {
    if (realPts.length < 2) return { x: 50, y: 30 };
    const lats = realPts.map(p => p.lat), lngs = realPts.map(p => p.lng);
    const minLa = Math.min(...lats), maxLa = Math.max(...lats), minLo = Math.min(...lngs), maxLo = Math.max(...lngs);
    const x = 10 + ((lng - minLo) / (maxLo - minLo || 1)) * 80;
    const y = 50 - ((lat - minLa) / (maxLa - minLa || 1)) * 40;
    return { x, y };
  };

  const inTransit = fleet.filter(d => d.status === 'in_transit');
  const available = fleet.filter(d => d.status === 'available').length;
  const driverColor = (s: string) => s === 'available' ? '#4ade80' : s === 'busy' ? '#fbbf24' : '#38bdf8';
  const etaMin = (d: SimDriver) => Math.max(1, Math.round(dist(d.pos, d.to) * 1.4));

  return (
    <div style={{ position: 'relative', height: 460, background: 'var(--color-surface-container-high)' }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="opsgrid" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M6 0H0V6" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.25" /></pattern>
          <radialGradient id="heat"><stop offset="0%" stopColor="rgba(248,113,113,0.55)" /><stop offset="100%" stopColor="rgba(248,113,113,0)" /></radialGradient>
        </defs>
        <rect width={VW} height={VH} fill="url(#opsgrid)" />

        {/* Heatmap activity layer */}
        {layers.heat && inTransit.map(d => <circle key={`h-${d.id}`} cx={d.to.x} cy={d.to.y} r="9" fill="url(#heat)" />)}

        {/* Routes (driver → customer) with animated dash */}
        {layers.orders && inTransit.map(d => (
          <line key={`r-${d.id}`} x1={d.pos.x} y1={d.pos.y} x2={d.to.x} y2={d.to.y}
            stroke="rgba(56,189,248,0.55)" strokeWidth="0.5" strokeDasharray="2 1.5" strokeDashoffset={-(tick % 14)} strokeLinecap="round" />
        ))}

        {/* Customer / order markers (route destinations + real orders) */}
        {layers.orders && inTransit.map(d => (
          <g key={`c-${d.id}`}><circle cx={d.to.x} cy={d.to.y} r="1.1" fill="#38bdf8" /><circle cx={d.to.x} cy={d.to.y} r="1.1" fill="none" stroke="#38bdf8" strokeWidth="0.3" opacity={0.5} /></g>
        ))}
        {layers.orders && orders.map(o => { const p = project(o.lat, o.lng); return <circle key={`ro-${o.id}`} cx={p.x} cy={p.y} r="1.2" fill="#60a5fa" stroke="#fff" strokeWidth="0.2" />; })}

        {/* Merchant markers */}
        {layers.merchants && simMerchants.map((m, i) => (
          <g key={`m-${i}`}><rect x={m.x - 1.4} y={m.y - 1.4} width="2.8" height="2.8" rx="0.6" fill="#f87171" /><rect x={m.x - 1.4} y={m.y - 1.4} width="2.8" height="2.8" rx="0.6" fill="none" stroke="#fff" strokeWidth="0.25" /></g>
        ))}
        {layers.merchants && merchants.map(m => { const p = project(m.lat, m.lng); return <rect key={`rm-${m.id}`} x={p.x - 1.3} y={p.y - 1.3} width="2.6" height="2.6" rx="0.5" fill="#ef4444" stroke="#fff" strokeWidth="0.25" />; })}

        {/* Moving driver markers (animated) */}
        {layers.drivers && fleet.map(d => (
          <g key={d.id}>
            {d.status === 'in_transit' && <circle cx={d.pos.x} cy={d.pos.y} r={1.6 + (tick % 8) * 0.18} fill="none" stroke={driverColor(d.status)} strokeWidth="0.2" opacity={0.5 - (tick % 8) * 0.05} />}
            <circle cx={d.pos.x} cy={d.pos.y} r="1.5" fill={driverColor(d.status)} stroke="#0c1410" strokeWidth="0.3" />
          </g>
        ))}
        {layers.drivers && drivers.map(d => { const p = project(d.lat, d.lng); return <circle key={`rd-${d.id}`} cx={p.x} cy={p.y} r="1.5" fill={driverColor(d.status)} stroke="#fff" strokeWidth="0.3" />; })}

        {/* ETA labels for a few in-transit drivers */}
        {layers.drivers && inTransit.slice(0, 5).map(d => (
          <text key={`e-${d.id}`} x={d.pos.x + 2} y={d.pos.y - 1.4} fontSize="2.2" fill="#cbd5e1" style={{ fontWeight: 700 }}>{etaMin(d)}′</text>
        ))}
      </svg>

      {/* Overlay HUD */}
      <div style={{ position: 'absolute', top: 8, insetInlineStart: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ background: 'rgba(0,0,0,0.55)', color: '#9ed442', fontWeight: 800, fontSize: 11, padding: '3px 8px', borderRadius: 8 }}>
          ● {L('محاكاة حيّة', 'LIVE SIM')}
        </span>
        <span style={{ background: 'rgba(0,0,0,0.55)', color: '#e5e7eb', fontSize: 11, padding: '3px 8px', borderRadius: 8 }}>
          {L('قيد التوصيل', 'In transit')} {inTransit.length} · {L('متاح', 'Available')} {available}
        </span>
      </div>
      <div style={{ position: 'absolute', bottom: 8, insetInlineStart: 8, display: 'flex', gap: 10, fontSize: 10, color: '#cbd5e1', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 8 }}>
        <span>🟥 {L('متجر', 'Merchant')}</span><span>🟦 {L('عميل', 'Customer')}</span>
        <span style={{ color: '#4ade80' }}>● {L('متاح', 'Available')}</span><span style={{ color: '#38bdf8' }}>● {L('بالطريق', 'In transit')}</span>
      </div>
    </div>
  );
};
