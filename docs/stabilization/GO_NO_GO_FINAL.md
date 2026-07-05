# Final Go / No-Go — Phase 9.5

> The definitive production decision after Phase 9 remediation + Phase 9.5 live staging
> validation. Date: 2026-07-05.

---

## Decision

### ⛔ NO-GO for production **from this environment / right now** — but a clear, short GO path.

Two distinct verdicts, kept separate on purpose:

1. **Automated certification in this session: NO-GO (blocked, not failed).** I cannot apply
   migrations, deploy edge functions, or run the live E2E here (read-only MCP, no DB password,
   dev DB 21 migrations behind with no test data — `LIVE_VALIDATION_REPORT.md` §1). No honest
   "all runtime checks passed" statement is possible, so I do not make one.

2. **The Phase 9 code itself: CONDITIONAL GO for a single-tenant pilot.** Live read-only
   validation *raised* confidence — 7/8 migrations are dependency-valid against the real schema,
   pg_cron is available, and validation caught + fixed 2 real defects and 1 hardening gap. The
   remaining work is **operational execution on a write-capable staging**, not new development.

---

## Why NO-GO now (the hard blockers)

| # | Blocker | Removable by |
|---|---|---|
| 1 | MCP is `--read-only` → cannot apply migrations / deploy functions | run migrations via Supabase CLI/dashboard with DB creds |
| 2 | No DB password / service-role key in this environment | operator provides staging credentials |
| 3 | Dev project 21 migrations behind repo head; `tenants` absent | apply `20260626*`+`20260627*`+`20260705*` in order |
| 4 | No demo/test accounts on the live project → live E2E can't log in | seed staging test users/data |

None are code defects. All are environment/access gaps.

---

## The GO runbook (operator with staging write access)

Run against a **staging** Supabase project (not production, not the stale `haat-now-dev`),
ideally a fresh clone of production schema+data.

1. **Apply migrations to head.** `supabase db push` (or apply `20260626000001` … `20260705000008`
   in order). Verify `list_migrations` head = `20260705000008`. Watch `000001` succeed *after*
   `20260627000008_tenants`.
2. **Deploy edge functions.** `supabase functions deploy payment-initiate payment-refund`
   (payment-verify/webhook unchanged). Confirm new versions (> v5).
3. **RPC smoke tests** (SQL): `create_order` (idempotent replay returns same order; server total
   ignores client price); `refund_reserve` rejects over-ceiling; `refund_confirm(success=true)`
   posts a balanced `customer_refund`/`platform_cash` `ledger_entries` txn.
4. **Idempotency**: call `create_order` twice with one key → one row. Insert two active
   `payment_attempts` for one order → blocked by `uq_payment_attempts_active_order`.
5. **Triggers**: set an order `status='accepted'` with `driver_id null` → a `dispatch_assignments`
   offer appears. Assign a driver → `drivers.active_orders` +1. Mark `delivered` → −1 and
   `status='available'` at zero.
6. **pg_cron**: `select jobname, schedule from cron.job` shows `haat_dispatch_sweep`,
   `haat_payment_reconcile`, `haat_segments`, `haat_settlements`. If pg_cron unavailable, wire the
   scheduled-edge fallback.
7. **RLS / RBAC**: as a country/non-finance admin, call `pay_merchant_settlement` → rejected
   (`permission denied: finance.pay`); as super_admin → succeeds. Confirm `role_permissions`
   seeded and `admin_users.role_template` backfilled.
8. **PII**: `pg_policies` shows no `using(true)` PII policy on drivers/merchants; a
   `select contact_phone from merchants` as `authenticated` is denied (column revoked).
9. **Advisor**: re-run `get_advisors(security)`; confirm the new functions are no longer
   anon-executable; schedule the pre-existing ~80 anon-RPC revokes (P1) + the 3 always-true
   INSERT policies + 6 public-bucket listings + leaked-password protection.
10. **Provisioning**: run the Tenant Onboarding wizard against live → tenant row created with all
    provisioned columns (P0-2 verifies here, needs `tenants` from step 1).
11. **Live E2E**: seed test accounts; run `HAAT_LIVE_BACKEND=1` E2E; expect the customer →
    merchant → driver → admin lifecycle green.
12. **Sign-off**: all of `PRODUCTION_CERTIFICATION.md` gates 1–8 pass → flip to GO.

**Estimated operator effort:** ~0.5–1 day on a prepared staging project.

---

## Scope reminder

- This phase changed **no product features**. The only code edits were **validation-driven
  corrections** to the Phase 9 migrations (the 2 PII defects + anon-execute hardening).
- Multi-tenant / multi-country **GA remains NO-GO** regardless of the pilot — that needs the
  P1/P2 backlog (event backbone incl. capture→ledger, KYC/suspension gating, inventory coupling,
  real billing, DB-backed white-label, full `tenant_id` RLS isolation). See
  `TOP20_CTO_RECOMMENDATIONS.md` #10–#20.

---

## One-line verdict

**The code is staging-ready and validation improved it; production certification is blocked only
by environment access. Execute the 12-step runbook on a write-capable, seeded staging project and
this converts to GO for a controlled single-tenant pilot.**
