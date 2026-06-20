# PRIORITIZED_BACKLOG.md

Ranked path to production validation. **P0 = hard blocker**, P1 = required, P2 = important, P3 = polish.
Most P0/P1 items need Supabase **dashboard or SQL-Editor access** (not available to the build environment).

## P0 — Hard blockers (nothing real is testable until these are done)
1. **Enable Phone provider + Test OTP** (dashboard). Unblocks all authenticated testing. _(BLOCKER-1/5)_
2. **Apply migration `0019_authenticated_grants`** (SQL Editor); confirm with the `role_table_grants` query. Without it, logged-in users hit `42501` everywhere. _(BLOCKER-3)_
3. **Apply `order_country_code` SECURITY DEFINER fix** (SQL Editor) — prevents admin-orders RLS recursion. _(BLOCKER-4)_
4. **Run `seed_demo_accounts.sql`** (create auth users + `user_roles` + `admin_users` scope rows) so roles resolve.

## P1 — Required production validation (once P0 done)
5. Run the **authenticated-grants proof query** (item 3 of validation) → confirm orders/order_items/wallets/notifications/favorites/addresses/customer_carts/cart_items readable by `authenticated`.
6. Verify **RPC `prosecdef`** = true for `complete_delivery`/`payout`/`adjust_wallet_balance`; alter if not. _(BLOCKER-6)_
7. **Real-mode auth E2E:** login (phone OTP) → session restore on refresh → logout → DB role resolution, for customer/merchant/driver/admin.
8. **Order lifecycle E2E:** customer places order → merchant accepts → driver accepts → `on_the_way` → `complete_delivery` → wallet credit → notification row. Assert each table mutation.
9. **Wallet lifecycle:** balance read, transaction list, payout via `complete_delivery_payout`.
10. **Admin RBAC isolation:** Egypt vs Saudi vs Super — confirm each sees only its scope (JWT-simulation query + real sessions).

## P2 — Important
11. **Dashboard real-mutation tests** (supabase mode): admin config save/ticket reply; merchant product+branch CRUD; driver accept/complete/earnings.
12. **Country-scoped RLS** replicated to `merchant_branches` + `payment_transactions`; denormalize `orders.country_code` (+ index) for performance.
13. **Seed Egypt + Saudi catalog** so country admins/customers have real data.
14. **Push notifications E2E** (token registration → `push_tokens` → send edge function). _(BLOCKER-7)_
15. **Remove/guard demo paths** before go-live: confirm `VITE_AUTH_MODE=supabase`, `PAYMENT_MODE=production`; the `SANDBOX` branches in DriverApp/MerchantApp + `DEMO_ACCOUNTS` are inert in supabase mode but should be feature-flag-audited. _(BLOCKER-8)_
16. Delete the stray unconfirmed `prodval_*@example.com` test auth user (needs service-role/dashboard).

## P3 — Polish (do NOT prioritize over P0–P2)
17. Full i18n body-text coverage (Checkout/Wallet/Orders/Merchant/Driver/Admin).
18. Mobile drawer for merchant/admin sidebar; keyboard-safe fixed CTAs.
19. Admin: turn aggregate KPIs into navigable Orders/Merchants/Drivers/Customers lists.
20. Device-matrix safe-area regression.

## Critical path
`1 → 2 → 3 → 4` (all dashboard/SQL) unlock `5–10` (real validation), then `11–14`. Items 17–20 are explicitly deprioritized below production readiness.
