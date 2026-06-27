-- ─────────────────────────────────────────────────────────────────────────────
-- Business CRUD backend — admin management of the core entities.
--  1. Creates the missing `vehicles` table (fleet management).
--  2. Adds admin-write RLS policies (auth_is_admin) so the admin CRUD pages can
--     Create/Update/Delete. Additive: existing role policies are untouched and
--     OR-combined; we do NOT toggle RLS on tables that already manage it.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Vehicles (new) ───────────────────────────────────────────────────────────
create table if not exists public.vehicles (
  id              uuid primary key default uuid_generate_v4(),
  plate           varchar(20) not null,
  vehicle_type    varchar(30) default 'motorcycle',   -- motorcycle | car | bicycle | van
  status          varchar(20) default 'active',        -- active | maintenance | retired
  driver_id       uuid references public.drivers(id),
  insurance_expiry date,
  license_expiry   date,
  created_at      timestamptz default now()
);
alter table public.vehicles enable row level security;
drop policy if exists vehicles_public_read on public.vehicles;
create policy vehicles_public_read on public.vehicles for select using (true);
drop policy if exists vehicles_admin_write on public.vehicles;
create policy vehicles_admin_write on public.vehicles for all
  using (public.auth_is_admin()) with check (public.auth_is_admin());
create index if not exists idx_vehicles_driver on public.vehicles (driver_id);
create index if not exists idx_vehicles_status on public.vehicles (status);

-- 2) Admin-write policies on existing core tables ─────────────────────────────
do $$
declare tbl text;
begin
  foreach tbl in array array['drivers','merchants','merchant_branches','orders','customers'] loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=tbl) then
      execute format('drop policy if exists %I on public.%I', tbl||'_admin_write', tbl);
      execute format('create policy %I on public.%I for all using (public.auth_is_admin()) with check (public.auth_is_admin())', tbl||'_admin_write', tbl);
    end if;
  end loop;
end $$;
