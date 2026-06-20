-- ─────────────────────────────────────────────────────────────────────────────
-- 20260614000018_admin_country_scoping.sql
-- Adds Super vs Country-scoped admin architecture.
--   admin_users.user_id      → links to auth.users (auth.uid())
--   admin_users.scope        → 'super' | 'country'
--   admin_users.country_code → e.g. 'EG' | 'SA' (null for super)
-- Plus helper functions and country-scoped RLS for admin reads.
-- Idempotent / safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.admin_users add column if not exists user_id      uuid references auth.users(id) on delete cascade;
alter table public.admin_users add column if not exists scope        varchar(20) not null default 'country';
alter table public.admin_users add column if not exists country_code varchar(5);

do $$ begin
  alter table public.admin_users add constraint admin_users_scope_chk check (scope in ('super','country'));
exception when duplicate_object then null; end $$;

create unique index if not exists idx_admin_users_user_id on public.admin_users(user_id);

-- ── Helper functions (security definer so they can read admin_users under RLS) ──
create or replace function public.auth_is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

create or replace function public.auth_admin_scope() returns varchar
  language sql stable security definer set search_path = public as $$
  select scope from admin_users where user_id = auth.uid() limit 1;
$$;

create or replace function public.auth_admin_country() returns varchar
  language sql stable security definer set search_path = public as $$
  select country_code from admin_users where user_id = auth.uid() limit 1;
$$;

-- Country an order belongs to, derived: branch → zone → city → country.
-- NOTE: for production scale, denormalize a country_code column onto orders and
-- index it; this per-row function is correct but not the cheapest at volume.
create or replace function public.order_country_code(p_order_id uuid) returns varchar
  language sql stable set search_path = public as $$
  select co.code
  from orders o
  join merchant_branches mb on mb.id = o.branch_id
  join zones z              on z.id  = mb.zone_id
  join cities ci            on ci.id = z.city_id
  join countries co         on co.id = ci.country_id
  where o.id = p_order_id;
$$;

-- ── Admin read policies: super → all, country admin → own country only ─────────
drop policy if exists "Admins read orders by scope" on public.orders;
create policy "Admins read orders by scope" on public.orders
  for select to authenticated
  using (
    public.auth_is_admin() and (
      public.auth_admin_scope() = 'super'
      or public.order_country_code(id) = public.auth_admin_country()
    )
  );

-- Admins may read the admin roster (super: all; country: same-country admins).
drop policy if exists "Admins read admin roster by scope" on public.admin_users;
create policy "Admins read admin roster by scope" on public.admin_users
  for select to authenticated
  using (
    user_id = auth.uid()
    or (public.auth_is_admin() and (public.auth_admin_scope() = 'super' or country_code = public.auth_admin_country()))
  );

-- Replicate the orders pattern for other country-bearing tables (merchant_branches,
-- payment_transactions via order, etc.) using order_country_code / a branch variant.
