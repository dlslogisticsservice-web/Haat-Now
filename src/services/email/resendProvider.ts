// ─────────────────────────────────────────────────────────────────────────────
// Resend provider adapter (production email vendor). Server-side only: the API key
// is a SECRET read from process env (no VITE_ prefix), so it never enters a client
// bundle. Atomic single send with a timeout + structured errors; a health check that
// validates the key; and a graceful fallback provider used when Resend is unconfigured.
// ─────────────────────────────────────────────────────────────────────────────
import type { EmailProvider, EmailMessage, EmailSendResult, EmailError, ProviderHealth } from './types';
import { withTimeout } from './retry';
import { monitoring } from '../monitoring.service';

const SEND_TIMEOUT_MS = 8000;
const HEALTH_TIMEOUT_MS = 5000;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const RESEND_DOMAINS = 'https://api.resend.com/domains';

/** Server-side env read (secrets live in process.env, never on import.meta.env). */
function serverEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  const ime = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env) || undefined;
  return ime?.[key];
}

export interface ResendConfig {
  apiKey?: string;
  from?: string;
  replyTo?: string;
}

export function resolveResendConfig(): ResendConfig {
  return {
    apiKey: serverEnv('RESEND_API_KEY'),
    from: serverEnv('EMAIL_FROM') || 'HAAT NOW <noreply@mail.haatnow.app>',
    replyTo: serverEnv('EMAIL_REPLY_TO') || 'support@haatnow.app',
  };
}

const err = (kind: EmailError['kind'], message: string, retryable: boolean, status?: number): EmailError =>
  ({ kind, message, retryable, status });

function validate(message: EmailMessage): EmailError | null {
  if (!message.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.to)) return err('invalid_input', 'invalid recipient', false);
  if (!message.subject || (!message.html && !message.text)) return err('invalid_input', 'empty subject/body', false);
  return null;
}

export function createResendProvider(cfg: ResendConfig = resolveResendConfig()): EmailProvider {
  return {
    name: 'resend',
    isConfigured: () => !!cfg.apiKey && !!cfg.from,

    async send(message: EmailMessage): Promise<EmailSendResult> {
      const started = Date.now();
      const badInput = validate(message);
      if (badInput) return { ok: false, error: badInput, ms: 0 };
      if (!cfg.apiKey || !cfg.from) return { ok: false, error: err('not_configured', 'RESEND_API_KEY / EMAIL_FROM missing', false), ms: 0 };

      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
      const attempt: Promise<EmailSendResult> = (async () => {
        try {
          const res = await fetch(RESEND_ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              from: message.from || cfg.from,
              to: message.to,
              subject: message.subject,
              html: message.html,
              text: message.text,
              reply_to: message.replyTo || cfg.replyTo,
              ...(message.idempotencyKey ? { headers: { 'Idempotency-Key': message.idempotencyKey } } : {}),
            }),
          });
          const ms = Date.now() - started;
          let body: unknown = null;
          try { body = await res.json(); } catch { /* non-json */ }
          if (res.ok) {
            const id = (body as { id?: string } | null)?.id;
            return { ok: true, id, ms, providerResponse: { status: res.status } };
          }
          const retryable = res.status === 429 || res.status >= 500;
          const kind: EmailError['kind'] = res.status === 429 ? 'rate_limited' : 'provider_error';
          return { ok: false, error: err(kind, `resend ${res.status}`, retryable, res.status), ms, providerResponse: { status: res.status } };
        } finally {
          clearTimeout(to);
        }
      })();

      return withTimeout(attempt, SEND_TIMEOUT_MS + 500, () => ({
        ok: false, error: err('timeout', `no response within ${SEND_TIMEOUT_MS}ms`, true), ms: Date.now() - started,
      })).catch(() => ({ ok: false, error: err('network_error', 'fetch failed', true), ms: Date.now() - started }));
    },

    async healthCheck(): Promise<ProviderHealth> {
      const started = Date.now();
      if (!cfg.apiKey || !cfg.from) {
        return { provider: 'resend', configured: false, ok: false, detail: 'RESEND_API_KEY / EMAIL_FROM not set' };
      }
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      try {
        const res = await fetch(RESEND_DOMAINS, { headers: { Authorization: `Bearer ${cfg.apiKey}` }, signal: controller.signal });
        const ms = Date.now() - started;
        return { provider: 'resend', configured: true, ok: res.ok, detail: res.ok ? 'reachable' : `domains ${res.status}`, ms };
      } catch {
        return { provider: 'resend', configured: true, ok: false, detail: 'unreachable', ms: Date.now() - started };
      } finally {
        clearTimeout(to);
      }
    },
  };
}

/**
 * Graceful fallback — used when Resend is not configured (e.g. sandbox/dev). It never
 * sends and never throws: it logs the intent and returns a structured not_configured
 * result, so callers degrade gracefully instead of crashing.
 */
export const fallbackProvider: EmailProvider = {
  name: 'fallback',
  isConfigured: () => true,
  async send(message: EmailMessage): Promise<EmailSendResult> {
    monitoring.log('warn', '[email] not sent — no provider configured (fallback)', { to: maskEmail(message.to), template: message.templateId });
    return { ok: false, error: { kind: 'not_configured', message: 'email provider not configured', retryable: false }, ms: 0 };
  },
  async healthCheck(): Promise<ProviderHealth> {
    return { provider: 'fallback', configured: false, ok: false, detail: 'no provider configured' };
  },
};

/** Redact an email for logs. */
export function maskEmail(email: string): string {
  const [l, d] = (email || '').split('@');
  return d ? `${l.slice(0, 2)}***@${d}` : '***';
}

/** The active provider: Resend when configured, otherwise the graceful fallback. */
export function getEmailProvider(): EmailProvider {
  const resend = createResendProvider();
  return resend.isConfigured() ? resend : fallbackProvider;
}
