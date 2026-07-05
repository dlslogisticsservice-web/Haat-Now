/**
 * payment-webhook
 *
 * Receives inbound webhook calls from payment providers.
 * Server-to-server only — no CORS headers, no browser callers.
 *
 * Security model:
 *   - HMAC-SHA256 signature verification (provider-specific header)
 *   - Idempotency enforced via webhook_events.idempotency_key UNIQUE constraint
 *   - Duplicate deliveries return 200 immediately without re-processing
 *   - All writes use the service-role client (bypasses RLS — no customer context)
 *
 * POST /functions/v1/payment-webhook
 * Headers:
 *   x-webhook-signature   HMAC-SHA256 hex digest of the raw body
 *   x-webhook-provider    Provider name: "moyasar" | "stripe" (extensible)
 *
 * Flow:
 *   1. Verify HMAC signature
 *   2. Deduplicate via webhook_events.idempotency_key
 *   3. Insert webhook_events row
 *   4. Parse event type and resolve order/attempt IDs
 *   5. Update payment_attempts.status + gateway_reference
 *   6. Update orders.payment_status on capture
 *   7. Mark webhook_events.processed = true
 */

import { okServer, errServer } from '../_shared/response.ts';
import { adminClient }         from '../_shared/supabase.ts';
import { log }                 from '../_shared/log.ts';

const FN = 'payment-webhook';

/** Supported status values for payment_attempts */
type AttemptStatus = 'pending' | 'captured' | 'failed' | 'cancelled';

/** Normalised event parsed from any provider's payload */
interface ParsedEvent {
  provider:         string;
  eventType:        string;
  idempotencyKey:   string;   // Provider's own event/transaction ID
  orderId:          string | null;
  attemptIdemKey:   string | null;  // Our idempotency_key we sent as metadata
  gatewayReference: string | null;
  targetStatus:     AttemptStatus;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return errServer('Method not allowed', 405, 'METHOD_NOT_ALLOWED');

  try {
    // ── 1. Extract provider and raw body ──────────────────────────────────────
    const provider  = (req.headers.get('x-webhook-provider') ?? 'unknown').toLowerCase();
    const rawBody   = await req.text();

    if (!rawBody) return errServer('Empty body', 400, 'EMPTY_BODY');

    log('INFO', FN, 'Webhook received', { provider, bodyLength: rawBody.length });

    // ── 2. HMAC-SHA256 signature verification ─────────────────────────────────
    // PAYMENT_WEBHOOK_SECRET must be set via: supabase secrets set PAYMENT_WEBHOOK_SECRET=<value>
    const webhookSecret = Deno.env.get('PAYMENT_WEBHOOK_SECRET');

    if (!webhookSecret) {
      // FAIL CLOSED: without the secret we cannot verify authenticity, so a forged
      // webhook could mark orders paid. Reject by default. Local development may opt
      // out EXPLICITLY with WEBHOOK_ALLOW_UNSIGNED=true (never set that in production).
      const allowUnsigned = Deno.env.get('WEBHOOK_ALLOW_UNSIGNED') === 'true';
      if (!allowUnsigned) {
        log('ERROR', FN, 'PAYMENT_WEBHOOK_SECRET not set — rejecting webhook. Set the secret (supabase secrets set PAYMENT_WEBHOOK_SECRET=…), or WEBHOOK_ALLOW_UNSIGNED=true for local dev only.', { provider });
        return errServer('Webhook signature verification is not configured', 503, 'WEBHOOK_SECRET_MISSING');
      }
      log('WARN', FN, 'PAYMENT_WEBHOOK_SECRET not set but WEBHOOK_ALLOW_UNSIGNED=true — skipping HMAC verification (LOCAL DEV ONLY)');
    } else {
      // Moyasar sends its HMAC in x-moyasar-signature; all other providers use x-webhook-signature.
      const signatureHeader =
        provider === 'moyasar'
          ? req.headers.get('x-moyasar-signature') ?? ''
          : req.headers.get('x-webhook-signature') ?? '';
      const valid = await verifyHmacSha256(webhookSecret, rawBody, signatureHeader);
      if (!valid) {
        log('WARN', FN, 'HMAC signature mismatch — rejecting webhook', { provider });
        return errServer('Invalid signature', 401, 'INVALID_SIGNATURE');
      }
    }

    // ── 3. Parse provider payload ──────────────────────────────────────────────
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(rawBody); }
    catch { return errServer('Invalid JSON payload', 400, 'INVALID_JSON'); }

