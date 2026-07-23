/**
 * payment-refund  —  Phase 17B-EF-2
 *
 * Creates a refund record, calls the Moyasar refund API, and updates
 * orders.payment_status accordingly.
 * Admin-only — requires the Supabase service-role key in the Authorization header.
 *
 * This function NEVER modifies the original payment_attempts row.
 * Refund amounts are tracked in the refunds table to support partial refunds.
 *
 * POST /functions/v1/payment-refund
 * Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Body:
 *   orderId            string  UUID of the order to refund
 *   paymentAttemptId   string  UUID of the captured payment_attempt
 *   amount             number  Amount to refund in SAR (must be <= captured amount)
 *   reason             string  Human-readable refund reason
 *
 * Logic:
 *   totalRefunded = sum of existing refunds for this order (non-failed)
 *   newTotal      = totalRefunded + amount
 *
 *   if newTotal >= capturedAmount → payment_status = 'refunded'
 *   else                          → payment_status = 'partially_refunded'
 *
 * Response:
 *   { success, refundId, orderId, amountRefunded, newPaymentStatus, totalRefundedToDate, gatewayRefundRef }
 */

import { okServer, errServer } from '../_shared/response.ts';
import { adminClient, userClient } from '../_shared/supabase.ts';
import { log }                 from '../_shared/log.ts';

