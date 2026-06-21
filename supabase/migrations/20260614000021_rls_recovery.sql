-- ─────────────────────────────────────────────────────────────────────────────
-- 20260614000021_rls_recovery.sql
-- P0 RECOVERY: 21 public tables have RLS ENABLED with ZERO policies (default-deny),
-- locking authenticated users out of the core transactional surface
-- (orders/order_items/wallets/wallet_transactions/notifications/reviews/favorites/
-- drivers/driver_locations/coupons/coupon_usages/subscriptions/admin_users + ref
-- tables). This migration creates the missing owner/role/admin/reference policies,
-- INCLUDING the 0018 admin-scoping policies that never landed (orders, admin_users).
--
-- Compatibility:
--   • 0018 — re-creates its admin policies idempotently; uses auth_is_admin/
--     auth_admin_scope/auth_admin_country (DEFINER, already live).
--   • 0019 — grants are table privileges; these are row policies. Together they
--     unlock access. No grant is altered here.
--   • 0020 — touches none of 0020's tables/columns; coupons read policy uses
--     is_active (pre-0020). Independent; any apply order works.
--   • Requires 20260614000022 (order_country_code → DEFINER) applied first so the
--     admin-orders policy does not recurse.
-- Idempotent: every policy is dropped-if-exists then created. NOT executed here.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── helper: writes go through SECURITY DEFINER RPCs; money tables stay read-only ──

-- ============================== ORDERS ==============================
drop policy if exists "Customers read own orders"   on public.orders;
create policy "Customers read own orders" on public.orders
  for select to authenticated using (customer_id = auth.uid());

drop policy if exists "Customers create own orders" on public.orders;
create policy "Customers create own orders" on public.orders
  for insert to authenticated with check (customer_id = auth.uid());

drop policy if exists "Customers update own orders" on public.orders;
create policy "Customers update own orders" on public.orders
  for update to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());

drop policy if exists "Drivers read assigned orders" on public.orders;
create policy "Drivers read assigned orders" on public.orders
  for select to authenticated using (driver_id = auth.uid());

drop policy if exists "Drivers update assigned orders" on public.orders;
create policy "Drivers update assigned orders" on public.orders
  for update to authenticated using (driver_id = auth.uid()) with check (driver_id = auth.uid());

drop policy if exists "Merchants read branch orders" on public.orders;
create policy "Merchants read branch orders" on public.orders
  for select to authenticated
  using (branch_id in (select id from public.merchant_branches where merchant_id = auth.uid()));

drop policy if exists "Merchants update branch orders" on public.orders;
create policy "Merchants update branch orders" on public.orders
  for update to authenticated
  using (branch_id in (select id from public.merchant_branches where merchant_id = auth.uid()))
  with check (branch_id in (select id from public.merchant_branches where merchant_id = auth.uid()));

-- 0018 admin country scoping (recovered). Needs order_country_code = DEFINER (0022).
drop policy if exists "Admins read orders by scope" on public.orders;
create policy "Admins read orders by scope" on public.orders
  for select to authenticated
  using (public.auth_is_admin() and (
    public.auth_admin_scope() = 'super'
    or public.order_country_code(id) = public.auth_admin_country()
  ));

-- ============================== ORDER_ITEMS ==============================
-- Visible when the parent order is visible (reuses orders RLS via the subquery).
drop policy if exists "Read items of visible orders" on public.order_items;
create policy "Read items of visible orders" on public.order_items
  for select to authenticated using (order_id in (select id from public.orders));

drop policy if exists "Insert items for own orders" on public.order_items;
create policy "Insert items for own orders" on public.order_items
  for insert to authenticated
  with check (order_id in (select id from public.orders where customer_id = auth.uid()));

-- ============================== WALLETS (read-only; writes via RPC) ==============================
drop policy if exists "Owners read own wallet" on public.wallets;
create policy "Owners read own wallet" on public.wallets
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists "Read own wallet transactions" on public.wallet_transactions;
create policy "Read own wallet transactions" on public.wallet_transactions
  for select to authenticated using (wallet_id in (select id from public.wallets));

-- ============================== NOTIFICATIONS ==============================
drop policy if exists "Read own notifications" on public.notifications;
create policy "Read own notifications" on public.notifications
  for select to authenticated using (target_user_id = auth.uid());

drop policy if exists "Mark own notifications read" on public.notifications;
create policy "Mark own notifications read" on public.notifications
  for update to authenticated using (target_user_id = auth.uid()) with check (target_user_id = auth.uid());

-- ============================== FAVORITES ==============================
drop policy if exists "Manage own favorites" on public.favorites;
create policy "Manage own favorites" on public.favorites
  for all to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- ============================== REVIEWS ==============================
drop policy if exists "Read all reviews" on public.reviews;
create policy "Read all reviews" on public.reviews
  for select to authenticated using (true);

