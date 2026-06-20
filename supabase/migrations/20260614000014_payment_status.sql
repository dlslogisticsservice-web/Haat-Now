-- 0014_payment_status.sql
-- Add payment lifecycle column to orders, orthogonal to the fulfillment status column.
-- Idempotent: ADD COLUMN IF NOT EXISTS + named constraint guarded by pg_constraint check.

alter table orders
  add column if not exists payment_status varchar(50) not null default 'unpaid';

-- Named CHECK constraint — guarded so re-running this migration is safe.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname    = 'orders_payment_status_check'
      and conrelid   = 'orders'::regclass
  ) then
    alter table orders
      add constraint orders_payment_status_check
      check (payment_status in ('unpaid', 'paid', 'refunded', 'partially_refunded'));
  end if;
end $$;
