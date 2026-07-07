# Rollback Runbook — HaaT Now

Single source for reverting a bad production release. Scope: the Vercel web deploy + Supabase
config. **No schema rollback** is expected for a cutover (config-only changes); data migrations
are forward-only and additive.

## Decision: when to roll back
Roll back immediately if, within the smoke window, any of:
- Health probe `/health.json` returns non-200 or a stale SHA (see below).
- Auth broken (no login/registration) — customers cannot enter.
- Checkout/COD order creation failing (P0 revenue path).
- Error rate spike in Sentry (>2% of sessions) or a security regression.

## 1. Web app rollback (Vercel) — instant, no rebuild
1. Vercel → Project → **Deployments**.
2. Find the last-known-good deployment (match its SHA to `version.json` you recorded pre-cutover).
3. **⋯ → Promote to Production** (atomic alias switch; ~seconds).
4. Verify: `curl https://<domain>/version.json` → `short` equals the good SHA.
5. PWA cache: each build stamps the service-worker cache `haat-shell-<sha>` (`scripts/gen-version.cjs:29-34`); promoting the old deploy serves the old SW, whose `activate` purges the newer shell cache. No manual cache bust needed. If a client is stuck, instruct a hard-reload.

## 2. Environment/secret rollback
- Env var change caused it → revert the specific var in Vercel → **Redeploy** the good deployment.
- Supabase Auth Site URL / Redirect URLs changed → restore prior values in the Supabase dashboard.

## 3. Database
- Migrations are **additive + idempotent** (e.g. `20260707000001_cod_payment_method.sql` only adds a nullable column). A web rollback does **not** require a DB rollback.
- If a migration must be reverted, do it as a **new forward migration** (drop the added object), never an in-place edit. Take a snapshot first (§DR).
- Row-level data corruption → restore from Supabase PITR/backup (see `../operations/PRODUCTION_RECOVERY_EXECUTION_PLAN.md`).

## 4. Payments
- COD needs no gateway → nothing to reverse at the provider.
- Moyasar (if enabled): in-flight authorizations expire; issue refunds via `payment-refund` only for captured charges. Disable card checkout by unsetting `MOYASAR_SECRET_KEY` (checkout returns to COD-only).

## 5. Post-rollback
- Announce in the incident channel (see `../operations/INCIDENT_ESCALATION_PLAN.md`).
- File an incident record; root-cause before re-attempting cutover.
- Re-run the smoke tests on the restored deployment.

## Verification commands
```
curl -s https://<domain>/health.json      # {"status":"ok","sha":"<good>", ...}
curl -s https://<domain>/version.json      # short == last-known-good SHA
```

## Related
`GO_LIVE_CHECKLIST.md` · `FINAL_CUTOVER_RUNBOOK.md` · `../operations/PRODUCTION_RECOVERY_EXECUTION_PLAN.md`
