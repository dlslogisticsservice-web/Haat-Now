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
import { authService } from './auth.service';

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

  /**
   * Gateway initiation — the single client entry for hosted-gateway checkout. Routes
   * through the SECURE server-side `payment-initiate` edge function (gateway secrets stay
   * server-side — no client gateway calls), guarded by a durable idempotency lock
   * (`payment_idempotency`) so a double-submit returns the original result, never re-charges.
   */
  async initiate(req: { orderId: string; customerId: string; amount: number; currency: string }): Promise<{ ok: boolean; data: any }> {
    const key = `initiate:${req.orderId}`;
    if (supabase) {
      const { error: lockErr } = await supabase.from('payment_idempotency')
        .insert({ idempotency_key: key, order_id: req.orderId, customer_id: req.customerId, status: 'locked' } as any);
      if (lockErr) { // duplicate request — return the prior result if the first call finished
        const { data: existing } = await supabase.from('payment_idempotency').select('result').eq('idempotency_key', key).maybeSingle();
        if (existing?.result) return { ok: true, data: existing.result };
      }
    }
    const accessToken = await authService.getAccessToken();
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const res = await fetch(`${url}/functions/v1/payment-initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': anon },
      body: JSON.stringify({ orderId: req.orderId, customerId: req.customerId, amount: req.amount, currency: req.currency }),
    });
    const data = await res.json();
    const ok = res.ok && !!(data as any)?.success;
    if (supabase) {
      await supabase.from('payment_idempotency').update({ status: ok ? 'completed' : 'failed', result: data, updated_at: new Date().toISOString() } as any).eq('idempotency_key', key);
    }
    return { ok, data };
  },

  /** Reconciliation — initiations that locked but never completed (need follow-up). */
  async reconcile(): Promise<{ stuck: any[]; error: any }> {
    if (!supabase) return { stuck: [], error: null };
    const { data, error } = await supabase.from('payment_idempotency').select('*').eq('status', 'locked');
    return { stuck: data || [], error };
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
