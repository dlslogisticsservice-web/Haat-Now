// ─────────────────────────────────────────────────────────────────────────────
// Production email infrastructure — shared types.
//
// Runs in a SERVER context (Supabase Edge Function / node). The Resend API key is a
// secret and is NEVER read in the browser; the provider reports "not configured" when
// the key is absent, so a client bundle can import these types without leaking or sending.
// ─────────────────────────────────────────────────────────────────────────────

export type Locale = 'ar' | 'en';

export type EmailTemplateId =
  | 'welcome'
  | 'login_otp'
  | 'email_verification'
  | 'password_reset'
  | 'merchant_invitation'
  | 'driver_invitation'
  | 'order_confirmation'
  | 'order_delivered'
  | 'payment_receipt'
  | 'support_ticket'
  | 'account_deleted'
  | 'admin_alert';

/** Fully-rendered email content. */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** A message ready to hand to a provider. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  /** Template + locale that produced this message (for logging/metrics only). */
  templateId?: EmailTemplateId;
  locale?: Locale;
  /** Idempotency key so a retry never double-sends. */
  idempotencyKey?: string;
}

export type EmailErrorKind =
  | 'not_configured'   // no API key / from address — cannot send
  | 'invalid_input'    // bad recipient / empty content
  | 'timeout'          // provider did not respond in time
  | 'rate_limited'     // provider 429
  | 'provider_error'   // provider 4xx/5xx
  | 'network_error';   // fetch threw

export interface EmailError {
  kind: EmailErrorKind;
  message: string;
  /** Provider HTTP status, when available. */
  status?: number;
  /** Whether a retry could plausibly succeed. */
  retryable: boolean;
}

/** Result of a single provider send attempt. */
export interface EmailSendResult {
  ok: boolean;
  /** Provider message id on success. */
  id?: string;
  error?: EmailError;
  /** Round-trip duration (ms). */
  ms: number;
  /** Raw provider response (redacted), for structured logging. */
  providerResponse?: unknown;
}

export interface ProviderHealth {
  provider: string;
  configured: boolean;
  ok: boolean;
  detail: string;
  ms?: number;
}

/** The provider contract — a channel/vendor implements this. */
export interface EmailProvider {
  readonly name: string;
  /** True when the provider has the config it needs to send. */
  isConfigured(): boolean;
  send(message: EmailMessage): Promise<EmailSendResult>;
  healthCheck(): Promise<ProviderHealth>;
}

export type QueueItemStatus = 'queued' | 'sending' | 'sent' | 'deferred' | 'failed' | 'dead';

export interface QueueItem {
  id: string;
  message: EmailMessage;
  status: QueueItemStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: number;
  lastError?: EmailError;
  providerId?: string;
  createdAt: number;
  updatedAt: number;
}
