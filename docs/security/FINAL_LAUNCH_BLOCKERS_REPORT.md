# Final Launch Blockers Report

Eliminates the four remaining findings from the Final Independent Security Certification
(`FINAL_SECURITY_CERTIFICATION_REPORT.md`): **C-1**, **C-2** (Medium) and **C-3**, **C-4** (Low).
Scope was strictly these four — no features, no architecture changes, no certified module touched.
One DB migration (applied to prod `haat-now-prod`) + a regression suite. **No app code changed**
(RPC signatures preserved; ops/self call-sites still pass). Guards use `auth.uid()`/`is_ops_admin()`
(not `current_user`, which inside a `SECURITY DEFINER` function is the owner).

## C-1 — Driver shift / presence manipulation — ELIMINATED
`start_shift`, `end_shift`, `start_break`, `end_break` now enforce ownership:
- `auth.uid()` required.
- **`start_shift`** rejects an arbitrary `p_driver_id` — caller must own the driver
  (`drivers.id = auth.uid()` or `owner_user_id = auth.uid()`) or be ops.
- **`end_shift` / `start_break` / `end_break`** reject an arbitrary `p_shift_id` — the shift is
  resolved to its driver and the caller must own that driver (or be ops).
- Only Operations Admin (`is_ops_admin()`) may bypass ownership.
- No caller can force another driver's `status` / `is_online` / break state / shift state.
- Tenant/country are covered transitively: ownership binds the caller to their **own** driver row,
  which carries its own tenant (drivers have no per-row country column; country derives from tenant).

**Proof (live):** an attacker's `start_shift(victim)` and `end_shift(victim_shift)` both raised;
the victim driver stayed `is_online = false`; a driver's own `start_shift(self)` still works.

## C-2 — Review / rating manipulation — ELIMINATED
`submit_review` now validates, before inserting an approved review:
1. the order belongs to `auth.uid()`;
2. for a **driver** target, `p_target_id` equals the order's `driver_id`;
3. for a **merchant** target, `p_target_id` owns the order's branch (`merchant_branches`);
4. duplicate abuse rejected — `UNIQUE (order_id, target_type, target_id)`, and only the original
   author may update (idempotent re-submit);
5. forged target ids rejected (checks 2/3);
6. reviews for `cancelled` orders rejected;
7. reviews before delivery rejected (order must be `delivered`);
8. idempotency maintained (upsert of the author's own review);
9. rating manipulation impossible — only a genuine customer of a delivered order can review the
   order's actual driver/merchant; `drivers.rating` is recomputed only from approved reviews.

**Proof (live):** reviewing a foreign order, a non-order (forged) target, a pre-delivery order, and
a cancelled order **all raised**; a legit driver review and merchant review succeeded; the real
target's rating became `5.00`; a forged review left the other driver's rating unchanged (`5`).

## C-3 — `set_default_address` ownership — ELIMINATED
Added an explicit `auth.uid()` ownership check (or ops); a caller can no longer alter another
customer's default address. **Proof (live):** attacker call on a victim's address raised; the
victim's default was unchanged.

## C-4 — Maintenance RPC authorization — ELIMINATED
`recalc_merchant_performance` and `recompute_customer_segments` gained a body gate allowing only
service context (`auth.uid()` null) or Operations Admin; `EXECUTE` revoked from `anon`/`public`
on all three maintenance RPCs. (`recalc_all_merchant_performance` already carried an
`is_ops_admin()` guard; only its client surface was tightened.) The only internal caller
(`cron_recompute_segments`) runs in a cron/owner context (`auth.uid()` null) and is unaffected;
the ops dashboards (`recompute_customer_segments`, `recalc_all_merchant_performance`) run as an
authenticated admin and pass. **Proof (live):** a non-admin authenticated user calling
`recalc_merchant_performance` and `recompute_customer_segments` both raised; anon EXECUTE is revoked.

## Files modified
- **Migration added:** `supabase/migrations/20260801000005_final_launch_blockers.sql` (applied to
  prod; history reconciled to a single canonical row `20260801000005`).
- **Regression suite added:** `supabase/tests/final_launch_blockers_regression.sql`.
- **Application code:** none (all fixes are SQL RPC-level; signatures unchanged).

## RPCs modified
`start_shift`, `end_shift`, `start_break`, `end_break`, `submit_review`, `set_default_address`,
`recompute_customer_segments`, `recalc_merchant_performance`.

## Policies changed
None. (All fixes are function-level authorization; no RLS policy was added or dropped.)
`EXECUTE` grants tightened: `recompute_customer_segments`, `recalc_merchant_performance`,
`recalc_all_merchant_performance` revoked from `anon`/`public`.

## Regression tests added
`final_launch_blockers_regression.sql` (impersonated, self-cleaning) asserts:
- **C-1:** `start_shift`/`end_shift`/`start_break` on a foreign driver/shift rejected; victim not
  forced online; own-driver `start_shift` works.
- **C-2:** foreign-order, forged-target, pre-delivery, and cancelled reviews rejected; legit
  driver + merchant reviews accepted; forged review does not move another driver's rating.
- **C-3:** foreign-address `set_default_address` rejected; victim default unchanged.
- **C-4:** non-admin `recalc_merchant_performance`/`recompute_customer_segments` rejected; anon
  EXECUTE revoked on all three maintenance RPCs.

## Evidence — C-1..C-4 eliminated (live, on prod)
```
C-1 start_shift on victim blocked                = true
C-1 end_shift on victim shift blocked            = true
    victim driver still offline                  = true
C-1 legit own-driver start_shift works           = true
C-2 attacker review on foreign order blocked     = true
C-2 forged target (non-order driver) blocked     = true
C-2 review before delivery blocked               = true
C-2 review on cancelled order blocked            = true
C-2 legit driver review works / merchant works   = true / true
    real target driver rating (legit)            = 5.00
C-3 set_default_address on victim blocked        = true
C-4 recalc_merchant_performance non-admin blocked= true
C-4 recompute_customer_segments non-admin blocked= true
FINAL_LAUNCH_BLOCKERS_REGRESSION: C-1..C-4 closed
```

## Quality gates
| Gate | Result |
|---|---|
| Migration apply (prod) | ✅ clean |
| C-1..C-4 regression (impersonated + structural) | ✅ **closed** |
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| ESLint (`tsc` + architecture + demo-isolation) | ✅ clean |
| Unit + integration / business-logic tests | ✅ **777 pass / 0 fail** |
| Guardian | ✅ **544 files · 0 cycles · 0 violations** |
| Production build | ✅ |

## Status
**C-1, C-2, C-3, C-4 are all eliminated and verified on production.** No Red Team was re-run
(per instructions); no deployment, no Vercel/infrastructure change. Stop after remediation.
