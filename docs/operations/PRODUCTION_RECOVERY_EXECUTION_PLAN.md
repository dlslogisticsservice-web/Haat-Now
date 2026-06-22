# PRODUCTION_RECOVERY_EXECUTION_PLAN.md — P0

Ordered remediation for every blocker found in the live audit (`MCP_DATABASE_AUDIT.md`, `PRODUCTION_CUTOVER_READINESS.md`). **Files only — no SQL executed.** Run phases in order; each has PASS/FAIL readiness criteria. SQL = Supabase SQL Editor; auth = dashboard.

## Artifacts produced this sprint
- `supabase/migrations/20260614000021_rls_recovery.sql` — all missing RLS policies (+ recovered 0018 admin policies).
- `supabase/migrations/20260614000022_order_country_code_fix.sql` — `order_country_code` → `SECURITY DEFINER`.
- `RLS_RECOVERY_PLAN.md` — per-table policy design.

## Execution order (dependencies)
`H3 (0022)` → `H1+H2 (0021)` → `H4 (0020)` → `H5 (auth)` → `H6 (RBAC)` → validate.
Rationale: 0021's admin-orders policy calls `order_country_code()`, which must be DEFINER first (H3). 0020 is independent of 0021/0022. Auth (H5) before RBAC (H6) so `auth.users` UIDs exist.

---

### H3 — order_country_code Recovery
- **Action:** apply `20260614000022_order_country_code_fix.sql`.
- **PASS:** `select prosecdef from pg_proc where proname='order_country_code'` → `t`.
- **FAIL:** `prosecdef=f`, or admin `select * from orders` raises `infinite recursion detected in policy for relation "orders"`.

### H1 — RLS Recovery
- **Action:** apply `20260614000021_rls_recovery.sql`.
- **PASS:** every core table has ≥1 policy:
  ```sql
  select tablename, count(*) n from pg_policies where schemaname='public'
   and tablename in ('orders','order_items','wallets','wallet_transactions','notifications',
   'reviews','favorites','drivers','driver_locations','subscriptions','coupons','coupon_usages',
   'countries','cities','memberships','permissions','role_permissions','settings','admin_users',
   'audit_logs','webhook_events') group by tablename order by tablename;  -- all n ≥ 1
  ```
  Behavioral: a provisioned customer reads only their own `orders`; a driver only assigned; wallet/notifications/reviews readable by owner.
- **FAIL:** any listed table returns 0 policies, or a customer can read another customer's orders.

### H2 — Admin Country Scoping Recovery
- **Action:** included in `0021` (`"Admins read orders by scope"` on `orders`; `"Admins read admin roster by scope"` on `admin_users`). Depends on H3.
- **PASS:** Egypt Admin reads only EG orders, Saudi Admin only SA, Super Admin all; no recursion; both policies present in `pg_policies`.
- **FAIL:** admin sees foreign-country orders, or recursion error, or policy absent.

### H4 — Migration 0020 (feature persistence)
- **Action:** apply `20260614000020_feature_persistence.sql` (unchanged; still unapplied).
- **PASS:** 2 new tables (`loyalty_transactions`,`stock_movements`); products stock cols; coupon cols (`max_uses,used_count,expires_at,country_code`); `notifications.is_read`; 5 RPCs `prosecdef=t` (`adjust_product_stock,validate_coupon,loyalty_balance,award_loyalty_points,redeem_loyalty_points`).
- **FAIL:** any table/column/RPC missing.

### H5 — Real Authentication
- **Action (dashboard):** Auth → Providers → Phone → Enable; add Test OTP for the 6 demo phones → `123456`.
- **PASS:** `external_phone_enabled=true`; `POST /auth/v1/otp {"phone":"+201000000001"}` → 200.
- **FAIL:** `phone_provider_disabled`.

### H6 — RBAC Provisioning
- **Action:** create 6 `auth.users`; run the idempotent PRECHECK→PROVISION→VERIFY from `FINAL_CUTOVER_RUNBOOK.md` Phase 3 (user_roles, admin_users, customer/driver/merchant/branch, wallets).
- **PASS:** `auth.users`=6 for the demo phones; `user_roles` effective roles = customer/merchant/driver/admin×3; `admin_users` scopes = super/null, country/EG, country/SA; no duplicate wallets.
- **FAIL:** any role unmapped, wrong scope, or 0 auth users.

---

## Compatibility verification (0018 / 0019 / 0020)
| Against | Result |
|---|---|
| **0018** | ✅ `0021` re-creates 0018's two admin policies (which never landed) idempotently and uses its live DEFINER helpers; `0022` fixes 0018's `order_country_code`. No 0018 object dropped. |
| **0019** | ✅ Grants (table privileges) are orthogonal to policies (row filters); `0021` alters no grant. Together they unlock access — grants already present, policies now added. |
| **0020** | ✅ `0021`/`0022` touch none of 0020's tables/columns/RPCs. `0021`'s `coupons` read policy uses `is_active` (pre-0020). Apply order independent; recommended H4 after H1 for clean validation. |

## Final readiness criteria (GO when all PASS)
| Blocker | Closed by | PASS check |
|---|---|---|
| RLS gap (locked tables) | H1 | all core tables ≥1 policy; owner isolation holds |
| Admin country scoping | H2 | EG/SA/Super scoping correct, no recursion |
| order_country_code INVOKER | H3 | `prosecdef=t` |
| 0020 absent | H4 | 2 tables + cols + 5 RPCs present |
| Phone provider off | H5 | OTP → 200 |
| No RBAC data | H6 | 6 users + roles + scopes verified |
| Ledger drift | H1–H4 | record `0018–0022` in `schema_migrations` after apply |

**Production Ready = YES only when H1–H6 all PASS.** This sprint generated the remediation files (`0021`, `0022`, plans) and executed **no** SQL; H3/H1/H2/H4 are DDL and H5/H6 are auth/DML — all left for the owner to run in order.
