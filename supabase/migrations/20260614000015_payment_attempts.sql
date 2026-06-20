-- 0015_payment_attempts.sql
-- Tracks every individual gateway charge attempt.
-- One order may have multiple attempts (retries, different cards).
-- idempotency_key is client-generated per attempt and enforced UNIQUE to prevent double-charge.
-- Fully idempotent: CREATE TABLE IF NOT EXISTS + DO-guarded constraints + CREATE INDEX IF NOT EXISTS.

create table if not exists payment_attempts (
  id                uuid        primary key default gen_random_uuid(),
  order_id          uuid        not null references orders(id)    on delete cascade,
  customer_id       uuid                    references customers(id) on delete set null,
  provider          varchar(50) not null,
  amount            decimal(12,2) not null,
  currency          varchar(10) not null default 'SAR',
  status            varchar(50) not null default 'pending',
  idempotency_key   varchar(255) not null,
  gateway_reference varchar(255),
  raw_response      jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- UNIQUE on idempotency_key — core double-charge prevention
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname  = 'payment_attempts_idempotency_key_key'
      and conrelid = 'payment_attempts'::regclass
  ) then
    alter table payment_attempts
      add constraint payment_attempts_idempotency_key_key unique (idempotency_key);
  end if;
end $$;

-- Status domain constraint
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname  = 'payment_attempts_status_check'
      and conrelid = 'payment_attempts'::regclass
  ) then
    alter table payment_attempts
      add constraint payment_attempts_status_check
      check (status in ('pending', 'captured', 'failed', 'cancelled'));
  end if;
end $$;

-- Indexes
create index if not exists idx_payment_attempts_order_id       on payment_attempts(order_id);
create index if not exists idx_payment_attempts_customer_id    on payment_attempts(customer_id);
create index if not exists idx_payment_attempts_idempotency_key on payment_attempts(idempotency_key);
create index if not exists idx_payment_attempts_status         on payment_attempts(status);

-- RLS
alter table payment_attempts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename  = 'payment_attempts'
      and policyname = 'Customers can read own payment attempts'
  ) then
    create policy "Customers can read own payment attempts" on payment_attempts
      for select to authenticated
      using (customer_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename  = 'payment_attempts'
      and policyname = 'Customers can insert own payment attempts'
  ) then
    create policy "Customers can insert own payment attempts" on payment_attempts
      for insert to authenticated
      with check (customer_id = auth.uid());
  end if;
end $$;
