import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { driverService } from '../../services/driver.service';
import { orderService } from '../../services/order.service';
import { trackingService } from '../../services/tracking.service';
import { walletService } from '../../services/wallet.service';
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
interface DriverAppProps { driverId: string }

export const DriverApp = ({ driverId }: DriverAppProps) => {
  // ── State (unchanged) ─────────────────────────────────────
  const [driverProfile,           setDriverProfile]           = useState<any>(null);
  const [isOnline,                setIsOnline]                = useState(false);
  const [activeJobs,              setActiveJobs]              = useState<ActiveOrder[]>([]);
  const [availableFeed,           setAvailableFeed]           = useState<OrdersFeed[]>([]);
  const [earnings,                setEarnings]                = useState<any[]>([]);
  const [loading,                 setLoading]                 = useState(true);
  const [actionLoading,           setActionLoading]           = useState(false);
  const [simCoordinatesIndex,     setSimCoordinatesIndex]     = useState(0);

  useEffect(() => { fetchDriverCore(); }, [driverId]);

  // ── Business logic (ALL UNCHANGED) ───────────────────────
  const fetchDriverCore = async () => {
    try {
      setLoading(true);
      let dProfile;
      const { data, error } = await supabase.from('drivers').select('*').eq('id', driverId).maybeSingle();
      if (error || !data) {
        const { data: newDr } = await supabase.from('drivers')
          .insert({ id: driverId, phone_number: '0500000002', full_name: 'الكابتن أحمد المندوب', is_online: true })
          .select().single();
        dProfile = newDr;
      } else { dProfile = data; }
      if (dProfile) { setDriverProfile(dProfile); setIsOnline(dProfile.is_online); await reloadDriverState(dProfile.id); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const reloadDriverState = async (drvId: string) => {
    const { data: feed } = await supabase.from('orders').select('*, merchant_branches(*, zones(*))').eq('status', 'accepted').is('driver_id', null);
    if (feed) setAvailableFeed(feed as unknown as OrdersFeed[]);
    const { data: active } = await driverService.getActiveJobs(drvId);
    if (active) setActiveJobs(active as unknown as ActiveOrder[]);
    const { data: earn } = await driverService.getEarnings(drvId);
    if (earn) setEarnings(earn);
  };

  const handleToggleOnline = async () => {
    setActionLoading(true);
    const targetState = !isOnline;
    const { error } = await driverService.toggleOnline(driverProfile.id, targetState);
    setActionLoading(false);
    if (!error) setIsOnline(targetState); else alert((error as any).message);
  };

  const handleAcceptJob = async (orderId: string) => {
    if (!isOnline) { alert('الرجاء الانتقال إلى وضع الاتصال أولاً!'); return; }
    setActionLoading(true);
    const { success, error } = await driverService.acceptDelivery(orderId, driverProfile.id);
    setActionLoading(false);
    if (error) alert(`فشل قبول الطلب: ${(error as any).message || error}`);
    else if (success) { alert('تم قبول الطلب بنجاح!'); await reloadDriverState(driverProfile.id); }
  };

  const handleAdvanceActiveJob = async (job: ActiveOrder) => {
    setActionLoading(true);
    try {
      if (job.status === 'preparing') {
        const { error } = await orderService.updateOrderStatus(job.id, 'on_the_way', 'الطلب في الطريق.');
        if (!error) { await trackingService.updateDriverLocation(driverProfile.id, 24.7136, 46.6753); alert('تم استلام الشحنة وتفعيل بث الإحداثيات 🚴'); }
      } else if (job.status === 'on_the_way') {
        const { error } = await orderService.updateOrderStatus(job.id, 'delivered', 'تم التسليم بنجاح.');
        if (!error) {
          await supabase.from('driver_earnings').insert({ driver_id: driverProfile.id, order_id: job.id, delivery_fee_earned: 10.00, tip_earned: 0.00, bonus_earned: 0.00 });
          const { error: adjustErr } = await walletService.adjustBalance('driver', driverProfile.id, 10.00, 'payout');
          if (adjustErr) console.error('Failed atomic driver payout:', adjustErr);
          alert('تم تسليم الشحنة وتسجيل مكافأة 10 ر.س بمحفظتك! 🏁');
        }
      }
      await reloadDriverState(driverProfile.id);
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  const handleSimulateGPSMove = async (job: ActiveOrder) => {
    const coordinates = [
      { lat: 24.7136, lng: 46.6753 }, { lat: 24.7290, lng: 46.6620 },
      { lat: 24.7450, lng: 46.6500 }, { lat: 24.7610, lng: 46.6410 },
      { lat: 24.7820, lng: 46.6340 }, { lat: 24.8100, lng: 46.6260 },
    ];
    const nextIdx = (simCoordinatesIndex + 1) % coordinates.length;
    setSimCoordinatesIndex(nextIdx);
    const targetPos = coordinates[nextIdx];
    const { error } = await trackingService.updateDriverLocation(driverProfile.id, targetPos.lat, targetPos.lng);
    if (error) alert((error as any).message);
    else alert(`📡 تم تحديث الإحداثيات: ${targetPos.lat}, ${targetPos.lng}`);
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

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-8" id="driver_app_container">

      {/* ── Header / Presence Bar ────────────────────────────── */}
      <Card variant="glass" radius="xl" padding="p-5" className="flex items-center justify-between gap-4 flex-wrap" id="driver_presence_head">
        <button
          onClick={handleToggleOnline}
          disabled={actionLoading}
          className={[
            'flex items-center gap-2.5 px-5 h-11 rounded-full text-label-md font-semibold cursor-pointer transition-all',
            isOnline
              ? 'neon-glow-sm'
              : 'opacity-70',
          ].join(' ')}
          style={{
            background: isOnline ? 'rgba(163,249,91,0.1)' : 'var(--color-surface-container-high)',
            border: isOnline ? '1px solid rgba(163,249,91,0.4)' : '1px solid rgba(255,255,255,0.08)',
            color: isOnline ? 'var(--color-primary-container)' : 'var(--color-on-surface-variant)',
          }}
          id="toggle_online_presence"
        >
          <Icon name={isOnline ? 'wifi' : 'wifi_off'} size={18} fill={isOnline ? 1 : 0} />
          <span>{isOnline ? 'متصل — نشط' : 'غير متصل'}</span>
        </button>

        <div className="text-end" id="driver_badge_box">
          <div className="flex items-center gap-2.5 justify-end">
            <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">
              {driverProfile?.full_name || 'الكابتن'}
            </h3>
            <Icon name="local_shipping" size={22} className="text-[var(--color-primary-container)]" fill={1} />
          </div>
          <p className="text-label-sm text-[var(--color-on-surface-variant)]" style={{ textTransform: 'none', letterSpacing: 0 }}>
            #{driverProfile?.id.slice(-6).toUpperCase()}
          </p>
        </div>
      </Card>

      {/* ── Stats Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="الشحنات النشطة"    value={activeJobs.length}           icon={<Icon name="inventory_2" size={18} fill={1} />} accentColor="var(--color-primary-container)" />
        <StatCard label="الطلبات المتاحة"   value={availableFeed.length}        icon={<Icon name="storefront"  size={18} fill={1} />} accentColor="var(--color-secondary)" />
        <StatCard label="الرحلات المكتملة"  value={completedCount}              icon={<Icon name="task_alt"    size={18} fill={1} />} accentColor="var(--color-tertiary-container)" />
        <StatCard label="إجمالي الأرباح"    value={`${totalEarned.toFixed(0)} ر.س`} icon={<Icon name="payments" size={18} fill={1} />} accentColor="var(--color-neon)" />
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
                variant="glass"
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
                  {job.status === 'on_the_way' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSimulateGPSMove(job)}
                      leftIcon={<Icon name="navigation" size={16} className="animate-spin" />}
                      id="sim_gps_trigger"
                    >
                      محاكاة GPS
                    </Button>
                  )}
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
            <Card variant="glass" radius="xl" padding="p-6" className="text-center space-y-3" id="driver_offline_alert">
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
                  variant="glass"
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
                      10.00 ر.س
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
          <Card variant="glass" radius="xl" padding="p-5" className="space-y-4" id="driver_earnings_summary_card">
            <h4 className="text-headline-sm font-semibold text-[var(--color-on-surface)] text-end pb-3 border-b border-[rgba(255,255,255,0.06)]">
              ملخص المحفظة
            </h4>
            <div className="grid grid-cols-2 gap-3 text-center" id="driver_earnings_analytics">
              <div className="p-3 rounded-[var(--radius-lg)]" style={{ background: 'var(--color-surface-container-high)' }} id="earn_1">
                <p className="text-label-sm text-[var(--color-on-surface-variant)] mb-1">الرحلات</p>
                <p className="text-headline-sm font-bold text-[var(--color-on-surface)]">{completedCount}</p>
              </div>
              <div className="p-3 rounded-[var(--radius-lg)]" style={{ background: 'var(--color-surface-container-high)' }} id="earn_2">
                <p className="text-label-sm text-[var(--color-on-surface-variant)] mb-1">الأرباح</p>
                <p className="text-headline-sm font-bold" style={{ color: 'var(--color-primary-container)' }}>
                  {totalEarned.toFixed(0)} ر.س
                </p>
              </div>
            </div>
            <p className="text-label-sm text-[var(--color-on-surface-variant)] text-center leading-relaxed" style={{ textTransform: 'none', letterSpacing: 0 }}>
              10 ر.س أجرة ثابتة لكل رحلة مكتملة
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};
