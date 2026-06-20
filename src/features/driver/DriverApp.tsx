import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { driverService } from '../../services/driver.service';
import { orderService } from '../../services/order.service';
import { trackingService } from '../../services/tracking.service';
import { walletService } from '../../services/wallet.service';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { Icon } from '../../components/ui/Icon';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Loader, EmptyState } from '../../components/ui/Primitives';

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
  // ── State (unchanged) ─────────────────────────────────────
  const [driverProfile,           setDriverProfile]           = useState<any>(null);
  const [isOnline,                setIsOnline]                = useState(false);
  const [activeJobs,              setActiveJobs]              = useState<ActiveOrder[]>([]);
  const [availableFeed,           setAvailableFeed]           = useState<OrdersFeed[]>([]);
  const [earnings,                setEarnings]                = useState<any[]>([]);
  const [loading,                 setLoading]                 = useState(true);
  const [actionLoading,           setActionLoading]           = useState(false);
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
    if (watchIdRef.current !== null) return;
    if (!navigator.geolocation) {
      alert('تحديد الموقع غير مدعوم في هذا المتصفح');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        trackingService.updateDriverLocation(drvId, pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          alert('لم تُمنح صلاحية تحديد الموقع. يُرجى تفعيلها من إعدادات المتصفح.');
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

  // ── Business logic (ALL UNCHANGED) ───────────────────────
  const fetchDriverCore = async () => {
    try {
      setLoading(true);
      // Sandbox mode has no real backend session, so the drivers table can't be read.
      // Provide a demo driver profile + sample data so the portal renders with data.
      if (SANDBOX) {
        setDriverProfile({ id: driverId, full_name: 'كابتن تجريبي', phone_number: '+201000000003', is_online: true, vehicle_type: 'motorcycle' });
        setIsOnline(true);
        setEarnings([
          { id: 'e1', delivery_fee_earned: 10, created_at: '2026-06-18T10:00:00Z' },
          { id: 'e2', delivery_fee_earned: 10, created_at: '2026-06-18T12:30:00Z' },
          { id: 'e3', delivery_fee_earned: 10, created_at: '2026-06-19T09:15:00Z' },
        ]);
        setAvailableFeed([
          { id: 'feed1', status: 'accepted', total_amount: 78.5, merchant_branches: { name: 'مطعم الجليلة — حي النخيل', zones: { name: 'حي النخيل' } } },
          { id: 'feed2', status: 'accepted', total_amount: 45.0, merchant_branches: { name: 'مايسترو بيتزا', zones: { name: 'حي الملقا' } } },
        ]);
        setActiveJobs([]);
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
      if (!error) setIsOnline(targetState); else alert((error as any).message);
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  const handleAcceptJob = async (orderId: string) => {
    if (!isOnline) { alert('الرجاء الانتقال إلى وضع الاتصال أولاً!'); return; }
    setActionLoading(true);
    try {
      const { success, error } = await driverService.acceptDelivery(orderId, driverProfile.id);
      if (error) alert(`فشل قبول الطلب: ${(error as any).message || error}`);
      else if (success) { alert('تم قبول الطلب بنجاح!'); await reloadDriverState(driverProfile.id); }
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  const handleAdvanceActiveJob = async (job: ActiveOrder) => {
    setActionLoading(true);
    try {
      if (job.status === 'preparing') {
        const { error } = await orderService.updateOrderStatus(job.id, 'on_the_way', 'الطلب في الطريق.');
        if (!error) {
          startGPSTracking(driverProfile.id);
          alert('تم استلام الشحنة وتفعيل بث الإحداثيات 🚴');
        }
      } else if (job.status === 'on_the_way') {
        // Phase 15: single atomic RPC — status transition + earnings + wallet in one transaction.
        const { error: deliveryError } = await walletService.completeDelivery(job.id, driverProfile.id);
        if (!deliveryError) {
          stopGPSTracking();
          alert('تم تسليم الشحنة وتسجيل مكافأة بمحفظتك! 🏁');
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
        <p className="text-body-md text-[var(--color-on-surface-variant)]">جاري تحميل بيانات الكابتن...</p>
      </div>
    );
  }

  if (!driverProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" id="driver_not_registered">
        <p className="text-body-md text-[var(--color-on-surface-variant)]">لم يتم تسجيلك كسائق. يرجى التواصل مع الإدارة.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-5" id="driver_app_container">

      {/* ── Top bar: logout + language ─────────────────────── */}
      <div className="flex items-center justify-between" id="driver_topbar">
        <Button variant="danger" size="sm" onClick={onLogout} id="driver_logout_btn" leftIcon={<Icon name="logout" size={16} />}>
          تسجيل الخروج
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleLang} id="driver_lang_btn" leftIcon={<Icon name="language" size={16} />}>
          {lang === 'ar' ? 'EN' : 'ع'}
        </Button>
      </div>

      {/* ══════════════════════════════════════════════════════
          PRIMARY — Command Center: Online Status Hero
      ══════════════════════════════════════════════════════ */}
      <Card variant="z4" radius="xl" padding="p-7" className="flex flex-col items-center text-center gap-6" id="driver_presence_head">
        {/* Identity */}
        <div className="flex items-center gap-2.5" id="driver_badge_box">
          <Icon name="local_shipping" size={20} className="text-[var(--color-primary-container)]" fill={1} />
          <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">
            {driverProfile?.full_name || 'الكابتن'}
          </h3>
          <span className="text-label-sm text-[var(--color-on-surface-variant)]" style={{ textTransform: 'none', letterSpacing: 0 }}>
            #{driverProfile?.id.slice(-6).toUpperCase()}
          </span>
        </div>

        {/* Primary toggle — the command */}
        <button
          onClick={handleToggleOnline}
          disabled={actionLoading}
          className={[
            'flex items-center gap-4 px-10 py-5 rounded-[var(--radius-sheet)] text-headline-sm font-bold cursor-pointer transition-all duration-300',
            isOnline ? 'neon-glow-sm' : 'opacity-80',
          ].join(' ')}
          style={{
            background: isOnline ? 'rgba(158,212,66,0.14)' : 'rgba(255,255,255,0.05)',
            borderTop: isOnline ? '1px solid rgba(158,212,66,0.5)' : '1px solid rgba(255,255,255,0.1)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.02)',
            color: isOnline ? 'var(--color-lime-vb, #9ed442)' : 'var(--color-t3, #aab0b6)',
            boxShadow: isOnline ? '0 0 40px rgba(158,212,66,0.22)' : 'none',
            minWidth: '260px',
          }}
          id="toggle_online_presence"
        >
          <Icon name={isOnline ? 'wifi' : 'wifi_off'} size={28} fill={isOnline ? 1 : 0} />
          <span>{isOnline ? 'متصل — نشط' : 'اضغط للاتصال'}</span>
        </button>

        {/* Supporting metrics row — secondary inside primary card */}
        <div className="grid grid-cols-3 gap-6 w-full max-w-sm border-t border-[rgba(255,255,255,0.06)] pt-5">
          <div className="text-center">
            <p className="text-headline-sm font-bold" style={{ color: 'var(--color-lime-vb, #9ed442)' }}>{totalEarned.toFixed(0)}</p>
            <p className="text-label-sm" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>ريال اليوم</p>
          </div>
          <div className="text-center">
            <p className="text-headline-sm font-bold text-[var(--color-on-surface)]">{activeJobs.length}</p>
            <p className="text-label-sm" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>شحنة نشطة</p>
          </div>
          <div className="text-center">
            <p className="text-headline-sm font-bold" style={{ color: availableFeed.length > 0 ? 'var(--color-lime-vb, #9ed442)' : 'var(--color-t3, #aab0b6)' }}>{availableFeed.length}</p>
            <p className="text-label-sm" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>طلب متاح</p>
          </div>
        </div>
      </Card>

      {/* TERTIARY — Compact stat chips */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="نشطة"     value={activeJobs.length}               icon={<Icon name="inventory_2" size={16} fill={1} />} accentColor="var(--color-primary-container)" />
        <StatCard label="متاحة"    value={availableFeed.length}             icon={<Icon name="storefront"  size={16} fill={1} />} accentColor="var(--color-secondary)" />
        <StatCard label="مكتملة"   value={completedCount}                   icon={<Icon name="task_alt"    size={16} fill={1} />} accentColor="var(--color-tertiary-container)" />
        <StatCard label="الأرباح"  value={money(totalEarned)} icon={<Icon name="payments"    size={16} fill={1} />} accentColor="var(--color-neon)" />
      </div>

      {/* ── Main Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="driver_app_grids">

        {/* Active jobs — col 8 */}
        <div className="lg:col-span-8 space-y-4" id="active_jobs_wrapper">
          <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">شحناتي النشطة</h3>

          {activeJobs.length === 0 ? (
            <EmptyState
              icon="directions_bike"
              title="لا توجد شحنات نشطة"
              description="اختر من السوق أدناه للبدء"
            />
          ) : (
            activeJobs.map((job) => (
              <Card
                key={job.id}
                variant="z3"
                radius="xl"
                padding="p-5"
                className="space-y-4"
                id={`active_job_card_${job.id}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between pb-3 border-b border-[rgba(255,255,255,0.06)]">
                  <span
                    className="text-label-sm font-semibold"
                    style={{ color: 'var(--color-primary-container)', textTransform: 'none', letterSpacing: 0 }}
                  >
                    #{job.id.slice(-6).toUpperCase()}
                  </span>
                  <div className="text-end">
                    <p className="text-headline-sm font-semibold text-[var(--color-on-surface)]">
                      {job.merchant_branches?.name || 'المطعم'}
                    </p>
                    <p className="text-label-sm text-[var(--color-on-surface-variant)]">
                      عميل: {job.customers?.full_name || 'تجريبي'}
                      {job.customers?.phone_number ? ` · ${job.customers.phone_number}` : ''}
                    </p>
                  </div>
                </div>

                {/* Destination */}
                <div className="flex items-start gap-2 justify-end">
                  <p className="text-label-md text-[var(--color-on-surface-variant)] text-end" style={{ textTransform: 'none' }}>
                    الرياض، حي الياسمين — عنوان التسليم المسجل
                  </p>
                  <Icon name="location_on" size={18} className="text-[var(--color-primary-container)] shrink-0" fill={1} />
                </div>

                {/* Status badge */}
                <div className="flex items-center justify-end">
                  <Badge variant="primary" dot>
                    {job.status === 'preparing' ? 'جاهز للاستلام' : 'في الطريق'}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 justify-end pt-1 border-t border-[rgba(255,255,255,0.06)]" id="active_job_actions">
                    <Button
                    variant="primary"
                    size="sm"
                    loading={actionLoading}
                    onClick={() => handleAdvanceActiveJob(job)}
                    leftIcon={<Icon name={job.status === 'preparing' ? 'inventory_2' : 'task_alt'} size={16} fill={1} />}
                    id="advance_job_trigger"
                  >
                    {job.status === 'preparing' ? 'استلام الشحنة' : 'تأكيد التسليم'}
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Feed / Market — col 4 */}
        <div className="lg:col-span-4 space-y-4" id="available_jobs_col">
          <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">
            سوق الطلبات ({availableFeed.length})
          </h3>

          {!isOnline ? (
            <Card variant="z3" radius="xl" padding="p-6" className="text-center space-y-3" id="driver_offline_alert">
              <Icon name="wifi_off" size={36} className="text-[var(--color-error)] mx-auto opacity-60" />
              <p className="text-body-md text-[var(--color-on-surface-variant)]">
                قم بتفعيل الاتصال لعرض الطلبات المتاحة
              </p>
            </Card>
          ) : availableFeed.length === 0 ? (
            <EmptyState icon="storefront" title="لا توجد طلبات" description="لا توجد طلبات بانتظار سائق حالياً" />
          ) : (
            <div className="space-y-3" id="available_jobs_scroller">
              {availableFeed.map((f) => (
                <Card
                  key={f.id}
                  variant="z3"
                  radius="xl"
                  padding="p-4"
                  className="space-y-3"
                  id={`available_f_job_${f.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-label-sm"
                      style={{ color: 'var(--color-primary-container)', textTransform: 'none', letterSpacing: 0 }}
                    >
                      #{f.id.slice(-6).toUpperCase()}
                    </span>
                    <p className="text-label-md font-semibold text-[var(--color-on-surface)]">
                      {f.merchant_branches?.name || 'المطعم'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-headline-sm font-bold" style={{ color: 'var(--color-primary-container)' }}>
                      {money(10)}
                    </span>
                    <span className="text-label-md text-[var(--color-on-surface-variant)]">أجرة التوصيل</span>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    loading={actionLoading}
                    onClick={() => handleAcceptJob(f.id)}
                    id={`accept_job_btn_${f.id}`}
                  >
                    قبول الطلب
                  </Button>
                </Card>
              ))}
            </div>
          )}

          {/* Earnings summary */}
          <Card variant="z3" radius="xl" padding="p-5" className="space-y-4" id="driver_earnings_summary_card">
            <h4 className="text-headline-sm font-semibold text-[var(--color-on-surface)] text-end pb-3 border-b border-[rgba(255,255,255,0.06)]">
              ملخص المحفظة
            </h4>
            <div className="grid grid-cols-2 gap-3 text-center" id="driver_earnings_analytics">
              <div className="p-3 rounded-[var(--radius-lg)] surface-z2" id="earn_1">
                <p className="text-label-sm text-[var(--color-on-surface-variant)] mb-1">الرحلات</p>
                <p className="text-headline-sm font-bold text-[var(--color-on-surface)]">{completedCount}</p>
              </div>
              <div className="p-3 rounded-[var(--radius-lg)] surface-z2" id="earn_2">
                <p className="text-label-sm text-[var(--color-on-surface-variant)] mb-1">الأرباح</p>
                <p className="text-headline-sm font-bold" style={{ color: 'var(--color-primary-container)' }}>
                  {money(totalEarned)}
                </p>
              </div>
            </div>
            <p className="text-label-sm text-[var(--color-on-surface-variant)] text-center leading-relaxed" style={{ textTransform: 'none', letterSpacing: 0 }}>
              {money(10)} أجرة ثابتة لكل رحلة مكتملة
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};
