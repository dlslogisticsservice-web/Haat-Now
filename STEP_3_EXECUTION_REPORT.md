# STEP_3_EXECUTION_REPORT.md — LIVE EXECUTION

Live execution of `EXECUTION_RUNBOOK.md` STEP 3 against **`umwbzradvbsirsybfxfb` (haat-now-dev)** via Management API `/database/query` (as `postgres`). Real write. Steps 4–6 NOT executed (held per instruction).

## Result: ✅ STEP 3 = PASS

## STEP 3 — Apply `20260614000020_feature_persistence.sql`
**Apply result:** `HTTP 201` → `[]` (DDL).

| # | Verify item | Query | Expected | Actual | Result |
|---|---|---|---|---|---|
| 1 | **Loyalty + inventory RPCs** present + DEFINER | `pg_proc` for the 5 RPCs | 5 rows, `prosecdef=t` | `adjust_product_stock`, `award_loyalty_points`, `loyalty_balance`, `redeem_loyalty_points`, `validate_coupon` — all `prosecdef=true` | ✅ |
| 2 | **`loyalty_transactions`** + **`stock_movements`** tables | `information_schema.tables` | 2 rows | both present | ✅ |
| 3 | **Coupon persistence** cols | `coupons` cols | `country_code,expires_at,max_uses,used_count` | present (4) | ✅ |
| 3 | **Notification persistence** cols | `notifications` cols | `is_read,created_at` | present (2) | ✅ |
| 3 | Inventory cols | `products` cols | `stock,low_stock_threshold,is_active` | present (3) | ✅ |
| 4 | **Loyalty RPC executes** | `select loyalty_balance('…')` | `0` | `0` | ✅ |
| 4 | **Coupon RPC executes** | `select validate_coupon('NONEXISTENT','EG') is null` | `true` | `true` | ✅ |
| 5 | New-table RLS + policy + index | `pg_class`/`pg_policies`/`pg_indexes` | RLS on, ≥1 policy, ≥2 idx each | `loyalty_transactions` rls=t, 1 policy, 2 idx · `stock_movements` rls=t, 1 policy, 2 idx | ✅ |

**Column total:** 9 (products 3 + coupons 4 + notifications 2) — matches expected.

## Requested verification items — all PASS
- **loyalty_transactions** ✅ table + RLS enabled + 2 indexes + read policy
- **stock_movements** ✅ table + RLS enabled + 2 indexes + read policy
- **loyalty RPCs** ✅ `loyalty_balance`/`award_loyalty_points`/`redeem_loyalty_points` present, DEFINER, `loyalty_balance` executes → 0
- **inventory RPCs** ✅ `adjust_product_stock` present, DEFINER
- **coupon persistence** ✅ `max_uses,used_count,expires_at,country_code` added
- **notification persistence** ✅ `is_read,created_at` added

## Failures
- **None.** Applied first-try; all verifications passed.

## Warnings
- Writes went through the **Management API** (token has full access — keep rotated), not the read-only MCP server.
- `coupons.is_active`/`created_at` and `notifications.created_at` pre-existed from earlier migrations; 0020's `add column if not exists` left them intact — no conflict.

## Rollback status
- **Not invoked** — STEP 3 PASS. Rollback available per `EXECUTION_RUNBOOK.md` (drop 5 functions + 2 tables; columns are additive). Migration is idempotent.

## State after Steps 1–3
- order_country_code = DEFINER ✅ · 21 tables RLS-policied (80 total) ✅ · feature persistence live (2 tables, 5 RPCs, 9 cols) ✅.
- The inventory/coupon/loyalty/notification service layer now has its real backend.

## Held (NOT executed — per instruction "do not continue to STEP 4")
- STEP 4 (phone provider), STEP 5 (RBAC provisioning), STEP 6 (validation).
- **Recommended pending:** record `0018–0022` in `supabase_migrations.schema_migrations` (the runbook groups this with Steps 1–3; held since this turn was scoped to STEP 3 only).

**STEP 3 = PASS. Stopped as instructed; awaiting go-ahead for STEP 4.**
