import React, { useEffect, useState } from 'react';
import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, RotateCcw, Banknote, RefreshCw } from 'lucide-react';
import { walletService } from '../../services/wallet.service';
import { Wallet, WalletTransaction } from '../../services/types';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { EmptyState } from '../../components/ui/Primitives';
import { SkeletonList } from '../../components/ui/Skeleton';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 16, padding: 16 };
const money = (n: number) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TX_CFG: Record<WalletTransaction['type'], { ar: string; en: string; Icon: typeof ArrowDownLeft; color: string; sign: number }> = {
  deposit: { ar: 'إيداع', en: 'Deposit', Icon: ArrowDownLeft, color: '#4ade80', sign: 1 },
  payout: { ar: 'تحويل بنكي', en: 'Payout', Icon: ArrowUpRight, color: '#fbbf24', sign: -1 },
  withdrawal: { ar: 'سحب', en: 'Withdrawal', Icon: ArrowUpRight, color: '#f87171', sign: -1 },
  payment_refund: { ar: 'استرداد', en: 'Refund', Icon: RotateCcw, color: '#60a5fa', sign: -1 },
};

/** Merchant Wallet Center — REAL data via wallet.service (wallets + wallet_transactions). */
export const MerchantWalletCenter: React.FC<{ merchantId: string; lang: 'ar' | 'en' }> = ({ merchantId, lang }) => {
  const { country } = useAppConfig();
  const cur = lang === 'ar' ? country.currency.symbolAr : country.currency.symbolEn;
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [tx, setTx] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: w } = await walletService.getWallet('merchant', merchantId);
    setWallet(w);
    if (w) { const { data: t } = await walletService.getTransactions(w.id); setTx(t); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [merchantId]);

  const fmt = (d?: string) => d ? new Date(d).toLocaleString(L('ar', 'en'), { dateStyle: 'medium', timeStyle: 'short' }) : '';

  return (
    <div id="merchant_wallet_center" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      {/* Balance */}
      <div style={card} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-surface-container-high)' }}><WalletIcon size={20} color="var(--color-primary-fixed)" /></span>
          <div>
            <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('رصيد المحفظة', 'Wallet balance')}</p>
            <p className="text-2xl font-extrabold" style={{ color: 'var(--color-on-surface)' }}>{money(wallet?.balance ?? 0)} <span className="text-sm font-normal" style={{ color: 'var(--color-on-surface-variant)' }}>{cur}</span></p>
          </div>
        </div>
        <button onClick={load} aria-label={L('تحديث', 'Refresh')} className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer" style={card}><RefreshCw size={16} color="var(--color-on-surface-variant)" /></button>
      </div>

      {/* Transactions */}
      <div>
        <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-on-surface-variant)' }}><Banknote size={13} />{L('سجل المعاملات', 'Transaction history')}</p>
        {loading ? <SkeletonList rows={5} />
          : tx.length === 0 ? <EmptyState title={L('لا توجد معاملات بعد', 'No transactions yet')} description={L('تظهر هنا الإيداعات والتحويلات البنكية', 'Deposits and bank payouts appear here')} />
          : (
            <div className="space-y-2">
              {tx.map(t => {
                const c = TX_CFG[t.type] || TX_CFG.deposit;
                return (
                  <div key={t.id} style={card} className="flex items-center gap-3 !py-3">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${c.color}22` }}><c.Icon size={16} color={c.color} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{L(c.ar, c.en)}</p>
                      <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{fmt(t.created_at)}</p>
                    </div>
                    <span className="font-bold text-sm" style={{ color: c.color }}>{c.sign > 0 ? '+' : '−'}{money(Math.abs(t.amount))} {cur}</span>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
};
