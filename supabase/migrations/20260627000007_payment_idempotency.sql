-- ─────────────────────────────────────────────────────────────────────────────
-- Payment idempotency / locks — durable duplicate-request protection at payment
-- INITIATION (complements webhook_events, which dedups inbound provider callbacks).
-- The unique idempotency_key acts as the lock: a second initiate for the same key
-- collides and returns the original result instead of double-charging.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_idempotency (
  id              uuid primary key default uuid_generate_v4(),
  idempotency_key text unique not null,        -- e.g. initiate:<orderId>
  order_id        uuid,
  customer_id     uuid,
  status          text default 'locked',        -- locked | completed | failed
  result          jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.payment_idempotency enable row level security;

-- A signed-in user may create/read their own idempotency record (key is order-scoped
-- and unguessable). Admins see all.
drop policy if exists payment_idempotency_owner on public.payment_idempotency;
create policy payment_idempotency_owner on public.payment_idempotency for all
  using (customer_id = auth.uid() or public.auth_is_admin())
  with check (customer_id = auth.uid() or public.auth_is_admin());

create index if not exists idx_payment_idempotency_order on public.payment_idempotency (order_id);
