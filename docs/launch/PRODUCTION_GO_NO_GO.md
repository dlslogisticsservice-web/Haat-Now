# HAAT NOW — Production Go / No-Go Checklist

**Sprint:** Final Production Activation (verification & planning only — no deploy, no prod change).
**Date:** 2026-08-04. **Evidence:** live Supabase inspection + repo verification (read-only).

Legend: **PASS** (ready) · **WARNING** (works but must be completed/confirmed) · **BLOCKER** (must
be fixed before that launch tier).

> Two Supabase projects exist in the org: **`haat-now-prod`** (`ckmqxhjdrfztkunqprax`, Frankfurt,
> ACTIVE_HEALTHY) — the **security-certified** backend (migrations `20260801000001…000007`, cron,
> reference seed); and **`haat-now-dev`** (`umwbzradvbsirsybfxfb`). The production frontend build
> (`.env.production`) points at **dev, in sandbox mode** — the deployed app is a self-contained
> demo, **not** wired to the certified backend. This is the central activation gap.

---

## STEP 1 — Production Infrastructure

| Item | Status | Evidence / Note |
|---|---|---|
| Supabase production project | **PASS** | `haat-now-prod` ACTIVE_HEALTHY, Postgres 17, Frankfurt |
| Schema migrated | **PASS** | 155 public tables; full fix chain `…001–…007` applied |
| Security certification | **PASS** | All findings B/RT/F/N/C/RC-1/RC2 closed (see `docs/security/`) |
| Reference data seeded | **PASS** | 8 countries |
| Operational data seeded | **BLOCKER** | **0 cities, 0 zones, 0 merchants, 0 admin_users, 0 auth.users** — no delivery geography, no catalog, **no admin to operate** |
| Cron jobs | **WARNING** | pg_cron live: dispatch_sweep(1m), payment_reconcile(5m), recompute_segments(daily), daily_settlements(daily). **daily_settlements is a silent no-op** — `generate_*_settlement` requires `is_ops_admin()` and the cron context has no admin identity (caught → null). Fine for COD (no settlements yet); fix before payouts scale |
| Storage | **PASS** | 7 buckets; `kyc-documents` private; others public CDN; listing removed (F-6) |
| Vercel production | **WARNING** | `vercel.json` production-grade (CSP, HSTS, security headers, SPA, cache); project linked (`haatnow.app`). Current deploy serves the **sandbox** build |
| Environment variables | **BLOCKER** | `.env.production` = `VITE_SUPABASE_URL→dev`, `AUTH_MODE=sandbox`, `PAYMENT_MODE=sandbox`. Live values (prod URL/key, live modes) not set |
| Secrets (email/maps/payment) | **BLOCKER (beta: email only)** | `.env.example` defines Resend/Paymob/Stripe/Mada/Maps/Sentry; none in `.env.production`. **Email OTP delivery secret (Resend/SMTP) required for closed beta**; payments/SMS intentionally deferred |
| SMTP / Email | **BLOCKER (beta)** | Auth email OTP is the beta login; Supabase Auth SMTP / Resend must be configured on `haat-now-prod`. Not verifiable from repo — confirm in dashboard |
| SMS | **N/A (deferred)** | Not activated (per instruction); email OTP for beta |
| Monitoring / Error tracking | **WARNING** | `monitoring.service` is provider-agnostic, defaults to **console**; `VITE_SENTRY_DSN` / `VITE_ANALYTICS_URL` not set — no external crash/analytics backend wired |
| Logging | **PASS** | Supabase logs + `monitoring.service` structured events |
| Health checks | **PASS** | `health.json` generated per build; `no-store` header |
| pg_net (HTTP from DB) | **WARNING** | not installed — only needed if cron/triggers call out (webhooks); not required for COD |

## STEP 2 — Production Environment Validation

| Item | Status | Evidence / Note |
|---|---|---|
| Production URLs | **WARNING** | `haatnow.app` live but serving sandbox; live build not yet published |
| API endpoints (PostgREST/RPC) | **PASS** | On `haat-now-prod`; RLS + RPC authz certified |
| Supabase keys | **BLOCKER** | Prod anon/publishable key not wired into the prod build (points at dev) |
| Storage buckets | **PASS** | Provisioned + policies verified |
| Edge Functions | **WARNING** | **None deployed.** Payment webhook / refund service-role paths are code-only. Not needed for COD; required before card payments |
| Realtime | **PASS** | Supabase Realtime enabled; used by driver order feed |
| Email | **BLOCKER (beta)** | See SMTP above — must be configured for email OTP |
| SMS | **N/A** | Deferred |
| Push Notifications | **WARNING** | Capacitor push configured; FCM/APNs credentials not provisioned (not needed for web beta) |
| Maps | **WARNING** | Google Maps allowed in CSP; `VITE_` Maps API key not in prod env — live tracking map needs it |
| Payment Gateway | **N/A (deferred)** | Paymob wired in CSP/env template; `PAYMENT_MODE=sandbox`; COD for beta |

