# ADR — Production Email Delivery Provider (Auth: Email OTP / Magic Link)

- **Status:** Accepted (provider selection). **Activation BLOCKED** — see §Blockers.
- **Date:** 2026-07-28
- **Context phase:** STEP 3A (Egypt-first closed beta; phone OTP postponed; auth via Email OTP / Magic Link).
- **Decision:** Use **Resend** as the production email (SMTP) provider for Supabase Auth, with **Postmark** as the deliverability-max fallback and **Amazon SES** as the high-volume/cost option for later scale.

## Decision drivers
Auth emails (OTP + magic link) are **transactional and time-sensitive** — inbox placement is the product (a spam-foldered OTP = a login failure). For an Egypt-first closed beta we need: strong deliverability, trivial domain verification (SPF/DKIM/DMARC), a free tier that covers beta volume, and **Supabase custom-SMTP compatibility with zero application code for sending**. Note: email delivery is **not geo-restricted** the way A2P SMS is — Egypt inbox placement depends on domain reputation + SPF/DKIM/DMARC, not on a regional route — so all three candidates are viable for Egypt; the differentiators are setup, cost, and deliverability polish.

## Options considered

| Criterion | **Resend (chosen)** | Postmark | Amazon SES |
|---|---|---|---|
| Deliverability / inbox placement | High | **Best-in-class** (transactional) | Good (you manage reputation) |
| Spam resistance | Strong (enforced auth) | **Strongest** | Good w/ correct config |
| Ease of setup | **Very easy** | Easy | Complex (IAM, sandbox exit) |
| Supabase compatibility (SMTP) | ✅ SMTP + API | ✅ SMTP + API | ✅ SMTP + API |
| React compatibility | ✅ React Email (future txn mail) | Templating API | Minimal |
| Free tier | **3,000/mo, 100/day** | 100/mo (dev) | ~62k/mo (first year, from EC2) |
| Cost at scale | ~$20/mo (50k) | ~$15/mo (10k) | **~$0.10 / 1,000** (cheapest) |
| Scaling | Good | Good | **Excellent** |
| Domain verification / DKIM / SPF / DMARC | ✅ Guided, auto records | ✅ Guided | Manual |
| Analytics | Good | **Excellent** | Basic (needs CloudWatch) |
| Bounce handling | ✅ | ✅ Excellent | ✅ (SNS wiring) |
| Production readiness | ✅ | ✅ | ✅ (after sandbox exit) |

### Why Resend
Best balance for this beta: easiest domain verification, strong deliverability, a **free tier that covers the entire closed beta at $0**, clean Supabase SMTP integration, and React Email for future product/transactional mail — all with **no application code for sending** (GoTrue renders and sends auth emails).

### Why the others were rejected (for now)
- **Postmark** — arguably the deliverability leader for transactional mail, but a smaller free tier and stricter/pricier model. **Kept as the fallback** if beta OTP inbox placement ever underperforms.
- **Amazon SES** — cheapest at scale and most scalable, but highest setup friction (IAM, initial sending sandbox, manual DKIM/SPF/DMARC, DIY analytics). Overkill for a beta. **Adopt at high volume** (≫100k/mo) when unit cost dominates.

## Egypt-first strategy
- Email (unlike SMS) is not blocked by NTRA/CITC routing, so Resend delivers to Egyptian recipients (Gmail/Outlook/local ISPs) normally, gated only by domain auth + reputation.
- Send from a dedicated subdomain (e.g. `mail.haatnow.app` / `noreply@haatnow.app`) to isolate auth-email reputation from the apex domain.
- Bilingual (Arabic-first, RTL) OTP + magic-link templates.

## Future scaling strategy
- Beta → free tier (Resend). Growth → Resend paid.
- If volume ≫100k/mo, evaluate migrating the auth SMTP to **Amazon SES** for unit cost (a config change, still no app code).
- Product/transactional email (receipts, notifications) can adopt Resend + React Email independently later.

## Security considerations
- **SPF, DKIM, DMARC** mandatory before production sending; DMARC start at `p=none` (monitor) → tighten to `p=quarantine`/`p=reject`.
- SMTP credentials are **secrets** — stored in Supabase Auth SMTP config only; never committed.
- Transactional-only sending domain to protect reputation; enable bounce/complaint handling.
- OTP emails: short expiry, single-use; magic-link redirect allow-list restricted to the beta origin.

## Cost considerations (planning estimates — confirm at signup)
| Monthly auth emails | Resend | Postmark | Amazon SES |
|---|---|---|---|
| 1,000 | $0 (free tier) | $0 (dev) / ~$15 | ~$0.10 |
| 10,000 | $0–20 | ~$15 | ~$1 |
| 100,000 | ~$20–35 | ~$100+ | ~$10 |

## Blockers (why activation is NOT executed in this phase)
1. **Application code is required (hard gate).** The app is **phone-only**: `auth.service.ts` uses `signInWithOtp({phone})`/`verifyOtp({type:'sms'})`; `LoginScreen.tsx` collects a phone number + 6-digit SMS OTP; there is **no** email input, **no** `signInWithOtp({email})`/email `verifyOtp`, and **no** magic-link callback (`exchangeCodeForSession`). Email OTP / Magic Link cannot function without adding those flows. STEP 3A forbids runtime code changes, so **activation is not permitted here** — it must be a separate code-enabled phase.
2. **External inputs not in hand.** Provider account (Resend) + SMTP credentials, DNS access for SPF/DKIM/DMARC on `haatnow.app`, and Supabase Auth SMTP write access (dashboard / Management API) — none are available to this automation; they are operator actions.

## Consequences
- Provider decision is locked (Resend) and documented; the **email-auth application work is now the gating item** for an email-based beta.
- When the code phase lands, activation is a **no-code-further** SMTP + template + DNS configuration.
