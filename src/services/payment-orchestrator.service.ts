// ─────────────────────────────────────────────────────────────────────────────
// Payment Orchestrator — THE single payment pipeline for the whole platform.
// CANONICAL payment entry point: `initiate()` → the server-side `payment-initiate`
// edge function (gateway secrets stay server-side; real Moyasar charge). This is the
// only method consumed by the app (CheckoutPage) and the only path that touches a real
// gateway. `reconcile()` / `history()` are real Supabase reads over the same
// `payment_idempotency` / `payment_transactions` tables for follow-up + auditing.
//
// Platform Consolidation removed the previous mock-backed + duplicate pass-through
// methods (pay/refund/providers → simulated payment.service; wallet.* → walletService;
// settlements.* → financeService). Those had zero external references; their real
// canonicals (edge functions / walletService / financeService) are used directly.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { authService } from './auth.service';
import { buildCodRecord, COD_PROVIDER } from '../website-platform/finance/cod';

export const paymentOrchestrator = {
  /**
   * Cash-on-Delivery — a FIRST-CLASS method on the single payment pipeline. COD needs no
   * gateway and no secret: it records a COD attempt in the same `payment_attempts` ledger
   * (idempotent per order) and labels the order `payment_method='cod'`. Cash is reconciled to
   * paid at delivery. Reuses the pure COD model (website-platform/finance/cod) — no duplication.
   */
  async recordCod(req: { orderId: string; customerId: string; amount: number; currency: string }): Promise<{ ok: boolean; data: any }> {
    const rec = buildCodRecord(req.orderId, req.customerId, req.amount, req.currency);
    if (!supabase) return { ok: true, data: { ...rec, simulated: true } };
    const { error } = await supabase.from('payment_attempts').insert({
      order_id: rec.orderId, customer_id: rec.customerId, provider: COD_PROVIDER,
      amount: rec.amount, status: 'pending', idempotency_key: rec.idempotencyKey,
    } as any);
    // Additive label so reporting/receipts show COD (column added by the COD migration).
    await supabase.from('orders').update({ payment_method: COD_PROVIDER } as any).eq('id', rec.orderId);
    return { ok: true, data: { ...rec, recorded: !error } };
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

  /** Transaction history for an order or a customer (reads the live `payment_attempts`
   *  ledger where both gateway and COD attempts are recorded). */
  async history(filter: { orderId?: string; customerId?: string }): Promise<{ data: any[]; error: any }> {
    if (!supabase) return { data: [], error: null };
    let q = supabase.from('payment_attempts').select('*').order('created_at', { ascending: false });
    if (filter.orderId) q = q.eq('order_id', filter.orderId);
    if (filter.customerId) q = q.eq('customer_id', filter.customerId);
    const { data, error } = await q;
    return { data: data || [], error };
  },
};
