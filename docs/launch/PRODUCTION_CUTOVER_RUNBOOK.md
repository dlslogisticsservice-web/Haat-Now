# HAAT NOW — Production Cutover Runbook

**Purpose:** the operational procedure to activate HAAT NOW from the current sandbox demo to a
live **Closed Beta (COD, email OTP)** on the certified backend `haat-now-prod`
(`ckmqxhjdrfztkunqprax`). Planning document — **no step here has been executed** in this sprint.

**Roles:** Release Captain (owns the cutover), Ops Admin (seeds/verifies data), On-call Engineer
(monitoring/rollback). **Backend of record:** `haat-now-prod` (Frankfurt). **Frontend:** Vercel →
`haatnow.app`. **Maintenance window:** low-traffic; the current deploy is a sandbox demo so there is
no live customer traffic to drain.

---

## 0. Pre-flight (T-1 day) — all must be green before cutover

- [ ] Go/No-Go blockers 1–4 resolved (`PRODUCTION_GO_NO_GO.md`).
- [ ] `haat-now-prod` migration list == repo (`…001–…007`); `list_migrations` matches.
- [ ] Regression suites pass on prod (all `supabase/tests/*_regression.sql`).
- [ ] Email OTP: test sign-in delivered end-to-end (Supabase Auth SMTP/Resend).
- [ ] Seed verified: ≥1 admin (ops console loads), launch city + zones, ≥1 approved merchant +
      branch + products, delivery-fee/zone config.
- [ ] Env secrets set in Vercel: prod `VITE_SUPABASE_URL/ANON_KEY`, `VITE_AUTH_MODE=live` (or
      email), `PAYMENT_MODE=cod`, `VITE_` Maps key, `VITE_SENTRY_DSN`.
- [ ] `git status` clean; branch merged to `main`; tag cut (`vX.Y.Z-beta`).
- [ ] Rollback artifact identified: current live deployment URL + previous git SHA recorded.

## 1. Launch sequence (cutover)

1. **Freeze** — announce window; no new merges to the release branch.
2. **DB final check** — `select version, name from supabase_migrations.schema_migrations order by
   version;` on prod == expected 7 rows; `get_advisors(security)` reviewed (WARN-only expected).
3. **Build live** — `npm run build:live` (HAAT_LIVE_BACKEND) with prod env; confirm
   `dist/version.json` shows the release SHA and `dist/guardian-snapshot.json` = 0 violations.
4. **Deploy** — publish the live build to Vercel production (`vercel --prod` or dashboard promote).
   Do **not** delete the previous deployment (rollback target).
5. **DNS/routing** — confirm `haatnow.app` serves the new build (`/version.json` == release SHA).
6. **Smoke tests** — run §3. If any P0 smoke test fails → **rollback (§4)**.
7. **Enable** — flip any launch feature flags (e.g. `HAAT_LIVE_BACKEND` already implied by
   build:live); confirm sandbox banners are gone.
8. **Announce** — invite the closed-beta cohort.

## 2. Monitoring (first 60 min intensive, then 24 h heightened)

- **Health/Version** — poll `/health.json` + `/version.json` (SHA correct, status ok).
- **Supabase** — `get_logs` (api, auth, postgres) for 4xx/5xx spikes; `get_advisors(performance)`;
  DB connections/CPU in dashboard.
- **Auth** — OTP request→verify success rate; watch for SMTP bounces/rate-limits.
- **Orders** — `select status, count(*) from orders group by status;` progresses normally;
  `dispatch_assignments` flowing; no orders stuck `pending` beyond SLA.
- **Errors** — Sentry (once `VITE_SENTRY_DSN` set) crash rate; `monitoring.service` console/network.
- **Cron** — `select * from cron.job_run_details order by end_time desc limit 20;` sweeps succeed.
- **Wallet/ledger sanity** — `select coalesce(sum(debit-credit),0) from ledger_entries;` stays
  balanced; no unexpected wallet credits (referral/loyalty gated).

