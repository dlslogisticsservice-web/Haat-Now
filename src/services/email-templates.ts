// ─────────────────────────────────────────────────────────────────────────────
// Transactional email templates — the PRESENTATION layer for outbound email.
//
// It does NOT define a template catalog: it reuses comms-templates.ts (the one bilingual
// {{variable}} catalog the platform already ships) and adds the two things email needs on
// top: (1) an RTL/LTR HTML envelope carrying brand + country variables for white-label,
// and (2) missing-variable DETECTION — renderTemplate silently substitutes '' for an
// absent variable, which is exactly how a broken email ("Hi ,") goes out. Here a missing
// variable makes the render `ok:false`, so the sender refuses rather than send a blank.
//
// Presentation only. No business logic, no network, no secrets — a caller supplies the
// variables; this turns them into a subject + HTML. PURE.
// ─────────────────────────────────────────────────────────────────────────────
import { renderTemplate, commsTemplate } from './comms-templates';

/** The 15 production transactional email types → the catalog key that renders each. */
export const EMAIL_TYPES = {
  otp_verification: 'email_otp',
  account_verification: 'account_verification',
  password_reset: 'password_reset',
  welcome: 'welcome',
  order_confirmation: 'receipt',
  order_status_update: 'order_accepted',
  driver_assignment: 'driver_assignment',
  driver_arrival: 'driver_arrived',
  delivery_completed: 'delivery_completed',
  payment_confirmation: 'payment_confirmation',
  refund_confirmation: 'refund_issued',
  merchant_onboarding: 'merchant_approved',
  partner_onboarding: 'partner_approved',
  affiliate_onboarding: 'affiliate_approved',
  security_alert: 'security_alert',
} as const;

export type EmailType = keyof typeof EMAIL_TYPES;
export const EMAIL_TYPE_KEYS = Object.keys(EMAIL_TYPES) as EmailType[];

/** Brand variables for white-label rendering. All optional — sensible fallbacks apply. */
export interface BrandVars { brandName?: string; brandColor?: string; supportEmail?: string; logoUrl?: string }
/** Country variables (locale/currency footer). */
export interface CountryVars { country?: string; currency?: string }

export interface RenderedEmail {
  /** False when the template is unknown OR a required variable was missing. Never send a false. */
  ok: boolean;
  subject: string;
  html: string;
  /** Plain-text fallback (the raw filled body). */
  text: string;
  locale: 'ar' | 'en';
  dir: 'rtl' | 'ltr';
  /** Declared variables that were not supplied — the reason `ok` may be false. */
  missingVars: string[];
  error?: string;
}

/** Escape user/variable content before it enters the HTML envelope (no injection). */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** Which declared variables of a template were not supplied? */
export function missingVariables(templateKey: string, vars: Record<string, unknown>): string[] {
  const t = commsTemplate(templateKey);
  if (!t) return [];
  return t.vars.filter(v => vars[v] === undefined || vars[v] === null || vars[v] === '');
}

/** The RTL/LTR, brand-aware HTML envelope. Presentation only. */
function envelope(subject: string, body: string, dir: 'rtl' | 'ltr', brand?: BrandVars, country?: CountryVars): string {
  const brandName = escapeHtml(brand?.brandName ?? 'HAAT NOW');
  const color = /^#[0-9a-fA-F]{3,8}$/.test(brand?.brandColor ?? '') ? brand!.brandColor : '#a3f95b';
  const footer = [country?.country, brand?.supportEmail].filter(Boolean).map(escapeHtml).join(' · ');
  const align = dir === 'rtl' ? 'right' : 'left';
  return [
    `<!doctype html>`,
    `<html dir="${dir}" lang="${dir === 'rtl' ? 'ar' : 'en'}">`,
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>`,
    `<body style="margin:0;padding:24px;background:#0b0f12;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">`,
    `<table role="presentation" width="600" style="max-width:600px;background:#13171a;border-radius:16px;border-top:3px solid ${color};overflow:hidden">`,
    `<tr><td style="padding:24px;text-align:${align};direction:${dir}">`,
    `<h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:20px;color:${color}">${brandName}</h1>`,
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#e8eaed;white-space:pre-line">${escapeHtml(body)}</div>`,
    footer ? `<p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a9099">${footer}</p>` : ``,
    `</td></tr></table></td></tr></table></body></html>`,
  ].join('');
}

/**
 * Render a transactional email. Reuses comms-templates for the localized, variable-filled
 * body; wraps it in the brand/country/RTL envelope; and flags missing variables so the
 * sender never dispatches a blank message.
 */
export function renderEmail(
  type: EmailType,
  vars: Record<string, string | number> = {},
  locale: 'ar' | 'en' = 'ar',
  brand?: BrandVars,
  country?: CountryVars,
): RenderedEmail {
  const dir: 'rtl' | 'ltr' = locale === 'ar' ? 'rtl' : 'ltr';
  const key = EMAIL_TYPES[type];
  const t = commsTemplate(key);
  if (!t) {
    return { ok: false, subject: '', html: '', text: '', locale, dir, missingVars: [], error: `no template for email type '${type}'` };
  }
  const missing = missingVariables(key, vars);
  const r = renderTemplate(key, vars, locale)!;   // non-null: commsTemplate(key) exists
  const subject = r.subject ?? (brand?.brandName ?? 'HAAT NOW');
  const html = envelope(subject, r.body, dir, brand, country);
  return {
    ok: missing.length === 0,
    subject, html, text: r.body, locale, dir,
    missingVars: missing,
    error: missing.length ? `missing variables: ${missing.join(', ')}` : undefined,
  };
}
