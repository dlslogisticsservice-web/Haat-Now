-- 0016_refunds.sql
-- First-class refund ledger. Each refund is stored as a separate row rather than
-- mutating payment_transactions.status, preserving the original charge record.
-- Fully idempotent: CREATE TABLE IF NOT EXISTS + DO-guarded constraints + CREATE INDEX IF NOT EXISTS.

create table if not exists refunds (
  id                 uuid         primary key default gen_random_uuid(),
  order_id           uuid                     references orders(id)           on delete set null,
  payment_attempt_id uuid                     references payment_attempts(id) on delete set null,
  amount             decimal(12,2) not null,
  currency           varchar(10)  not null default 'SAR',
  reason             text,
  status             varchar(50)  not null default 'pending',
  gateway_refund_ref varchar(255),
  initiated_by       uuid,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now()
);

-- Status domain constraint
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname  = 'refunds_status_check'
      and conrelid = 'refunds'::regclass
  ) then
    alter table refunds
      add constraint refunds_status_check
      check (status in ('pending', 'refunded', 'failed'));
  end if;
end $$;

-- Indexes
create index if not exists idx_refunds_order_id           on refunds(order_id);
create index if not exists idx_refunds_payment_attempt_id on refunds(payment_attempt_id);
create index if not exists idx_refunds_status             on refunds(status);

-- RLS
alter table refunds enable row level security;

-- Customers can see refunds on their own orders
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename  = 'refunds'
      and policyname = 'Customers can read own refunds'
  ) then
    create policy "Customers can read own refunds" on refunds
      for select to authenticated
      using (
        order_id in (
          select id from orders where customer_id = auth.uid()
        )
      );
  end if;
end $$;

-- Refund writes are admin/Edge-Function only (service_role bypasses RLS).
-- No INSERT/UPDATE policy for authenticated role intentionally — prevents
-- customers from self-issuing refunds.
