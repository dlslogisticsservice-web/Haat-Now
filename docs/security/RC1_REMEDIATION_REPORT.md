# RC-1 Remediation Report

Eliminates **RC-1 — Broken Object Level Authorization (OWASP API1)** on `SECURITY DEFINER`
read RPCs, the sole finding of the Release-Candidate certification
(`RELEASE_CANDIDATE_SECURITY_CERTIFICATE.md`). Scope was strictly RC-1 — no certified
subsystem, no unrelated code, no infrastructure touched. One DB migration (applied to prod
`haat-now-prod`) + a regression suite. **No application code changed** (all RPC signatures
preserved, so every self/ops call-site keeps working).

## Audit method
Enumerated **every** `SECURITY DEFINER` function in `public` whose body contains **no**
authorization reference (`auth.uid()` / `is_ops_admin()` / `auth_is_admin()`) — the complete
BOLA candidate set. Each was classified and handled:

| Class | Functions | Action |
|---|---|---|
| Owner-scoped read (customer) | `loyalty_balance`, `resolve_loyalty_tier`, `recently_ordered` | guard `p_customer = auth.uid()` or ops |
| Owner-scoped read (order) | `reorder_items`, `order_tracking` | guard order-belongs-to-caller (+driver for tracking) or ops |
| Owner-scoped read (merchant) | `merchant_growth_stats` | guard merchant-owner or ops |
| Ops-only analytics / compliance | `growth_analytics`, `ops_summary`, `ops_zone_analytics`, `retention_targets`, `search_term_stats`, `support_sla_stats`, `expiring_documents`, `estimate_segment` | guard `is_ops_admin()` |
| Already safe — **no change** | `cashback_balance`, `driver_wallet_summary` (SECURITY **INVOKER** ⇒ RLS-scoped to owner); money mutators (already client-revoked); cron/maintenance (revoked/gated); public catalog/aggregates (`active_promotions`, `rating_summary`, `recommended_merchants`, `trending_products`, `validate_coupon`, `search_catalog`, `order_country_code`) | audited, left as-is |

Guards use `auth.uid()`/`is_ops_admin()` (accurate inside `SECURITY DEFINER`; `current_user`
is the owner there and cannot identify the caller — the lesson from earlier passes).

## Requirements met
1. **Ownership verified** on every id-taking read RPC (customer/order/merchant = `auth.uid()`, or ops).
2. **Client-supplied ids never trusted** — the guard rejects any id not owned by the caller.
3. **`order_tracking` minimized + scoped:** driver **phone removed** from the payload; the
   function now serves only the order's own **customer**, its **assigned driver**, or **ops**
   (raw-UUID public access removed). A shareable public-tracking link, if desired later, must use
   a signed token — out of scope here.
4. **Backwards compatible:** all signatures unchanged; the customer app (own loyalty/tier/recent/
   reorder/tracking) and ops dashboards (own-merchant stats, ops analytics) keep working — verified.
5. **Regression tests** reproduce RC-1 (cross-account reads) and confirm they fail.

## Files changed
- **Migration added:** `supabase/migrations/20260801000006_rc1_bola_remediation.sql` (applied to
  prod; history reconciled to a single canonical row `20260801000006`).
- **Regression suite added:** `supabase/tests/rc1_bola_remediation_regression.sql`.
- **Application code:** none.

## RPCs changed
Guarded (converted `language sql` → `plpgsql` with an authorization guard, logic otherwise
unchanged): `loyalty_balance`, `resolve_loyalty_tier`, `recently_ordered`, `reorder_items`,
`order_tracking` (also driver-phone removed), `merchant_growth_stats`, `growth_analytics`,
`ops_summary`, `ops_zone_analytics`, `retention_targets`, `search_term_stats`,
`support_sla_stats`, `expiring_documents`, `estimate_segment`. `EXECUTE` revoked from
`anon`/`public` on all fourteen.

## Policies changed
None (function-level authorization only; no RLS policy added/dropped).

## Regression tests added
`rc1_bola_remediation_regression.sql` (impersonated, self-cleaning): an unrelated attacker's
call to each of the 12 owner/ops read RPCs on a victim must raise; the owner's own reads
(`loyalty_balance`, `reorder_items`, `order_tracking`) must succeed; `order_tracking` must not
contain a driver `phone`; and the fixed RPCs must be non-anon-executable.

## Evidence — RC-1 eliminated (live, on prod)
```
loyalty_balance(victim) blocked            = true
resolve_loyalty_tier(victim) blocked       = true
recently_ordered(victim) blocked           = true
reorder_items(victim order) blocked        = true
order_tracking(victim order) blocked       = true
merchant_growth_stats(victim) blocked      = true
growth_analytics non-admin blocked         = true
ops_summary non-admin blocked              = true
retention_targets non-admin blocked        = true
support_sla_stats non-admin blocked        = true
expiring_documents non-admin blocked       = true
estimate_segment non-admin blocked         = true
OWN loyalty_balance works                  = 30
OWN reorder_items works                     = 1
OWN order_tracking works                    = true (status present)
order_tracking leaks driver PHONE           = false
RC1_BOLA_REGRESSION: RC-1 closed
```

## Quality gates
| Gate | Result |
|---|---|
| Migration apply (prod) | ✅ clean |
| RC-1 regression (impersonated + structural) | ✅ **closed** |
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| ESLint (`tsc` + architecture + demo-isolation) | ✅ clean |
| Unit + integration tests | ✅ **777 pass / 0 fail** |
| Guardian | ✅ **544 files · 0 cycles · 0 violations** |
| Production build | ✅ |

## Status
**RC-1 is eliminated and verified on production.** `cashback_balance` and
`driver_wallet_summary` were audited and confirmed already safe (SECURITY INVOKER + RLS) — no
change needed. No Red Team was re-run (per instructions); no deployment, Vercel, or
infrastructure change. The full security-fix chain is now migrations
`20260801000001 … 20260801000006`. Stop after remediation.
