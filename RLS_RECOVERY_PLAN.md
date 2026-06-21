# RLS_RECOVERY_PLAN.md — P0

The live audit found **21 public tables with RLS enabled and ZERO policies** → default-deny locks authenticated users out. This plan defines the policies that `20260614000021_rls_recovery.sql` creates. Ownership columns verified live (`information_schema.columns`); convention follows the existing working policies (`auth.uid() = <owner col>`).

## Affected tables (RLS=on, policy_count=0)
`admin_users, audit_logs, cities, countries, coupon_usages, coupons, driver_locations, drivers, favorites, memberships, notifications, order_items, orders, permissions, reviews, role_permissions, settings, subscriptions, wallet_transactions, wallets, webhook_events`

## Per-table remediation
| Table | Risk if unfixed | Required policies (name → purpose) |
|---|---|---|
| **orders** | 🔴 Customers can't read/place orders; drivers can't see jobs; merchants can't see branch orders; admins can't scope | `Customers read own orders` (SELECT customer_id=uid) · `Customers create own orders` (INSERT) · `Customers update own orders` (UPDATE) · `Drivers read assigned orders` (driver_id=uid) · `Drivers update assigned orders` · `Merchants read branch orders` (branch∈own) · `Merchants update branch orders` · `Admins read orders by scope` (0018 — super/all or `order_country_code(id)=auth_admin_country()`) |
| **order_items** | 🔴 Order contents invisible; checkout insert blocked | `Read items of visible orders` (order_id∈orders) · `Insert items for own orders` |
| **wallets** | 🔴 Wallet balance unreadable | `Owners read own wallet` (owner_id=uid, SELECT only — writes via `adjust_wallet_balance` DEFINER) |
| **wallet_transactions** | 🟠 Ledger unreadable | `Read own wallet transactions` (wallet_id∈own wallets) |
| **notifications** | 🔴 Notifications + read-tracking broken | `Read own notifications` (target_user_id=uid) · `Mark own notifications read` (UPDATE) |
| **favorites** | 🟠 Favoriting blocked | `Manage own favorites` (ALL customer_id=uid) |
| **reviews** | 🔴 Ratings unreadable; submit blocked | `Read all reviews` (SELECT true) · `Create own reviews` (INSERT customer_id=uid) · `Update own reviews` |
| **drivers** | 🔴 Order tracking can't show driver; driver profile locked | `Read drivers` (SELECT true — 0019 granted select) · `Drivers insert own profile` · `Drivers update own profile` (id=uid) |
| **driver_locations** | 🟠 Live tracking blocked | `Read driver locations` (SELECT true) · `Drivers insert own location` · `Drivers update own location` (driver_id=uid) |
| **subscriptions** | 🟢 Memberships unusable | `Manage own subscriptions` (ALL customer_id=uid) |
| **coupons** | 🔴 Coupon apply at checkout blocked | `Read active coupons` (SELECT anon+auth where is_active) · `Admins manage coupons` (ALL auth_is_admin) |
| **coupon_usages** | 🟠 Usage tracking blocked | `Read usages of visible orders` · `Insert usage for own order` |
| **countries / cities / memberships** | 🟠 Reference reads blocked (country/currency/zone) | `Public read <t>` (SELECT anon+auth true) |
| **permissions / role_permissions** | 🟢 RBAC reference reads blocked | `Authenticated read <t>` (SELECT true) |
| **settings** | 🟠 App settings unreadable | `Authenticated read settings` (SELECT) · `Admins manage settings` (ALL auth_is_admin) |
| **admin_users** | 🔴 Admin roster invisible; 0018 scoping missing | `Admins read admin roster by scope` (0018 — self or super/same-country) |
| **audit_logs / webhook_events** | 🟢 Admin visibility only | `Admins read <t>` (SELECT auth_is_admin) — no client writes |

## Design notes
- **Writes to money/ledger tables stay closed** — `wallets`/`wallet_transactions` get SELECT-only policies; balance changes flow through the `adjust_wallet_balance`/`complete_delivery` DEFINER RPCs (consistent with 0019's read-only grants).
- **Subquery reuse** — `order_items`/`coupon_usages`/`wallet_transactions` policies use `… in (select id from <parent>)`, which is filtered by the parent table's RLS — one source of truth for visibility (mirrors the existing `order_status_history` policy).
- **No recursion** — the `orders` admin policy calls `order_country_code(id)`, which must be `SECURITY DEFINER` (migration `0022`) so its internal `select from orders` bypasses RLS. `auth_is_admin/scope/country` are already DEFINER. → apply `0022` before/with `0021`.
- **Idempotent** — each policy is `drop policy if exists` then `create policy`, safe to re-run.
