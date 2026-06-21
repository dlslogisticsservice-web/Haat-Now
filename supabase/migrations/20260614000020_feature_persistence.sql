-- ─────────────────────────────────────────────────────────────────────────────
-- 20260614000020_feature_persistence.sql
-- Backend persistence for the completed features (inventory, coupons, loyalty,
-- notifications). Mirrors the sandboxStore behavior with real tables + RPCs.
-- Idempotent / safe to re-run. NOT YET APPLIED — prepared for the Supabase cutover.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. INVENTORY ────────────────────────────────────────────────────────────
alter table public.products add column if not exists stock                integer not null default 0;
alter table public.products add column if not exists low_stock_threshold  integer not null default 5;
alter table public.products add column if not exists is_active            boolean not null default true;

create table if not exists public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  delta       integer not null,
  reason      varchar(120),
  created_at  timestamptz not null default now()
);
create index if not exists idx_stock_movements_product on public.stock_movements(product_id, created_at desc);

-- Adjust stock atomically + record the movement + auto out-of-stock toggle.
create or replace function public.adjust_product_stock(p_product_id uuid, p_delta integer, p_reason varchar default 'تعديل يدوي')
returns integer language plpgsql security definer set search_path = public as $$
declare v_new integer;
begin
  update public.products
     set stock = greatest(0, stock + p_delta),
         is_active = (greatest(0, stock + p_delta) > 0)
   where id = p_product_id
   returning stock into v_new;
  if v_new is null then raise exception 'product not found'; end if;
  insert into public.stock_movements(product_id, delta, reason) values (p_product_id, p_delta, p_reason);
  return v_new;
end; $$;

-- ── 2. COUPONS (extend) ─────────────────────────────────────────────────────
alter table public.coupons add column if not exists max_uses     integer not null default 0;   -- 0 = unlimited
alter table public.coupons add column if not exists used_count   integer not null default 0;
alter table public.coupons add column if not exists expires_at   date;
alter table public.coupons add column if not exists country_code varchar(5);                   -- null = all countries
alter table public.coupons add column if not exists is_active    boolean not null default true;
alter table public.coupons add column if not exists created_at   timestamptz not null default now();

-- Validate a coupon for a country; returns the row when usable, else null.
create or replace function public.validate_coupon(p_code varchar, p_country varchar default null)
returns public.coupons language sql stable security definer set search_path = public as $$
  select c.* from public.coupons c
  where upper(c.code) = upper(p_code)
    and c.is_active
    and (c.expires_at is null or c.expires_at >= current_date)
    and (c.max_uses = 0 or c.used_count < c.max_uses)
    and (c.country_code is null or c.country_code = p_country)
  limit 1;
$$;

-- ── 3. LOYALTY / REWARDS ────────────────────────────────────────────────────
create table if not exists public.loyalty_transactions (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  points      integer not null,                 -- positive = earn, negative = redeem
  reason      varchar(160),
  created_at  timestamptz not null default now()
);
create index if not exists idx_loyalty_customer on public.loyalty_transactions(customer_id, created_at desc);

-- Current points balance for a customer.
create or replace function public.loyalty_balance(p_customer_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(points), 0)::integer from public.loyalty_transactions where customer_id = p_customer_id;
$$;

-- Award points (e.g. on delivery).
create or replace function public.award_loyalty_points(p_customer_id uuid, p_points integer, p_reason varchar)
returns integer language plpgsql security definer set search_path = public as $$
begin
  insert into public.loyalty_transactions(customer_id, points, reason) values (p_customer_id, p_points, p_reason);
  return public.loyalty_balance(p_customer_id);
end; $$;

-- Redeem points (guards against negative balance). Returns new balance, or -1 if insufficient.
create or replace function public.redeem_loyalty_points(p_customer_id uuid, p_points integer, p_reason varchar)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if public.loyalty_balance(p_customer_id) < p_points then return -1; end if;
  insert into public.loyalty_transactions(customer_id, points, reason) values (p_customer_id, -p_points, p_reason);
  return public.loyalty_balance(p_customer_id);
end; $$;

-- ── 4. NOTIFICATIONS (extend) ───────────────────────────────────────────────
alter table public.notifications add column if not exists is_read    boolean not null default false;
alter table public.notifications add column if not exists created_at timestamptz not null default now();

-- ── 5. GRANTS (authenticated) ───────────────────────────────────────────────
grant select on public.stock_movements, public.loyalty_transactions to authenticated;
grant select, insert, update on public.coupons to authenticated;   -- admin writes constrained by RLS
grant execute on function public.adjust_product_stock(uuid, integer, varchar) to authenticated;
grant execute on function public.validate_coupon(varchar, varchar)            to authenticated;
grant execute on function public.loyalty_balance(uuid)                        to authenticated;
grant execute on function public.award_loyalty_points(uuid, integer, varchar) to authenticated;
grant execute on function public.redeem_loyalty_points(uuid, integer, varchar) to authenticated;

-- ── 6. RLS (mirror existing posture; admins/owners only for writes) ─────────
alter table public.stock_movements      enable row level security;
alter table public.loyalty_transactions enable row level security;
do $$ begin
  create policy "read own loyalty" on public.loyalty_transactions for select to authenticated using (customer_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read stock movements" on public.stock_movements for select to authenticated using (true);
exception when duplicate_object then null; end $$;
