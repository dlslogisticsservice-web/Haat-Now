// ─────────────────────────────────────────────────────────────────────────────
// OTP abuse-guard policy — client-side DEFENSE IN DEPTH.
//
// SECURITY BOUNDARY: this is NOT the security boundary. The OTP itself is generated,
// sent, verified and expired by Supabase Auth on the SERVER — the client never sees,
// generates or stores an OTP. Supabase also enforces its own server-side rate limits.
//
// What this adds is a fast, honest, client-side guard on TOP of that: it rejects a
// resend still in cooldown, a phone that has burned too many sends, and a code that has
// failed too many times — before a wasted round-trip, and with a specific reason. It can
// only ever be MORE strict than the server, never less. A bypassed client guard changes
// nothing: the server still rejects.
//
// PURE. No React, no DOM, no network, no clock — the caller passes `now`, so every
// decision is deterministic and unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

/** Machine-readable denial reason. The UI localises these; tests assert on them. */
export type OtpDenyReason =
  | 'cooldown'          // a resend was requested before the cooldown elapsed
  | 'send_limit'        // too many sends for this phone within the window
  | 'attempt_limit'     // too many invalid codes — locked out
  | 'replay'            // this OTP session was already consumed (verified)
  | 'locked';           // still inside a lockout window

export interface OtpDecision {
  allowed: boolean;
  reason?: OtpDenyReason;
  /** Seconds the caller must wait before retrying, when the denial is time-based. */
  retryAfterSec?: number;
}

/** Per-phone guard state. Held in memory by authService — never persisted (no OTP in it). */
export interface OtpGuardState {
  /** Send timestamps (ms) within the rolling window. */
  sends: number[];
  lastSendAt: number | null;
  /** Consecutive invalid verifies for the current code. */
  verifyFails: number;
  /** Lockout expiry (ms) after too many invalid attempts. */
  lockedUntil: number | null;
  /** True once a code has been verified — blocks client-side replay of the same session. */
  consumed: boolean;
}

// Thresholds. Intentionally generous — a normal one-send/one-verify login never trips them.
export const OTP_POLICY = {
  /** Minimum gap between OTP sends to the same phone (rate limiting). */
  resendCooldownMs: 30_000,
  /** Rolling window for the send cap. */
  sendWindowMs: 15 * 60_000,
  /** Max sends per phone per window (retry limits). */
  maxSendsPerWindow: 5,
  /** Max invalid codes before lockout (invalid attempt limits). */
  maxVerifyFails: 5,
  /** Lockout duration after the invalid-attempt limit is hit. */
  lockoutMs: 15 * 60_000,
} as const;

export const emptyOtpState = (): OtpGuardState => ({
  sends: [], lastSendAt: null, verifyFails: 0, lockedUntil: null, consumed: false,
});

const ceilSec = (ms: number): number => Math.max(1, Math.ceil(ms / 1000));
const prune = (sends: number[], now: number): number[] => sends.filter(t => now - t < OTP_POLICY.sendWindowMs);

/** May we SEND (or resend) an OTP to this phone right now? */
export function checkSend(state: OtpGuardState, now: number): OtpDecision {
  if (state.lockedUntil && now < state.lockedUntil) {
    return { allowed: false, reason: 'locked', retryAfterSec: ceilSec(state.lockedUntil - now) };
  }
  if (state.lastSendAt !== null) {
    const since = now - state.lastSendAt;
    if (since < OTP_POLICY.resendCooldownMs) {
      return { allowed: false, reason: 'cooldown', retryAfterSec: ceilSec(OTP_POLICY.resendCooldownMs - since) };
    }
  }
  if (prune(state.sends, now).length >= OTP_POLICY.maxSendsPerWindow) {
    const oldest = prune(state.sends, now)[0];
    return { allowed: false, reason: 'send_limit', retryAfterSec: ceilSec(OTP_POLICY.sendWindowMs - (now - oldest)) };
  }
  return { allowed: true };
}

/** Record a successful send. A new send opens a fresh verify session. */
export function recordSend(state: OtpGuardState, now: number): OtpGuardState {
  return {
    ...state,
    sends: [...prune(state.sends, now), now],
    lastSendAt: now,
    verifyFails: 0,
    consumed: false,
  };
}

/**
 * May we attempt a VERIFY right now? Hitting the invalid-attempt limit sets a lockout
 * (see recordVerifyFailure), so the lockout window IS the enforcement — once it expires,
 * attempts resume. There is no separate "attempt_limit" denial that could outlive the
 * lockout and leave a phone blocked forever.
 */
export function checkVerify(state: OtpGuardState, now: number): OtpDecision {
  if (state.lockedUntil && now < state.lockedUntil) {
    return { allowed: false, reason: 'locked', retryAfterSec: ceilSec(state.lockedUntil - now) };
  }
  if (state.consumed) return { allowed: false, reason: 'replay' };
  return { allowed: true };
}

/** Record a rejected code. The Nth failure locks the phone out; an expired lockout resets. */
export function recordVerifyFailure(state: OtpGuardState, now: number): OtpGuardState {
  // A failure after a prior lockout has expired starts a fresh allotment.
  const base = state.lockedUntil && now >= state.lockedUntil
    ? { ...state, verifyFails: 0, lockedUntil: null }
    : state;
  const verifyFails = base.verifyFails + 1;
  const locked = verifyFails >= OTP_POLICY.maxVerifyFails;
  return { ...base, verifyFails, lockedUntil: locked ? now + OTP_POLICY.lockoutMs : base.lockedUntil };
}

/** Record a successful verify. Consumes the session so the same code cannot be replayed. */
export function recordVerifySuccess(state: OtpGuardState, _now: number): OtpGuardState {
  return { ...state, verifyFails: 0, consumed: true };
}