**Alert thresholds (page on-call):** 5xx > 2% over 5 min · OTP verify success < 90% · any order
stuck > 15 min · crash-free sessions < 99% · DB CPU > 80% sustained.

## 3. Smoke tests (post-deploy; P0 = rollback if failing)

**P0**
- [ ] App loads at `haatnow.app`; `/version.json` == release SHA; no console CSP errors.
- [ ] Customer email OTP sign-up + sign-in works (real inbox).
- [ ] Browse catalog (seeded merchant/products render); place a **COD** order end-to-end.
- [ ] Order lifecycle: accepted → preparing → on_the_way → **delivered** (driver app / ops).
- [ ] Live tracking map renders (Maps key) with driver location.
- [ ] Ops admin console loads; KYC queue, dispatch board, orders visible (scoped).
- [ ] RLS spot-check: a second customer cannot see the first's order/wallet (BOLA closed).

**P1**
- [ ] Delete-account flow completes (anonymizes/removes).
- [ ] Driver presence via `driver_set_presence`/location RPCs; dispatch offer + accept.
- [ ] Merchant self-service (own catalog only).
- [ ] Referral: reward only on paid+delivered (no self-mint).
- [ ] Legal pages (Privacy/Terms) reachable; Delete Account discoverable.

## 4. Rollback (target: < 10 min)

**Trigger:** any P0 smoke failure, 5xx storm, auth outage, or data-integrity anomaly.

1. **Frontend** — in Vercel, **promote the previous deployment** (instant) — or set
   `AUTH_MODE=sandbox` env and redeploy to return to the safe demo. Confirm `/version.json`
   reverts.
2. **No destructive DB rollback by default.** The cutover adds no schema change (migrations were
   applied and certified earlier); operational **seed data is additive**. If a bad seed caused the
   issue, disable/remove that seed row (do not drop tables).
3. **Comms** — post status; pause beta invites.
4. **Post-mortem** — capture logs (`get_logs`), Sentry, and the failing smoke test; file an
   incident (§5) before re-attempting.

> Migrations are **forward-only**. There is no automated down-migration; a schema issue is handled
> by a new corrective migration, not a rollback. This runbook's rollback is a **frontend revert**
> to the sandbox build, which is always safe.

## 5. Incident response

- **Severity:** SEV1 (outage / data-integrity / auth down) · SEV2 (degraded, workaround exists) ·
  SEV3 (minor).
- **On SEV1:** page on-call → Release Captain declares incident → execute rollback (§4) → status
  update every 15 min → root-cause after stabilization.
- **Security incident** (suspected exploit): capture evidence read-only; the security fix chain +
  regression suites (`supabase/tests/`) are the reference for expected protections; do **not**
  hot-patch prod without a migration + regression test.
- **Runbook contacts / escalation:** Release Captain → On-call Engineer → Ops Admin (fill with real
  names/pager before launch).

## 6. Post-launch (T+24h / T+1 week)

- [ ] 24h: review error rate, OTP success, order completion, cron success, ledger balance.
- [ ] 1 week: `get_advisors` (security + performance) re-review; storage growth; DB size/indexes.
- [ ] Before **public launch**: fill legal entity, host Universal/App-Link files, deploy payment
      webhook + activate Paymob, fix settlement-cron authorization, provision FCM/APNs, and re-run
      the full security certification.

---

### Appendix — key facts
- Certified backend: `haat-now-prod` / `ckmqxhjdrfztkunqprax` (Frankfurt).
- Security fix chain: migrations `20260801000001 … 20260801000007` (all findings closed).
- Cron: dispatch_sweep(1m), payment_reconcile(5m), recompute_segments(daily 03:30),
  daily_settlements(daily 04:00 — currently a no-op pending authorization fix).
- Payment: Paymob (deferred; COD at beta). Auth: email OTP at beta (phone/CEQUENS deferred).
- Rollback is always available: promote previous Vercel deploy or set `AUTH_MODE=sandbox`.
