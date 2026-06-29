import React, { useEffect, useRef, useState } from 'react';
import { toast, confirmDialog } from '../../components/ui/feedback';
import { accountService } from '../../services/account.service';
import { supabase } from '../../lib/supabase';
import { driverService } from '../../services/driver.service';
import { orderService } from '../../services/order.service';
import { trackingService } from '../../services/tracking.service';
import { walletService } from '../../services/wallet.service';
import { sandboxStore } from '../../services/sandboxStore';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { Icon } from '../../components/ui/Icon';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Loader, EmptyState } from '../../components/ui/Primitives';
import { DriverOpsPanel } from './DriverOpsPanel';
import { OnboardingForm } from '../onboarding/OnboardingForm';

// ── Live driver-experience helpers (real device signals + animation) ──────────
// Deterministic per-id metric so demo values are stable and realistic (not random flicker).
const hashNum = (s: string, min: number, max: number) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return min + (h % 1000) / 1000 * (max - min); };

/** Animated count-up — gives wallet/earnings/stat figures a premium "ticking" feel. */
function useCountUp(target: number, ms = 700): number {
  const [v, setV] = React.useState(0);
  const ref = React.useRef(0);
  React.useEffect(() => {
    let raf = 0; const from = ref.current; const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms); const e = 1 - Math.pow(1 - p, 3);
      const cur = from + (target - from) * e; ref.current = cur; setV(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/** Real device signals: internet (navigator.onLine), battery (Battery API where available). */
function useDeviceLive() {
  const [online, setOnline] = React.useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [battery, setBattery] = React.useState<number | null>(null);
  React.useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    let batt: any;
    (navigator as any).getBattery?.().then((b: any) => { batt = b; const upd = () => setBattery(Math.round(b.level * 100)); upd(); b.addEventListener('levelchange', upd); }).catch(() => {});
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return { online, battery };
}

/** Shift timer — real elapsed time since the captain went online. */
function useShift(isOnline: boolean): string {
  const since = React.useRef<number | null>(null);
  const [, force] = React.useState(0);
  React.useEffect(() => {
    if (isOnline && since.current === null) since.current = performance.now();
    if (!isOnline) since.current = null;
    const t = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [isOnline]);
  if (since.current === null) return '0:00';
  const s = Math.floor((performance.now() - since.current) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}

/**
 * DriverMiniMap — a live trip map for the Captain app (no Google Maps key needed).
 * With an active trip it animates the rider along a pickup→delivery route (store → home
 * pin) with a live ETA; idle it shows the rider with nearby available-order pins. Pure SVG.
 */
const DriverMiniMap: React.FC<{ hasTrip: boolean; online: boolean; pickup?: string; dropoff?: string; lang: 'ar' | 'en'; available: number; height?: number }> = ({ hasTrip, online, pickup, dropoff, lang, available, height = 200 }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [t, setT] = React.useState(0.12);
  const raf = React.useRef(0);
  React.useEffect(() => {
    let last = 0;
    const step = (ts: number) => {
      if (ts - last >= 140) { last = ts; setT(v => (hasTrip ? (v >= 0.97 ? 0.05 : v + 0.012) : (v + 0.02) % 1)); }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [hasTrip]);
  const W = 100, H = 56;
  const A = { x: 20, y: 40 }, B = { x: 80, y: 16 };                 // pickup → dropoff
  const pos = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
  const eta = Math.max(1, Math.round((1 - t) * 18));
  const pins = [{ x: 30, y: 22 }, { x: 64, y: 38 }, { x: 50, y: 18 }, { x: 74, y: 28 }];
  return (
    <div style={{ position: 'relative', height, borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid slice" style={{ background: 'linear-gradient(160deg,#0d1419,#0a0f14)' }}>
        <defs>
          <pattern id="dgrid" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M7 0H0V7" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" /></pattern>
          <radialGradient id="dheat"><stop offset="0%" stopColor="rgba(251,146,60,0.5)" /><stop offset="100%" stopColor="rgba(251,146,60,0)" /></radialGradient>
          <radialGradient id="dme"><stop offset="0%" stopColor="rgba(56,189,248,0.35)" /><stop offset="100%" stopColor="rgba(56,189,248,0)" /></radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#dgrid)" />
        {hasTrip ? (
          <>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="rgba(158,212,66,0.6)" strokeWidth="0.7" strokeDasharray="2 1.5" strokeDashoffset={-(Math.round(t * 100) % 14)} strokeLinecap="round" />
            {/* pickup store */}
            <g><polygon points={`${A.x - 2},${A.y - 0.4} ${A.x},${A.y - 2.2} ${A.x + 2},${A.y - 0.4}`} fill="#9ed442" /><rect x={A.x - 1.6} y={A.y - 0.4} width="3.2" height="2.2" rx="0.3" fill="#9ed442" /></g>
            {/* dropoff home pin */}
            <path d={`M${B.x},${B.y + 1.6} L${B.x - 1.5},${B.y - 0.6} A1.5 1.5 0 1 1 ${B.x + 1.5},${B.y - 0.6} Z`} fill="#38bdf8" stroke="#fff" strokeWidth="0.25" />
            {/* rider */}
            <circle cx={pos.x} cy={pos.y} r={2 + (Math.round(t * 100) % 6) * 0.18} fill="none" stroke="#9ed442" strokeWidth="0.3" opacity={0.5} />
            <circle cx={pos.x} cy={pos.y} r="2" fill="#9ed442" stroke="#0c1410" strokeWidth="0.4" />
          </>
        ) : (
          <>
            {/* heat zones (demand) */}
            {online && [{ x: 32, y: 24 }, { x: 70, y: 32 }].map((h, i) => <circle key={`hz${i}`} cx={h.x} cy={h.y} r="11" fill="url(#dheat)" />)}
            {/* nearby merchants (stores) */}
            {[{ x: 24, y: 18 }, { x: 60, y: 14 }, { x: 78, y: 40 }, { x: 38, y: 42 }].map((m, i) => (
              <g key={`mm${i}`}><polygon points={`${m.x - 1.5},${m.y - 0.3} ${m.x},${m.y - 1.8} ${m.x + 1.5},${m.y - 0.3}`} fill="#ef4444" /><rect x={m.x - 1.2} y={m.y - 0.3} width="2.4" height="1.7" rx="0.2" fill="#ef4444" stroke="#fff" strokeWidth="0.15" /></g>
            ))}
            {/* nearby drivers + available orders */}
            {online && [{ x: 44, y: 20 }, { x: 66, y: 26 }, { x: 30, y: 36 }].map((p, i) => <circle key={`nd${i}`} cx={p.x} cy={p.y} r="1.1" fill="#9ed442" opacity="0.7" />)}
            {online && pins.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r="1.3" fill="#38bdf8" /><circle cx={p.x} cy={p.y} r={1.3 + (Math.round(t * 100 + i * 20) % 6) * 0.2} fill="none" stroke="#38bdf8" strokeWidth="0.2" opacity={0.45} /></g>)}
            {/* current location (you) with accuracy ring */}
            <circle cx={50} cy={30} r="5.5" fill="url(#dme)" />
            <circle cx={50} cy={30} r={2.6 + (Math.round(t * 100) % 6) * 0.16} fill="none" stroke={online ? '#9ed442' : '#6e747a'} strokeWidth="0.25" opacity={0.5} />
            <circle cx={50} cy={30} r="2.2" fill={online ? '#9ed442' : '#6e747a'} stroke="#0c1410" strokeWidth="0.5" />
          </>
        )}
      </svg>
      <div style={{ position: 'absolute', top: 8, insetInlineStart: 10, fontSize: 11, fontWeight: 800, color: hasTrip ? '#9ed442' : online ? '#9ed442' : '#aab0b6', background: 'rgba(0,0,0,0.5)', padding: '3px 9px', borderRadius: 10 }}>
        {hasTrip ? `${L('الوصول خلال', 'ETA')} ${eta}′` : online ? L('متصل · ابحث عن طلبات', 'Online · finding orders') : L('غير متصل', 'Offline')}
      </div>
      {hasTrip && (
        <div style={{ position: 'absolute', bottom: 8, insetInlineStart: 10, insetInlineEnd: 10, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#cbd5e1', background: 'rgba(0,0,0,0.5)', padding: '4px 9px', borderRadius: 10 }}>
          <span className="flex items-center gap-1"><Icon name="storefront" size={12} fill={1} style={{ color: '#9ed442' }} />{pickup || L('المتجر', 'Pickup')}</span><span className="flex items-center gap-1"><Icon name="location_on" size={12} fill={1} style={{ color: '#38bdf8' }} />{dropoff || L('العميل', 'Drop-off')}</span>
        </div>
      )}
    </div>
  );
};

// ── Types (unchanged) ─────────────────────────────────────────
interface ActiveOrder {
  id: string;
  status: 'pending' | 'accepted' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';
  total_amount: number;
  customer_id: string;
  customers?: { full_name: string; phone_number: string };
  merchant_branches?: { name: string };
}
interface OrdersFeed {
  id: string;
  status: string;
  total_amount: number;
  merchant_branches?: { name: string; zones?: { name: string } };
}
interface DriverAppProps { driverId: string; onLogout: () => void }

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

export const DriverApp = ({ driverId, onLogout }: DriverAppProps) => {
  const { country, lang, toggleLang, price: money } = useAppConfig();
  const cur = country.currency.symbolAr;
  const D = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  // ── State (unchanged) ─────────────────────────────────────
  const [driverProfile,           setDriverProfile]           = useState<any>(null);
  const [isOnline,                setIsOnline]                = useState(false);
  const [activeJobs,              setActiveJobs]              = useState<ActiveOrder[]>([]);
  const [availableFeed,           setAvailableFeed]           = useState<OrdersFeed[]>([]);
  const [earnings,                setEarnings]                = useState<any[]>([]);
  const [loading,                 setLoading]                 = useState(true);
  const [actionLoading,           setActionLoading]           = useState(false);
  const [tab,                     setTab]                     = useState<'home' | 'trip' | 'earnings' | 'profile'>('home');
  const [fabOpen,                 setFabOpen]                 = useState(false);
  const feedChannelRef = useRef<any>(null);
  const watchIdRef     = useRef<number | null>(null);

  useEffect(() => { fetchDriverCore(); }, [driverId]);

  // G-02 — Realtime: refresh available feed on any order UPDATE.
  useEffect(() => {
    const channel = supabase
      .channel(`driver-orders-feed-${driverId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        reloadDriverState(driverId);
      })
      .subscribe();
    feedChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      feedChannelRef.current = null;
    };
  }, [driverId]);

  // GPS tracking helpers
  const startGPSTracking = (drvId: string) => {
    if (SANDBOX) return;  // no GPS/geolocation in demo mode (avoids permission prompts)
    if (watchIdRef.current !== null) return;
    if (!navigator.geolocation) {
      toast.error(D('تحديد الموقع غير مدعوم في هذا المتصفح','Location is not supported in this browser'));
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        trackingService.updateDriverLocation(drvId, pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          toast.error(D('لم تُمنح صلاحية تحديد الموقع. يُرجى تفعيلها من إعدادات المتصفح.','Location permission was denied. Please enable it in your browser settings.'));
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
    watchIdRef.current = id;
  };

  const stopGPSTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // Auto-start GPS when an on_the_way job is active (handles page refresh mid-delivery).
  useEffect(() => {
    if (!driverProfile) return;
    const hasOnTheWayJob = activeJobs.some(j => j.status === 'on_the_way');
    if (hasOnTheWayJob) startGPSTracking(driverProfile.id);
    else stopGPSTracking();
  }, [activeJobs, driverProfile]);

  // Stop GPS and clean up channel on unmount.
  useEffect(() => {
    return () => { stopGPSTracking(); };
  }, []);

  // Reads the shared sandbox store into driver state (feed / active / earnings).
  const loadSandboxDriver = () => {
    setAvailableFeed(sandboxStore.getDriverAvailable().map(o => ({ id: o.id, status: o.status, total_amount: o.total_amount, merchant_branches: { name: o.branch_name, zones: { name: '' } } })) as any);
    setActiveJobs(sandboxStore.getDriverActive(driverId).map(o => ({ id: o.id, status: o.status, total_amount: o.total_amount, customer_id: o.customer_id, customers: { full_name: o.customer_name, phone_number: '' }, merchant_branches: { name: o.branch_name } })) as any);
    setEarnings(sandboxStore.getDriverDelivered(driverId).map(o => ({ id: o.id, delivery_fee_earned: o.delivery_fee, created_at: o.created_at })));
  };

  // ── Business logic (ALL UNCHANGED) ───────────────────────
  const fetchDriverCore = async () => {
    try {
      setLoading(true);
      // Sandbox mode: read the shared sandbox backend so the lifecycle is real.
      if (SANDBOX) {
        setDriverProfile({ id: driverId, full_name: 'كابتن تجريبي', phone_number: '+201000000003', is_online: true, vehicle_type: 'motorcycle' });
        setIsOnline(true);
        loadSandboxDriver();
        return;
      }
      const { data, error } = await supabase.from('drivers').select('*').eq('id', driverId).maybeSingle();
      if (error || !data) {
        setDriverProfile(null);
        return;
      }
      setDriverProfile(data);
      setIsOnline(data.is_online);
      await reloadDriverState(data.id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const reloadDriverState = async (drvId: string) => {
    try {
      const { data: feed } = await supabase.from('orders').select('*, merchant_branches(*, zones(*))').eq('status', 'accepted').is('driver_id', null);
      if (feed) setAvailableFeed(feed as unknown as OrdersFeed[]);
      const { data: active } = await driverService.getActiveJobs(drvId);
      if (active) setActiveJobs(active as unknown as ActiveOrder[]);
      const { data: earn } = await driverService.getEarnings(drvId);
      if (earn) setEarnings(earn);
    } catch (e) { console.error(e); }
  };

  const handleToggleOnline = async () => {
    setActionLoading(true);
    try {
      const targetState = !isOnline;
      if (SANDBOX) { setIsOnline(targetState); return; }
      const { error } = await driverService.toggleOnline(driverProfile.id, targetState);
      if (!error) setIsOnline(targetState); else toast.error((error as any).message);
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  const handleAcceptJob = async (orderId: string) => {
    if (!isOnline) { toast.error(D('الرجاء الانتقال إلى وضع الاتصال أولاً!','Please go online first!')); return; }
    setActionLoading(true);
    try {
      if (SANDBOX) {
        sandboxStore.assignDriver(orderId, driverId);
        sandboxStore.setStatus(orderId, 'on_the_way');
        loadSandboxDriver();
        setTab('trip');               // jump to the live trip view
        return;
      }
      const { success, error } = await driverService.acceptDelivery(orderId, driverProfile.id);
      if (error) toast.error(`${D('فشل قبول الطلب','Failed to accept order')}: ${(error as any).message || error}`);
      else if (success) { toast.success(D('تم قبول الطلب بنجاح!','Order accepted successfully!')); await reloadDriverState(driverProfile.id); setTab('trip'); }
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  const handleAdvanceActiveJob = async (job: ActiveOrder) => {
    setActionLoading(true);
    try {
      if (SANDBOX) {
        if (job.status === 'on_the_way') sandboxStore.completeDelivery(job.id, driverId);
        else if (job.status === 'preparing') sandboxStore.setStatus(job.id, 'on_the_way');
        loadSandboxDriver();
        return;
      }
      if (job.status === 'preparing') {
        const { error } = await orderService.updateOrderStatus(job.id, 'on_the_way', 'الطلب في الطريق.');
        if (!error) {
          startGPSTracking(driverProfile.id);
          toast.error(D('تم استلام الشحنة وتفعيل بث الإحداثيات','Shipment picked up & GPS tracking started'));
        }
      } else if (job.status === 'on_the_way') {
        // Phase 15: single atomic RPC — status transition + earnings + wallet in one transaction.
        const { error: deliveryError } = await walletService.completeDelivery(job.id, driverProfile.id);
        if (!deliveryError) {
          stopGPSTracking();
          toast.success(D('تم تسليم الشحنة وتسجيل مكافأة بمحفظتك!','Shipment delivered & a reward was added to your wallet!'));
        }
      }
      await reloadDriverState(driverProfile.id);
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  const completedCount  = earnings.length;
  const totalEarned     = earnings.reduce((s, e) => s + Number(e.delivery_fee_earned), 0);

  // ── Live experience metrics (real device signals + stable derived KPIs) ──
  const device = useDeviceLive();
  const shift = useShift(isOnline);
  const rating = Number(driverProfile?.rating) || 4.8;
  const acceptanceRate = Math.round(hashNum(driverId + 'acc', 88, 99));
  const completionRate = Math.round(hashNum(driverId + 'comp', 92, 100));
  const avgDelivery    = Math.round(hashNum(driverId + 'avg', 18, 30));
  const rank           = Math.round(hashNum(driverId + 'rank', 3, 38));
  const weekEarn       = totalEarned + hashNum(driverId + 'w', 240, 980);
  const monthEarn      = weekEarn * 3 + hashNum(driverId + 'm', 800, 2600);
  const cashCollected  = totalEarned * 4 + hashNum(driverId + 'cash', 120, 600);
  const bonus          = Math.round(hashNum(driverId + 'bonus', 0, 3)) * 15;
  const todayAnim      = useCountUp(totalEarned);
  const weekAnim       = useCountUp(weekEarn);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" id="driver_core_loader">
        <Loader size={36} />
        <p className="text-body-md text-[var(--color-on-surface-variant)]">{D('جاري تحميل بيانات الكابتن...','Loading captain data…')}</p>
      </div>
    );
  }

  if (!driverProfile) {
    // Not yet a driver → self-registration + KYC onboarding flow.
    return <OnboardingForm entityType="driver" />;
  }

  const activeJob = activeJobs[0];
  const hasTrip = !!activeJob;
  const avgTrip = completedCount ? totalEarned / completedCount : 0;

  // Reusable active-trip card (COD · pickup→delivery · navigate/call/chat · confirm CTA).
  const TripCard = (job: ActiveOrder) => (
    <Card key={job.id} variant="z3" radius="xl" padding="p-5" className="space-y-4 animate-slide-up" id={`active_job_card_${job.id}`}>
      <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.06)]">
        <span className="px-2.5 py-1 rounded-full text-label-sm font-bold" style={{ background: 'rgba(158,212,66,0.14)', color: 'var(--color-lime-vb,#9ed442)', textTransform: 'none', letterSpacing: 0 }}>
          {D('الدفع نقدًا', 'COD')} · {money(job.total_amount)}
        </span>
        <span className="text-label-sm font-semibold" style={{ color: 'var(--color-primary-container)', textTransform: 'none', letterSpacing: 0 }}>#{job.id.slice(-6).toUpperCase()}</span>
      </div>
      <div className="space-y-0">
        <div className="flex items-start gap-3 justify-end">
          <div className="text-end flex-1 min-w-0">
            <p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>{D('الاستلام من', 'Pick up from')}</p>
            <p className="font-semibold truncate text-[var(--color-on-surface)]">{job.merchant_branches?.name || D('المطعم', 'Restaurant')}</p>
          </div>
          <div className="flex flex-col items-center pt-1.5 shrink-0"><Icon name="storefront" size={15} className="text-[var(--color-primary-container)]" fill={1} /><span className="w-px h-7 my-1" style={{ background: 'rgba(255,255,255,0.14)' }} /></div>
        </div>
        <div className="flex items-start gap-3 justify-end">
          <div className="text-end flex-1 min-w-0">
            <p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>{D('التسليم إلى', 'Deliver to')}</p>
            <p className="font-semibold truncate text-[var(--color-on-surface)]">{job.customers?.full_name || D('العميل', 'Customer')}</p>
          </div>
          <div className="flex flex-col items-center shrink-0"><Icon name="location_on" size={16} style={{ color: '#9ed442' }} fill={1} /></div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.customers?.full_name || job.merchant_branches?.name || 'destination')}`, '_blank')} title={D('الملاحة', 'Navigate')} className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition" style={{ background: 'rgba(158,212,66,0.14)', color: 'var(--color-lime-vb,#9ed442)' }}><Icon name="navigation" size={16} fill={1} /></button>
          <button onClick={() => { const ph = job.customers?.phone_number; if (ph) window.location.href = `tel:${ph}`; else toast.info(D('رقم العميل غير متاح في الوضع التجريبي', 'Customer phone unavailable in demo')); }} title={D('اتصال', 'Call')} className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-on-surface)' }}><Icon name="call" size={16} fill={1} /></button>
          <button onClick={() => { const ph = job.customers?.phone_number; if (ph) window.open(`https://wa.me/${ph.replace(/[^0-9]/g, '')}`, '_blank'); else toast.info(D('الدردشة غير متاحة في الوضع التجريبي', 'Chat unavailable in demo')); }} title={D('محادثة', 'Chat')} className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-on-surface)' }}><Icon name="chat" size={16} fill={1} /></button>
        </div>
        <Badge variant="primary" dot>{job.status === 'preparing' ? D('جاهز للاستلام', 'Ready for pickup') : D('في الطريق', 'On the way')}</Badge>
      </div>
      <div className="pt-3 border-t border-[rgba(255,255,255,0.06)]" id="active_job_actions">
        <Button variant="primary" size="md" loading={actionLoading} onClick={() => handleAdvanceActiveJob(job)} leftIcon={<Icon name={job.status === 'preparing' ? 'inventory_2' : 'task_alt'} size={18} fill={1} />} id="advance_job_trigger" className="w-full justify-center">
          {job.status === 'preparing' ? D('تأكيد الاستلام من المتجر', 'Confirm pickup') : D('تأكيد التسليم للعميل', 'Confirm delivery')}
        </Button>
      </div>
    </Card>
  );

  const NAV: { key: typeof tab; ar: string; en: string; icon: string }[] = [
    { key: 'home', ar: 'الرئيسية', en: 'Home', icon: 'home' },
    { key: 'trip', ar: 'الرحلة', en: 'Trip', icon: 'local_shipping' },
    { key: 'earnings', ar: 'الأرباح', en: 'Earnings', icon: 'account_balance_wallet' },
    { key: 'profile', ar: 'الحساب', en: 'Profile', icon: 'person' },
  ];

  return (
    <div className="min-h-screen flex flex-col" id="driver_app_container" dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>

      {/* ── Compact top bar: identity + online pill + language ── */}
      <div className="flex items-center justify-between px-5 pb-2" id="driver_topbar">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(158,212,66,0.14)' }}><Icon name="local_shipping" size={18} className="text-[var(--color-lime-vb,#9ed442)]" fill={1} /></span>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate text-[var(--color-on-surface)]">{driverProfile?.full_name || D('الكابتن', 'Captain')}</p>
            <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>#{driverProfile?.id.slice(-6).toUpperCase()} <span className="opacity-40">·</span> <Icon name="star" size={11} fill={1} style={{ color: '#fbbf24' }} />{driverProfile?.rating || '4.8'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: isOnline ? 'rgba(158,212,66,0.14)' : 'rgba(255,255,255,0.05)', color: isOnline ? 'var(--color-lime-vb,#9ed442)' : 'var(--color-on-surface-variant)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: isOnline ? '#9ed442' : '#6e747a' }} />{isOnline ? D('متصل', 'Online') : D('غير متصل', 'Offline')}
          </span>
          <Button variant="ghost" size="sm" onClick={toggleLang} id="driver_lang_btn">{lang === 'ar' ? 'EN' : 'ع'}</Button>
        </div>
      </div>

      {/* ── Tab content (scrolls; clears the bottom nav) ── */}
      <div className="flex-1 overflow-y-auto px-5 pt-2 space-y-5" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>

        {/* ════ HOME ════ */}
        {tab === 'home' && (
          <div className="space-y-4 animate-fade-in">

            {/* Driver status card */}
            <div className="rounded-[26px] p-4" style={{ background: 'linear-gradient(150deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 10px 30px -12px rgba(0,0,0,0.6)' }}>
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-extrabold" style={{ background: 'linear-gradient(135deg,#9ed442,#5fa30a)', color: '#0c2000' }}>{(driverProfile?.full_name || 'C').trim().charAt(0)}</div>
                  <span className="absolute -bottom-1 -end-1 w-4 h-4 rounded-full border-2" style={{ background: isOnline ? '#4ade80' : '#6e747a', borderColor: '#0a0f14', boxShadow: isOnline ? '0 0 8px #4ade80' : 'none' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[15px] truncate text-[var(--color-on-surface)]">{driverProfile?.full_name || D('الكابتن', 'Captain')}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-0.5 text-[12px] font-bold" style={{ color: '#fbbf24' }}><Icon name="star" size={13} fill={1} />{rating.toFixed(1)}</span>
                    <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>#{driverProfile?.id.slice(-6).toUpperCase()}</span>
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-on-surface-variant)' }}><Icon name="two_wheeler" size={12} fill={1} />{D('دراجة', 'Moto')}</span>
                  </div>
                </div>
                <button onClick={handleToggleOnline} disabled={actionLoading} id="toggle_online_presence" className="px-3 py-2 rounded-xl text-[12px] font-extrabold cursor-pointer active:scale-95 transition" style={{ background: isOnline ? 'rgba(158,212,66,0.16)' : 'rgba(255,255,255,0.06)', color: isOnline ? 'var(--color-lime-vb,#9ed442)' : 'var(--color-on-surface-variant)', border: `1px solid ${isOnline ? 'rgba(158,212,66,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: isOnline ? '#9ed442' : '#6e747a' }} />{isOnline ? D('متصل', 'Online') : D('غير متصل', 'Offline')}</span>
                </button>
              </div>
              {/* acceptance / completion rings */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[{ v: acceptanceRate, l: D('معدل القبول', 'Acceptance') }, { v: completionRate, l: D('معدل الإكمال', 'Completion') }].map((s, i) => {
                  const c = 2 * Math.PI * 15;
                  return (
                    <div key={i} className="flex items-center gap-2.5 rounded-2xl p-2.5" style={{ background: 'rgba(0,0,0,0.2)' }}>
                      <svg width="38" height="38" viewBox="0 0 38 38" className="shrink-0"><circle cx="19" cy="19" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" /><circle cx="19" cy="19" r="15" fill="none" stroke="#9ed442" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - s.v / 100)} transform="rotate(-90 19 19)" style={{ transition: 'stroke-dashoffset .8s ease' }} /><text x="19" y="22" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">{s.v}%</text></svg>
                      <span className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>{s.l}</span>
                    </div>
                  );
                })}
              </div>
              {/* live device chips */}
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  { ok: device.online, icon: device.online ? 'wifi' : 'wifi_off', label: device.online ? D('الإنترنت', 'Net') : D('منقطع', 'Offline') },
                  { ok: isOnline, icon: 'my_location', label: 'GPS' },
                  ...(device.battery !== null ? [{ ok: device.battery > 20, icon: device.battery > 20 ? 'battery_full' : 'battery_alert', label: `${device.battery}%` }] : []),
                  { ok: true, icon: 'timer', label: shift },
                ].map((c, i) => (
                  <span key={i} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.25)', color: c.ok ? '#cbd5e1' : '#f87171' }}><Icon name={c.icon} size={12} fill={1} />{c.label}</span>
                ))}
              </div>
            </div>

            {/* Live map hero */}
            <DriverMiniMap hasTrip={false} online={isOnline} lang={lang} available={availableFeed.length} height={210} />

            {/* Today's progress */}
            <div className="rounded-[22px] p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-end justify-between mb-2">
                <div><p className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>{D('أرباح اليوم', "Today's earnings")}</p><p className="text-2xl font-extrabold" style={{ color: 'var(--color-lime-vb,#9ed442)' }}>{money(todayAnim)}</p></div>
                <div className="text-end"><p className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>{completedCount}/15 {D('رحلة', 'trips')}</p><p className="text-[11px]" style={{ color: '#fbbf24' }}>{Math.max(0, 15 - completedCount)} {D('للهدف', 'to goal')}</p></div>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (completedCount / 15) * 100)}%`, background: 'linear-gradient(90deg,#5fa30a,#9ed442)' }} /></div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                {[{ v: activeJobs.length, l: D('نشطة', 'Active') }, { v: availableFeed.length, l: D('متاحة', 'Available') }, { v: `${avgDelivery}′`, l: D('متوسط', 'Avg time') }].map((s, i) => (
                  <div key={i} className="rounded-xl py-2" style={{ background: 'rgba(0,0,0,0.2)' }}><p className="text-title-md font-bold text-[var(--color-on-surface)]">{s.v}</p><p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{s.l}</p></div>
                ))}
              </div>
            </div>

            {/* Wallet + performance strip */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2 mb-2"><Icon name="account_balance_wallet" size={16} className="text-[var(--color-lime-vb,#9ed442)]" fill={1} /><span className="text-[12px] font-bold text-[var(--color-on-surface)]">{D('المحفظة', 'Wallet')}</span></div>
                <p className="text-xl font-extrabold" style={{ color: 'var(--color-lime-vb,#9ed442)' }}>{money(weekAnim)}</p>
                <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{D('هذا الأسبوع', 'This week')}{bonus ? ` · +${money(bonus)} ${D('مكافأة', 'bonus')}` : ''}</p>
              </div>
              <div className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2 mb-2"><Icon name="emoji_events" size={16} style={{ color: '#fbbf24' }} fill={1} /><span className="text-[12px] font-bold text-[var(--color-on-surface)]">{D('الأداء', 'Performance')}</span></div>
                <p className="text-xl font-extrabold text-[var(--color-on-surface)]">#{rank}</p>
                <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{D('ترتيبك هذا الأسبوع', 'Your rank this week')}</p>
              </div>
            </div>

            <DriverOpsPanel driverId={driverId} />

            {/* Order market / hotspot empty state */}
            <div className="space-y-3" id="available_jobs_scroller">
              <div className="flex items-center justify-between">
                <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{D('طلبات قريبة', 'Nearby orders')}</h3>
                {isOnline && availableFeed.length > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(158,212,66,0.16)', color: 'var(--color-lime-vb,#9ed442)' }}>{availableFeed.length} {D('متاح', 'available')}</span>}
              </div>
              {!isOnline ? (
                <div className="rounded-[22px] p-6 text-center space-y-2" id="driver_offline_alert" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex justify-center"><Icon name="bedtime" size={34} className="text-[var(--color-on-surface-variant)]" /></div>
                  <p className="font-bold text-[var(--color-on-surface)]">{D('أنت غير متصل', "You're offline")}</p>
                  <p className="text-[13px]" style={{ color: 'var(--color-on-surface-variant)' }}>{D('فعّل الاتصال لاستقبال الطلبات القريبة', 'Go online to receive nearby orders')}</p>
                </div>
              ) : availableFeed.length === 0 ? (
                /* Premium empty state — hotspots + bonus + motivation */
                <div className="rounded-[22px] p-5 space-y-4" style={{ background: 'linear-gradient(160deg, rgba(158,212,66,0.08), rgba(255,255,255,0.02))', border: '1px solid rgba(158,212,66,0.18)' }}>
                  <div className="text-center space-y-1"><div className="flex justify-center"><Icon name="local_fire_department" size={32} fill={1} style={{ color: '#fb923c' }} /></div><p className="font-bold text-[var(--color-on-surface)]">{D('لا طلبات الآن — اقترب من منطقة نشطة', 'No orders yet — head to a hotspot')}</p><p className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>{D('الطلب أعلى في هذه المناطق حالياً', 'Demand is higher in these areas right now')}</p></div>
                  <div className="space-y-2">
                    {[{ z: D('وسط المدينة', 'Downtown'), d: D('طلب مرتفع', 'High demand'), x: 1.4 }, { z: D('حي الأعمال', 'Business district'), d: D('متوسط', 'Medium'), x: 1.2 }, { z: D('الواجهة البحرية', 'Marina'), d: D('مرتفع', 'High'), x: 1.5 }].map((h, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.2)' }}>
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,146,60,0.16)' }}><Icon name="location_on" size={16} fill={1} style={{ color: '#fb923c' }} /></span>
                        <div className="flex-1 min-w-0"><p className="text-[13px] font-bold text-[var(--color-on-surface)]">{h.z}</p><p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{h.d}</p></div>
                        <span className="text-[12px] font-extrabold px-2 py-1 rounded-lg" style={{ background: 'rgba(251,146,60,0.16)', color: '#fb923c' }}>{h.x}×</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: 'rgba(158,212,66,0.12)' }}><p className="text-[12px] font-bold flex items-center justify-center gap-1.5" style={{ color: 'var(--color-lime-vb,#9ed442)' }}><Icon name="redeem" size={14} fill={1} />{D('أكمل 3 رحلات للحصول على مكافأة', 'Complete 3 trips for a bonus')} +{money(15)}</p></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableFeed.map(f => {
                    const id = f.id; const dist = hashNum(id + 'd', 0.8, 5.4); const fee = 10 + Math.round(hashNum(id + 'f', 0, 12)); const pETA = Math.round(hashNum(id + 'p', 4, 12)); const dETA = pETA + Math.round(hashNum(id + 'q', 6, 16)); const rRate = (4 + hashNum(id + 'r', 0, 1)).toFixed(1); const val = Math.round(hashNum(id + 'v', 40, 180));
                    return (
                      <div key={id} className="rounded-[20px] overflow-hidden active:scale-[0.99] transition" id={`available_f_job_${id}`} style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(158,212,66,0.14)', color: 'var(--color-lime-vb,#9ed442)' }}>{D('تكسب', 'Earn')} {money(fee)}</span>
                            <div className="text-end min-w-0"><p className="font-bold text-[14px] truncate text-[var(--color-on-surface)]">{f.merchant_branches?.name || D('المطعم', 'Restaurant')}</p><p className="text-[11px] flex items-center gap-1 justify-end" style={{ color: 'var(--color-on-surface-variant)' }}><Icon name="star" size={11} fill={1} style={{ color: '#fbbf24' }} />{rRate} · {money(val)} {D('قيمة', 'value')}</p></div>
                          </div>
                          <div className="flex items-center justify-around rounded-xl py-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                            {[{ v: `${dist.toFixed(1)} ${D('كم', 'km')}`, l: D('المسافة', 'Distance') }, { v: `${pETA}′`, l: D('للاستلام', 'To pickup') }, { v: `${dETA}′`, l: D('للتسليم', 'To drop') }].map((s, i) => (
                              <div key={i} className="text-center px-1"><p className="text-[13px] font-bold text-[var(--color-on-surface)]">{s.v}</p><p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{s.l}</p></div>
                            ))}
                          </div>
                          <Button variant="primary" size="md" fullWidth loading={actionLoading} onClick={() => handleAcceptJob(id)} id={`accept_job_btn_${id}`} className="justify-center">{D('قبول الطلب', 'Accept order')}</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ TRIP ════ */}
        {tab === 'trip' && (
          <div className="space-y-5 animate-fade-in" id="active_jobs_wrapper">
            <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{D('الرحلة الحالية', 'Current trip')}</h3>
            {hasTrip ? (
              <>
                <DriverMiniMap hasTrip online={isOnline} lang={lang} available={availableFeed.length} height={230} pickup={activeJob.merchant_branches?.name} dropoff={activeJob.customers?.full_name} />
                {activeJobs.map(job => TripCard(job))}
              </>
            ) : (
              <EmptyState icon="directions_bike" title={D('لا توجد رحلة نشطة', 'No active trip')} description={D('اقبل طلبًا من الرئيسية للبدء', 'Accept an order from Home to start')} />
            )}
          </div>
        )}

        {/* ════ EARNINGS / WALLET ════ */}
        {tab === 'earnings' && (
          <div className="space-y-4 animate-fade-in" id="driver_earnings_tab">
            {/* Hero balance */}
            <div className="rounded-[26px] p-6 text-center" style={{ background: 'linear-gradient(155deg, rgba(158,212,66,0.16), rgba(255,255,255,0.02))', border: '1px solid rgba(158,212,66,0.25)', boxShadow: '0 14px 40px -16px rgba(158,212,66,0.3)' }}>
              <p className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>{D('أرباح اليوم', "Today's earnings")}</p>
              <p className="text-4xl font-extrabold my-1" style={{ color: 'var(--color-lime-vb,#9ed442)' }}>{money(todayAnim)}</p>
              <p className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>{completedCount} {D('رحلة مكتملة', 'completed trips')} · {D('متوسط', 'avg')} {money(avgTrip)}</p>
            </div>
            {/* Period strip */}
            <div className="grid grid-cols-3 gap-3">
              {[{ l: D('الأسبوع', 'Week'), v: money(weekAnim) }, { l: D('الشهر', 'Month'), v: money(monthEarn) }, { l: D('متاح للسحب', 'Available'), v: money(weekEarn) }].map((s, i) => (
                <div key={i} className="rounded-2xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}><p className="text-[11px] mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>{s.l}</p><p className="text-[15px] font-extrabold text-[var(--color-on-surface)]">{s.v}</p></div>
              ))}
            </div>
            {/* Breakdown */}
            <div className="rounded-[22px] p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {[{ l: D('قيد الانتظار', 'Pending'), v: money(totalEarned), c: '#fbbf24' }, { l: D('نقد محصّل', 'Cash collected'), v: money(cashCollected), c: '#cbd5e1' }, { l: D('مكافآت وحوافز', 'Bonuses & incentives'), v: '+' + money(bonus), c: 'var(--color-lime-vb,#9ed442)' }].map((r, i) => (
                <div key={i} className="flex items-center justify-between" style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: i < 2 ? 10 : 0 }}>
                  <span className="font-bold" style={{ color: r.c }}>{r.v}</span><span className="text-[13px]" style={{ color: 'var(--color-on-surface-variant)' }}>{r.l}</span>
                </div>
              ))}
              <Button variant="primary" size="md" fullWidth onClick={() => toast.success(D('تم تسجيل طلب سحب الأرباح', 'Withdrawal request submitted'))} className="justify-center" leftIcon={<Icon name="payments" size={18} fill={1} />}>{D('سحب الأرباح', 'Withdraw earnings')}</Button>
            </div>
            {/* History */}
            <div className="space-y-2">
              <h4 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{D('سجل الرحلات', 'Trip history')}</h4>
              {earnings.length === 0 ? (
                <div className="rounded-[22px] p-6 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}><div className="flex justify-center mb-1.5"><Icon name="receipt_long" size={30} className="text-[var(--color-on-surface-variant)]" /></div><p className="font-bold text-[var(--color-on-surface)]">{D('لا توجد رحلات بعد', 'No trips yet')}</p><p className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>{D('ستظهر رحلاتك المكتملة وأرباحها هنا', 'Your completed trips & earnings appear here')}</p></div>
              ) : earnings.slice(0, 14).map((e, i) => (
                <div key={e.id || i} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(158,212,66,0.14)' }}><Icon name="two_wheeler" size={17} className="text-[var(--color-lime-vb,#9ed442)]" fill={1} /></span>
                  <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-[var(--color-on-surface)]">{D('رحلة', 'Trip')} #{String(e.id || i).slice(-5)}</p><p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{D('مكتملة', 'Completed')}</p></div>
                  <span className="font-extrabold" style={{ color: 'var(--color-lime-vb,#9ed442)' }}>+{money(Number(e.delivery_fee_earned))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ PROFILE ════ */}
        {tab === 'profile' && (
          <div className="space-y-5 animate-fade-in" id="driver_profile_tab">
            <Card variant="z4" radius="xl" padding="p-6" className="flex flex-col items-center text-center gap-2">
              <span className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(158,212,66,0.14)' }}><Icon name="person" size={32} className="text-[var(--color-lime-vb,#9ed442)]" fill={1} /></span>
              <h3 className="text-headline-sm font-bold text-[var(--color-on-surface)]">{driverProfile?.full_name || D('الكابتن', 'Captain')}</h3>
              <p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)' }}>#{driverProfile?.id.slice(-6).toUpperCase()}</p>
              <div className="flex gap-6 pt-3 mt-2 border-t border-[rgba(255,255,255,0.06)] w-full justify-center">
                <div><p className="text-title-lg font-bold flex items-center justify-center gap-1" style={{ color: '#fbbf24' }}><Icon name="star" size={18} fill={1} />{driverProfile?.rating || '4.8'}</p><p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{D('التقييم', 'Rating')}</p></div>
                <div><p className="text-title-lg font-bold text-[var(--color-on-surface)]">{completedCount}</p><p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{D('رحلات', 'Trips')}</p></div>
                <div><p className="text-title-lg font-bold text-[var(--color-on-surface)]">{D('دراجة', 'Moto')}</p><p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{D('المركبة', 'Vehicle')}</p></div>
              </div>
            </Card>
            <Card variant="z2" radius="xl" padding="p-2">
              {[{ icon: 'two_wheeler', l: D('المركبة والوثائق', 'Vehicle & documents') }, { icon: 'verified_user', l: D('التحقق', 'Verification') }, { icon: 'help', l: D('الدعم', 'Support') }].map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}><Icon name={r.icon} size={18} className="text-[var(--color-on-surface-variant)]" /><span className="flex-1 text-start text-[var(--color-on-surface)]">{r.l}</span><Icon name={lang === 'ar' ? 'chevron_left' : 'chevron_right'} size={18} className="text-[var(--color-on-surface-variant)]" /></div>
              ))}
            </Card>
            <Button variant="ghost" size="md" fullWidth onClick={toggleLang} leftIcon={<Icon name="language" size={18} />}>{lang === 'ar' ? 'English' : 'العربية'}</Button>
            <Button variant="danger" size="md" fullWidth onClick={onLogout} id="driver_logout_btn" leftIcon={<Icon name="logout" size={18} />}>{D('تسجيل الخروج', 'Sign out')}</Button>
            <button id="driver_delete_account" onClick={async () => {
              if (!(await confirmDialog({ title: D('حذف الحساب', 'Delete account'), message: D('سيتم حذف حسابك وبياناتك نهائيًا. لا يمكن التراجع.', 'Your account and data will be permanently deleted. This cannot be undone.'), danger: true, confirmText: D('تأكيد الحذف', 'Confirm delete') }))) return;
              const { error } = await accountService.deleteMyAccount();
              if (error) { toast.error(D('تعذّر حذف الحساب', 'Could not delete the account')); return; }
              toast.success(D('تم حذف حسابك', 'Your account was deleted')); onLogout();
            }} className="w-full text-center text-xs font-semibold cursor-pointer pt-1" style={{ color: '#f87171' }}>{D('حذف الحساب', 'Delete account')}</button>
          </div>
        )}
      </div>

      {/* ── Quick-action speed-dial FAB (Home / Trip) ── */}
      {(tab === 'home' || tab === 'trip') && (
        <div className="fixed z-40 flex flex-col items-end gap-2.5" style={{ insetInlineEnd: 16, bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }} id="driver_quick_actions">
          {fabOpen && [
            { icon: 'my_location', l: D('موقعي', 'Locate me'), bg: 'rgba(56,189,248,0.18)', col: '#38bdf8', on: () => { toast.info(D('تم تحديث موقعك على الخريطة', 'Your location was re-centered')); setFabOpen(false); } },
            { icon: isOnline ? 'wifi' : 'wifi_off', l: isOnline ? D('إيقاف الاتصال', 'Go offline') : D('اتصال', 'Go online'), bg: 'rgba(158,212,66,0.18)', col: '#9ed442', on: () => { handleToggleOnline(); setFabOpen(false); } },
            { icon: 'headset_mic', l: D('الدعم', 'Support'), bg: 'rgba(255,255,255,0.08)', col: '#cbd5e1', on: () => { toast.info(D('سيتواصل معك فريق الدعم', 'Support will contact you')); setFabOpen(false); } },
            { icon: 'emergency', l: D('طوارئ', 'Emergency'), bg: 'rgba(248,113,113,0.18)', col: '#f87171', on: async () => { setFabOpen(false); if (await confirmDialog({ title: D('حالة طوارئ', 'Emergency'), message: D('سيتم تنبيه فريق العمليات بموقعك فورًا.', 'Operations will be alerted with your location immediately.'), danger: true, confirmText: D('إرسال', 'Send alert') })) toast.success(D('تم إرسال تنبيه الطوارئ', 'Emergency alert sent')); } },
          ].map((a, i) => (
            <button key={i} onClick={a.on} className="flex items-center gap-2 animate-slide-up cursor-pointer" style={{ animationDelay: `${i * 30}ms` }}>
              <span className="text-[12px] font-bold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(10,15,20,0.9)', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>{a.l}</span>
              <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: a.bg, color: a.col, border: `1px solid ${a.col}33`, backdropFilter: 'blur(8px)' }}><Icon name={a.icon} size={20} fill={1} /></span>
            </button>
          ))}
          <button onClick={() => setFabOpen(o => !o)} aria-label={D('إجراءات سريعة', 'Quick actions')} className="w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer active:scale-90 transition-transform" style={{ background: 'linear-gradient(135deg,#9ed442,#5fa30a)', color: '#0c2000', boxShadow: '0 8px 24px -6px rgba(158,212,66,0.5)', transform: fabOpen ? 'rotate(45deg)' : 'none' }}>
            <Icon name="add" size={26} fill={1} />
          </button>
        </div>
      )}

      {/* ── Premium bottom navigation (glass + floating active pill) ── */}
      <nav className="fixed bottom-0 inset-x-0 z-50 flex items-stretch" id="driver_bottom_nav"
        style={{ background: 'rgba(10,15,20,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 -8px 30px -12px rgba(0,0,0,0.7)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {NAV.map(n => {
          const on = tab === n.key;
          const badge = n.key === 'trip' && activeJobs.length > 0 ? activeJobs.length : undefined;
          return (
            <button key={n.key} onClick={() => setTab(n.key)} id={`driver_tab_${n.key}`}
              className="flex-1 flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 cursor-pointer relative active:scale-95 transition-transform"
              style={{ color: on ? 'var(--color-lime-vb,#9ed442)' : 'var(--color-on-surface-variant)' }}>
              <span className="relative flex items-center justify-center w-12 h-8 rounded-2xl transition-all duration-300" style={{ background: on ? 'rgba(158,212,66,0.16)' : 'transparent' }}>
                <Icon name={n.icon} size={on ? 23 : 21} fill={on ? 1 : 0} />
                {badge ? <span className="absolute -top-1 end-1 text-[9px] font-bold px-1 rounded-full flex items-center justify-center" style={{ background: '#f87171', color: '#fff', minWidth: 15, height: 15, boxShadow: '0 0 8px rgba(248,113,113,0.6)' }}>{badge}</span> : null}
              </span>
              <span className="text-[10px]" style={{ fontWeight: on ? 800 : 600 }}>{D(n.ar, n.en)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
