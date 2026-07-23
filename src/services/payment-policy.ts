// ─────────────────────────────────────────────────────────────────────────────
// Payment reconciliation policy — classifies existing payment statuses and decides
// which in-flight payments are STUCK and need follow-up.
//
// This is NOT a second payment service and it defines NO new status model. The status
// strings it classifies are the ones already in the codebase: PaymentAttempt
// (pending/captured/failed/cancelled), PaymentTransaction (pending/succeeded/failed/
// refunded), the COD model (pending/collected), and orders.payment_status. The
// orchestrator still owns idempotency, the edge-function call and the DB reads; this
// module only DECIDES from what those return.
//
// The gap it fills: paymentOrchestrator.reconcile() returns rows locked in 'pending' but
// never judges whether they are merely in-flight or genuinely stuck. That judgement is
// pure and belongs here.
//
// PURE. No React, no DOM, no network, no clock — the caller passes `now`.
// ─────────────────────────────────────────────────────────────────────────────

/** The outcome a raw status string collapses to. */
export type PaymentOutcome = 'success' | 'failed' | 'pending' | 'refunded';

// The vocabulary already in use across PaymentAttempt / PaymentTransaction / COD / orders.
const SUCCESS = new Set(['captured', 'succeeded', 'paid', 'collected']);
const FAILED = new Set(['failed', 'cancelled', 'canceled']);
const REFUNDED = new Set(['refunded', 'partially_refunded']);
const PENDING = new Set(['pending', 'locked', 'processing', 'initiated', 'unpaid']);

/** Collapse any known status string to a single outcome. Unknown → 'pending' (never assume paid). */
export function classifyPayment(status: string): PaymentOutcome {
  const s = (status || '').toLowerCase();
  if (SUCCESS.has(s)) return 'success';
  if (REFUNDED.has(s)) return 'refunded';
  if (FAILED.has(s)) return 'failed';
  if (PENDING.has(s)) return 'pending';
  return 'pending';   // an unrecognised status is treated as in-flight, not settled
}

export const isPaymentSettled = (status: string): boolean => {
  const o = classifyPayment(status);
  return o === 'success' || o === 'refunded';
};
export const isPaymentFailed = (status: string): boolean => classifyPayment(status) === 'failed';
export const isPaymentPending = (status: string): boolean => classifyPayment(status) === 'pending';

export const PAYMENT_POLICY = {
  /** A payment still 'pending' beyond this is stuck — the gateway result never came back. */
  stuckAfterMs: 10 * 60_000,
} as const;

/** Minimal shape of a reconciliation candidate — a subset of PaymentAttempt/idempotency rows. */
export interface ReconRecord { status: string; createdAt: number }

/** Is this record stuck (pending past the threshold), needing manual/automated follow-up? */
export function isStuck(rec: ReconRecord, now: number): boolean {
  return isPaymentPending(rec.status) && now - rec.createdAt > PAYMENT_POLICY.stuckAfterMs;
}

export interface ReconStats {
  success: number; failed: number; refunded: number;
  /** Pending but still within the window — normal in-flight. */
  pending: number;
  /** Pending past the threshold — genuinely stuck. */
  stuck: number;
}

/** Partition a batch of payment records for the reconciliation view Guardian surfaces. */
export function reconcileStats(records: ReconRecord[], now: number): ReconStats {
  const s: ReconStats = { success: 0, failed: 0, refunded: 0, pending: 0, stuck: 0 };
  for (const r of records) {
    const o = classifyPayment(r.status);
    if (o === 'success') s.success++;
    else if (o === 'failed') s.failed++;
    else if (o === 'refunded') s.refunded++;
    else if (isStuck(r, now)) s.stuck++;
    else s.pending++;
  }
  return s;
}