drop policy if exists "Create own reviews" on public.reviews;
create policy "Create own reviews" on public.reviews
  for insert to authenticated with check (customer_id = auth.uid());

drop policy if exists "Update own reviews" on public.reviews;
create policy "Update own reviews" on public.reviews
  for update to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- ============================== DRIVERS ==============================
-- Readable by authenticated (order tracking shows driver name/phone; 0019 granted select).
drop policy if exists "Read drivers" on public.drivers;
create policy "Read drivers" on public.drivers
  for select to authenticated using (true);

drop policy if exists "Drivers insert own profile" on public.drivers;
create policy "Drivers insert own profile" on public.drivers
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "Drivers update own profile" on public.drivers;
create policy "Drivers update own profile" on public.drivers
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ============================== DRIVER_LOCATIONS ==============================
drop policy if exists "Read driver locations" on public.driver_locations;
create policy "Read driver locations" on public.driver_locations
  for select to authenticated using (true);

drop policy if exists "Drivers insert own location" on public.driver_locations;
create policy "Drivers insert own location" on public.driver_locations
  for insert to authenticated with check (driver_id = auth.uid());

drop policy if exists "Drivers update own location" on public.driver_locations;
create policy "Drivers update own location" on public.driver_locations
  for update to authenticated using (driver_id = auth.uid()) with check (driver_id = auth.uid());

-- ============================== SUBSCRIPTIONS ==============================
drop policy if exists "Manage own subscriptions" on public.subscriptions;
create policy "Manage own subscriptions" on public.subscriptions
  for all to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- ============================== COUPONS ==============================
drop policy if exists "Read active coupons" on public.coupons;
create policy "Read active coupons" on public.coupons
  for select to anon, authenticated using (is_active);

drop policy if exists "Admins manage coupons" on public.coupons;
create policy "Admins manage coupons" on public.coupons
  for all to authenticated using (public.auth_is_admin()) with check (public.auth_is_admin());

-- ============================== COUPON_USAGES ==============================
drop policy if exists "Read usages of visible orders" on public.coupon_usages;
create policy "Read usages of visible orders" on public.coupon_usages
  for select to authenticated using (order_id in (select id from public.orders));

drop policy if exists "Insert usage for own order" on public.coupon_usages;
create policy "Insert usage for own order" on public.coupon_usages
  for insert to authenticated
  with check (order_id in (select id from public.orders where customer_id = auth.uid()));

-- ============================== REFERENCE (public read) ==============================
drop policy if exists "Public read countries" on public.countries;
create policy "Public read countries" on public.countries for select to anon, authenticated using (true);

drop policy if exists "Public read cities" on public.cities;
create policy "Public read cities" on public.cities for select to anon, authenticated using (true);

drop policy if exists "Public read memberships" on public.memberships;
create policy "Public read memberships" on public.memberships for select to anon, authenticated using (true);

drop policy if exists "Authenticated read permissions" on public.permissions;
create policy "Authenticated read permissions" on public.permissions for select to authenticated using (true);

drop policy if exists "Authenticated read role_permissions" on public.role_permissions;
create policy "Authenticated read role_permissions" on public.role_permissions for select to authenticated using (true);

drop policy if exists "Authenticated read settings" on public.settings;
create policy "Authenticated read settings" on public.settings for select to authenticated using (true);
drop policy if exists "Admins manage settings" on public.settings;
create policy "Admins manage settings" on public.settings
  for all to authenticated using (public.auth_is_admin()) with check (public.auth_is_admin());

-- ============================== ADMIN_USERS (0018 roster, recovered) ==============================
drop policy if exists "Admins read admin roster by scope" on public.admin_users;
create policy "Admins read admin roster by scope" on public.admin_users
  for select to authenticated
  using (
    user_id = auth.uid()
    or (public.auth_is_admin() and (public.auth_admin_scope() = 'super' or country_code = public.auth_admin_country()))
  );

-- ============================== AUDIT / SYSTEM (admin read; no client writes) ==============================
drop policy if exists "Admins read audit_logs" on public.audit_logs;
create policy "Admins read audit_logs" on public.audit_logs for select to authenticated using (public.auth_is_admin());

drop policy if exists "Admins read webhook_events" on public.webhook_events;
create policy "Admins read webhook_events" on public.webhook_events for select to authenticated using (public.auth_is_admin());

-- Verify: select tablename, count(*) from pg_policies where schemaname='public'
--   and tablename in ('orders','order_items','wallets','wallet_transactions','notifications',
--   'reviews','favorites','drivers','driver_locations','subscriptions','coupons','coupon_usages',
--   'countries','cities','memberships','permissions','role_permissions','settings','admin_users',
--   'audit_logs','webhook_events') group by tablename order by tablename;  -- all > 0
