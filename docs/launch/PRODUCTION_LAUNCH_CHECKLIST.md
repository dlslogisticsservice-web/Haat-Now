# Production Launch Checklist

Derived from the Security Audit (`docs/security/SECURITY_AUDIT_REPORT.md`). Grouped by the
gate each item unblocks. Nothing here has been executed — this is the go-live runlist.

## 🔴 P0 — before ANY real traffic (Closed Beta)
- [ ] **F1** Revoke `EXECUTE` from `anon` (and `public`) on all non-public SECURITY DEFINER RPCs; keep only intended public read RPCs; audit each remaining function's internal guard. *(1–2 d)*
- [ ] **F5** Replace the 3 `WITH CHECK (true)` INSERT policies (campaign_events, order_status_history, search_analytics) with owner/tenant-scoped predicates. *(2–4 h)*
- [ ] Stand up a **dedicated prod project** or confirm launching on `haat-now-prod`; apply all migrations (70/70). *(done for haat-now-prod)*
- [ ] Enable + verify the **SMS/Email provider** for real OTP (email OTP → Resend SMTP + DNS). *(0.5–1 d)*
- [ ] Set Vercel env (`HAAT_LIVE_BACKEND=1`, `VITE_SUPABASE_URL/ANON_KEY`) + `vercel.json buildCommand`→`build:live`. *(0.5 d)*
- [ ] Prove **one full E2E** (register → browse → cart → COD checkout → merchant → dispatch → driver → delivery → settlement → notification). *(1–2 d)*

## 🟠 P0 — before Public Launch
- [ ] **F2** Upgrade org to Pro; enable **PITR/daily backups**; run one restore drill. *(0.5 d + billing)*
- [ ] **F3** Set `VITE_SENTRY_DSN` + alert rules (error rate, auth-failure spike, dead-letter growth). *(0.5 d)*
- [ ] **F6** `ALTER FUNCTION … SET search_path=''` on the 13 mutable-search-path functions. *(2–4 h)*
- [ ] **F7** Drop the broad list/SELECT policy on the 6 public buckets. *(1–2 h)*
- [ ] **F8** Restrict payment edge-function CORS to the app origin. *(1–2 h)*
- [ ] **F4** Remove CSP `script-src 'unsafe-inline'` (nonce/hash). *(0.5–1 d)*
- [ ] Confirm a **verified card gateway** end-to-end if enabling cards (else keep COD-only).

## 🟡 P1
- [ ] **F9** Sanitize the component-platform raw-HTML block or restrict authoring to trusted roles. *(2–4 h)*
- [ ] **F10** `npm audit fix` (tar). *(0.5 h)*
- [ ] **F11** Move `pg_trgm` to the `extensions` schema. *(1 h)*
- [ ] **F12** Enable leaked-password protection; verify OTP expiry in Auth config. *(15 m)*

## ⚪ P2 / hygiene
- [ ] **F13** Gitignore `supabase/.temp/`. *(15 m)*
- [ ] **F14** Enable GitHub secret scanning + Dependabot. *(15 m)*

## Operational readiness
- [ ] Health checks: `/health.json` (build) + `emailService.health()` + a DB/auth probe.
- [ ] Rollback rehearsed: Vercel alias revert (atomic) + SW-cache SHA stamp; DB forward-only.
- [ ] Runbooks linked: `EMAIL_PRODUCTION_RUNBOOK.md`, `PRODUCTION_ACTIVATION_PA1.md`, rollback runbook.
- [ ] On-call + incident channel defined; alert thresholds documented.

## Compliance (store submission)
- [x] Account deletion implemented (`delete_my_account`).
- [x] Privacy policy + terms (`src/config/legal.ts`, ar/en).
- [ ] Apple/Google **data-safety** forms completed at submission.
- [ ] App privacy nutrition labels match actual data use (email, phone-optional, location for delivery).

## Penetration-test checklist (run after F1 fix)
- [ ] Attempt each anon `/rest/v1/rpc/<fn>` against privileged functions → expect denial.
- [ ] Attempt cross-tenant/user row access (orders, wallets, payments) as another authed user → expect RLS denial.
- [ ] Forge a payment webhook without/with bad HMAC → expect 401/failure.
- [ ] Replay a captured OTP + a payment idempotency key → expect rejection.
- [ ] Upload a non-image/oversized file to each bucket → expect rejection; attempt to list a public bucket.
- [ ] XSS payloads in website-builder fields + raw-HTML block → expect escaping/sanitization.
- [ ] Clickjacking (iframe embed) → expect `X-Frame-Options: DENY`.
- [ ] Token theft simulation: expired/None-alg JWT → expect rejection.