const FN = 'payment-refund';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return errServer('Method not allowed', 405, 'METHOD_NOT_ALLOWED');

  try {
    // ── 1. Auth: admin JWT + finance.refund permission ─────────────────────────
    // Previously this compared the header to SUPABASE_SERVICE_ROLE_KEY, which meant
    // the ONLY way to call it was to ship the service-role key to the browser — so
    // in practice it was uncallable and refunds had no production trigger path.
    // Now it verifies a real session JWT and asks the database whether that user
    // holds `finance.refund`, reusing auth_has_permission() from
    // 20260705000006_rbac_server_enforcement.sql. Server-side authority, no new
    // permission model, and the service-role key never leaves the server.
    //
    // The service-role path is retained for server-to-server callers (cron, scripts).
    const authHeader = req.headers.get('Authorization') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!authHeader.startsWith('Bearer ')) {
      log('WARN', FN, 'Refund attempt with no bearer token');
      return errServer('Missing or malformed Authorization header', 401, 'UNAUTHORIZED');
    }

    const isServiceCall = serviceKey.length > 0 && authHeader === `Bearer ${serviceKey}`;

    if (!isServiceCall) {
      const caller = userClient(authHeader);
      const { data: { user }, error: authErr } = await caller.auth.getUser();
      if (authErr || !user) {
        log('WARN', FN, 'Refund attempt with invalid token', { authErr: authErr?.message });
        return errServer('Invalid or expired token', 401, 'INVALID_TOKEN');
      }
      // Ask the DB, not the client. A forged role claim cannot pass this.
      const { data: allowed, error: permErr } = await caller.rpc('auth_has_permission', { p_perm: 'finance.refund' });
      if (permErr || allowed !== true) {
        log('WARN', FN, 'Refund denied — caller lacks finance.refund', { userId: user.id, permErr: permErr?.message });
        return errServer('Forbidden: finance.refund permission required', 403, 'FORBIDDEN');
      }
      log('INFO', FN, 'Refund authorised', { userId: user.id });
    }

    // ── EF2-9: Load Moyasar credentials early — fail before any DB work ────────
    const moyasarKey = Deno.env.get('MOYASAR_SECRET_KEY');
    if (!moyasarKey) {
      log('ERROR', FN, 'MOYASAR_SECRET_KEY is not set — cannot process refund');
      return errServer('Payment provider not configured', 503, 'PROVIDER_NOT_CONFIGURED');
    }

    // ── 2. Parse & validate body ───────────────────────────────────────────────
    let body: unknown;
    try { body = await req.json(); }
    catch { return errServer('Invalid JSON body', 400, 'INVALID_BODY'); }

    const { orderId, paymentAttemptId, amount, reason } =
      body as Record<string, unknown>;

    if (!orderId          || typeof orderId          !== 'string') return errServer('orderId is required',          400, 'MISSING_ORDER_ID');
    if (!paymentAttemptId || typeof paymentAttemptId !== 'string') return errServer('paymentAttemptId is required', 400, 'MISSING_ATTEMPT_ID');
    if (typeof amount     !== 'number' || amount <= 0)             return errServer('amount must be a positive number', 400, 'INVALID_AMOUNT');
    if (!reason           || typeof reason           !== 'string') return errServer('reason is required',           400, 'MISSING_REASON');

    log('INFO', FN, 'Refund requested', { orderId, paymentAttemptId, amount });

    const supabase = adminClient();

    // ── 3. EF2-8: Verify the payment_attempt — now includes gateway_reference ──
    const { data: attempt, error: attemptErr } = await supabase
      .from('payment_attempts')
      .select('id, order_id, amount, currency, status, gateway_reference')
      .eq('id', paymentAttemptId)
      .eq('order_id', orderId)
      .single();

    if (attemptErr || !attempt) {
      log('WARN', FN, 'Payment attempt not found', { paymentAttemptId, orderId });
      return errServer('Payment attempt not found for this order', 404, 'ATTEMPT_NOT_FOUND');
    }

    if (attempt.status !== 'captured') {
      log('WARN', FN, 'Cannot refund non-captured attempt', {
        paymentAttemptId, status: attempt.status,
      });
      return errServer(
        `Cannot refund a payment in "${attempt.status}" status — only captured payments can be refunded`,
        409,
        'ATTEMPT_NOT_CAPTURED',
      );
    }

    // EF2-8: Validate that a Moyasar payment ID exists — required to call the refund API.
    // gateway_reference is null when payment_attempts.status was set without a real gateway.
    if (!attempt.gateway_reference) {
      log('WARN', FN, 'Cannot refund: no gateway_reference on captured attempt', {
        paymentAttemptId,
      });
      return errServer(
        'Cannot refund this payment: no gateway payment ID is recorded. Manual reconciliation required.',
        409,
        'NO_GATEWAY_REFERENCE',
      );
    }

    // ── 4. Verify order payment status allows a refund ────────────────────────
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, payment_status, total_amount')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return errServer('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if (order.payment_status === 'refunded') {
      return errServer('This order has already been fully refunded', 409, 'ALREADY_REFUNDED');
    }

    if (order.payment_status === 'unpaid') {
      return errServer('Cannot refund an unpaid order', 409, 'ORDER_UNPAID');
    }

    // ── 5. Phase 9 · P0-4: RESERVE atomically (race-safe ceiling + pending row) ─
    // refund_reserve() locks the attempt, sums prior non-failed refunds under the lock,
    // enforces the ceiling, and inserts a pending refund — eliminating the TOCTOU
    // over-refund race. Idempotent on `refund:<orderId>:<attemptId>:<amount>`.
    const idempotencyKey = `refund:${orderId}:${paymentAttemptId}:${amount}`;
    const { data: reservedRaw, error: reserveErr } = await supabase.rpc('refund_reserve', {
      p_order_id:           orderId,
      p_payment_attempt_id: paymentAttemptId,
      p_amount:             amount,
      p_reason:             reason,
      p_idempotency_key:    idempotencyKey,
    });

    if (reserveErr) {
      log('WARN', FN, 'refund_reserve rejected', { error: reserveErr.message });
      // Ceiling breach / not-captured surface as a 409; everything else as 500.
      const isBusiness = /exceeds|captured|not found|authorised/i.test(reserveErr.message || '');
      return errServer(reserveErr.message || 'Refund reservation failed', isBusiness ? 409 : 500,
        isBusiness ? 'REFUND_REJECTED' : 'REFUND_RESERVE_FAILED');
    }

    const reserved = reservedRaw as { id: string; amount: number; currency: string; status: string } | null;
    if (!reserved?.id) {
      return errServer('Failed to reserve refund', 500, 'REFUND_RESERVE_FAILED');
    }

    // Already-confirmed idempotent replay → return success without re-calling the gateway.
    if (reserved.status === 'refunded') {
      log('INFO', FN, 'Idempotent replay — refund already confirmed', { refundId: reserved.id });
      return okServer({ success: true, refundId: reserved.id, orderId, amountRefunded: reserved.amount,
        currency: reserved.currency, moyasarStatus: 'refunded', replay: true });
    }

    // ── 6. Call Moyasar POST /v1/payments/{id}/refund (gateway AFTER reserve) ──
    const refundHalalas = Math.round(amount * 100);
    let gatewayRefundRef: string | null = null;
    let moyasarRefundRaw: Record<string, unknown> | null = null;
    let gatewaySuccess = false;

    try {
      const moyasarRes = await fetch(
        `https://api.moyasar.com/v1/payments/${attempt.gateway_reference}/refund`,
        {
          method:  'POST',
          headers: { 'Authorization': 'Basic ' + btoa(moyasarKey + ':'), 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: refundHalalas }),
        },
      );
      if (moyasarRes.ok) {
        moyasarRefundRaw = await moyasarRes.json() as Record<string, unknown>;
        gatewayRefundRef = moyasarRefundRaw['id'] as string | null ?? null;
        gatewaySuccess = true;
        log('INFO', FN, 'Moyasar refund successful', { refundId: reserved.id, moyasarRefundId: gatewayRefundRef });
      } else {
        log('ERROR', FN, 'Moyasar refund API returned non-200', { refundId: reserved.id, status: moyasarRes.status });
      }
    } catch (fetchErr: unknown) {
      log('ERROR', FN, 'Network error calling Moyasar refund API', { refundId: reserved.id, error: String(fetchErr) });
    }

    // ── 7. CONFIRM: finalize refund + order.payment_status + ledger in ONE txn ─
    // On gateway success → posts a balanced customer_refund/platform_cash ledger entry and
    // sets order.payment_status. On failure → marks the refund failed WITHOUT touching the
    // order (no more "order shows refunded but gateway failed" inconsistency).
    const { data: confirmedRaw, error: confirmErr } = await supabase.rpc('refund_confirm', {
      p_refund_id:   reserved.id,
      p_success:     gatewaySuccess,
      p_gateway_ref: gatewayRefundRef,
      p_raw:         moyasarRefundRaw,
    });

    if (confirmErr) {
      log('ERROR', FN, 'refund_confirm failed', { refundId: reserved.id, error: confirmErr.message });
      return errServer('Refund gateway succeeded but finalization failed — reconcile refunds table', 500, 'REFUND_CONFIRM_FAILED');
    }

    const confirmed = confirmedRaw as { status: string } | null;
    if (!gatewaySuccess) {
      return errServer('Payment provider refund failed — refund marked failed, order unchanged', 502, 'GATEWAY_REFUND_FAILED');
    }

    log('INFO', FN, 'Refund completed', { refundId: reserved.id, orderId, amount, gatewayRefundRef });

    return okServer({
      success:        true,
      refundId:       reserved.id,
      orderId,
      amountRefunded: amount,
      currency:       reserved.currency,
      status:         confirmed?.status ?? 'refunded',
      gatewayRefundRef,
      moyasarStatus:  'refunded',
    });

  } catch (e: unknown) {
    log('ERROR', FN, 'Unhandled exception', { error: String(e) });
    return errServer('Internal server error', 500, 'INTERNAL_ERROR');
  }
});
