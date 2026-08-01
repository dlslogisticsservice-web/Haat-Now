// ─────────────────────────────────────────────────────────────────────────────
// Email monitoring — the single place email delivery events are recorded. Each event
// updates emailMetrics and logs to the monitoring/Guardian seam. Recipients are masked.
// Webhook-driven events (delivered/deferred/opened/clicked) arrive from the provider's
// delivery webhook; send/failed/queued/retry are recorded inline by the platform.
// ─────────────────────────────────────────────────────────────────────────────
import { monitoring } from '../monitoring.service';
import { emailMetrics } from './emailMetrics';
import { maskEmail } from './resendProvider';
import type { EmailTemplateId } from './types';

export type EmailEvent =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'deferred'
  | 'failed'
  | 'dead_lettered'
  | 'retry'
  | 'opened'
  | 'clicked';

export interface EmailEventContext {
  to?: string;
  template?: EmailTemplateId;
  providerId?: string;
  error?: string;
  ms?: number;
  at?: number;
}

const WARN = new Set<EmailEvent>(['failed', 'deferred', 'dead_lettered']);

export const emailMonitoring = {
  record(event: EmailEvent, ctx: EmailEventContext = {}): void {
    switch (event) {
      case 'retry': emailMetrics.inc('retries'); break;
      case 'delivered': emailMetrics.inc('delivered'); break;
      case 'sent': emailMetrics.inc('sent'); if (typeof ctx.ms === 'number') emailMetrics.observeSendMs(ctx.ms); break;
      case 'failed': emailMetrics.inc('failed'); emailMetrics.recordFailure(ctx.at ?? nowSafe(), ctx.template, ctx.error); break;
      case 'dead_lettered': emailMetrics.inc('dead_lettered'); emailMetrics.recordFailure(ctx.at ?? nowSafe(), ctx.template, ctx.error); break;
      case 'queued': emailMetrics.inc('queued'); break;
      case 'deferred': emailMetrics.inc('deferred'); break;
      case 'opened': emailMetrics.inc('opened'); break;
      case 'clicked': emailMetrics.inc('clicked'); break;
    }
    const level = WARN.has(event) ? 'warn' : 'info';
    monitoring.log(level, `[email] ${event}`, {
      event,
      to: ctx.to ? maskEmail(ctx.to) : undefined,
      template: ctx.template,
      providerId: ctx.providerId,
      ...(ctx.error ? { error: ctx.error } : {}),
      ...(typeof ctx.ms === 'number' ? { ms: ctx.ms } : {}),
    });
  },

  metrics: () => emailMetrics.snapshot(),
};

// Metrics timestamps are passed in by callers; this is only a soft fallback for logging.
function nowSafe(): number {
  try { return Date.now(); } catch { return 0; }
}
