// ─────────────────────────────────────────────────────────────────────────────
// Authentication metrics — in-memory counters + timing, exposed as a snapshot for
// dashboards / health probes. Pure and side-effect-free (no network, no clock read
// except the caller-supplied durations). Fed by authAudit.
// ─────────────────────────────────────────────────────────────────────────────
export type AuthCounter =
  | 'otp_requested'
  | 'otp_delivered'
  | 'otp_delivery_failed'
  | 'otp_verified'
  | 'login_success'
  | 'login_failure'
  | 'account_created'
  | 'account_locked'
  | 'rate_limit_triggered'
  | 'resend_requested'
  | 'logout';

const COUNTERS: AuthCounter[] = [
  'otp_requested', 'otp_delivered', 'otp_delivery_failed', 'otp_verified',
  'login_success', 'login_failure', 'account_created', 'account_locked',
  'rate_limit_triggered', 'resend_requested', 'logout',
];

interface MetricsState {
  counters: Record<AuthCounter, number>;
  verifyMsTotal: number;
  verifyMsCount: number;
}

const zero = (): MetricsState => ({
  counters: COUNTERS.reduce((a, c) => { a[c] = 0; return a; }, {} as Record<AuthCounter, number>),
  verifyMsTotal: 0,
  verifyMsCount: 0,
});

let state = zero();

const rate = (num: number, den: number): number => (den > 0 ? Number((num / den).toFixed(4)) : 0);

export interface AuthMetricsSnapshot {
  counters: Record<AuthCounter, number>;
  rates: {
    loginSuccessRate: number;    // success / (success + failure)
    loginFailureRate: number;    // failure / (success + failure)
    otpVerificationRate: number; // verified / requested
    otpDeliveryFailureRate: number; // delivery_failed / requested
  };
  averageVerificationMs: number;
  resendRequests: number;
  lockedAccounts: number;
}

export const authMetrics = {
  inc(counter: AuthCounter, by = 1): void { state.counters[counter] += by; },

  /** Record an observed verify round-trip duration (ms). */
  observeVerifyMs(ms: number): void {
    if (ms >= 0 && Number.isFinite(ms)) { state.verifyMsTotal += ms; state.verifyMsCount += 1; }
  },

  /** Structured snapshot for dashboards / health endpoints. */
  snapshot(): AuthMetricsSnapshot {
    const c = state.counters;
    const attempts = c.login_success + c.login_failure;
    return {
      counters: { ...c },
      rates: {
        loginSuccessRate: rate(c.login_success, attempts),
        loginFailureRate: rate(c.login_failure, attempts),
        otpVerificationRate: rate(c.otp_verified, c.otp_requested),
        otpDeliveryFailureRate: rate(c.otp_delivery_failed, c.otp_requested),
      },
      averageVerificationMs: state.verifyMsCount > 0 ? Math.round(state.verifyMsTotal / state.verifyMsCount) : 0,
      resendRequests: c.resend_requested,
      lockedAccounts: c.account_locked,
    };
  },

  /** Reset — tests only. */
  reset(): void { state = zero(); },
};
