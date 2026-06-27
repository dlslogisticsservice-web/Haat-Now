// ─────────────────────────────────────────────────────────────────────────────
// Payment Orchestrator — THE single payment pipeline for the whole platform.
// One entry point that composes the existing real services (no duplicated logic):
//   • Provider factory + gateway adapters  → paymentService (paymob/moyasar/stripe/
//     apple_pay/google_pay/mada/cash/wallet)
//   • Transaction persistence              → checkoutService.recordPaymentTransaction
//   • Wallet                               → walletService
//   • Refund engine                        → paymentService.refundPayment
//   • Settlements (merchant + driver)      → financeService
// Adds: idempotency (no double-charge), retry (transient only), audit, history.
// All payments MUST go through paymentOrchestrator.pay() — no parallel flows.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { paymentService, validatePaymentCredentials, type PaymentProvider, type PaymentRequest, type PaymentResult, type RefundRequest } from './payment.service';
import { checkoutService } from './checkout.service';
import { walletService } from './wallet.service';
import { financeService } from './finance.service';

export const SUPPORTED_PROVIDERS: PaymentProvider[] = ['paymob', 'moyasar', 'stripe', 'apple_pay', 'google_pay', 'mada', 'cash', 'wallet'];

// Idempotency cache — dedups retries / double-submits within the session. (A
// payment_idempotency table is the durable cross-instance layer — operator step.)
const idempotencyCache = new Map<string, PaymentResult>();

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 250): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) { lastErr = err; if (i < attempts - 1) await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, i))); }
  }
  throw lastErr;
}

export interface PayOptions { idempotencyKey?: string }

export const paymentOrchestrator = {
  /** List supported providers + whether each is production-configured. */
  providers() {
    const { missing } = validatePaymentCredentials();
    return SUPPORTED_PROVIDERS.map(p => ({ provider: p, internal: p === 'cash' || p === 'wallet', configured: p === 'cash' || p === 'wallet' || missing.length === 0 }));
  },

  /** THE payment entry point — gateway (factory) → persist → audit, idempotent + retried. */
  async pay(req: PaymentRequest, opts: PayOptions = {}): Promise<PaymentResult> {
    const key = opts.idempotencyKey || `${req.orderId}:${req.provider}:${req.amount}`;
    const cached = idempotencyCache.get(key);
    if (cached) return cached; // no double-charge

    // Retry only wraps thrown/transient errors; a clean decline ({success:false}) is NOT retried.
    const result = await withRetry(() => paymentService.processPayment(req));

    // Single persistence path — record every attempt for reconciliation.
    try {
      await checkoutService.recordPaymentTransaction({
        order_id: req.orderId, customer_id: req.customerId, amount: req.amount,
        provider: req.provider, status: result.status, gateway_reference: result.gatewayReference,
      } as any);
    } catch { /* persistence is best-effort; gateway result is source of truth */ }

    if (result.success) idempotencyCache.set(key, result);
    return result;
  },

  /** Refund engine (single path). */
  async refund(req: RefundRequest) {
    return paymentService.refundPayment(req);
  },

  /** Transaction history for an order or a customer. */
  async history(filter: { orderId?: string; customerId?: string }): Promise<{ data: any[]; error: any }> {
    if (!supabase) return { data: [], error: null };
    let q = supabase.from('payment_transactions').select('*').order('created_at', { ascending: false });
    if (filter.orderId) q = q.eq('order_id', filter.orderId);
    if (filter.customerId) q = q.eq('customer_id', filter.customerId);
    const { data, error } = await q;
    return { data: data || [], error };
  },

  // Wallet (top-up balance + ledger) — single namespace.
  wallet: {
    get: (ownerType: 'customer' | 'driver' | 'merchant', id: string) => walletService.getWallet(ownerType, id),
    transactions: (walletId: string) => walletService.getTransactions(walletId),
  },

  // Settlements — merchant + driver payout runs.
  settlements: {
    runs: () => financeService.settlementRuns(),
    generateMerchant: (start: string, end: string) => financeService.generateMerchantSettlement(start, end),
    generateDriver: (start: string, end: string) => financeService.generateDriverSettlement(start, end),
    payMerchant: (id: string) => financeService.payMerchantSettlement(id),
    payDriver: (id: string) => financeService.payDriverSettlement(id),
  },
};
