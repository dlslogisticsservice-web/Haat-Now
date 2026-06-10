import React, { useState, useEffect } from 'react';
import { checkoutService } from '../../services/checkout.service';

interface PaymentMethod { id: string; provider: string; is_default: boolean; provider_payment_method_id?: string | null }

interface WalletScreenProps {
  customerId: string;
}

export const WalletScreen = ({ customerId }: WalletScreenProps) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    checkoutService.getPaymentMethods(customerId).then(({ data }) => {
      if (data) setPaymentMethods(data);
    });
  }, [customerId]);

  return (
    <div className="min-h-screen metallic-bg" style={{ paddingBottom: '128px' }} dir="rtl">

      {/* Atmospheric orbs */}
      <div className="fixed top-20 right-10 w-64 h-64 rounded-full animate-neon-pulse pointer-events-none"
           style={{ background: 'var(--color-primary-fixed)', filter: 'blur(80px)', opacity: 0.15, zIndex: 0 }} />
      <div className="fixed bottom-40 left-10 w-48 h-48 rounded-full animate-neon-pulse pointer-events-none"
           style={{ background: 'white', filter: 'blur(60px)', opacity: 0.08, animationDelay: '2s', zIndex: 0 }} />

      {/* Sticky header */}
      <header
        className="sticky z-40 flex items-center justify-between px-4 h-16"
        style={{ top: '36px', background: 'rgba(17,20,23,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <span className="material-symbols-outlined cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-on-surface-variant)' }}>notifications</span>
        <h1 className="font-bold neon-text-glow"
            style={{ color: 'var(--color-primary-fixed)', fontSize: '18px', textTransform: 'none', letterSpacing: 0 }}>
          محفظتي
        </h1>
        <span className="material-symbols-outlined cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-on-surface-variant)' }}>more_vert</span>
      </header>

      <main className="relative z-10 px-4 py-6 space-y-6">

        {/* Balance card – metallic */}
        <div className="metallic-card rounded-xl p-6 relative overflow-hidden">
          {/* Neon orb */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
               style={{ background: 'rgba(163,249,91,0.2)', filter: 'blur(80px)' }} />

          <div className="relative z-10">
            <p className="uppercase mb-2"
               style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px', letterSpacing: '0.12em' }}>
              الرصيد المتاح
            </p>
            <div className="flex items-end gap-2 mb-6">
              <span className="font-bold" style={{ color: 'var(--color-primary-fixed)', fontSize: '48px', lineHeight: 1 }}>
                1,250.00
              </span>
              <span className="mb-1" style={{ color: 'var(--color-on-surface-variant)', fontSize: '20px' }}>ج.م</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px' }}>آخر تحديث: اليوم</span>
                <span className="material-symbols-outlined"
                      style={{ fontSize: '16px', color: 'var(--color-primary-fixed)' }}>sync</span>
              </div>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold neon-glow-primary transition-all hover:scale-105 active:scale-95 cursor-pointer"
                style={{ background: 'var(--color-primary-fixed)', color: '#1e3700', fontSize: '14px', border: 'none' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_card</span>
                شحن المحفظة
              </button>
            </div>
          </div>
        </div>

        {/* Rewards / tier */}
        <div className="glass-panel rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold" style={{ color: 'var(--color-primary-fixed)', fontSize: '28px' }}>2,450</span>
            <div>
              <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px' }}>نقاط المكافآت</p>
              <p className="font-bold" style={{ color: 'white', fontSize: '14px' }}>الفئة البلاتينية</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="material-symbols-outlined"
                  style={{ fontSize: '32px', color: 'var(--color-primary-fixed)', fontVariationSettings: "'FILL' 1" }}>
              workspace_premium
            </span>
            <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '10px' }}>برنسيم</span>
          </div>
        </div>

        {/* Payment cards – horizontal scroll */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <button className="flex items-center gap-1 cursor-pointer" style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px', background: 'none', border: 'none' }}>
              إدارة
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>settings</span>
            </button>
            <h2 className="font-bold" style={{ color: 'white', fontSize: '16px', textTransform: 'none', letterSpacing: 0 }}>
              طرق الدفع المحفوظة
            </h2>
          </div>

          <div className="flex gap-4 pb-4" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
            {paymentMethods.length > 0 ? paymentMethods.map((pm) => (
              <div
                key={pm.id}
                className="metallic-card rounded-xl p-5 flex flex-col justify-between flex-shrink-0"
                style={{ minWidth: '280px', height: '160px' }}
              >
                <div className="flex justify-between items-start">
                  <span className="material-symbols-outlined"
                        style={{ fontSize: '28px', color: 'var(--color-primary-fixed)', fontVariationSettings: "'FILL' 1" }}>
                    credit_card
                  </span>
                  {pm.is_default && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(163,249,91,0.15)', color: 'var(--color-primary-fixed)', border: '1px solid rgba(163,249,91,0.3)' }}>
                      افتراضي
                    </span>
                  )}
                </div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', letterSpacing: '0.15em', marginBottom: '4px' }}>
                    •••• •••• •••• {pm.provider_payment_method_id?.slice(-4) || '••••'}
                  </p>
                  <p className="font-bold" style={{ color: 'white', fontSize: '14px' }}>{pm.provider}</p>
                </div>
              </div>
            )) : (
              <div
                className="metallic-card rounded-xl p-5 flex flex-col items-center justify-center gap-3 flex-shrink-0"
                style={{ minWidth: '280px', height: '160px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--color-on-surface-variant)' }}>add_card</span>
                <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px', textTransform: 'none', letterSpacing: 0 }}>إضافة بطاقة جديدة</p>
              </div>
            )}

            {/* Add card tile */}
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-xl cursor-pointer hover:bg-white/5 transition-colors"
              style={{ minWidth: '120px', height: '160px', border: '2px dashed rgba(255,255,255,0.1)' }}
            >
              <div className="flex flex-col items-center gap-2">
                <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)', fontSize: '28px' }}>add_circle</span>
                <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px' }}>إضافة</span>
              </div>
            </div>
          </div>
        </section>

        {/* Transaction history */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <button className="flex items-center gap-1 cursor-pointer"
                    style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px', background: 'none', border: 'none' }}>
              عرض الكل
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_left</span>
            </button>
            <h2 className="font-bold" style={{ color: 'white', fontSize: '16px', textTransform: 'none', letterSpacing: 0 }}>
              العمليات الأخيرة
            </h2>
          </div>

          <div className="space-y-3">
            {/* Transaction 1 */}
            <div className="glass-panel p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer">
              <div className="text-left">
                <p className="font-bold" style={{ color: 'var(--color-error)', fontSize: '14px' }}>- 450.00 ج.م</p>
                <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '10px', marginTop: '2px' }}>طلب منجز</p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <h4 className="font-bold text-right" style={{ color: 'white', fontSize: '15px', textTransform: 'none', letterSpacing: 0 }}>مطعم صبحي كابر</h4>
                  <p className="text-right" style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px', marginTop: '2px' }}>15 أكتوبر • 08:30 م</p>
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary-fixed)', fontSize: '20px' }}>restaurant</span>
                </div>
              </div>
            </div>

            {/* Transaction 2 – refund */}
            <div className="glass-panel p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer">
              <div className="text-left">
                <p className="font-bold" style={{ color: 'var(--color-primary-fixed)', fontSize: '14px' }}>+ 125.50 ج.م</p>
                <p style={{ color: 'var(--color-primary-fixed)', fontSize: '10px', marginTop: '2px' }}>مكتمل</p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <h4 className="font-bold text-right" style={{ color: 'white', fontSize: '15px', textTransform: 'none', letterSpacing: 0 }}>إرجاع مبلغ: صيدليات العزبي</h4>
                  <p className="text-right" style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px', marginTop: '2px' }}>12 أكتوبر • 11:15 ص</p>
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(163,249,91,0.1)', border: '1px solid rgba(163,249,91,0.2)' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary-fixed)', fontSize: '20px' }}>keyboard_return</span>
                </div>
              </div>
            </div>

            {/* Transaction 3 */}
            <div className="glass-panel p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer">
              <div className="text-left">
                <p className="font-bold" style={{ color: 'var(--color-error)', fontSize: '14px' }}>- 890.00 ج.م</p>
                <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '10px', marginTop: '2px' }}>طلب منجز</p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <h4 className="font-bold text-right" style={{ color: 'white', fontSize: '15px', textTransform: 'none', letterSpacing: 0 }}>هايبر وان - الشيخ زايد</h4>
                  <p className="text-right" style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px', marginTop: '2px' }}>10 أكتوبر • 02:45 م</p>
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary-fixed)', fontSize: '20px' }}>shopping_bag</span>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};
