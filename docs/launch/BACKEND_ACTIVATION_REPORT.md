# Phase A — Production Backend Activation Report

**Objective:** prepare & verify the application against the **certified production backend**
`haat-now-prod` (`ckmqxhjdrfztkunqprax`, Frankfurt) — **not** a deploy, seed, or cutover.
**Date:** 2026-08-04. **Method:** local `build:live` verification + live read-only REST/SQL probes
using the **public publishable key** (no secrets exposed; service-role never used).

Legend: **PASS** · **WARNING** (ready, but confirm/complete in the next phase) · **BLOCKER**.

> Constraints honored: no merchants/cities/products seeded · no payments/SMS activated · no deploy ·
> no Vercel change. The live config file (`.env.production.local`) is **gitignored** and local-only.

---

## STEP 1 — Switch runtime configuration → `haat-now-prod` — **PASS**
- `build:live` (`scripts/live.cjs` → `HAAT_LIVE_BACKEND=1` → `vite.config.ts` injects
  `VITE_AUTH_MODE=supabase`) built cleanly and passed the hard env gate (`check-env`).
- **Bundle verification (dist):** prod ref `ckmqxhjdrfztkunqprax` present **6×**; dev ref
  `umwbzradvbsirsybfxfb` present **0×**; `VITE_AUTH_MODE:"supabase"` baked (no `sandbox` marker).
  → the live bundle targets **only** the certified prod backend, in production-data mode.
- Prepared local live config `.env.production.local` (gitignored): `VITE_SUPABASE_URL`
  =`https://ckmqxhjdrfztkunqprax.supabase.co`, `VITE_SUPABASE_ANON_KEY`=public publishable key,
  `PAYMENT_MODE=cod`. **For the real deploy these go in Vercel → Environment Variables** (repo
  `.env*` is gitignored by design).

## STEP 2 — Environment / URLs / Keys / Runtime flags — **PASS** (with recommendations)
| Item | Status | Evidence |
|---|---|---|
| Production Supabase URL | **PASS** | `https://ckmqxhjdrfztkunqprax.supabase.co` (matches project) |
| Supabase key | **PASS** | public **publishable** key valid & accepted by PostgREST/GoTrue (live 200s below). Service-role key NOT used/exposed |
| `AUTH_MODE` / `VITE_AUTH_MODE` | **PASS** | `supabase` (live) — compile-time `define`, cannot drift |
| `PAYMENT_MODE` | **PASS** | `cod`; `PAYMENTS_COD_ONLY=true` hardcoded in `runtime.ts` (card UI never renders) |
| `IS_SANDBOX` | **PASS** | `false` in the live bundle |
| Recommended env | **WARNING** | `VITE_SENTRY_DSN` (error monitoring) and `VITE_GOOGLE_MAPS_API_KEY` (tracking map) not set — non-fatal; set in Vercel for beta |

## STEP 3 — Authentication (email OTP / session / JWT / refresh / logout) — **PASS** (infra) / **WARNING** (live round-trip)
| Item | Status | Evidence |
|---|---|---|
| Email provider | **PASS** | `auth/v1/settings`: `email:true`, `phone:false` (SMS deferred), `mailer_autoconfirm:false` (OTP verification enforced — no auto-confirm) |
| Auth core tables | **PASS** | `auth.users`, `auth.sessions`, `auth.refresh_tokens`, `auth.identities` present → session + JWT + refresh supported by GoTrue |
| New-user provisioning | **PASS** | `on_auth_user_created` trigger on `auth.users` (auto-assigns `customer` role; roles seeded=4) |
| Auth health | **PASS** | `auth/v1/health` → HTTP 200 |
| Real OTP round-trip | **WARNING** | send→verify→session→JWT→refresh→logout must be exercised with a **real inbox + running app**, and production **SMTP (Resend)** configured for volume (the built-in sender is rate-limited). Verify at Closed-Beta bring-up |

