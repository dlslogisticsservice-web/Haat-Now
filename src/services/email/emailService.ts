// ─────────────────────────────────────────────────────────────────────────────
// Email service facade — the one entry point application/host code uses. Ties the
// template system, the active provider (Resend or graceful fallback), the durable
// queue, monitoring/metrics, and the health aggregator together.
//
// SERVER context: the Resend key is only present server-side, so in a client bundle the
// provider is the graceful fallback (never sends, never throws). Real sending happens in
// the deployment host (Supabase Edge Function) — see the Production Email Runbook.
// ─────────────────────────────────────────────────────────────────────────────
import { getEmailProvider, resolveResendConfig } from './resendProvider';
import { renderEmail, type TemplateData } from './templates';
import { EmailQueue, type EmailSender } from './emailQueue';
import { emailMonitoring } from './emailMonitoring';
import { emailHealth as computeHealth } from './emailHealth';
import { DEFAULT_RETRY } from './retry';
import type { EmailMessage, EmailTemplateId, Locale, EmailSendResult } from './types';

const provider = getEmailProvider();
const queue = new EmailQueue((msg) => provider.send(msg), DEFAULT_RETRY);

interface SendOpts { idempotencyKey?: string; from?: string; replyTo?: string }

function buildMessage(templateId: EmailTemplateId, to: string, locale: Locale, data: TemplateData, opts?: SendOpts): EmailMessage {
  const { subject, html, text } = renderEmail(templateId, locale, data);
  return { to, subject, html, text, templateId, locale, idempotencyKey: opts?.idempotencyKey, from: opts?.from, replyTo: opts?.replyTo };
}

export const emailService = {
  /** Render + send immediately (single provider attempt). Records monitoring/metrics. */
  async sendNow(templateId: EmailTemplateId, to: string, locale: Locale, data: TemplateData = {}, opts?: SendOpts): Promise<EmailSendResult> {
    const message = buildMessage(templateId, to, locale, data, opts);
    const result = await provider.send(message);
    if (result.ok) emailMonitoring.record('sent', { to, template: templateId, providerId: result.id, ms: result.ms });
    else emailMonitoring.record('failed', { to, template: templateId, error: result.error?.message, ms: result.ms, at: Date.now() });
    return result;
  },

  /** Enqueue for durable delivery (retries, exponential backoff, dead-letter). */
  enqueue(templateId: EmailTemplateId, to: string, locale: Locale, data: TemplateData = {}, now: number = Date.now(), opts?: SendOpts) {
    return queue.enqueue(buildMessage(templateId, to, locale, data, opts), now);
  },

  /** Drive due queue items — a scheduler/cron calls this with the real clock. */
  processQueue(now: number = Date.now()): Promise<void> { return queue.processDue(now); },

  queueSnapshot() { return queue.snapshot(); },
  deadLetter() { return queue.deadLetter(); },
  metrics() { return emailMonitoring.metrics(); },
  provider() { return provider; },

  /** Structured email-platform health (provider, DNS, queue, metrics). */
  health(now: number = Date.now()) {
    const cfg = resolveResendConfig();
    return computeHealth({
      provider,
      queue,
      env: { providerConfigured: !!cfg.apiKey, sendingDomainConfigured: !!cfg.from },
      now,
    });
  },

  /** Build a queue over a custom sender (advanced hosts / tests). */
  createQueue(sender: EmailSender) { return new EmailQueue(sender, DEFAULT_RETRY); },
};
