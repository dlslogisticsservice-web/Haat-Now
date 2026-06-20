/**
 * payment-verify
 *
 * Read-only status check for a payment_attempt.
 * Used by the customer UI after returning from a hosted payment page, or as
 * a polling fallback in case the webhook is delayed.
 *
 * NEVER modifies any row. NEVER credits wallets. Read only.
 *
 * POST /functions/v1/payment-verify
 * Authorization: Bearer <customer JWT>
 *
 * Body:
 *   paymentAttemptId  string  UUID of the payment_attempt to query
 *
 * Response:
 *   { success, paymentAttemptId, status, orderId, orderPaymentStatus, amount, currency, updatedAt }
 */

import { handleCors } from '../_shared/cors.ts';
import { ok, err }    from '../_shared/response.ts';
import { adminClient, userClient } from '../_shared/supabase.ts';
import { log }        from '../_shared/log.ts';

const FN = 'payment-verify';

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') return err('Method not allowed', 405, 'METHOD_NOT_ALLOWED');

  try {
    // ── 1. Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return err('Missing or malformed Authorization header', 401, 'UNAUTHORIZED');
    }

    const caller = userClient(authHeader);
    const { data: { user }, error: authErr } = await caller.auth.getUser();
    if (authErr || !user) {
      log('WARN', FN, 'JWT verification failed', { authErr: authErr?.message });
      return err('Invalid or expired token', 401, 'INVALID_TOKEN');
    }

    // ── 2. Parse & validate body ───────────────────────────────────────────────
    let body: unknown;
    try { body = await req.json(); }
    catch { return err('Invalid JSON body', 400, 'INVALID_BODY'); }

    const { paymentAttemptId } = body as Record<string, unknown>;

    if (!paymentAttemptId || typeof paymentAttemptId !== 'string') {
      return err('paymentAttemptId is required and must be a string', 400, 'MISSING_ATTEMPT_ID');
    }

    log('INFO', FN, 'Verifying payment attempt', { paymentAttemptId, callerId: user.id });

    // ── 3. Fetch attempt — scoped to caller to prevent enumeration ─────────────
    const supabase = adminClient();

    const { data: attempt, error: attemptErr } = await supabase
      .from('payment_attempts')
      .select('id, order_id, customer_id, provider, amount, currency, status, gateway_reference, created_at, updated_at')
      .eq('id', paymentAttemptId)
      .single();

    if (attemptErr || !attempt) {
      log('WARN', FN, 'Payment attempt not found', { paymentAttemptId });
      return err('Payment attempt not found', 404, 'ATTEMPT_NOT_FOUND');
    }

    // Scope guard: caller can only verify their own payment attempts
    if (attempt.customer_id !== user.id) {
      log('WARN', FN, 'Caller attempted to verify another customer\'s attempt', {
        callerId: user.id, attemptOwner: attempt.customer_id,
      });
      return err('Forbidden', 403, 'FORBIDDEN');
    }

    // ── 4. Fetch current order payment status (source of truth) ───────────────
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, payment_status, status, total_amount')
      .eq('id', attempt.order_id)
      .single();

    if (orderErr || !order) {
      log('ERROR', FN, 'Order missing for verified attempt — data integrity issue', {
        paymentAttemptId, orderId: attempt.order_id,
      });
      return err('Associated order not found', 500, 'ORDER_MISSING');
    }

    log('INFO', FN, 'Returning payment status', {
      paymentAttemptId,
      attemptStatus:     attempt.status,
      orderPaymentStatus: order.payment_status,
    });

    // ── 5. Return read-only state — no writes ──────────────────────────────────
    return ok({
      success:            true,
      paymentAttemptId:   attempt.id,
      status:             attempt.status,            // pending | captured | failed | cancelled
      orderId:            attempt.order_id,
      orderStatus:        order.status,              // pending | accepted | ... | delivered
      orderPaymentStatus: order.payment_status,      // unpaid | paid | refunded | partially_refunded
      amount:             attempt.amount,
      currency:           attempt.currency,
      provider:           attempt.provider,
      gatewayReference:   attempt.gateway_reference, // null until webhook arrives
      createdAt:          attempt.created_at,
      updatedAt:          attempt.updated_at,
    });

  } catch (e: unknown) {
    log('ERROR', FN, 'Unhandled exception', { error: String(e) });
    return err('Internal server error', 500, 'INTERNAL_ERROR');
  }
});