    const parsed = parseProviderEvent(provider, payload);
    if (!parsed) {
      log('WARN', FN, 'Unrecognised or unactionable event', { provider });
      return okServer({ received: true, processed: false, reason: 'unrecognised_event' });
    }

    const supabase = adminClient();

    // ── 4. Idempotency check — prevent duplicate processing ───────────────────
    const { data: existing } = await supabase
      .from('webhook_events')
      .select('id, processed')
      .eq('idempotency_key', parsed.idempotencyKey)
      .maybeSingle();

    if (existing) {
      log('INFO', FN, 'Duplicate webhook — already received, ignoring', {
        idempotencyKey: parsed.idempotencyKey,
        processed: existing.processed,
      });
      // Return 200 so the provider stops retrying. Idempotency handled.
      return okServer({ received: true, processed: false, reason: 'duplicate' });
    }

    // ── 5. Persist raw payload ─────────────────────────────────────────────────
    const { data: webhookEvent, error: webhookErr } = await supabase
      .from('webhook_events')
      .insert({
        provider:        parsed.provider,
        event_type:      parsed.eventType,
        idempotency_key: parsed.idempotencyKey,
        payload,
        processed:       false,
      })
      .select('id')
      .single();

    if (webhookErr || !webhookEvent) {
      // UNIQUE violation means a concurrent request already inserted this event.
      // PostgreSQL raises code 23505 on unique_violation — treat as duplicate.
      if (webhookErr?.code === '23505') {
        log('INFO', FN, 'Race-condition duplicate — unique_violation caught', {
          idempotencyKey: parsed.idempotencyKey,
        });
        return okServer({ received: true, processed: false, reason: 'duplicate_race' });
      }
      log('ERROR', FN, 'Failed to insert webhook_events', { error: webhookErr?.message });
      return errServer('Failed to record webhook', 500, 'WEBHOOK_STORE_FAILED');
    }

    log('INFO', FN, 'Webhook event stored', { webhookEventId: webhookEvent.id });

    // ── 6. Resolve the matching payment_attempt ────────────────────────────────
    let attemptId: string | null = null;

    // Prefer our own idempotency_key stored as metadata in the gateway request
    if (parsed.attemptIdemKey) {
      const { data: a } = await supabase
        .from('payment_attempts')
        .select('id, order_id, status')
        .eq('idempotency_key', parsed.attemptIdemKey)
        .maybeSingle();
      if (a) attemptId = a.id;
    }

