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
import { adminClient }         from '../_shared/supabase.ts';
import { log }                 from '../_shared/log.ts';

const FN = 'payment-refund';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return errServer('Method not allowed', 405, 'METHOD_NOT_ALLOWED');

  try {
    // ── 1. Auth: service-role only ─────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
      log('WARN', FN, 'Unauthorized refund attempt — invalid service key');
      return errServer('Forbidden: admin access only', 403, 'FORBIDDEN');
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

    // ── 5. Calculate total already refunded for this order ────────────────────
    const { data: existingRefunds } = await supabase
      .from('refunds')
      .select('amount')
      .eq('order_id', orderId)
      .neq('status', 'failed');  // Exclude failed refund attempts

    const totalRefundedSoFar = (existingRefunds ?? []).reduce(
      (sum, r) => sum + Number(r.amount), 0,
    );

    const capturedAmount   = Number(attempt.amount);
    const newTotalRefunded = totalRefundedSoFar + amount;

    // Guard: cannot refund more than was captured
    if (newTotalRefunded > capturedAmount + 0.001) {
      log('WARN', FN, 'Refund exceeds captured amount', {
        capturedAmount, totalRefundedSoFar, requested: amount, newTotal: newTotalRefunded,
      });
      return errServer(
        `Refund amount (${amount}) exceeds available captured amount (${(capturedAmount - totalRefundedSoFar).toFixed(2)})`,
        409,
        'EXCEEDS_CAPTURED_AMOUNT',
      );
    }

    // ── 6. Determine new payment_status ───────────────────────────────────────
    const isFullRefund     = newTotalRefunded >= capturedAmount - 0.01;
    const newPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';

    // ── 7. Insert refund record (status='pending' until Moyasar confirms) ─────
    const { data: refund, error: refundErr } = await supabase
      .from('refunds')
      .insert({
        order_id:           orderId,
        payment_attempt_id: paymentAttemptId,
        amount,
        currency:           attempt.currency,
        reason,
        status:             'pending',
        gateway_refund_ref: null,
      })
      .select('id, amount, currency, status, created_at')
      .single();

    if (refundErr || !refund) {
      log('ERROR', FN, 'Failed to insert refund record', { error: refundErr?.message });
      return errServer('Failed to create refund record', 500, 'REFUND_CREATE_FAILED');
    }

    // ── 8. Update orders.payment_status ───────────────────────────────────────
    // NEVER touch payment_attempts — refunds are tracked separately.
    const { error: orderUpdateErr } = await supabase
      .from('orders')
      .update({ payment_status: newPaymentStatus })
      .eq('id', orderId);

    if (orderUpdateErr) {
      log('ERROR', FN, 'Failed to update orders.payment_status after refund', {
        refundId: refund.id, error: orderUpdateErr.message,
      });
      // Refund row exists — log the inconsistency; reconcile via refunds table.
    }

    // ── EF2-9: Call Moyasar POST /v1/payments/{id}/refund ─────────────────────
    // Convert SAR → halalas (1 SAR = 100 halalas — Moyasar requires integers).
    const refundHalalas = Math.round(amount * 100);

    let gatewayRefundRef: string | null = null;
    let moyasarRefundRaw: Record<string, unknown> | null = null;
    let moyasarRefundStatus = 'pending';

    try {
      const moyasarRes = await fetch(
        `https://api.moyasar.com/v1/payments/${attempt.gateway_reference}/refund`,
        {
          method:  'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(moyasarKey + ':'),
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({ amount: refundHalalas }),
        },
      );

      if (moyasarRes.ok) {
        moyasarRefundRaw = await moyasarRes.json() as Record<string, unknown>;
        gatewayRefundRef = moyasarRefundRaw['id'] as string | null ?? null;
        moyasarRefundStatus = 'refunded';
        log('INFO', FN, 'Moyasar refund successful', {
          refundId: refund.id, moyasarRefundId: gatewayRefundRef,
        });
      } else {
        const errText = await moyasarRes.text();
        log('ERROR', FN, 'Moyasar refund API returned non-200', {
          refundId: refund.id, status: moyasarRes.status,
          // errText intentionally not logged — may contain sensitive data
        });
        // Refund row remains in 'pending' status for manual reconciliation.
      }
    } catch (fetchErr: unknown) {
      log('ERROR', FN, 'Network error calling Moyasar refund API', {
        refundId: refund.id, error: String(fetchErr),
      });
      // Continue — refund row in 'pending' is reconcilable.
    }

    // ── EF2-10: Update refund row with Moyasar gateway data ───────────────────
    // Writes gateway_refund_ref, status, raw Moyasar response, and updated_at.
    // If the Moyasar call failed, gateway_refund_ref stays null and status stays 'pending'.
    await supabase
      .from('refunds')
      .update({
        gateway_refund_ref: gatewayRefundRef,
        status:             moyasarRefundStatus,
        raw_response:       moyasarRefundRaw,
        updated_at:         new Date().toISOString(),
      })
      .eq('id', refund.id);

    log('INFO', FN, 'Refund completed', {
      refundId:        refund.id,
      orderId,
      amount,
      newPaymentStatus,
      totalRefunded:   newTotalRefunded,
      gatewayRefundRef,
      moyasarStatus:   moyasarRefundStatus,
    });

    return okServer({
      success:              true,
      refundId:             refund.id,
      orderId,
      amountRefunded:       amount,
      currency:             refund.currency,
      newPaymentStatus,
      totalRefundedToDate:  newTotalRefunded,
      isFullRefund,
      gatewayRefundRef,
      moyasarStatus:        moyasarRefundStatus,
      createdAt:            refund.created_at,
    });

  } catch (e: unknown) {
    log('ERROR', FN, 'Unhandled exception', { error: String(e) });
    return errServer('Internal server error', 500, 'INTERNAL_ERROR');
  }
});
