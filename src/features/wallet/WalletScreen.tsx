import React, { useState, useEffect, useRef } from 'react';
import { walletService } from '../../services/wallet.service';
import { Wallet, WalletTransaction } from '../../services/types';
import { sandboxStore } from '../../services/sandboxStore';
import { useAppConfig } from '../../contexts/AppConfigContext';
import {
  RefreshCw, MoreVertical, AlertCircle, Loader2, Plus,
  TrendingUp, ArrowUpRight, ArrowDownLeft, RotateCcw, Banknote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface WalletScreenProps {
  customerId: string;
}

const TX_ICONS: Record<string, LucideIcon> = {
  deposit:        TrendingUp,
  withdrawal:     ArrowUpRight,
  payment_refund: RotateCcw,
  payout:         Banknote,
};

const SAMPLE_TRANSACTIONS = [
  { id: 's1', type: 'deposit',        amount:  100,    created_at: new Date(Date.now() - 3_600_000).toISOString()   },
  { id: 's2', type: 'withdrawal',     amount:  -42.75, created_at: new Date(Date.now() - 86_400_000).toISOString()  },
  { id: 's3', type: 'payment_refund', amount:   15.50, created_at: new Date(Date.now() - 172_800_000).toISOString() },
  { id: 's4', type: 'deposit',        amount:   50,    created_at: new Date(Date.now() - 259_200_000).toISOString() },
  { id: 's5', type: 'withdrawal',     amount:  -28.00, created_at: new Date(Date.now() - 345_600_000).toISOString() },
] as const;


function formatTxDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ar-SA', {
      month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

function txTypeLabel(type: string): string {
  if (type === 'deposit')        return 'إيداع';
  if (type === 'withdrawal')     return 'سحب';
  if (type === 'payment_refund') return 'استرداد مبلغ';
  if (type === 'payout')         return 'مكافأة توصيل';
  return type;
}

export const WalletScreen = ({ customerId }: WalletScreenProps) => {
  const { country, lang } = useAppConfig();
  const cur = country.currency.symbolAr;
  const [wallet,         setWallet]         = useState<Wallet | null>(null);
  const [transactions,   setTransactions]   = useState<WalletTransaction[]>([]);
  const [walletLoading,  setWalletLoading]  = useState(true);
  const [walletError,    setWalletError]    = useState<string | null>(null);

  // P5 — balance count-up animation state
  const [displayBalance, setDisplayBalance] = useState(0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    loadWalletData();
  }, [customerId]);

  // Derived values declared before the count-up useEffect to avoid TDZ in production bundles
  const balance = wallet ? (parseFloat(String(wallet.balance)) || 0) : 0;

  // P5 — trigger count-up whenever real balance becomes available
  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (walletLoading || balance === 0) { setDisplayBalance(0); return; }

    const start = Date.now();
    const duration = 600;
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setDisplayBalance(balance * eased);
      if (t < 1) animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [balance, walletLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadWalletData = async () => {
    setWalletLoading(true);
    setWalletError(null);
    try {
      // Sandbox: the real wallets table is unreadable as anon — read the shared store.
      if (import.meta.env.VITE_AUTH_MODE === 'sandbox') {
        const bal = sandboxStore.getWallet('customer', customerId);
        setWallet({ id: 'sb-wallet', owner_type: 'customer', owner_id: customerId, balance: bal, currency: country.currency.code } as any);
        setTransactions(sandboxStore.getCustomerOrders(customerId).map(o => ({
          id: 'tx-' + o.id, wallet_id: 'sb-wallet', amount: o.total_amount, type: 'debit', created_at: o.created_at,
        })) as any);
        return;
      }
      const { data: w, error: wErr } = await walletService.getWallet('customer', customerId);
      if (wErr) {
        setWalletError('تعذّر تحميل بيانات المحفظة');
        return;
      }
      setWallet(w);
      if (w) {
        const { data: txs } = await walletService.getTransactions(w.id);
        setTransactions(txs || []);
      } else {
        setTransactions([]);
      }
    } catch {
      setWalletError('حدث خطأ غير متوقع. تحقق من اتصالك وأعد المحاولة.');
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <div className="min-h-screen metallic-bg" style={{ paddingBottom: '128px' }} dir="rtl">

      {/* Atmospheric orbs */}
      <div className="fixed top-20 right-10 w-64 h-64 rounded-full animate-neon-pulse pointer-events-none"
           style={{ background: 'var(--color-primary-fixed)', filter: 'blur(80px)', opacity: 0.15, zIndex: 0 }} />
      <div className="fixed bottom-40 left-10 w-48 h-48 rounded-full animate-neon-pulse pointer-events-none"
           style={{ background: 'white', filter: 'blur(60px)', opacity: 0.08, animationDelay: '2s', zIndex: 0 }} />

      {/* Sticky header */}
      <header className="sticky top-0 z-40 glass-strong flex items-center justify-between px-4 h-16">
        <button
          onClick={loadWalletData}
          className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
          aria-label="تحديث المحفظة"
        >
          <RefreshCw
            size={18}
            color="var(--color-on-surface-variant)"
            className={walletLoading ? 'animate-spin' : ''}
            strokeWidth={2}
          />
        </button>
        <h1
          className="font-bold gradient-text"
          style={{ fontSize: '18px', letterSpacing: '-0.01em', textShadow: '0 0 20px rgba(163,249,91,0.3)' }}
        >
          المحفظة
        </h1>
        <button
          className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
          aria-label="المزيد"
        >
          <MoreVertical size={18} color="var(--color-on-surface-variant)" strokeWidth={2} />
        </button>
      </header>

      <main className="relative z-10 px-4 py-6 space-y-4">

        {/* ── Balance card — Z3 metallic surface ── */}
        <div
          className="glass-shine rounded-2xl p-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #24282c 0%, #15181b 100%)',
            borderTop: '1px solid rgba(255,255,255,0.14)',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            boxShadow: '0 14px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.09)',
          }}
        >
          {/* Inner specular */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(ellipse 65% 40% at 50% 0%, rgba(255,255,255,0.07) 0%, transparent 65%)' }} />
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none"
               style={{ background: 'rgba(163,249,91,0.22)', filter: 'blur(90px)' }} />

          <div className="relative z-10">
            <p className="uppercase mb-2"
               style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px', letterSpacing: '0.12em' }}>
              الرصيد المتاح
            </p>

            {walletLoading ? (
              <div className="flex items-center gap-3 mb-6">
                <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary-fixed)' }} />
                <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px' }}>جاري التحميل...</span>
              </div>
            ) : walletError ? (
              <div className="mb-6 flex items-center gap-2">
                <AlertCircle size={20} style={{ color: 'var(--color-error)' }} strokeWidth={2} />
                <span style={{ color: 'var(--color-error)', fontSize: '14px' }}>{walletError}</span>
              </div>
            ) : (
              <div className="flex items-end gap-2 mb-4">
                <span
                  className="font-bold"
                  style={{ color: '#f2f4f6', fontSize: '48px', lineHeight: 1, letterSpacing: '-0.02em' }}
                >
                  {isNaN(displayBalance) ? '0.00' : displayBalance.toLocaleString(lang === 'ar' ? country.locale : 'en-US', { minimumFractionDigits: country.currency.decimals, maximumFractionDigits: country.currency.decimals })}
                </span>
                <span className="mb-1 font-bold" style={{ color: 'var(--color-primary-fixed)', fontSize: '18px', textShadow: '0 0 16px rgba(163,249,91,0.55)' }}>{cur}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px' }}>آخر تحديث: الآن</span>
              <RefreshCw size={14} style={{ color: 'var(--color-primary-fixed)' }} strokeWidth={2} />
            </div>
          </div>
        </div>

        {/* P6 — Full-width lime CTA: شحن الرصيد — VB §13: 52h 24r */}
        <button
          className="w-full font-bold flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] neon-glow-primary"
          style={{
            height: '52px',
            borderRadius: '24px',
            background: 'var(--color-primary-fixed)',
            color: '#1e3700',
            fontSize: '16px',
            border: 'none',
          }}
        >
          <Plus size={20} strokeWidth={2.5} />
          شحن الرصيد
        </button>

        {/* ── Transaction history ────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px' }}>
              {!walletLoading && !walletError ? `${transactions.length > 0 ? transactions.length : SAMPLE_TRANSACTIONS.length} عملية` : ''}
            </span>
            <h2 className="font-bold gradient-text"
                style={{ fontSize: '16px', letterSpacing: '-0.01em' }}>
              العمليات الأخيرة
            </h2>
          </div>

          {walletLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary-fixed)' }} />
            </div>
          ) : walletError ? (
            <div className="glass rounded-xl p-4 text-center" style={{ border: '1px solid rgba(255,0,0,0.15)' }}>
              <p style={{ color: 'var(--color-error)', fontSize: '13px' }}>{walletError}</p>
              <button onClick={loadWalletData} className="mt-2 px-3 py-1.5 rounded-lg cursor-pointer glass-hover text-sm"
                style={{ color: 'var(--color-on-surface-variant)', border: 'none', background: 'none' }}>
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {(transactions.length > 0 ? transactions : SAMPLE_TRANSACTIONS).map((tx) => {
                const isCredit = Number(tx.amount) > 0;
                const TxIcon   = TX_ICONS[tx.type] || ArrowDownLeft;
                return (
                  <div
                    key={tx.id}
                    className="glass glass-hover p-3.5 rounded-xl flex items-center justify-between cursor-pointer"
                  >
                    <div className="text-left">
                      <p className="font-bold"
                         style={{ color: isCredit ? 'var(--color-primary-fixed)' : 'var(--color-error)', fontSize: '13px' }}>
                        {isCredit ? '+' : ''}{Number(tx.amount).toLocaleString(lang === 'ar' ? country.locale : 'en-US', { minimumFractionDigits: country.currency.decimals, maximumFractionDigits: country.currency.decimals })} {cur}
                      </p>
                      <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '10px', marginTop: '1px' }}>
                        {txTypeLabel(tx.type)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {'created_at' in tx && tx.created_at && (
                        <p className="text-right" style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px' }}>
                          {formatTxDate(tx.created_at)}
                        </p>
                      )}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isCredit ? 'rgba(163,249,91,0.1)' : 'rgba(255,255,255,0.05)',
                          border:     isCredit ? '1px solid rgba(163,249,91,0.2)' : '1px solid rgba(255,255,255,0.1)',
                        }}
                      >
                        <TxIcon size={17} style={{ color: isCredit ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)' }} strokeWidth={2} />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* P6 — Ghost pill "عرض كل المعاملات" */}
              <button
                className="w-full cursor-pointer transition-all hover:bg-white/5 active:scale-[0.98]"
                style={{ height: '44px', borderRadius: '22px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--color-on-surface-variant)', fontSize: '14px', fontWeight: 600, marginTop: '4px' }}
              >
                عرض كل المعاملات
              </button>
            </div>
          )}
        </section>

      </main>
    </div>
  );
};
