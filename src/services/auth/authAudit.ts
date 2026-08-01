// ─────────────────────────────────────────────────────────────────────────────
// Authentication audit log — the single place auth events are recorded. Each event
// is (a) logged to the monitoring/Guardian seam and (b) folded into authMetrics.
// Identities are ALWAYS pre-masked by the caller (provider.mask); no PII is recorded.
// ─────────────────────────────────────────────────────────────────────────────
import { monitoring } from '../monitoring.service';
import { authMetrics, type AuthCounter } from './authMetrics';
import type { AuthChannel } from './types';

export type AuthEvent =
  | 'otp_requested'
  | 'otp_delivered'
  | 'otp_verified'
  | 'login_success'
  | 'login_failure'
  | 'account_created'
  | 'account_locked'
  | 'rate_limit_triggered'
  | 'resend_requested'
  | 'logout';

export interface AuthEventContext {
  channel?: AuthChannel;
  /** Already masked (e.g. `cu***@haatnow.test`) — never a raw identity. */
  identity?: string;
  /** Machine reason for failures / denials (e.g. 'otp_cooldown', 'invalid code'). */
  reason?: string;
  /** Verify round-trip duration (ms), when applicable. */
  ms?: number;
}

// Which counter (if any) each event increments.
const EVENT_COUNTER: Partial<Record<AuthEvent, AuthCounter>> = {
  otp_requested: 'otp_requested',
  otp_delivered: 'otp_delivered',
  otp_verified: 'otp_verified',
  login_success: 'login_success',
  login_failure: 'login_failure',
  account_created: 'account_created',
  account_locked: 'account_locked',
  rate_limit_triggered: 'rate_limit_triggered',
  resend_requested: 'resend_requested',
  logout: 'logout',
};

// Log severity per event — failures/denials warn, everything else info.
const WARN_EVENTS = new Set<AuthEvent>(['login_failure', 'account_locked', 'rate_limit_triggered']);

export const authAudit = {
  record(event: AuthEvent, ctx: AuthEventContext = {}): void {
    const counter = EVENT_COUNTER[event];
    if (counter) authMetrics.inc(counter);
    if (typeof ctx.ms === 'number') authMetrics.observeVerifyMs(ctx.ms);

    const level = WARN_EVENTS.has(event) ? 'warn' : 'info';
    monitoring.log(level, `[auth] ${event}`, {
      event,
      channel: ctx.channel,
      identity: ctx.identity,
      ...(ctx.reason ? { reason: ctx.reason } : {}),
      ...(typeof ctx.ms === 'number' ? { ms: ctx.ms } : {}),
    });
  },

  /** Convenience passthrough for dashboards/health probes. */
  metrics: () => authMetrics.snapshot(),
};
