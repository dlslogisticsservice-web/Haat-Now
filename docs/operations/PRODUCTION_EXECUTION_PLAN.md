# HAAT NOW — Production Execution Plan & Cutover Runbook

> Generated from the current repository state (Production Cutover Readiness Audit).
> Nothing here is assumed — every file, script, secret and command is grounded in the repo.
> This document plans the cutover; it performs none of it. No deploy, no secrets, no live providers.

**Repo facts this plan is built on**
- Build mode is selected at build time: `vite.config.ts` → `authMode = process.env.HAAT_LIVE_BACKEND === '1' ? 'supabase' : 'sandbox'`.
- `npm run build` → **sandbox** (demo). `npm run build:live` (`node scripts/live.cjs build`) → **supabase** (live).
- `vercel.json` `buildCommand` = `"npm run build"` (sandbox). `.env.production` currently `VITE_AUTH_MODE=sandbox`.
- Preflight gates: `npm run lint` (tsc + `check-architecture.cjs` + `check-demo-isolation.cjs`), `npm run test:website`, `npm run check:env`, `npm run preflight`.
- Edge functions present: `payment-initiate`, `payment-refund`, `payment-verify`, `payment-webhook` (gateway = **Moyasar**).
- Edge functions ABSENT: `sms-send`, `email-send`, `push-fanout`, `geocode`.
- 64 migrations (RLS + policies + storage buckets + pg_cron present).
- Release Gate rules (9): open criticals · architecture violations · regression suites · required journeys · Authentication · Location · Notification · Payment · Email.

---

## PHASES

Each phase: **Objective · Prerequisites · Files · Dashboards · Secrets · Expected result · Verification · Rollback · Risk · Time · Blocking deps**.

