# Go-Live Decision — HaaT Now (Production Cutover Sprint)

Date: 2026-07-07 · Build: `5e263f4` · Scope: COD-first launch.

## Decision: **GO WITH OPERATIONAL TASKS**

The platform is production-grade and verified. There are **no code, architecture, or design
blockers remaining.** Launch is gated only on a bounded, well-defined set of operational cutover
tasks (provision + configure + secrets). Once they are executed, HaaT is live.

## Evidence for GO (code/app readiness)
- **Verification gate green:** lint 0 · typecheck 0 · `test:website` 141/141 · `build:live` exit 0 ·
  E2E 24/24 · website COD commerce smoke 5/5.
- **Health & versioning:** `/health.json` liveness + `/version.json` SHA emitted by the build;
  no-store headers; service-worker cache versioned per SHA (clean PWA rollback).
- **Security posture shipped:** `vercel.json` sets CSP, HSTS(preload), X-Frame-Options DENY,
  nosniff, Referrer-Policy, Permissions-Policy, COOP. RLS (92 enables / 200 policies) + RBAC
  authored across 63 migrations.
- **COD is live-ready with no gateway secret:** order → COD record on the single payment engine →
  delivery → driver-wallet credit → settlement (all payment-method-agnostic). Verified.
- **Reuse-clean:** architecture guard passes; no duplicated business logic.

## Why not plain "GO"
The currently-built default artifact ships the **sandbox** stub, and the production backend is not
yet provisioned with secrets/SMS. These are operational, not code — hence **GO WITH OPERATIONAL
TASKS**, not unconditional GO.

## Operational cutover tasks (the gate to live)
Ordered; owners to fill in. Detail in the referenced runbooks.
1. **Provision Supabase production**; apply all `supabase/migrations/**` (incl.
   `20260707000001_cod_payment_method.sql`). — `../operations/SUPABASE_EXECUTION_RUNBOOK.md`
2. **Configure Auth SMS OTP** (Twilio) + secret; set Site URL + Redirect URLs. — `../deployment/SUPABASE_PRODUCTION_CONFIG.md`
3. **Set env/secrets in Vercel (Production):** `VITE_AUTH_MODE=supabase`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`, `VITE_GOOGLE_MAPS_API_KEY`. — `../deployment/VERCEL_ENV_SETUP.md`
4. **Enable Supabase backups/PITR** and **pg_cron** (dispatch/reconcile/settlements).
5. **Deploy** with the live build; verify `/health.json` + `/version.json` SHA.
6. **Run smoke tests** on the live URL (role smokes in `../deployment/GO_LIVE_CHECKLIST.md` + COD journey).
7. **Onboard** first merchants + drivers — `../operations/MERCHANT_ONBOARDING_CHECKLIST.md`,
   `../operations/DRIVER_ONBOARDING_CHECKLIST.md`.
8. **Stand up monitoring** for week 1 — `../operations/FIRST_WEEK_MONITORING_PLAN.md`;
   on-call + `../operations/INCIDENT_ESCALATION_PLAN.md` staffed.

## Not required for COD launch (defer)
Moyasar/card secrets + edge-function deploy (P1); Paymob/Stripe (future); push provider, email
provider, app-level rate limiting (P1/P2). See `PRODUCTION_BLOCKERS.md`.

## Sign-off
| Role | Name | GO? | Date |
|---|---|---|---|
| Engineering | _TBD_ | ☐ | |
| Operations | _TBD_ | ☐ | |
| Founder | _TBD_ | ☐ | |

**When tasks 1–8 are complete and live smoke passes → the decision converts to GO (live).**
