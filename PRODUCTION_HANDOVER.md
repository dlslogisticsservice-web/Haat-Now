# Production Handover — HAAT NOW

Operator handover for the live system. Production URL: **https://haat-now.vercel.app** (custom domain
`app.haatnow.com` pending DNS). Default branch **`main`** auto-deploys to production.

## 1. Architecture overview
- **Frontend**: React 19 + Vite 6 + TypeScript + Tailwind v4 + i18next. SPA, code-split per role
  (Customer / Merchant / Driver / Admin), PWA (manifest + versioned service worker).
- **Backend**: **Supabase** — Postgres (RLS-secured) + Auth (phone OTP) + Realtime + Storage + **Edge
  Functions** (Deno): `payment-initiate`, `payment-verify`, `payment-webhook`, `payment-refund`.
- **Payments**: single `paymentOrchestrator` (client) → secure server-side edge pipeline (gateway secrets
  server-side) → Moyasar/Paymob hosted page → webhook (HMAC + replay-dedup) → order/payment status.
- **Hosting/CDN**: Vercel (edge CDN, immutable hashed assets, atomic immutable deployments).
- **Multi-tenant**: white-label **control plane** live (`tenants` table + lifecycle); full data isolation
  is a documented future rollout (`TENANT_ISOLATION_ROADMAP.md`).
- **Roles**: Customer, Merchant, Driver, Super Admin, Country Admin (RLS country-scoped), Dispatcher (= admin ops).
- **Demo mode**: `VITE_AUTH_MODE=sandbox` uses an in-browser `sandboxStore` (no backend) — used for review/E2E.

## 2. Environment variables
| Var | Purpose | Scope |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase client | Vercel (build) |
| `VITE_AUTH_MODE` | `sandbox` (demo) or unset (production) | Vercel |
| `VITE_GOOGLE_MAPS_API_KEY` | maps + live tracking | Vercel |
| `VITE_SENTRY_DSN` | crash reporting (monitoring seam) | Vercel |
| `VITE_ANALYTICS_URL` | analytics collector | Vercel |
| `PAYMENT_MODE` | `production` to enable real gateways | Supabase Edge secrets |
| `PAYMOB_API_KEY` / `MOYASAR_SECRET_KEY` / `STRIPE_SECRET_KEY` / `MADA_*` | gateway keys | Supabase Edge secrets |
| `PAYMENT_WEBHOOK_SECRET` | webhook HMAC verification | Supabase Edge secrets |
| `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | (optional) CI deploy path | GitHub repo secrets |
> Never expose service-role / gateway secret keys to the client (verified: none in the bundle).

## 3. Production services
- **Supabase project** (Postgres + Auth + Storage + Edge) — apply migrations via `supabase db push`.
- **Vercel project** — connected to GitHub `main`; auto-deploys; serves `version.json`/`health.json`.
- **Google Maps Platform** — production key (domain-restricted).
- **Firebase** — FCM project (`google-services.json` / `GoogleService-Info.plist` + APNs key).
- **Sentry + analytics collector** — via the env DSNs.
- **Payment gateway** — Paymob / Moyasar production accounts + webhook endpoint.

## 4. Backup strategy
- **Database**: Supabase **automatic daily backups** + **Point-in-Time Recovery** (paid tiers). Confirm
  the retention window in the project settings.
- **Storage**: Supabase Storage (durable, replicated).
- **Code/config**: Git (GitHub) is the source of truth; every deploy is an immutable Vercel build.
- **Action**: verify backup cadence; schedule a periodic export if required by policy.

## 5. Rollback procedure (two layers)
1. **Instant (Vercel)**: Vercel → Deployments → select the previous good deployment → **Promote to
   Production**. Atomic; no rebuild.
2. **Source (Git)**: `git revert <bad-sha>` (or reset) → push `main` → auto-redeploy.
- **Verify** after rollback: `GET /version.json` SHA matches the intended commit; `/health.json` 200.
- **DB rollback**: migrations are additive/guarded; if a migration is bad, use Supabase PITR to the
  pre-migration timestamp.

## 6. Disaster recovery
- **DB loss/corruption** → Supabase PITR restore to the last good timestamp.
- **Bad deploy** → instant Vercel promote-previous.
- **Region outage** → Vercel edge is multi-region; Supabase region per project (consider read replicas).
- **Run one restore drill** before launch to validate the runbook + RTO/RPO.

## 7. Monitoring
- **Health**: `GET /health.json` (200 + SHA), `GET /version.json` — wire an uptime monitor (e.g.,
  UptimeRobot/Better Uptime) to `/health.json`.
- **App errors**: `ErrorBoundary` → `monitoring.captureError` → Sentry (on DSN).
- **Logs**: Vercel function/edge logs + Supabase logs + structured `monitoring.log`.
- **In-app ops**: Operations Command Center (live KPIs, SLA monitor, incident log, execution console).
- **Audit**: `audit_logs`, `operation_events`, `webhook_events`, `payment_idempotency`.

## 8. Incident response
1. **Detect**: uptime alert / Sentry alert / SLA monitor flags delayed orders / incident log shows failures.
2. **Triage**: check `/health.json` + Vercel/Supabase status + recent deploy (`version.json` SHA).
3. **Mitigate**: if deploy-related → **rollback** (§5); if data → PITR; if a tenant/zone → suspend via
   White Label / pause via ops.
4. **Operate**: reassign drivers / handle failed orders in the **Execution Console + Incident Log**.
5. **Communicate**: status update; **Postmortem**: record cause + fix; add a regression check.
- **Escalation**: L1 support → L2 on-call engineer → L3 platform (Supabase/Vercel/gateway support).