## STEP 3 — Deployment Readiness

| Item | Status | Evidence / Note |
|---|---|---|
| Build | **PASS** | `npm run build` clean |
| Production build | **PASS** | tsc 0, 777 tests pass, build ✓; `build:live` lever exists (`scripts/live.cjs`) |
| Source maps | **PASS** | Not emitted in prod (Vite default) — no source leak |
| Error monitoring | **WARNING** | Console-only until `VITE_SENTRY_DSN` set (STEP 1) |
| Health endpoint | **PASS** | `/health.json` (commit, status) |
| Version endpoint | **PASS** | `/version.json` (commit, version) |
| Guardian snapshot | **PASS** | `dist/guardian-snapshot.json` — 544 files, 0 cycles, 0 violations |

## STEP 4 — App Store Readiness

| Item | Status | Evidence / Note |
|---|---|---|
| Apple requirements | **WARNING** | Bundle `com.haatnow.app`, splash/icons present; needs signing, ATT/permission strings, App Privacy answers |
| Google Play requirements | **WARNING** | Same bundle; needs signing, Data-Safety form, target API level |
| **Delete Account** | **PASS** | `DeleteAccountFlow.tsx` + `delete_my_account` RPC (in-app self-service) — meets Apple/Google mandate |
| Privacy Policy | **WARNING** | `src/config/legal.ts` bilingual, production template — contains `[Company legal name]/[registration number]` **placeholders to fill** |
| Terms of Service | **WARNING** | Same as Privacy — templated, placeholders to fill |
| Permissions | **PASS** | `Permissions-Policy` scoped (geolocation/camera/payment self; mic/usb off) |
| Icons | **PASS** | 192/512/1024, maskable, apple-touch, notification icon |
| Splash | **PASS** | Capacitor SplashScreen configured |
| Deep Links | **WARNING** | Custom-scheme handling present in-app; no config file needed for scheme links |
| **Universal Links (iOS)** | **BLOCKER (native)** | No `public/.well-known/apple-app-site-association` |
| **App Links (Android)** | **BLOCKER (native)** | No `public/.well-known/assetlinks.json` |

---

## Blockers summary

**To reach READY FOR CLOSED BETA (COD, email OTP, web/PWA):**
1. **Wire the prod build to the certified backend.** Set `.env.production` →
   `VITE_SUPABASE_URL/ANON_KEY` of `haat-now-prod`, `AUTH_MODE`/`PAYMENT_MODE` to live/COD; build
   with `build:live`.
2. **Configure email OTP delivery** (Supabase Auth SMTP / Resend) on `haat-now-prod` and send a
   test OTP.
3. **Seed minimum operational data** on `haat-now-prod`: ≥1 admin user (ops console access), the
   launch country's cities + delivery zones, and ≥1 approved merchant + branch + products.
4. **Provision the Google Maps `VITE_` key** (live tracking) and `VITE_SENTRY_DSN` (error
   monitoring).

**Additional for READY FOR PUBLIC LAUNCH / native app store:**
5. Fill legal entity placeholders (Privacy/Terms). 6. Host `apple-app-site-association` +
   `.well-known/assetlinks.json` (Universal/App Links). 7. Deploy the payment webhook Edge
   Function + activate Paymob (only when moving beyond COD). 8. Fix the settlement-cron
   authorization no-op before payouts scale. 9. Provision FCM/APNs for native push.

**Not blockers (verified ready):** security certification, schema/migrations, storage, health/
version/guardian, CSP/headers, delete-account, build pipeline, cron infrastructure, reference data.

---

## FINAL DECISION: 🔴 **NOT READY**

**Rationale.** The platform is **security-certified and code-complete**, and the production backend
(`haat-now-prod`) is provisioned, migrated, and healthy. However, **production activation is not
done**: the deployed frontend runs in **sandbox** mode against the **dev** project (not the
certified prod backend), and `haat-now-prod` has **no operational data** — no admin user to run
ops, no delivery geography (cities/zones), and no merchants/catalog — plus email-OTP delivery is
unconfirmed. Launching today would serve a demo, not a real service. These are **operational**
blockers, not code or security defects.

**Shortest path (Closed Beta):** items 1–4 above — estimated ~1–2 weeks of operations work (wire
env → certified backend, configure email SMTP, seed admin + one city's zones + one merchant,
provision Maps/Sentry keys). After that, **READY FOR CLOSED BETA (COD)** is attainable. **Public
launch / app-store** additionally needs items 5–9. This sprint intentionally performed **no**
deploy, seeding, or provider activation.
