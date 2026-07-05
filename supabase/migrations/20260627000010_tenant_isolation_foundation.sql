-- ─────────────────────────────────────────────────────────────────────────────
-- Phase-3 Multi-Tenancy — tenant isolation FOUNDATION (additive, non-breaking).
--
-- Adds the plumbing for per-tenant data isolation WITHOUT enforcing it yet:
--   1. tenant_members — maps auth users → the tenant (white-label brand) they belong to.
--   2. auth_tenant() — resolves the calling user's tenant (SECURITY DEFINER resolver),
--      the tenant analogue of the existing auth_admin_country().
--   3. A NULLABLE tenant_id (+ FK to tenants + index) on the core domain tables.
--
-- What this migration deliberately does NOT do: it changes NO RLS policy. Nothing yet
-- reads tenant_id and the columns are nullable with no default, so existing rows and
-- every current query behave EXACTLY as before. Enforcement (per-tenant RLS with
-- `tenant_id = public.auth_tenant()`) is a SEPARATE, staged rollout that must run only
-- after (a) backfilling tenant_id and (b) validating on a staging project with real
-- multi-tenant data — see docs/stabilization/MULTI_TENANCY_REPORT.md (Stage C). Turning
-- on tenant RLS before backfill would lock every existing row out (the same class of
-- P0 the 000021 rls_recovery migration had to undo). Hence: foundation only, here.
--
-- Depends on public.tenants (migration 20260627000008). Applies after it in order.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Membership: which tenant a user belongs to (a brand's owner/staff/merchant/driver/customer).
create table if not exists public.tenant_members (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null,
  role       text not null default 'member',   -- owner | admin | staff | merchant | driver | customer
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists idx_tenant_members_user on public.tenant_members (user_id);

alter table public.tenant_members enable row level security;
drop policy if exists tenant_members_self_read on public.tenant_members;
create policy tenant_members_self_read on public.tenant_members for select using (user_id = auth.uid());
drop policy if exists tenant_members_admin_all on public.tenant_members;
create policy tenant_members_admin_all on public.tenant_members for all
  using (public.auth_is_admin()) with check (public.auth_is_admin());

-- 2) Resolver: the calling user's tenant. SECURITY DEFINER so it reads tenant_members
--    regardless of the caller's own RLS; STABLE; pinned search_path. Returns NULL when
--    the user has no membership (so future policies can fail-closed explicitly).
create or replace function public.auth_tenant()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.tenant_members where user_id = auth.uid() limit 1;
$$;

-- 3) Nullable tenant_id (+ FK + index) on the core domain tables. Guarded so it is a
--    no-op where already present. NO default, NO not-null → strictly additive.
do $$
declare t text;
begin
  foreach t in array array['merchants','merchant_branches','drivers','customers','orders','products'] loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t)
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='tenant_id') then
      execute format('alter table public.%I add column tenant_id uuid references public.tenants(id)', t);
      execute format('create index if not exists idx_%s_tenant on public.%I (tenant_id)', t, t);
    end if;
  end loop;
end $$;