## STEP 4 — Realtime — **PASS**
`supabase_realtime` publication includes: **orders, driver_locations, drivers, notifications,
merchant_branches, audit_logs** — the live order feed, driver presence/location, and notifications
are wired. (Realtime auth uses the same JWT; validated once a session exists.)

## STEP 5 — Storage — **PASS**
7 buckets provisioned; `kyc-documents` **private**; public buckets are **non-listable** (F-6
remediation holds — anon listing removed). Anon cannot list the private KYC bucket.

## STEP 6 — RPCs — **PASS**
| Probe (anon, live REST) | Result |
|---|---|
| `rpc/validate_coupon` (public) | **200** — reachable & executes |
| `rpc/loyalty_balance` (gated, RC-1) | **401** — denied to anon (ownership guard + revoke enforced over REST) |

## STEP 7 — RLS — **PASS** (login-first posture)
| Probe (anon, live REST) | Result |
|---|---|
| `wallets` (money) | **401 permission denied** ✓ |
| `customers` (PII) | **401 permission denied** ✓ |
| `products` / `merchant_branches` / `categories` / `offers` / `banners` / `app_config` / `countries` | **401** — catalog/reference require `authenticated` |
| `merchants_public` (safe directory) | **200** — the only anon-visible surface |

→ The backend is **login-first**: only the public merchant directory is anon-readable; money, PII,
and catalog require an authenticated session. **WARNING:** confirm the client's pre-auth boot does
not depend on anon reads of `app_config`/reference tables (grant anon SELECT only if guest browsing
is intended).

## STEP 8 — End-to-end smoke — **PASS** (backend) / **BLOCKER-next-phase** (full journey)
- **Backend smoke (this phase): PASS** — live connectivity, publishable-key validity, PostgREST
  execution, RLS enforcement (money/PII/catalog denied to anon), RPC gating (public 200 / gated
  401), and auth health/settings all green against `haat-now-prod`.
- **Full customer→order journey: not executable here (by design of this sprint).** It requires
  (a) operational **seed** (admin + city/zones + ≥1 merchant + products — explicitly out of scope),
  (b) production **email SMTP**, and (c) a **running/deployed app** — none performed. Deferred to
  the Closed-Beta bring-up (see `PRODUCTION_GO_NO_GO.md` / `PRODUCTION_CUTOVER_RUNBOOK.md`).

---

## Subsystem summary

| Subsystem | Status |
|---|---|
| Runtime config → prod (build:live) | **PASS** |
| Environment / URL / keys / flags | **PASS** (+ recommend Sentry/Maps keys) |
| Authentication (email OTP infra) | **PASS** |
| Auth live round-trip + SMTP | **WARNING** (verify at bring-up; configure Resend) |
| Realtime | **PASS** |
| Storage | **PASS** |
| RPCs | **PASS** |
| RLS | **PASS** |
| Backend smoke | **PASS** |
| Full E2E journey | **WARNING/BLOCKER-next-phase** (needs seed + SMTP + deploy) |

## Blockers to a live Closed Beta (unchanged from Go/No-Go — NOT part of this phase)
1. Operational **seed** on `haat-now-prod`: ≥1 admin, launch city + zones, ≥1 approved merchant + products.
2. Production **email SMTP** (Resend) + a verified OTP round-trip.
3. Set Vercel env (prod URL/key, `VITE_AUTH_MODE=supabase`, Maps key, Sentry DSN) and **deploy** the live build.

## Conclusion
**Backend activation is PREPARED and VERIFIED.** `haat-now-prod` is live, healthy, secured
(entire finding chain closed), and the application — via `build:live` — is correctly configured to
talk **only** to it in production-data, COD-only mode. Auth/realtime/storage/RPC/RLS are all
verified ready. No deploy, seed, payment, SMS, or Vercel change was performed. The remaining items
to serve real users (seed, SMTP, deploy) are operational and out of this sprint's scope.