### Phase 1 — Production Environment
- **Objective:** Establish the production environment variable set (client `VITE_*`) without flipping the build yet.
- **Prerequisites:** Vercel project exists; Supabase production project ref known.
- **Files:** `.env.production`, `scripts/check-env.cjs`, `vercel.json`.
- **Dashboards:** Vercel → Project → Settings → Environment Variables.
- **Secrets:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (required); `VITE_SENTRY_DSN`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_ANALYTICS_URL` (recommended).
- **Expected result:** `npm run check:env` passes for a live build.
- **Verification:** `HAAT_LIVE_BACKEND=1 npm run check:env` → exit 0.
- **Rollback:** Remove/blank the added vars; sandbox build ignores them.
- **Risk:** Low · **Time:** 20 min · **Blocking deps:** Supabase project (Phase 2).

### Phase 2 — Supabase (Database, RLS, Storage, Realtime)
- **Objective:** Confirm the production database schema, RLS, buckets and realtime are in place.
- **Prerequisites:** Supabase production project; migrations applied (64 recorded).
- **Files:** `supabase/migrations/*.sql`, `src/lib/supabase.ts`, `src/repositories/*`.
- **Dashboards:** Supabase → Database, Auth, Storage, Advisors.
- **Secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server/edge only — never client).
- **Expected result:** Advisors show 0 ERROR/CRITICAL; buckets exist; RLS enabled on customer tables.
- **Verification:** Run the Supabase RLS/security advisor (external); `list_migrations` matches repo count.
- **Rollback:** Point `VITE_SUPABASE_URL` back to the prior project; migrations are additive/idempotent.
- **Risk:** Medium · **Time:** 45 min · **Blocking deps:** none (schema already applied per prior sprints).

### Phase 3 — Authentication (Supabase OTP)
- **Objective:** Enable real phone-OTP sign-in for all six roles through the existing pipeline.
- **Prerequisites:** Phase 2; SMS vendor wired in Supabase Auth (Phase 4).
- **Files:** `src/services/auth.service.ts`, `src/services/otp-policy.ts`, `src/features/auth/LoginScreen.tsx`.
- **Dashboards:** Supabase → Authentication → Providers (Phone), Rate limits.
- **Secrets:** none client-side (OTP is server-side). SMS vendor secret lives in Supabase (Phase 4).
- **Expected result:** `authService.sendOtp` → real SMS; `verifyOtp` establishes a session; client abuse guard active.
- **Verification:** Validation checklist §Auth/OTP; Guardian Release Gate rule **Authentication ready** = pass.
- **Rollback:** Disable phone provider in Supabase; sandbox build restores demo OTP `123456`.
- **Risk:** High (login is the launch gate) · **Time:** 30 min · **Blocking deps:** Phase 4.

### Phase 4 — SMS (OTP delivery vendor)
- **Objective:** Configure the SMS vendor Supabase Auth uses to deliver OTP.
- **Prerequisites:** SMS vendor account (Twilio/MessageBird/Vonage); sender ID/number approved.
- **Files:** `src/providers/registry.ts` (`declaredSmsVendor`, `REQUIRED_ENV.sms`), `src/config/runtime.ts`.
- **Dashboards:** Supabase → Auth → SMS provider; vendor console.
- **Secrets:** vendor account SID/token — **in Supabase Auth (server-side)**. Client: `VITE_SMS_PROVIDER=<vendor>` (name only).
- **Expected result:** Supabase sends OTP via the vendor; `sms`/`auth` capabilities report **active**.
- **Verification:** Send OTP to a test number; Guardian Provider Readiness → auth/sms = active.
- **Rollback:** Remove the SMS provider in Supabase; auth reports not-configured (login blocked — do not launch).
- **Risk:** High · **Time:** 45 min · **Blocking deps:** none (unblocks Phase 3).

### Phase 5 — Payments (Moyasar + COD)
- **Objective:** Activate card payments through the existing `payment-initiate` edge function; COD already works.
- **Prerequisites:** Moyasar merchant account; edge functions deployed.
- **Files:** `supabase/functions/payment-initiate`, `payment-refund`, `payment-verify`, `payment-webhook`; `src/services/payment-orchestrator.service.ts`, `src/services/payment-policy.ts`.
- **Dashboards:** Supabase → Edge Functions → Secrets; Moyasar dashboard.
- **Secrets (edge, server-side):** `MOYASAR_SECRET_KEY`, `MOYASAR_CALLBACK_URL`, `PAYMENT_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`. Client: `VITE_PAYMENT_PROVIDER=moyasar`.
- **Expected result:** `initiate()` charges via Moyasar; `payment-webhook` reconciles; COD unaffected.
- **Verification:** Test charge in Moyasar test mode → webhook updates `payment_idempotency`; Gate **Payment ready** = pass (passes on COD alone regardless).
- **Rollback:** Unset `MOYASAR_SECRET_KEY` → card path returns `ok:false` honestly; **COD-only launch remains valid**.
- **Risk:** Medium (COD is the safety net) · **Time:** 60 min · **Blocking deps:** Phase 9 (edge deploy).

### Phase 6 — Email (transactional vendor)
- **Objective:** Enable transactional email via a server-side send function.
- **Prerequisites:** Email vendor account (Resend/SendGrid/SES/Mailgun); verified sender domain.
- **Files:** `src/services/email-templates.ts`, `src/services/email-policy.ts`, `src/services/comms-templates.ts`, `src/providers/registry.ts`.
- **Dashboards:** vendor console (domain/DKIM/SPF); Supabase → Edge Functions.
- **Secrets (edge, server-side):** vendor API key. Client: `VITE_EMAIL_PROVIDER=<vendor>`.
- **Expected result:** `renderEmail()` output sent by the `email-send` function (Phase 9); templates render AR/EN + RTL/LTR.
- **Verification:** Send a test `welcome` email; Gate **Email ready** = pass (passes on templates alone).
- **Rollback:** Unset `VITE_EMAIL_PROVIDER` → email reported not-configured (non-blocking; in-app/SMS still reach users).
- **Risk:** Low (enhancement channel) · **Time:** 45 min · **Blocking deps:** Phase 9.

### Phase 7 — Push (device notifications)
- **Objective:** Enable device push via a server-side fan-out function.
- **Prerequisites:** FCM/APNs project; VAPID/keys.
- **Files:** `src/services/notification.service.ts` (token storage), `src/services/delivery-policy.ts`, `src/providers/registry.ts`.
- **Dashboards:** Firebase/APNs console; Supabase → Edge Functions.
- **Secrets (edge, server-side):** push server key. Client: `VITE_PUSH_PROVIDER=<vendor>`.
- **Expected result:** Stored device tokens receive pushes via `push-fanout` (Phase 9); in-app unaffected.
- **Verification:** Send a test push to a registered token; Provider Readiness → push = active.
- **Rollback:** Unset `VITE_PUSH_PROVIDER` → push not-configured (non-blocking).
- **Risk:** Low · **Time:** 45 min · **Blocking deps:** Phase 9.

### Phase 8 — Maps (geocoding/routing)
- **Objective:** Enable geocoding/routing via a server-side function; browser geolocation already live.
- **Prerequisites:** Maps vendor (Google/Mapbox) account + restricted key.
- **Files:** `src/services/location.service.ts`, `src/services/tracking-policy.ts`, `src/providers/registry.ts`.
- **Dashboards:** vendor cloud console; Supabase → Edge Functions.
- **Secrets (edge, server-side):** maps API key. Client: `VITE_MAPS_PROVIDER=<vendor>`, optional `VITE_GOOGLE_MAPS_API_KEY` (referrer-restricted).
- **Expected result:** address↔coordinate geocoding via `geocode` (Phase 9); live tracking already works.
- **Verification:** Geocode a known address; Provider Readiness → maps = active. Tracking works regardless.
- **Rollback:** Unset `VITE_MAPS_PROVIDER` → geocoding not-configured (non-blocking; distance/ETA use built-in calc).
- **Risk:** Low · **Time:** 45 min · **Blocking deps:** Phase 9.

### Phase 9 — Edge Functions (deploy send-side)
- **Objective:** Deploy the missing send-side functions the seams call.
- **Prerequisites:** Phases 4–8 vendor secrets ready.
- **Files:** existing `supabase/functions/_shared`, `payment-*`; **NEW to author/deploy:** `sms-send`, `email-send`, `push-fanout`, `geocode`.
- **Dashboards:** Supabase → Edge Functions (deploy + Secrets).
- **Secrets:** as per Phases 4–8 (set as edge-function secrets, never client).
- **Expected result:** each provider seam's server-side counterpart responds; payment functions already deployed.
- **Verification:** `supabase functions list` shows all; invoke each with a test payload → 200.
- **Rollback:** Delete/disable the function; the client seam reports not-configured and throws honestly (never fakes success).
- **Risk:** Medium · **Time:** 90 min · **Blocking deps:** Phases 4–8 secrets.

### Phase 10 — Guardian Tables
- **Objective:** Create `guardian_issues` and `guardian_builds` so the issue lifecycle persists in production.
- **Prerequisites:** Phase 2.
- **Files:** `src/features/admin/LaunchGuardian.tsx` (`adminCrud('guardian_issues')`, `adminCrud('guardian_builds')`), `src/services/admin-crud.service.ts`.
- **Dashboards:** Supabase → Database (new migration).
- **Secrets:** none.
- **Expected result:** Guardian issues/builds read/write the real tables in the live build (localStorage in sandbox).
- **Verification:** Open Launch Guardian → issues persist across reload; build history row appears.
- **Rollback:** Drop the tables; Guardian degrades to empty (no crash).
- **Risk:** Low · **Time:** 20 min · **Blocking deps:** Phase 2.

### Phase 11 — Monitoring
- **Objective:** Route captured runtime signals to a durable backend.
- **Prerequisites:** Sentry/analytics accounts (optional).
- **Files:** `src/services/monitoring.service.ts` (capture wired at `src/main.tsx`).
- **Dashboards:** Sentry; analytics collector.
- **Secrets:** `VITE_SENTRY_DSN`, `VITE_ANALYTICS_URL` (client, non-secret endpoints).
- **Expected result:** crashes POST to DSN; analytics events POST to collector; Guardian Runtime Health populated.
- **Verification:** Trigger a caught error → appears in Sentry; Provider Readiness → crash/analytics = active.
- **Rollback:** Unset the vars → capture falls back to console (no data loss of behavior).
- **Risk:** Low · **Time:** 20 min · **Blocking deps:** none.

### Phase 12 — Live Build (the cutover flag)
- **Objective:** Flip the build to the live backend.
- **Prerequisites:** Phases 1–11 complete on **staging** first.
- **Files:** `vercel.json` (`buildCommand`), `vite.config.ts`, `scripts/live.cjs`, `.env.production`.
- **Dashboards:** Vercel → Build & Deploy settings.
- **Secrets:** none new (uses Phase 1 env).
- **Expected result:** deployed bundle has `VITE_AUTH_MODE=supabase`; demo strings absent (dead-code-eliminated).
- **Verification:** `docs/testing/production_mode_check.cjs` = 5/5; `#sandbox_hint` absent; no demo strings in DOM.
- **Rollback:** Revert `buildCommand` → `npm run build` (sandbox); one redeploy restores the demo build.
- **Risk:** High (this is the cutover) · **Time:** 15 min + build · **Blocking deps:** all prior phases.

### Phase 13 — Production Verification
- **Objective:** Prove the live build behaves correctly before opening to users.
- **Prerequisites:** Phase 12 on staging.
- **Files:** `docs/testing/*` (journeys, isolation, production-mode, ops-workspace, guardian_validate), `docs/testing/production_readiness_audit.cjs`.
- **Dashboards:** all provider consoles for live signal.
- **Secrets:** none.
- **Expected result:** all validation checks pass; Release Gate = **GO**.
- **Verification:** run the Verification Checklist (below) end-to-end on staging.
- **Rollback:** Fix-forward or revert to sandbox (Phase 12 rollback).
- **Risk:** Medium · **Time:** 60 min · **Blocking deps:** Phase 12.

### Phase 14 — Go / No-Go Decision
- **Objective:** Make a measurable launch decision.
- **Prerequisites:** Phase 13 complete.
- **Files:** this document (Go/No-Go criteria).
- **Expected result:** documented GO or NO-GO with the exact failing criteria if any.
- **Verification:** every Go/No-Go criterion below is measured and recorded.
- **Rollback:** NO-GO → stay on sandbox build; no user impact.
- **Risk:** — · **Time:** 30 min · **Blocking deps:** Phase 13.

---

## MANUAL ACTIONS CHECKLIST (by dashboard)

- **Supabase:** apply Guardian-tables migration · verify RLS advisor 0 critical · enable Phone auth provider · set edge-function secrets · confirm buckets · confirm pg_cron jobs.
- **Vercel:** set `VITE_*` env (production scope) · change `buildCommand` to `npm run build:live` (or set `HAAT_LIVE_BACKEND=1`) · confirm domain build.
- **Payment (Moyasar):** create merchant · obtain `MOYASAR_SECRET_KEY` · set `MOYASAR_CALLBACK_URL` · configure webhook + `PAYMENT_WEBHOOK_SECRET`.
- **SMS:** create vendor account · approve sender · wire into Supabase Auth · set `VITE_SMS_PROVIDER`.
- **Email:** create vendor account · verify domain (DKIM/SPF) · API key → edge secret · set `VITE_EMAIL_PROVIDER`.
- **Maps:** create restricted key · set `VITE_MAPS_PROVIDER` (+ optional `VITE_GOOGLE_MAPS_API_KEY`).
- **Push:** create FCM/APNs project · server key → edge secret · set `VITE_PUSH_PROVIDER`.
- **Analytics:** provision collector · set `VITE_ANALYTICS_URL`.
- **Crash:** create Sentry project · set `VITE_SENTRY_DSN`.
- **DNS:** confirm apex + `www` records (⚠ known: `www.haatnow.app` SSL cert issue — see Risks). *Do not change in this sprint.*
- **SSL:** verify Vercel-managed certs valid for all hosts.

---

## SECRETS MATRIX

| Secret | Purpose | Configured in | Required | Optional | Owner | Verified |
|---|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | Backend URL (client) | Vercel env | ✅ | | Platform | ☐ |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (client) | Vercel env | ✅ | | Platform | ☐ |
| `SUPABASE_SERVICE_ROLE_KEY` | Server privileged key | Supabase edge secrets | ✅ | | Platform | ☐ |
| `VITE_SMS_PROVIDER` | SMS vendor name (client flag) | Vercel env | ✅ (login) | | Platform | ☐ |
| SMS vendor SID/token | OTP delivery | Supabase Auth | ✅ (login) | | Platform | ☐ |
| `MOYASAR_SECRET_KEY` | Card charge | Supabase edge secrets | | ✅ (COD launch) | Finance | ☐ |
| `MOYASAR_CALLBACK_URL` | Charge callback | Supabase edge secrets | | ✅ | Finance | ☐ |
| `PAYMENT_WEBHOOK_SECRET` | Webhook auth | Supabase edge secrets | | ✅ | Finance | ☐ |
| `VITE_PAYMENT_PROVIDER` | Gateway flag (client) | Vercel env | | ✅ | Finance | ☐ |
| `VITE_EMAIL_PROVIDER` | Email vendor flag | Vercel env | | ✅ | Platform | ☐ |
| Email vendor API key | Email send | Supabase edge secrets | | ✅ | Platform | ☐ |
| `VITE_PUSH_PROVIDER` | Push vendor flag | Vercel env | | ✅ | Platform | ☐ |
| Push server key | Push fan-out | Supabase edge secrets | | ✅ | Platform | ☐ |
| `VITE_MAPS_PROVIDER` | Maps vendor flag | Vercel env | | ✅ | Platform | ☐ |
| Maps API key | Geocoding | Supabase edge secrets | | ✅ | Platform | ☐ |
| `VITE_SENTRY_DSN` | Crash reporting | Vercel env | | ✅ | Ops | ☐ |
| `VITE_ANALYTICS_URL` | Analytics ingest | Vercel env | | ✅ | Ops | ☐ |

> All secret VALUES are set outside this repo. This sprint creates none.

---

## VERIFICATION CHECKLIST

Run against the **staging live build** before production.

- **Authentication / OTP:** real OTP arrives; wrong code rejected; abuse guard cools resend; session persists reload.
- **Payments:** COD order completes; (if enabled) Moyasar test charge → webhook reconciles; refund path.
- **Tracking:** driver GPS pushes throttle correctly; customer sees live position; last-known on signal loss.
- **Driver / Merchant / Customer:** each role logs in and completes its core journey (`home_wiring_journeys.cjs` + role e2e).
- **Realtime:** order/driver updates propagate live.
- **Notifications:** in-app delivered; (if enabled) push received.
- **Email:** (if enabled) transactional email renders AR/EN + RTL/LTR, no missing variables.
- **Maps:** browser geo works; (if enabled) geocoding resolves.
- **Guardian:** Release Gate = GO; provider readiness reflects real config; issues persist.
- **Operations Command Center:** live ops + email ops panel render, no page errors.
- **Performance:** *(out of scope — separate Performance Audit).*
- **Security:** demo isolation guard passes; no demo strings in DOM; *(full audit is separate).*

Automated tooling: `npm run preflight` · `docs/testing/production_readiness_audit.cjs` · `ops_workspace_check.cjs` · `home_wiring_journeys.cjs` · `demo_isolation_check.cjs` · `production_mode_check.cjs` · `guardian_validate.ts`.

---

## ROLLBACK PLAN

- **Failed deployment:** revert `vercel.json buildCommand` → `npm run build`; redeploy → sandbox demo restored. No data change.
- **Provider failure:** unset that provider's `VITE_*` flag → seam reports not-configured and throws honestly; other channels unaffected (in-app/COD/browser-geo/built-in ETA).
- **Database migration failure:** migrations are additive/idempotent; re-point `VITE_SUPABASE_URL` to the prior project ref; do not down-migrate.
- **Payment failure:** unset `MOYASAR_SECRET_KEY` → **COD-only** (Gate still GO on COD). No fake charges (client never fakes success).
- **Authentication outage:** disable phone provider → revert to sandbox build (demo OTP) OR hold launch. Login is the launch gate.
- **Realtime outage:** app degrades to poll-on-refresh (subscribe failures are caught); no crash.

---

## GO / NO-GO CRITERIA (measurable)

**GO requires ALL:**
1. `npm run preflight` exits 0 (lint + 365 tests + build).
2. `docs/testing/production_mode_check.cjs` = 5/5 on the staging live build.
3. Guardian **Release Gate = GO** (0 blockers across the 9 rules).
4. `demo_isolation_check.cjs` = 5/5 and 0 demo strings in the live DOM.
5. **Authentication ready** (real OTP delivered to a test number) — the hard gate.
6. At least one payment method verified end-to-end (COD minimum).
7. Supabase RLS advisor = 0 ERROR/CRITICAL.
8. `check:env` passes for the live build (required client vars valid).

**NO-GO if ANY:** an open critical Guardian issue · a failing regression suite · an unverified required journey · Authentication not ready · demo content detected in the live bundle.

---

## GO / NO-GO SUMMARY
- **COD-only launch:** GO once criteria 1–8 pass **with Authentication (SMS) wired**.
- **Full launch (card/push/email/geocoding):** NO-GO until Phases 5–9 vendors + edge functions are live.
- **Hard blocker for any launch:** SMS OTP delivery (Phase 4).
