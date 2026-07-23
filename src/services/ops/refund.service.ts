// ─────────────────────────────────────────────────────────────────────────────
// Refund operations — the admin decision + trigger step that did not exist.
//
// The refund DATABASE layer (refunds table, refund_reserve/refund_confirm RPCs,
// ledger posting) and the GATEWAY layer (payment-refund edge function) were both
// already built and are reused verbatim. What was missing was the middle: no admin
// could actually decide on a refund and fire it, because the edge function required
// the service-role key — which can never be shipped to a browser.
//
// The function now accepts an admin JWT and checks `finance.refund` server-side, so
// this client simply calls it the same way payment-orchestrator calls payment-initiate.
// No new auth model, no new persistence, no duplicate refund logic.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../../lib/supabase';
import { authService } from '../auth.service';
import { monitoring } from '../monitoring.service';

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'refunded' | 'failed';

export interface RefundRow {
  id: string;
  order_id: string;
  payment_attempt_id: string | null;
  amount: number;
  reason: string | null;
  status: RefundStatus;
  gateway_reference: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface RefundCandidate {
  orderId: string;
  paymentAttemptId: string;
  amount: number;
  provider: string;
  paidAt: string | null;
}

export const refundService = {
  /** Existing refund records. Read-only view already used by FinanceCenter. */
  async list(): Promise<{ data: RefundRow[]; error: any }> {
    if (SANDBOX) return { data: [], error: null };
    // Missing client in a live build is a failure, not "no refunds".
    if (!supabase) return { data: [], error: { message: 'backend_not_configured' } };
    const { data, error } = await supabase
      .from('refunds').select('*')
      .order('created_at', { ascending: false }).limit(100);
    return { data: (data as RefundRow[]) || [], error };
  },

  /**
   * Captured payments on an order that could be refunded. Refunds are only ever
   * offered against a real captured attempt — never against an order total, which
   * is what would let an operator refund money that was never taken.
   */
  async candidatesForOrder(orderId: string): Promise<{ data: RefundCandidate[]; error: any }> {
    if (SANDBOX) return { data: [], error: null };
    if (!supabase) return { data: [], error: { message: 'backend_not_configured' } };
    const { data, error } = await supabase
      .from('payment_attempts')
      .select('id, order_id, amount, provider, status, created_at')
      .eq('order_id', orderId)
      .eq('status', 'captured');
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      data: rows.map(r => ({
        orderId: String(r.order_id),
        paymentAttemptId: String(r.id),
        amount: Number(r.amount) || 0,
        provider: String(r.provider ?? 'unknown'),
        paidAt: (r.created_at as string) ?? null,
      })),
      error,
    };
  },

  /**
   * Issue a refund through the server-side gateway function.
   *
   * Deliberately NOT optimistic: the returned `ok` reflects what the gateway actually
   * said. A refund that the provider rejected must never be shown to an operator as
   * done — the same rule the payment path already follows for charges.
   */
  async issue(input: {
    orderId: string;
    paymentAttemptId: string;
    amount: number;
    reason: string;
  }): Promise<{ ok: boolean; error: string | null; data: unknown }> {
    if (!input.reason?.trim()) return { ok: false, error: 'reason_required', data: null };
    if (!(input.amount > 0)) return { ok: false, error: 'invalid_amount', data: null };

    if (SANDBOX) {
      // The demo has no gateway and no money. Refuse rather than simulate success —
      // a fake "refunded" is exactly the kind of thing that gets believed later.
      return { ok: false, error: 'refunds_unavailable_in_demo', data: null };
    }

    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (!url || !anon) return { ok: false, error: 'backend_not_configured', data: null };

    try {
      const accessToken = await authService.getAccessToken();
      const res = await fetch(`${url}/functions/v1/payment-refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, apikey: anon },
        body: JSON.stringify({
          orderId: input.orderId,
          paymentAttemptId: input.paymentAttemptId,
          amount: input.amount,
          reason: input.reason.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      const ok = res.ok && !!(data as { success?: boolean } | null)?.success;
      if (!ok) {
        const message = (data as { error?: string } | null)?.error ?? `http_${res.status}`;
        monitoring.log('error', `[refund] gateway_failed: ${message}`, { orderId: input.orderId });
        return { ok: false, error: message, data };
      }
      return { ok: true, error: null, data };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'network_error';
      monitoring.log('error', `[refund] request_failed: ${message}`, { orderId: input.orderId });
      return { ok: false, error: message, data: null };
    }
  },
};
