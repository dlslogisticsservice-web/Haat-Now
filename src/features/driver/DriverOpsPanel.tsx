import React, { useEffect, useState } from 'react';
import { toast } from '../../components/ui/feedback';
import { shiftService, DriverShift } from '../../services/ops/shift.service';
import { dispatchService } from '../../services/ops/dispatch.service';
import { payoutService, WalletSummary } from '../../services/ops/payout.service';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../contexts/AppConfigContext';

const money = (n: number) => `${Number(n || 0).toFixed(2)} ر.س`;

/** Driver-side operations: shift clock-in/out + breaks, incoming dispatch offers, wallet + payout. */
export const DriverOpsPanel: React.FC<{ driverId: string }> = ({ driverId }) => {
  const { lang } = useAppConfig();
  const D = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [shift, setShift] = useState<DriverShift | null>(null);
  const [onBreak, setOnBreak] = useState(false);
  const [offers, setOffers] = useState<any[]>([]);
  const [wallet, setWallet] = useState<WalletSummary>({ available: 0, pending: 0, paid: 0, lifetime: 0 });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: sh }, { data: off }, { data: w }] = await Promise.all([
      shiftService.active(driverId),
      dispatchService.driverOffers(driverId),
      payoutService.walletSummary(driverId),
    ]);
    setShift(sh);
    setOffers(off);
    setWallet(w);
    if (sh) { const { data: br } = await shiftService.breaks(sh.id); setOnBreak(br.some(b => !b.ended_at)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [driverId]);

  const startShift = async () => { setBusy(true); await shiftService.start(driverId); setBusy(false); await load(); };
  const endShift = async () => { if (!shift) return; setBusy(true); await shiftService.end(shift.id); setBusy(false); await load(); };
  const toggleBreak = async () => {
    if (!shift) return; setBusy(true);
    await (onBreak ? shiftService.endBreak(shift.id) : shiftService.startBreak(shift.id));
    setBusy(false); await load();
  };
  const respond = async (assignmentId: string, accept: boolean) => {
    setBusy(true);
    const { data, error } = await dispatchService.respond(assignmentId, accept);
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data === 'lost') toast.success(D('تم قبول الطلب من مندوب آخر.','The order was accepted by another driver.'));
    await load();
  };
  const requestPayout = async () => {
    const raw = prompt(`${D('الرصيد المتاح','Available balance')}: ${money(wallet.available)}\n${D('أدخل مبلغ السحب','Enter withdrawal amount')}:`);
    if (!raw) return;
    const amount = Number(raw);
    if (!amount || amount <= 0) return toast.error(D('مبلغ غير صالح.','Invalid amount.'));
    setBusy(true);
    const { error } = await payoutService.request(driverId, amount);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(D('تم إرسال طلب السحب','Withdrawal request sent')); await load();
  };

  return (
    <div className="space-y-4" id="driver_ops_panel" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Shift / attendance */}
      <Card variant="z3" radius="xl" padding="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{D('الوردية','Shift')}</h3>
          <Badge variant={shift ? (onBreak ? 'secondary' : 'success') : 'secondary'}>
            {shift ? (onBreak ? D('في استراحة','On break') : D('وردية نشطة','Active shift')) : D('خارج الوردية','Off shift')}
          </Badge>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!shift ? (
            <Button size="sm" loading={busy} onClick={startShift}>{D('بدء الوردية','Start shift')}</Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" loading={busy} onClick={toggleBreak}>{onBreak ? D('إنهاء الاستراحة','End break') : D('استراحة','Break')}</Button>
              <Button size="sm" variant="secondary" loading={busy} onClick={endShift}>{D('إنهاء الوردية','End shift')}</Button>
            </>
          )}
        </div>
        {shift?.actual_start && (
          <p className="text-label-sm mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
            {D('بدأت','Started')}: {new Date(shift.actual_start).toLocaleString(D('ar','en'))}
          </p>
        )}
      </Card>

      {/* Incoming dispatch offers */}
      {offers.length > 0 && (
        <Card variant="z4" radius="xl" padding="p-5">
          <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)] mb-3">{D('عروض جديدة','New offers')} ({offers.length})</h3>
          <div className="space-y-3">
            {offers.map(o => (
              <div key={o.id} className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-[rgba(255,255,255,0.06)] last:border-0 last:pb-0">
                <div>
                  <p className="font-bold text-[var(--color-on-surface)]">{o.orders?.merchant_branches?.name ?? D('طلب','Order')} · {money(o.orders?.delivery_fee ?? 0)}</p>
                  <p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {o.orders?.merchant_branches?.zones?.name ?? ''}{o.distance_km != null ? ` · ${o.distance_km} ${D('كم','km')}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" loading={busy} onClick={() => respond(o.id, true)}>{D('قبول','Accept')}</Button>
                  <Button size="sm" variant="secondary" loading={busy} onClick={() => respond(o.id, false)}>{D('رفض','Decline')}</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Wallet / payout */}
      <Card variant="z3" radius="xl" padding="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{D('المحفظة','Wallet')}</h3>
          <Button size="sm" loading={busy} onClick={requestPayout} disabled={wallet.available <= 0}>{D('طلب سحب','Withdraw')}</Button>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-headline-sm font-bold" style={{ color: 'var(--color-lime-vb, #9ed442)' }}>{wallet.available.toFixed(0)}</p>
            <p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{D('متاح','Available')}</p>
          </div>
          <div>
            <p className="text-headline-sm font-bold text-[var(--color-on-surface)]">{wallet.pending.toFixed(0)}</p>
            <p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{D('قيد الانتظار','Pending')}</p>
          </div>
          <div>
            <p className="text-headline-sm font-bold text-[var(--color-on-surface)]">{wallet.lifetime.toFixed(0)}</p>
            <p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{D('الإجمالي','Lifetime')}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
