# NEXT 30 DAYS — EXECUTION PLAN

Priority: **production readiness over cosmetic UI.** Four one-week sprints.

## Sprint A (Week 1) — Unblock real auth + data path  🔴 critical
1. Supabase dashboard: enable **Phone provider** + add Test OTP numbers for the 6 demo phones.
2. Apply migration **`0019_authenticated_grants`** (table GRANTs to `authenticated`) → unblocks wallet/cart/orders for logged-in users.
3. Apply the **`order_country_code` SECURITY DEFINER** fix (RLS recursion) + verify admin order reads.
4. Run `seed_demo_accounts.sql` (create auth users + `user_roles` + `admin_users` scope rows).
5. Re-run `PORTALS_RUNTIME_TEST` in `VITE_AUTH_MODE=supabase` and convert sandbox-only checks to real.
**Exit:** a real customer can log in, see catalog, place an order end-to-end.

## Sprint B (Week 2) — Real transactional flows
1. Order lifecycle in supabase mode: create → accept (driver) → on_the_way → `complete_delivery` RPC → wallet credit → notification row.
2. Verify `adjust_wallet_balance`/`complete_delivery_payout` as `SECURITY DEFINER`; wallet screens read real balances.
3. Payments: exercise `payment-initiate`/`verify`/`refund` edge functions with a real JWT (sandbox or live gateway keys).
4. Merchant: real branch/product CRUD under merchant-ownership RLS.
**Exit:** money + delivery flows verified against the real backend.

## Sprint C (Week 3) — RBAC + multi-country hardening
1. Replicate country-scoped RLS (`order_country_code` pattern) to `merchant_branches`, `payment_transactions`; denormalize `orders.country_code` (+ index) for performance.
2. Verify Super vs Egypt vs Saudi admin data isolation with real sessions (RBAC_AUDIT runtime).
3. Seed Egypt + Saudi catalog data so country admins have content.
4. Admin: turn aggregate KPIs into navigable Orders/Merchants/Drivers/Customers lists.
**Exit:** verified country isolation; admins have real, scoped data.

## Sprint D (Week 4) — Reliability + polish
1. Push notifications end-to-end (web-push/FCM token registration → `push_tokens` → send edge function).
2. Full i18n body-text coverage (Checkout/Wallet/Orders/Merchant/Driver/Admin) — wrap remaining literals.
3. Mobile drawer for merchant/admin sidebar; keyboard-safe fixed CTAs (`visualViewport`).
4. Error/empty/skeleton-state pass; device-matrix safe-area regression (iPhone SE/14, Android, tablet).
**Exit:** notifications work; 100% i18n; no overlay/keyboard regressions.

### Cross-cutting (every sprint)
- Keep `tsc`/`build` green; expand the Puppeteer runtime suite per feature; commit per slice.
- Do **not** prioritize cosmetic redesign — the marketplace UI is already in place.
