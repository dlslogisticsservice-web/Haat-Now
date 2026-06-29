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
        <defs><pattern id="dgrid" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M7 0H0V7" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" /></pattern></defs>
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
            {online && pins.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r="1.4" fill="#9ed442" opacity="0.85" /><circle cx={p.x} cy={p.y} r={1.4 + (Math.round(t * 100 + i * 20) % 6) * 0.2} fill="none" stroke="#9ed442" strokeWidth="0.2" opacity={0.4} /></g>)}
            <circle cx={50} cy={30} r="2.4" fill={online ? '#9ed442' : '#6e747a'} stroke="#0c1410" strokeWidth="0.5" />
          </>
        )}
      </svg>
      <div style={{ position: 'absolute', top: 8, insetInlineStart: 10, fontSize: 11, fontWeight: 800, color: hasTrip ? '#9ed442' : online ? '#9ed442' : '#aab0b6', background: 'rgba(0,0,0,0.5)', padding: '3px 9px', borderRadius: 10 }}>
        {hasTrip ? `${L('الوصول خلال', 'ETA')} ${eta}′` : online ? L('متصل · ابحث عن طلبات', 'Online · finding orders') : L('غير متصل', 'Offline')}
      </div>
      {hasTrip && (
        <div style={{ position: 'absolute', bottom: 8, insetInlineStart: 10, insetInlineEnd: 10, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#cbd5e1', background: 'rgba(0,0,0,0.5)', padding: '4px 9px', borderRadius: 10 }}>
          <span>🟢 {pickup || L('المتجر', 'Pickup')}</span><span>📍 {dropoff || L('العميل', 'Drop-off')}</span>
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
            <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>#{driverProfile?.id.slice(-6).toUpperCase()} · ⭐ {driverProfile?.rating || '4.8'}</p>
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
          <div className="space-y-5 animate-fade-in">
            <DriverMiniMap hasTrip={false} online={isOnline} lang={lang} available={availableFeed.length} height={190} />
            {/* Online toggle */}
            <button onClick={handleToggleOnline} disabled={actionLoading} id="toggle_online_presence"
              className={`w-full flex items-center justify-center gap-3 py-4 rounded-[var(--radius-sheet)] text-base font-bold cursor-pointer transition-all duration-300 ${isOnline ? 'neon-glow-sm' : ''}`}
              style={{ background: isOnline ? 'rgba(158,212,66,0.14)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isOnline ? 'rgba(158,212,66,0.5)' : 'rgba(255,255,255,0.1)'}`, color: isOnline ? 'var(--color-lime-vb,#9ed442)' : 'var(--color-t3,#aab0b6)' }}>
              <Icon name={isOnline ? 'wifi' : 'wifi_off'} size={22} fill={isOnline ? 1 : 0} />{isOnline ? D('متصل — جاهز لاستقبال الطلبات', 'Online — ready for orders') : D('اضغط للاتصال وبدء العمل', 'Tap to go online')}
            </button>
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              {[{ v: money(totalEarned), l: D('أرباح اليوم', 'Today'), c: 'var(--color-lime-vb,#9ed442)' }, { v: activeJobs.length, l: D('نشطة', 'Active'), c: 'var(--color-on-surface)' }, { v: availableFeed.length, l: D('متاحة', 'Available'), c: 'var(--color-primary-container)' }].map((s, i) => (
                <Card key={i} variant="z2" radius="xl" padding="p-3" className="text-center"><p className="text-title-lg font-extrabold" style={{ color: s.c }}>{s.v}</p><p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>{s.l}</p></Card>
              ))}
            </div>
            <DriverOpsPanel driverId={driverId} />
            {/* Orders market */}
            <div className="space-y-3">
              <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{D('سوق الطلبات', 'Orders market')} ({availableFeed.length})</h3>
              {!isOnline ? (
                <Card variant="z3" radius="xl" padding="p-6" className="text-center space-y-3" id="driver_offline_alert"><Icon name="wifi_off" size={36} className="text-[var(--color-error)] mx-auto opacity-60" /><p className="text-body-md text-[var(--color-on-surface-variant)]">{D('قم بتفعيل الاتصال لعرض الطلبات المتاحة', 'Go online to see available orders')}</p></Card>
              ) : availableFeed.length === 0 ? (
                <EmptyState icon="storefront" title={D('لا توجد طلبات', 'No orders')} description={D('لا توجد طلبات بانتظار سائق حالياً', 'No orders waiting for a driver right now')} />
              ) : (
                <div className="space-y-3" id="available_jobs_scroller">
                  {availableFeed.map(f => (
                    <Card key={f.id} variant="z3" radius="xl" padding="p-4" className="space-y-3" id={`available_f_job_${f.id}`}>
                      <div className="flex items-center justify-between"><span className="text-label-sm" style={{ color: 'var(--color-primary-container)', textTransform: 'none', letterSpacing: 0 }}>#{f.id.slice(-6).toUpperCase()}</span><p className="text-label-md font-semibold text-[var(--color-on-surface)]">{f.merchant_branches?.name || D('المطعم', 'Restaurant')}</p></div>
                      <div className="flex items-center justify-between"><span className="text-headline-sm font-bold" style={{ color: 'var(--color-primary-container)' }}>{money(10)}</span><span className="text-label-md text-[var(--color-on-surface-variant)]">{D('أجرة التوصيل', 'Delivery fee')}</span></div>
                      <Button variant="secondary" size="sm" fullWidth loading={actionLoading} onClick={() => handleAcceptJob(f.id)} id={`accept_job_btn_${f.id}`}>{D('قبول الطلب', 'Accept order')}</Button>
                    </Card>
                  ))}
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

        {/* ════ EARNINGS ════ */}
        {tab === 'earnings' && (
          <div className="space-y-5 animate-fade-in" id="driver_earnings_tab">
            <Card variant="z4" radius="xl" padding="p-6" className="text-center space-y-1">
              <p className="text-label-md" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>{D('أرباح اليوم', "Today's earnings")}</p>
              <p className="text-display-sm font-extrabold" style={{ color: 'var(--color-lime-vb,#9ed442)' }}>{money(totalEarned)}</p>
              <p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>{completedCount} {D('رحلة مكتملة', 'completed trips')}</p>
            </Card>
            <div className="grid grid-cols-2 gap-3" id="driver_earnings_analytics">
              {[{ l: D('الرحلات', 'Trips'), v: completedCount }, { l: D('متوسط الرحلة', 'Avg / trip'), v: money(avgTrip) }, { l: D('قيد التوصيل', 'In delivery'), v: activeJobs.length }, { l: D('أرباح الأسبوع', 'This week'), v: money(totalEarned) }].map((s, i) => (
                <Card key={i} variant="z2" radius="xl" padding="p-4" className="text-center"><p className="text-label-sm mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>{s.l}</p><p className="text-title-lg font-bold text-[var(--color-on-surface)]">{s.v}</p></Card>
              ))}
            </div>
            <div className="space-y-2">
              <h4 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{D('سجل الرحلات', 'Trip history')}</h4>
              {earnings.length === 0 ? <EmptyState icon="receipt_long" title={D('لا توجد رحلات بعد', 'No trips yet')} description={D('ستظهر رحلاتك المكتملة هنا', 'Your completed trips will appear here')} /> : earnings.slice(0, 12).map((e, i) => (
                <Card key={e.id || i} variant="z2" radius="lg" padding="p-3" className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: 'var(--color-lime-vb,#9ed442)' }}>+{money(Number(e.delivery_fee_earned))}</span>
                  <span className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{D('رحلة', 'Trip')} #{String(e.id || i).slice(-5)}</span>
                </Card>
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
                <div><p className="text-title-lg font-bold" style={{ color: '#fbbf24' }}>⭐ {driverProfile?.rating || '4.8'}</p><p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{D('التقييم', 'Rating')}</p></div>
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

      {/* ── Bottom navigation (fixed, safe-area aware) ── */}
      <nav className="fixed bottom-0 inset-x-0 z-50 flex items-stretch" id="driver_bottom_nav"
        style={{ background: 'var(--color-surface-container-lowest,#0a0f14)', borderTop: '1px solid var(--color-outline-variant)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {NAV.map(n => {
          const on = tab === n.key;
          const badge = n.key === 'trip' && activeJobs.length > 0 ? activeJobs.length : undefined;
          return (
            <button key={n.key} onClick={() => setTab(n.key)} id={`driver_tab_${n.key}`}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 cursor-pointer relative transition-colors"
              style={{ color: on ? 'var(--color-lime-vb,#9ed442)' : 'var(--color-on-surface-variant)' }}>
              <span className="relative"><Icon name={n.icon} size={22} fill={on ? 1 : 0} />
                {badge ? <span className="absolute -top-1.5 -end-2 text-[9px] font-bold px-1 rounded-full" style={{ background: '#f87171', color: '#fff', minWidth: 14 }}>{badge}</span> : null}
              </span>
              <span className="text-[10px] font-bold">{D(n.ar, n.en)}</span>
              {on && <span className="absolute top-0 inset-x-6 h-0.5 rounded-full" style={{ background: 'var(--color-lime-vb,#9ed442)' }} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
