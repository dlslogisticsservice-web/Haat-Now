-- ─────────────────────────────────────────────────────────────────────────────
-- Phase-1 DB stabilization — hot-path index reconciliation.
--
-- 20260627000002_performance_indexes.sql declared several indexes against column
-- names that do not exist on this schema (`user_id`, `merchant_id`) and its column
-- guard SILENTLY SKIPPED them — so the notification-center, kitchen-queue and
-- catalog-by-branch hot paths shipped WITHOUT their intended indexes. (This was a
-- silent gap, not an error: 000002 is guarded and never fails.)
--
-- This migration adds the SAME indexes using the ACTUAL column names, verified
-- against the live schema on 2026-07-04:
--   notifications(target_user_id, is_read, created_at)   -- not `user_id`
--   orders(branch_id, status)                             -- orders link to merchant via branch_id, not `merchant_id`
--   products(branch_id)                                   -- products link to merchant via branch_id, not `merchant_id`
--
-- Idempotent (IF NOT EXISTS) and column-guarded (same helper idiom as 000002), so it
-- is safe to apply on any environment regardless of minor schema drift — an index
-- whose columns are absent is simply skipped, never an error. Purely additive: it
-- adds read indexes only, changes no data, and affects no existing object.
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
      return; -- a referenced column is missing → skip this index (never error)
    end if;
  end loop;
  execute ddl;
end $$;

-- Notification center: per-user timeline + unread badge (real column: target_user_id)
select pg_temp._mk_index('notifications', array['target_user_id','created_at'],
  'create index if not exists idx_notifications_target_created on public.notifications (target_user_id, created_at desc)');
select pg_temp._mk_index('notifications', array['target_user_id','is_read'],
  'create index if not exists idx_notifications_target_unread on public.notifications (target_user_id, is_read)');

-- Kitchen queue / merchant order board (orders → merchant via branch_id)
select pg_temp._mk_index('orders', array['branch_id','status'],
  'create index if not exists idx_orders_branch_status on public.orders (branch_id, status)');

-- Catalog by branch (products → merchant via branch_id)
select pg_temp._mk_index('products', array['branch_id'],
  'create index if not exists idx_products_branch on public.products (branch_id)');
