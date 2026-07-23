// ─────────────────────────────────────────────────────────────────────────────
// Notification delivery pipeline — the status lifecycle and retry strategy.
//
// This is NOT a second notification service. notification.service still owns the actual
// in-app send + token storage. This module is the pure DECISION layer a delivery worker
// (an edge function, later) drives: what state a message is in, when to retry, when to
// give up, when it has expired. Keeping it pure means the same rules can run on the
// client, in a test, or server-side without change.
//
// The seven states the platform tracks:
//   queued → sent → delivered → acknowledged        (happy path)
//               ↘ failed → retry → sent …            (transient failure, bounded)
//                              ↘ failed              (retries exhausted)
//   (any active state) → expired                     (TTL elapsed)
//
// PURE. No React, no DOM, no network, no clock — the caller passes `now`.
// ─────────────────────────────────────────────────────────────────────────────

export type DeliveryStatus =
  | 'queued' | 'sent' | 'delivered' | 'failed' | 'expired' | 'retry' | 'acknowledged';

export interface DeliveryState {
  status: DeliveryStatus;
  /** Send attempts made so far. */
  attempts: number;
  queuedAt: number;
  lastAttemptAt: number | null;
  /** When the next retry becomes due (status 'retry'). */
  nextRetryAt: number | null;
  /** Last failure reason, for diagnostics. */
  lastError?: string;
}

/** Active = still moving through the pipeline. Terminal = done, one way or another. */
export const ACTIVE_DELIVERY: readonly DeliveryStatus[] = ['queued', 'sent', 'retry'];
export const TERMINAL_DELIVERY: readonly DeliveryStatus[] = ['delivered', 'acknowledged', 'failed', 'expired'];
export const isDeliveryActive = (s: DeliveryStatus): boolean => ACTIVE_DELIVERY.includes(s);
export const isDeliveryTerminal = (s: DeliveryStatus): boolean => TERMINAL_DELIVERY.includes(s);

export const DELIVERY_POLICY = {
  /** Total send attempts before giving up. */
  maxAttempts: 5,
  /** First retry delay; doubles each attempt. */
  baseBackoffMs: 30_000,
  /** Backoff ceiling — retries never wait longer than this. */
  maxBackoffMs: 15 * 60_000,
  /** A message older than this is expired and must not be delivered late. */
  ttlMs: 24 * 60 * 60_000,
} as const;

/** Exponential backoff for the Nth attempt (1-based), capped. Deterministic (no jitter). */
export function backoffMs(attempt: number): number {
  const exp = DELIVERY_POLICY.baseBackoffMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(DELIVERY_POLICY.maxBackoffMs, exp);
}

export function queue(now: number): DeliveryState {
  return { status: 'queued', attempts: 0, queuedAt: now, lastAttemptAt: null, nextRetryAt: null };
}

/** A send attempt has been dispatched to the provider. */
export function markSent(state: DeliveryState, now: number): DeliveryState {
  return { ...state, status: 'sent', attempts: state.attempts + 1, lastAttemptAt: now, nextRetryAt: null };
}

/** The provider (or its receipt) confirmed delivery. */
export function markDelivered(state: DeliveryState, now: number): DeliveryState {
  return { ...state, status: 'delivered', lastAttemptAt: now };
}

/** The recipient opened/acknowledged it. */
export function markAcknowledged(state: DeliveryState, now: number): DeliveryState {
  return { ...state, status: 'acknowledged', lastAttemptAt: now };
}

/**
 * A send attempt failed. If attempts remain, schedule a retry (status 'retry') with a
 * backoff; otherwise the message is 'failed'. It never silently succeeds.
 */
export function markFailed(state: DeliveryState, now: number, error?: string): DeliveryState {
  const attempts = Math.max(state.attempts, 1);   // a failure implies an attempt was made
  if (attempts >= DELIVERY_POLICY.maxAttempts) {
    return { ...state, status: 'failed', attempts, lastAttemptAt: now, nextRetryAt: null, lastError: error };
  }
  return { ...state, status: 'retry', attempts, lastAttemptAt: now, nextRetryAt: now + backoffMs(attempts), lastError: error };
}

/** Is a retry now due? */
export function dueForRetry(state: DeliveryState, now: number): boolean {
  return state.status === 'retry' && state.nextRetryAt !== null && now >= state.nextRetryAt;
}

/** Flip an active-but-expired message to 'expired'. Terminal states are untouched. */
export function applyExpiry(state: DeliveryState, now: number): DeliveryState {
  if (isDeliveryTerminal(state.status)) return state;
  if (now - state.queuedAt > DELIVERY_POLICY.ttlMs) {
    return { ...state, status: 'expired', lastAttemptAt: now };
  }
  return state;
}

export interface QueueStats {
  queued: number; sent: number; retry: number; delivered: number;
  acknowledged: number; failed: number; expired: number;
  /** Active backlog = queued + retry + sent. */
  backlog: number;
  /** Failed + expired — messages that never reached the user. */
  dropped: number;
}

/** Aggregate a batch of delivery states — the queue view Guardian surfaces. */
export function queueStats(states: DeliveryState[]): QueueStats {
  const s: QueueStats = { queued: 0, sent: 0, retry: 0, delivered: 0, acknowledged: 0, failed: 0, expired: 0, backlog: 0, dropped: 0 };
  for (const d of states) {
    s[d.status]++;
  }
  s.backlog = s.queued + s.retry + s.sent;
  s.dropped = s.failed + s.expired;
  return s;
}
