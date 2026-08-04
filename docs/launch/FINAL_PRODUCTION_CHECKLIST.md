# FINAL Production Checklist — Closed Beta Cutover

**Date:** 2026-08-05. **Backend of record:** `haat-now-prod` (`ckmqxhjdrfztkunqprax`, Frankfurt).
**Method:** live verification (read-only) + honest configurability assessment.

Legend: **PASS** (done/verified) · **WARNING** (works, complete/confirm) · **BLOCKER** (must be
done by the operator before serving users — requires credentials/accounts not available to this
automation).

> **Honesty note.** Deploying and configuring third-party secrets require the operator's own
> Vercel, Resend, Google Cloud, and Sentry accounts/tokens. This environment has **no Vercel CLI
> or auth**, **no Supabase auth-config/Management tool**, and cannot create third-party API keys.
> Those items are therefore reported as **BLOCKER (operator action)** — not fabricated as done.

---

## STEP 1 — Production configuration

| Item | Status | Evidence |
|---|---|---|
| Supabase production project | **PASS** | `haat-now-prod` ACTIVE_HEALTHY; 7 security migrations; 4 active cron jobs |
| `VITE_SUPABASE_URL` | **PASS** | `https://ckmqxhjdrfztkunqprax.supabase.co` — `check-env` (live) required ✓ |
| `VITE_SUPABASE_ANON_KEY` | **PASS** | public publishable key `sb_publishable_pUyE65V6ehQLaIs-WzokPg_zWRJlyti` — valid & accepted by the live API |
| `VITE_AUTH_MODE=supabase` (build:live) | **PASS** | injected by `HAAT_LIVE_BACKEND=1`; bundle verified 6 prod refs / 0 dev refs (Phase A) |
| **Vercel production env vars set** | **BLOCKER** | not set; **no Vercel access from here** (vercel CLI/auth absent). Operator must set them (values in the runbook) |
| **SMTP (Resend) configured** | **BLOCKER** | Auth email uses the built-in sender (rate-limited); custom SMTP not configurable via available tools. Operator must set Auth → SMTP with a Resend key |
| **Google Maps API key** (`VITE_GOOGLE_MAPS_API_KEY`) | **BLOCKER (tracking)** | `check-env`: recommended **missing** — live tracking map degraded without it |
| **Sentry DSN** (`VITE_SENTRY_DSN`) | **WARNING** | `check-env`: recommended **missing** — crash monitoring is console-only until set |

## STEP 2 — Deployment

| Item | Status | Evidence |
|---|---|---|
| `build:live` produces a valid prod bundle | **PASS** | Phase A: clean build, env gate passed, targets `haat-now-prod` |
| Health endpoint (`/health.json`) | **PASS (artifact)** | generated: `{"status":"ok","sha":"…","at":…}` — served once deployed |
| Version endpoint (`/version.json`) | **PASS (artifact)** | generated: name/version/sha/builtAt/env=production |
| Guardian snapshot | **PASS** | 544 files · 0 cycles · 0 violations |
| **Live deployment executed** | **BLOCKER** | not deployed; **no deploy tooling/auth here**. `haatnow.app` still serves the sandbox build |
| Version/health verified **on the live URL** | **BLOCKER** | depends on the deploy above |

## STEP 3 — Production smoke tests (deployed app)

| Test | Status | Evidence |
|---|---|---|
| Backend order journey (RPC/RLS) | **PASS** | Phase B E2E: order 80.00 → accept → dispatch → deliver; earnings 1, wallet +20, ledger balanced |
| Role routing (admin/merchant/driver/customer) | **PASS** | Phase B: each identity resolves correctly |
| Email OTP send path | **PASS** | `auth/v1/otp` → HTTP 200 (single-operator); **multi-user needs Resend** |
| Customer registration (deployed UI) | **BLOCKER** | requires the live deployment |
| OTP → Login (deployed UI, real inbox) | **BLOCKER** | requires deploy + Resend SMTP |
| Browse merchants / products (deployed UI) | **BLOCKER** | requires the live deployment |
| Place COD order (deployed UI) | **BLOCKER** | requires the live deployment |
| Merchant / Driver / Admin dashboards (deployed UI) | **BLOCKER** | requires the live deployment |
| Realtime updates (deployed UI) | **BLOCKER** | requires the live deployment (publication is configured server-side) |

## Verified-ready foundation (no action)
Security certification (all findings closed, 7-migration chain) · backend bootstrapped (admin +
Egypt/Cairo + 2 zones + fees + settings + approved merchant + catalog + driver) · full backend E2E ·
RLS/RPC enforcement live · storage (kyc private, non-listable) · cron active · delete-account flow ·
CSP/HSTS/security headers · build/tests/guardian gates.

---

## Remaining blockers (all require operator credentials — cannot be done by this automation)
1. **Set Vercel production environment variables** (Supabase URL/key + `VITE_GOOGLE_MAPS_API_KEY` +
   `VITE_SENTRY_DSN`). *Evidence: no Vercel access here.*
2. **Configure Resend/custom SMTP** on `haat-now-prod` (Auth → SMTP) and confirm a real OTP
   arrives. *Evidence: built-in sender only; no auth-config tool.*
3. **Provision `VITE_GOOGLE_MAPS_API_KEY`** (Google Cloud) for live tracking. *Evidence: check-env
   recommended missing.*
4. **Execute the live deployment** (`build:live` → `vercel --prod`, closed URL). *Evidence: no
   deploy tooling/auth here; `haatnow.app` still sandbox.*
5. **Run the deployed-app smoke sequence** (STEP 3) and confirm every P0 passes. *Evidence:
   depends on 1–4.*

Non-beta / later: Sentry DSN (WARNING), legal-entity placeholders, Universal/App-Link files,
payment webhook + Paymob, settlement-cron authorization, FCM/APNs push.

See `PRODUCTION_CUTOVER_RUNBOOK_FINAL.md` for the exact commands/values to complete 1–5.
