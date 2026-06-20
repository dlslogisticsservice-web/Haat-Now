-- ─────────────────────────────────────────────────────────────────────────────
-- 20260614000019_authenticated_grants.sql
-- Table privileges for the `authenticated` role. RLS already restricts WHICH rows
-- a user can touch; PostgREST checks the table GRANT *before* RLS, so without
-- these grants every logged-in user gets 42501 "permission denied".
-- Least-privilege: wallet/ledger/audit tables are read-only (writes go through
-- SECURITY DEFINER RPCs); user-owned tables get full CRUD.
-- Idempotent / safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

grant usage on schema public to authenticated;

-- User-owned, fully manageable by the owner (rows constrained by RLS).
grant select, insert, update, delete on
  public.customer_carts, public.cart_items,
  public.favorites, public.reviews, public.addresses,
  public.payment_methods, public.support_tickets, public.support_messages,
  public.push_tokens, public.subscriptions
to authenticated;

-- Orders: place + update own; no hard delete from the client.
grant select, insert, update on public.orders, public.order_items, public.coupon_usages to authenticated;

-- Notifications: read + mark-as-read.
grant select, update on public.notifications to authenticated;

-- Money / ledger / audit: READ-ONLY for clients. Writes happen via RPCs
-- (adjust_wallet_balance, complete_delivery*) which run as SECURITY DEFINER.
grant select on
  public.wallets, public.wallet_transactions,
  public.payment_transactions, public.payment_attempts, public.refunds,
  public.driver_earnings, public.order_status_history
to authenticated;

-- Reference / catalog / identity: read-only for authenticated (mirrors anon).
grant select on
  public.merchants, public.merchant_branches, public.products, public.product_variants,
  public.product_images, public.offers, public.banners, public.zones, public.categories,
  public.countries, public.cities, public.coupons, public.app_config,
  public.roles, public.user_roles, public.admin_users, public.drivers
to authenticated;

-- Merchants manage their own catalog (RLS already scopes to owned branches).
grant insert, update, delete on
  public.products, public.product_variants, public.product_images,
  public.merchants, public.merchant_branches
to authenticated;

-- Drivers manage their own profile / location.
grant insert, update on public.drivers, public.driver_locations, public.driver_earnings to authenticated;

-- Execute on the deployed RPCs.
grant execute on function public.complete_delivery(uuid, uuid) to authenticated;
grant execute on function public.complete_delivery_payout(uuid, uuid, decimal) to authenticated;
grant execute on function public.adjust_wallet_balance(varchar, uuid, decimal, varchar) to authenticated;
