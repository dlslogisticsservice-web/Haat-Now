-- ─────────────────────────────────────────────────────────────────────────────
-- Query optimization — composite indexes on the hottest read paths (order lists,
-- kitchen queue, dispatch board, driver jobs, notification center, ledgers).
-- Each index is created ONLY if every referenced column exists (a temp guard
-- function), so this migration is safe to apply regardless of minor schema drift —
-- an index whose columns are absent is simply skipped, never an error.
-- All use IF NOT EXISTS so re-applying is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function pg_temp._mk_index(tbl text, cols text[], ddl text)
returns void language plpgsql as $$
declare c text;
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = tbl) then
    return;
  end if;
  foreach c in array cols loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = tbl and column_name = c) then
      return; -- a referenced column is missing → skip this index
    end if;
  end loop;
  execute ddl;
end $$;

-- Orders: customer history, merchant kitchen queue, driver jobs, admin dispatch board
select pg_temp._mk_index('orders', array['customer_id','created_at'],
  'create index if not exists idx_orders_customer_created on public.orders (customer_id, created_at desc)');
select pg_temp._mk_index('orders', array['merchant_id','status'],
  'create index if not exists idx_orders_merchant_status on public.orders (merchant_id, status)');
select pg_temp._mk_index('orders', array['driver_id','status'],
  'create index if not exists idx_orders_driver_status on public.orders (driver_id, status)');
select pg_temp._mk_index('orders', array['status','created_at'],
  'create index if not exists idx_orders_status_created on public.orders (status, created_at desc)');

-- Order items join
select pg_temp._mk_index('order_items', array['order_id'],
  'create index if not exists idx_order_items_order on public.order_items (order_id)');

-- Catalog
select pg_temp._mk_index('products', array['merchant_id'],
  'create index if not exists idx_products_merchant on public.products (merchant_id)');
select pg_temp._mk_index('products', array['category_id'],
  'create index if not exists idx_products_category on public.products (category_id)');

-- Notification center
select pg_temp._mk_index('notifications', array['user_id','created_at'],
  'create index if not exists idx_notifications_user_created on public.notifications (user_id, created_at desc)');
select pg_temp._mk_index('notifications', array['user_id','is_read'],
  'create index if not exists idx_notifications_user_unread on public.notifications (user_id, is_read)');

-- Reviews aggregation
select pg_temp._mk_index('reviews', array['merchant_id'],
  'create index if not exists idx_reviews_merchant on public.reviews (merchant_id)');
select pg_temp._mk_index('reviews', array['order_id'],
  'create index if not exists idx_reviews_order on public.reviews (order_id)');

-- Addresses + push tokens lookups
select pg_temp._mk_index('addresses', array['customer_id'],
  'create index if not exists idx_addresses_customer on public.addresses (customer_id)');
select pg_temp._mk_index('push_tokens', array['user_id'],
  'create index if not exists idx_push_tokens_user on public.push_tokens (user_id)');

-- Wallet ledger
select pg_temp._mk_index('wallet_transactions', array['wallet_id','created_at'],
  'create index if not exists idx_wallet_tx_wallet_created on public.wallet_transactions (wallet_id, created_at desc)');
