/**
 * payment-initiate  —  Phase 17B-EF-2
 *
 * Creates a payment_attempts row, calls the Moyasar API, and returns
 * the hosted payment page URL so the customer can complete payment.
 *
 * POST /functions/v1/payment-initiate
 * Authorization: Bearer <customer JWT>
 *
 * Body:
 *   orderId    string  UUID of the order to pay
 *   customerId string  UUID of the authenticated customer
 *   amount     number  Total amount in SAR (validated against order.total_amount ±0.01)
 *   currency   string  3-letter ISO code, default "SAR"
 *
 * Response:
 *   { success, paymentAttemptId, idempotencyKey, amount, currency, gateway }
 *   gateway.paymentUrl — Moyasar hosted payment page; redirect customer here
 */

import { handleCors } from '../_shared/cors.ts';
import { ok, err }    from '../_shared/response.ts';
import { adminClient, userClient } from '../_shared/supabase.ts';
import { log }        from '../_shared/log.ts';

const FN = 'payment-initiate';

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') return err('Method not allowed', 405, 'METHOD_NOT_ALLOWED');

  try {
    // ── EF2-1: Load Moyasar credentials — hard fail if either is missing ──────
    const moyasarKey  = Deno.env.get('MOYASAR_SECRET_KEY');
    const callbackUrl = Deno.env.get('MOYASAR_CALLBACK_URL');

    if (!moyasarKey) {
      log('ERROR', FN, 'MOYASAR_SECRET_KEY is not set in secrets');
      return err('Payment provider not configured', 503, 'PROVIDER_NOT_CONFIGURED');
    }
    if (!callbackUrl) {
      log('ERROR', FN, 'MOYASAR_CALLBACK_URL is not set in secrets');
      return err('Payment callback URL not configured', 503, 'CALLBACK_NOT_CONFIGURED');
    }

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

    const { orderId, customerId, amount, currency = 'SAR' } =
      body as Record<string, unknown>;

    if (!orderId    || typeof orderId    !== 'string') return err('orderId is required and must be a string',    400, 'MISSING_ORDER_ID');
    if (!customerId || typeof customerId !== 'string') return err('customerId is required and must be a string', 400, 'MISSING_CUSTOMER_ID');
    if (typeof amount !== 'number' || amount <= 0)     return err('amount must be a positive number',            400, 'INVALID_AMOUNT');
    if (typeof currency !== 'string' || currency.length !== 3) return err('currency must be a 3-letter ISO code', 400, 'INVALID_CURRENCY');

    if (user.id !== customerId) {
      log('WARN', FN, 'Caller identity mismatch', { callerId: user.id, requestedCustomerId: customerId });
      return err('Forbidden: customerId does not match authenticated user', 403, 'FORBIDDEN');
    }

    log('INFO', FN, 'Initiating payment', { orderId, customerId, amount, currency });

    // ── 3. Verify order ────────────────────────────────────────────────────────
    const supabase = adminClient();

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, total_amount, payment_status, customer_id, status')
      .eq('id', orderId)
      .eq('customer_id', customerId)
      .single();

    if (orderErr || !order) {
      log('WARN', FN, 'Order not found or customer mismatch', { orderId, customerId });
      return err('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if (order.payment_status === 'paid') {
      log('WARN', FN, 'Attempted to pay an already-paid order', { orderId });
      return err('This order has already been paid', 409, 'ORDER_ALREADY_PAID');
    }

    if (order.status === 'cancelled') {
      log('WARN', FN, 'Attempted to pay a cancelled order', { orderId });
      return err('Cannot pay a cancelled order', 409, 'ORDER_CANCELLED');
    }

    // Guard: client-supplied amount must match order.total_amount (±0.01 SAR float tolerance).
    // Prevents payment_attempts.amount from being poisoned, which would corrupt the
    // refund ceiling in payment-refund (capturedAmount = attempt.amount).
    if (Math.abs(Number(order.total_amount) - amount) > 0.01) {
      log('WARN', FN, 'Amount mismatch — client supplied incorrect total', {
        clientAmount: amount,
        orderTotal:   order.total_amount,
        orderId,
      });
      return err(
        `amount (${amount}) does not match order total (${order.total_amount})`,
        400,
        'AMOUNT_MISMATCH',
      );
    }

    // ── EF2-2: Convert SAR → halalas using the DB value as authoritative source
    // Moyasar requires amounts as integers in the smallest currency unit (halala).
    // 1 SAR = 100 halalas. Use order.total_amount, NOT the client-supplied amount.
    const authorisedAmount = Number(order.total_amount);
    const amountHalalas    = Math.round(authorisedAmount * 100);

    // ── 4. Check for an existing pending attempt ───────────────────────────────
    // Added gateway_reference to detect whether a prior Moyasar call succeeded.
    const { data: existingAttempt } = await supabase
      .from('payment_attempts')
      .select('id, idempotency_key, status, gateway_reference')
      .eq('order_id', orderId)
      .eq('customer_id', customerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingAttempt?.gateway_reference) {
      // Attempt already reached Moyasar — retrieve the existing payment to get a fresh URL.
      log('INFO', FN, 'Reusing existing Moyasar payment', {
        attemptId: existingAttempt.id,
        moyasarId: existingAttempt.gateway_reference,
      });
      const moyasarPayment = await getMoyasarPayment(existingAttempt.gateway_reference, moyasarKey);
      const paymentUrl     = (moyasarPayment?.['source'] as Record<string, unknown> | undefined)?.['transaction_url'] as string | null ?? null;

      return ok({
        success:          true,
        paymentAttemptId: existingAttempt.id,
        idempotencyKey:   existingAttempt.idempotency_key,
        amount:           authorisedAmount,
        currency:         (currency as string).toUpperCase(),
        gateway: {
          status:     moyasarPayment?.['status'] ?? 'initiated',
          provider:   'moyasar',
          paymentUrl,
          moyasarId:  existingAttempt.gateway_reference,
        },
        _reused: true,
      });
    }

    // ── 5. Idempotency key: DETERMINISTIC per order (Phase 9 · P0-9) ───────────
    // Derive the key from the order id, not a random UUID. Combined with the DB partial
    // UNIQUE index uq_payment_attempts_active_order (at most one active attempt per order),
    // this makes server-side double-charge protection independent of the client-side
    // orchestrator lock — a second concurrent initiate collides on the key / index and is
    // reused instead of creating a second Moyasar charge. Orphan attempts still reuse their
    // stored key.
    const idempotencyKey: string = existingAttempt?.idempotency_key ?? `order:${orderId}`;
    let   attemptId: string;

    if (!existingAttempt) {
      // ── 6. Persist new payment attempt ──────────────────────────────────────
      const { data: attempt, error: attemptErr } = await supabase
        .from('payment_attempts')
        .insert({
          order_id:        orderId,
          customer_id:     customerId,
          provider:        'moyasar',
          amount:          authorisedAmount,
          currency:        (currency as string).toUpperCase(),
          status:          'pending',
          idempotency_key: idempotencyKey,
          raw_response:    null,
        })
        .select('id')
        .single();

      if (attemptErr || !attempt) {
        log('ERROR', FN, 'Failed to insert payment_attempt', { error: attemptErr?.message });
        return err('Failed to initiate payment — please retry', 500, 'ATTEMPT_CREATE_FAILED');
      }

      attemptId = attempt.id;
      log('INFO', FN, 'Payment attempt created', { attemptId, orderId });
    } else {
      attemptId = existingAttempt.id;
      log('INFO', FN, 'Reusing orphan attempt (no gateway_reference)', { attemptId });
    }

    // ── EF2-3: Call Moyasar POST /v1/payments ─────────────────────────────────
    // Authorization: HTTP Basic with secret key as username, empty password.
    // metadata fields are echoed back in the webhook, enabling us to match
    // the webhook event to our payment_attempt row without relying on Moyasar's ID.
    let moyasarPayment: Record<string, unknown>;

    try {
      const moyasarRes = await fetch('https://api.moyasar.com/v1/payments', {
        method:  'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(moyasarKey + ':'),
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          amount:       amountHalalas,
          currency:     'SAR',
          description:  'HAAT NOW order',
          callback_url: callbackUrl,
          source:       { type: 'creditcard' },
          metadata: {
            order_id:        orderId,
            idempotency_key: idempotencyKey,
            customer_id:     customerId,
          },
        }),
      });

      if (!moyasarRes.ok) {
        const errText = await moyasarRes.text();
        log('ERROR', FN, 'Moyasar API rejected payment creation', {
          status:    moyasarRes.status,
          // errText intentionally NOT logged — may contain sensitive gateway details
        });
        if (!existingAttempt) {
          await supabase.from('payment_attempts').delete().eq('id', attemptId);
        }
        return err('Payment provider error — please retry', 502, 'PROVIDER_ERROR');
      }

      moyasarPayment = await moyasarRes.json() as Record<string, unknown>;

    } catch (fetchErr: unknown) {
      log('ERROR', FN, 'Network error reaching Moyasar', { error: String(fetchErr) });
      if (!existingAttempt) {
        await supabase.from('payment_attempts').delete().eq('id', attemptId);
      }
      return err('Could not reach payment provider — please retry', 502, 'PROVIDER_UNREACHABLE');
    }

    const moyasarId  = moyasarPayment['id']      as string | null ?? null;
    const source     = (moyasarPayment['source'] as Record<string, unknown> | undefined) ?? {};
    const paymentUrl = source['transaction_url'] as string | null ?? null;

    log('INFO', FN, 'Moyasar payment created', { moyasarId, orderId });

    // ── EF2-4: Update payment_attempts with Moyasar data ──────────────────────
    // provider, gateway_reference, and raw_response are now populated.
    // This converts the row from a placeholder into a fully-wired payment attempt.
    await supabase
      .from('payment_attempts')
      .update({
        provider:          'moyasar',
        gateway_reference: moyasarId,
        raw_response:      moyasarPayment,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', attemptId);

    // ── EF2-5: Return real Moyasar payment URL ────────────────────────────────
    // gateway.paymentUrl is the Moyasar hosted page URL.
    // The client MUST redirect the customer here to complete payment.
    // Payment confirmation arrives via webhook — NOT from this response.
    return ok({
      success:          true,
      paymentAttemptId: attemptId,
      idempotencyKey,
      amount:           authorisedAmount,
      currency:         (currency as string).toUpperCase(),
      gateway: {
        status:     moyasarPayment['status'] ?? 'initiated',
        provider:   'moyasar',
        paymentUrl,
        moyasarId,
        expiresAt:  new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    });

  } catch (e: unknown) {
    log('ERROR', FN, 'Unhandled exception', { error: String(e) });
    return err('Internal server error', 500, 'INTERNAL_ERROR');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET an existing Moyasar payment to retrieve a fresh transaction_url.
// Used when a pending attempt already has a gateway_reference (Moyasar ID).
// Returns null on any network or API error — caller falls back gracefully.
// ─────────────────────────────────────────────────────────────────────────────
async function getMoyasarPayment(
  moyasarId: string,
  apiKey: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://api.moyasar.com/v1/payments/${moyasarId}`, {
      method:  'GET',
      headers: { 'Authorization': 'Basic ' + btoa(apiKey + ':') },
    });
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}
