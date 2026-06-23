# Production Readiness — HAAT NOW

**Date:** 2026-06-24 · **Branch:** `feat/auth-recovery-frontend-sprint`

---

## Readiness checklist

| Area | Status | Detail |
|---|---|---|
| **Security (Critical/High)** | ✅ resolved | 1 Critical + 2 High RLS/crash issues fixed (see `SECURITY_AUDIT.md`, `CRITICAL_SECURITY.md`, `HIGH_SECURITY.md`). |
| **RLS** | ✅ | All `public` tables RLS-enabled; over-permissive writes locked to owner/super-admin. |
| **Error boundaries** | ✅ **added** | `src/components/ErrorBoundary.tsx` wraps the app in `main.tsx` — uncaught render errors now show a recoverable fallback (reload) instead of a white screen; includes an `onError` monitoring hook. |
| **Session expiration** | ✅ | `onAuthStateChange` → logout on `SIGNED_OUT`/null session; Supabase-js auto-refreshes the JWT. |
| **Retry logic** | 🟡 partial | Payment verification polls (12 attempts / 5s). Wallet/profile have manual retry buttons. General fetch retry is a backlog item. |
| **Offline handling** | 🟡 backlog | No offline cache/queue; errors surface user-facing retry. Recommend a service-worker/cache pass post-launch. |
| **Rate limiting** | 🟡 server-side | Supabase Auth provides OTP rate-limits (confirm enabled in dashboard); edge functions are service-role gated. App-level throttling is a backlog item. |
| **Logging** | ✅ baseline | `console.error` on caught failures (no secret logging); `ErrorBoundary` logs render errors. |
| **Monitoring hooks** | ✅ hook ready | `ErrorBoundary.onError(error, info)` is the integration point for Sentry/Logflare (wire in prod). |
| **Secrets management** | ✅ | Client = anon key only; `service_role` server-side via `Deno.env`; `.env*` + `.mcp.json` gitignored; no secrets in tracked files. |
| **Build** | ✅ | `npm run build` passes. Entry chunk ≈ 312 KB (lazy routes + vendor split). |
| **Lint** | ✅ | `tsc --noEmit` clean on app `src` (only pre-existing Deno edge-fn files excluded). |
| **E2E** | ✅ | 24/24 journeys pass (customer/merchant/driver/admin); 0 console/React errors. |

## Hardening implemented this sprint
1. **Top-level `ErrorBoundary`** — prevents full-app white-screen; bilingual fallback + reload + monitoring hook.
2. **RLS write-policy lockdown** (migration `20260614000026_security_hardening.sql`, applied live):
   - `app_config` → super-admin write only.
   - `payment_transactions` → own-order insert only.
   - `support_messages` → `sender_id = auth.uid()`.

## Pre-launch operational checklist (config, not code)
- [ ] Set Vercel `VITE_AUTH_MODE=supabase` (and confirm `DEV=false` in prod build → sandbox tree-shaken).
- [ ] Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in Vercel.
- [ ] **Rotate** the Supabase management token used by dev scripts.
- [ ] Configure real Twilio (replace Test OTP `123456`) + payment gateway keys (edge-fn env).
- [ ] Confirm Supabase Auth rate limits + set `site_url`/redirect URLs.
- [ ] Wire `ErrorBoundary.onError` + edge-function logs to a monitoring service.
- [ ] (Backlog) `order_status_history` trigger-based hardening; general fetch retry/offline.

## Verdict
**Production-ready from a security standpoint:** 0 Critical, 0 High outstanding; build + lint + E2E pass.
Remaining items are operational config (env/keys/monitoring) and non-blocking Medium hardening, tracked
above.