    // Fallback: match by order ID + pending status
    if (!attemptId && parsed.orderId) {
      const { data: a } = await supabase
        .from('payment_attempts')
        .select('id, order_id, status')
        .eq('order_id', parsed.orderId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (a) attemptId = a.id;
    }

    // ── 7. Update payment_attempt status ──────────────────────────────────────
    if (attemptId) {
      await supabase
        .from('payment_attempts')
        .update({
          status:            parsed.targetStatus,
          gateway_reference: parsed.gatewayReference,
          raw_response:      payload,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', attemptId)
        .neq('status', 'captured');  // Guard: never downgrade a captured attempt
    } else {
      log('WARN', FN, 'No matching payment_attempt found for webhook', {
        orderId: parsed.orderId, provider: parsed.provider,
      });
    }

    // ── 8. Update orders.payment_status on capture ────────────────────────────
    if (parsed.targetStatus === 'captured' && parsed.orderId) {
      const { error: orderUpdateErr } = await supabase
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', parsed.orderId)
        .eq('payment_status', 'unpaid');  // Idempotency: only update if still unpaid

      if (orderUpdateErr) {
        log('ERROR', FN, 'Failed to update orders.payment_status', {
          error: orderUpdateErr.message, orderId: parsed.orderId,
        });
      } else {
        log('INFO', FN, 'Order marked as paid', { orderId: parsed.orderId });
      }
    }

    // ── 9. Mark webhook_event as processed ────────────────────────────────────
    await supabase
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', webhookEvent.id);

    log('INFO', FN, 'Webhook processed successfully', {
      webhookEventId: webhookEvent.id,
      targetStatus:   parsed.targetStatus,
      orderId:        parsed.orderId,
    });

    return okServer({
      received:       true,
      processed:      true,
      webhookEventId: webhookEvent.id,
      targetStatus:   parsed.targetStatus,
    });

  } catch (e: unknown) {
    log('ERROR', FN, 'Unhandled exception', { error: String(e) });
    return errServer('Internal server error', 500, 'INTERNAL_ERROR');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HMAC-SHA256 verification using the Web Crypto API (Deno native, no deps)
// ─────────────────────────────────────────────────────────────────────────────
async function verifyHmacSha256(
  secret: string,
  payload: string,
  signatureHex: string,
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBytes  = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const computed  = Array.from(new Uint8Array(sigBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    // Constant-time comparison to prevent timing attacks
    return timingSafeEqual(computed, signatureHex.toLowerCase());
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider-specific event parsers
// Add new providers by extending this function and the ParsedEvent builder.
// ─────────────────────────────────────────────────────────────────────────────
function parseProviderEvent(
  provider: string,
  payload: Record<string, unknown>,
): ParsedEvent | null {
  switch (provider) {
    case 'moyasar':  return parseMoyasar(payload);
    case 'stripe':   return parseStripe(payload);
    case 'mock':     return parseMock(payload);
    default:
      return null;
  }
}

/** Moyasar webhook shape: https://docs.moyasar.com/webhooks */
function parseMoyasar(p: Record<string, unknown>): ParsedEvent | null {
  const id     = p['id'] as string | undefined;
  const status = p['status'] as string | undefined;

  if (!id) return null;

  const statusMap: Record<string, AttemptStatus> = {
    paid:     'captured',
    failed:   'failed',
    cancelled: 'cancelled',
  };

  const targetStatus: AttemptStatus = statusMap[status ?? ''] ?? 'pending';

  // Both idempotency_key and order_id are stored at the top-level metadata field,
  // which Moyasar echoes back from the metadata object we sent during payment creation.
  // Previous code incorrectly read from p.source.metadata — Moyasar puts it at p.metadata.
  const topMeta  = (p['metadata'] as Record<string, unknown> | undefined) ?? {};
  const idemKey  = topMeta['idempotency_key'] as string | null ?? null;
  const orderId  = topMeta['order_id']        as string | null ?? null;

  return {
    provider:         'moyasar',
    eventType:        `moyasar.payment.${status ?? 'unknown'}`,
    idempotencyKey:   id,
    orderId,
    attemptIdemKey:   idemKey,
    gatewayReference: id,
    targetStatus,
  };
}

/** Stripe webhook shape: https://stripe.com/docs/webhooks */
function parseStripe(p: Record<string, unknown>): ParsedEvent | null {
  const id       = p['id'] as string | undefined;
  const type     = p['type'] as string | undefined;
  const dataObj  = (p['data'] as Record<string, unknown> | undefined)?.['object'] as Record<string, unknown> | undefined;

  if (!id || !type || !dataObj) return null;

  const statusMap: Record<string, AttemptStatus> = {
    'payment_intent.succeeded':        'captured',
    'payment_intent.payment_failed':   'failed',
    'payment_intent.canceled':         'cancelled',
  };

  const targetStatus: AttemptStatus = statusMap[type] ?? 'pending';
  if (!(type in statusMap)) return null; // Ignore non-actionable events

  const meta    = (dataObj['metadata'] as Record<string, unknown> | undefined) ?? {};
  const orderId = meta['order_id']        as string | null ?? null;
  const idemKey = meta['idempotency_key'] as string | null ?? null;

  return {
    provider:         'stripe',
    eventType:        type,
    idempotencyKey:   id,
    orderId,
    attemptIdemKey:   idemKey,
    gatewayReference: dataObj['id'] as string | null ?? id,
    targetStatus,
  };
}

/** Mock provider for sandbox testing without a real gateway */
function parseMock(p: Record<string, unknown>): ParsedEvent | null {
  const id      = p['id'] as string | undefined;
  const status  = p['status'] as string | undefined;
  const orderId = p['order_id'] as string | null ?? null;
  const idemKey = p['idempotency_key'] as string | null ?? null;

  if (!id) return null;

  const statusMap: Record<string, AttemptStatus> = {
    captured:  'captured',
    failed:    'failed',
    cancelled: 'cancelled',
  };

  return {
    provider:         'mock',
    eventType:        `mock.payment.${status ?? 'unknown'}`,
    idempotencyKey:   id,
    orderId,
    attemptIdemKey:   idemKey,
    gatewayReference: id,
    targetStatus:     statusMap[status ?? ''] ?? 'pending',
  };
}
