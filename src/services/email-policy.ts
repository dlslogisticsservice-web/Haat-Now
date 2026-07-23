// ─────────────────────────────────────────────────────────────────────────────
// Email delivery policy — the email status lifecycle and retry schedule.
//
// Email is another delivery channel in the SAME communication architecture, so it does
// not fork the retry engine: it REUSES delivery-policy's backoff + TTL + attempt cap
// (import below). What is email-specific is the richer status vocabulary — 'sending' (in
// flight to the provider) and 'opened' (tracking, future-ready) — and BOUNCE handling: a
// hard bounce is terminal and must never be retried (retrying a dead mailbox is abuse).
//
// PURE. No React, no DOM, no network, no clock — the caller passes `now`.
// ─────────────────────────────────────────────────────────────────────────────
import { backoffMs, DELIVERY_POLICY } from './delivery-policy';

export type EmailStatus =
  | 'queued' | 'sending' | 'sent' | 'delivered' | 'opened' | 'failed' | 'retry' | 'expired';

export type BounceKind = 'hard' | 'soft' | 'none';

export interface EmailDelivery {
  status: EmailStatus;
  attempts: number;
  queuedAt: number;
  lastAttemptAt: number | null;
  nextRetryAt: number | null;
  bounce: BounceKind;
  lastError?: string;
}

export const EMAIL_ACTIVE: readonly EmailStatus[] = ['queued', 'sending', 'sent', 'retry'];
export const EMAIL_TERMINAL: readonly EmailStatus[] = ['delivered', 'opened', 'failed', 'expired'];
export const isEmailActive = (s: EmailStatus): boolean => EMAIL_ACTIVE.includes(s);
export const isEmailTerminal = (s: EmailStatus): boolean => EMAIL_TERMINAL.includes(s);

/** Hard-bounce signatures — a permanent failure that must never be retried. */
const HARD_BOUNCE = /(no such user|mailbox.*(not found|unavailable)|does not exist|invalid.*(recipient|address)|550|5\.1\.1)/i;
export function classifyBounce(reason?: string): BounceKind {
  if (!reason) return 'none';
  return HARD_BOUNCE.test(reason) ? 'hard' : 'soft';
}

export function queueEmail(now: number): EmailDelivery {
  return { status: 'queued', attempts: 0, queuedAt: now, lastAttemptAt: null, nextRetryAt: null, bounce: 'none' };
}

/** Dispatch to the provider has begun (in flight). */
export function markSending(state: EmailDelivery, now: number): EmailDelivery {
  return { ...state, status: 'sending', attempts: state.attempts + 1, lastAttemptAt: now, nextRetryAt: null };
}

/** The provider accepted the message for delivery. */
export function markSent(state: EmailDelivery, now: number): EmailDelivery {
  return { ...state, status: 'sent', lastAttemptAt: now };
}

/** The recipient MTA confirmed delivery. */
export function markDelivered(state: EmailDelivery, now: number): EmailDelivery {
  return { ...state, status: 'delivered', lastAttemptAt: now };
}

/** The recipient opened it (open-tracking; future-ready). */
export function markOpened(state: EmailDelivery, now: number): EmailDelivery {
  return { ...state, status: 'opened', lastAttemptAt: now };
}

/**
 * A send attempt failed. A HARD bounce is terminal ('failed') immediately — never retried.
 * A soft/transient failure retries with backoff until the shared attempt cap, then fails.
 * Never returns a success.
 */
export function markFailed(state: EmailDelivery, now: number, reason?: string): EmailDelivery {
  const bounce = classifyBounce(reason);
  const attempts = Math.max(state.attempts, 1);
  if (bounce === 'hard' || attempts >= DELIVERY_POLICY.maxAttempts) {
    return { ...state, status: 'failed', attempts, lastAttemptAt: now, nextRetryAt: null, bounce, lastError: reason };
  }
  return { ...state, status: 'retry', attempts, lastAttemptAt: now, nextRetryAt: now + backoffMs(attempts), bounce, lastError: reason };
}

export function dueForRetry(state: EmailDelivery, now: number): boolean {
  return state.status === 'retry' && state.nextRetryAt !== null && now >= state.nextRetryAt;
}

/** Flip an active-but-expired message to 'expired'. Terminal states are untouched. */
export function applyExpiry(state: EmailDelivery, now: number): EmailDelivery {
  if (isEmailTerminal(state.status)) return state;
  if (now - state.queuedAt > DELIVERY_POLICY.ttlMs) return { ...state, status: 'expired', lastAttemptAt: now };
  return state;
}

export interface EmailQueueStats {
  queued: number; sending: number; sent: number; retry: number;
  delivered: number; opened: number; failed: number; expired: number;
  /** Active backlog awaiting a terminal state. */
  backlog: number;
  /** Failed + expired — never reached the inbox. */
  dropped: number;
  /** Hard + soft bounces observed. */
  bounced: number;
}

export function emailQueueStats(states: EmailDelivery[]): EmailQueueStats {
  const s: EmailQueueStats = { queued: 0, sending: 0, sent: 0, retry: 0, delivered: 0, opened: 0, failed: 0, expired: 0, backlog: 0, dropped: 0, bounced: 0 };
  for (const d of states) {
    s[d.status]++;
    if (d.bounce !== 'none') s.bounced++;
  }
  s.backlog = s.queued + s.sending + s.sent + s.retry;
  s.dropped = s.failed + s.expired;
  return s;
}
