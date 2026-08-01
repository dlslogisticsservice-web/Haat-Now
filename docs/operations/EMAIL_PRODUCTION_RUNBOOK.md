# Production Email Runbook (Resend)

Operational guide for HAAT NOW production email. The platform lives in
`src/services/email/`; this runbook covers deploying, configuring, and operating it.

## Architecture (where email runs)
- **Auth emails** (login OTP, email verification, password reset) are sent by **Supabase Auth (GoTrue)** via SMTP → Resend. Their HTML comes from `templates.ts` (paste into Supabase Auth → Email Templates). *Sending these does not go through our platform and does not change auth behavior.*
- **Transactional emails** (welcome, merchant/driver invite, order confirmation/delivered, payment receipt, support ticket, account deleted, admin alert) are sent by **our platform** (`emailService`) from a **server host** (Supabase Edge Function) that holds the Resend key. The client never sends email.

## Secrets (server-side only — never `VITE_`)
| Secret | Where | Purpose |
|---|---|---|
| `RESEND_API_KEY` | Supabase Edge Function secrets (+ Supabase Auth SMTP password) | Resend auth |
| `EMAIL_FROM` | Edge secrets | Verified sender, e.g. `HAAT NOW <noreply@mail.haatnow.app>` |
| `EMAIL_REPLY_TO` | Edge secrets | `support@haatnow.app` |
| `EMAIL_SENDING_DOMAIN` | Edge secrets | `mail.haatnow.app` |

Set with: `supabase secrets set RESEND_API_KEY=... EMAIL_FROM=... EMAIL_REPLY_TO=... EMAIL_SENDING_DOMAIN=...`

## DNS configuration (sending domain `mail.haatnow.app`)
| Record | Host | Value |
|---|---|---|
| SPF (TXT) | `mail.haatnow.app` | `v=spf1 include:resend.com ~all` |
| DKIM | `resend._domainkey.mail.haatnow.app` | the CNAME/TXT Resend generates |
| DMARC (TXT) | `_dmarc.haatnow.app` | `v=DMARC1; p=none; rua=mailto:dmarc@haatnow.app` (→ quarantine → reject) |
| Return-Path | per Resend | the return-path/MX record Resend provides (bounce alignment) |

Verify all records show **verified** in Resend and resolve (`dig`, mxtoolbox).

## Deployment steps
1. Create the Resend account + API key; add `mail.haatnow.app` as a sending domain.
2. Add the DNS records above; wait for Resend to mark the domain **verified**.
3. `supabase secrets set …` (secrets table above) on the target project.
4. Deploy the email edge host: `supabase functions deploy email-send` (and the delivery **webhook** function). *(This sprint built the platform, not the deploy — do this in the deployment sprint.)*
5. Configure the Resend **webhook** → the delivery webhook function → `emailMonitoring.record(...)` for `delivered/deferred/opened/clicked/bounced/complained`.
6. Point **Supabase Auth → SMTP** at Resend (host `smtp.resend.com`, user `resend`, pass = `RESEND_API_KEY`, sender = `EMAIL_FROM`) and paste the auth template HTML.
7. Send a test to each template; confirm inbox placement (Gmail/Outlook) + SPF/DKIM/DMARC pass (mail-tester.com).

## Environment variables (reference)
See `.env.example` (Resend block). All server-side; none prefixed `VITE_`.

## Rollback
- **Bad send / spike:** disable the email edge function (or unset `RESEND_API_KEY`) → `getEmailProvider()` degrades to the graceful fallback (no sends, logged), the app keeps working.
- **Auth SMTP issue:** revert Supabase Auth to the built-in SMTP (temporary; low rate limits) or the prior provider.
- **DNS regression:** DNS changes are reversible at the registrar; keep the prior record values.
- No data migration is involved — rollback is config-only and immediate.

## Emergency procedures
| Symptom | Action |
|---|---|
| Failure rate spike / provider down | Health = `degraded`/`down`; pause the queue processor; unset `RESEND_API_KEY` to fall back; open a Resend incident |
| Dead-letter growing | Inspect `emailService.deadLetter()`; fix root cause; re-drive after resolution |
| Spam complaints | Add addresses to the suppression list; check DMARC alignment; throttle sends |
| Domain unverified | Re-check DNS; do not send until Resend shows verified (deliverability collapses otherwise) |

## Health & monitoring
- `emailService.health()` → provider status, DNS readiness, queue size, failure rate, average send time, retry count, last failure. Expose via an `email-health` edge route.
- `emailService.metrics()` → sent/delivered/deferred/failed/opened/clicked counters + rates for dashboards.
- Events flow through `emailMonitoring` → the monitoring/Guardian seam (masked recipients).
