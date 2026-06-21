# MCP_DATABASE_AUDIT.md — Phase 2 (read-only)

Live read-only audit of project `umwbzradvbsirsybfxfb` via the Supabase Management API `/database/query` (same read path as MCP `execute_sql`). No writes, no DDL.

## Item-by-item PASS / FAIL
| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Project identity | ✅ PASS | `umwbzradvbsirsybfxfb` → **haat-now-dev**, eu-west-1, ACTIVE_HEALTHY, PG 17.6 |
| 2 | Migration state | ⚠️ PARTIAL | `schema_migrations` records **0000–0017 only**; **0018, 0019, 0020 NOT recorded** |
| 3 | `admin_users` structure | ✅ PASS | columns: id, email, full_name, created_at, updated_at, **user_id, scope, country_code** (0018 cols present) |
| 4 | `order_country_code` | ❌ **FAIL** | exists, args `p_order_id uuid`, **`prosecdef = false`** (SECURITY INVOKER → admin-orders RLS recursion) |
| 5 | `auth_is_admin` | ✅ PASS | exists, `prosecdef = true` |
| 6 | `auth_admin_scope` | ✅ PASS | exists, `prosecdef = true` |
| 7 | `auth_admin_country` | ✅ PASS | exists, `prosecdef = true` |
| 8 | Authenticated grants (0019) | ✅ PASS | grants present on orders(INSERT,SELECT,UPDATE), order_items, notifications(SELECT,UPDATE), wallets(SELECT), customer_carts/cart_items/favorites/addresses(full CRUD) |
| 9 | RLS policies | ❌ **FAIL (critical)** | **21 RLS-enabled tables have 0 policies** (see below) → default-deny locks authenticated users out |
| 10 | Admin country scoping | ❌ **FAIL** | 0018 policy **"Admins read orders by scope" is ABSENT** — `pg_policies` for `orders` & `admin_users` returns **empty** |
| 11 | `wallets` | ❌ locked | RLS on, **0 policies**; grant is SELECT-only but RLS denies all rows |
| 12 | `notifications` | ❌ locked | RLS on, **0 policies** |
| 13 | `orders` | ❌ locked | RLS on, **0 policies** |
| 14 | `customer_carts` | ✅ PASS | RLS on, **1 policy** ("Customers can manage their own cart", ALL) |
| 15 | RBAC readiness (data) | ❌ FAIL | roles seeded (`customer,driver,merchant,admin`) ✅ but **user_roles=0, admin_users=0, auth.users=0, customers=0, drivers=0** (only 5 catalog merchants) |

## 🔴 Critical finding — RLS-enabled tables with ZERO policies (default-deny)
These tables have `relrowsecurity = true` and **no policy**, so an authenticated (`authenticated`) user can read/write **nothing** on them regardless of the 0019 grants:
```
admin_users, audit_logs, cities, countries, coupon_usages, coupons,
driver_locations, drivers, favorites, memberships, notifications,
order_items, orders, permissions, reviews, role_permissions, settings,
subscriptions, wallet_transactions, wallets, webhook_events
```
Impact: in production (`supabase` mode) a real customer **cannot read their own orders, place an order (`order_items`), view their wallet, see notifications, leave a review, favorite, or be matched to a driver** — the core transactional surface is locked. Tables that DO have policies (working): customers, addresses, cart_items, customer_carts, products(4), product_variants(4), merchants, merchant_branches, categories, offers, banners, zones, push_tokens, payment_*, support_*, driver_earnings, order_status_history, user_roles, roles, refunds (41 policies total across the schema).

**Interpretation:** Migration **0018 is only partially applied** — its functions (`auth_is_admin/scope/country`) and `admin_users` columns landed, but its **RLS policies did not**. More broadly, the base customer/owner RLS policies for `orders/order_items/wallets/notifications/reviews/favorites/drivers` are missing from the live DB (drift or never-applied), beyond what 0018/0019/0020 cover.

## Phase 2 verdict
**FAIL** — DB is reachable and partly provisioned, but **RLS policy coverage on the core transactional tables is missing** (most severe), `order_country_code` is INVOKER, 0018/0019/0020 are unrecorded, and **no auth users / role assignments exist**. Read-only audit only — nothing modified.
