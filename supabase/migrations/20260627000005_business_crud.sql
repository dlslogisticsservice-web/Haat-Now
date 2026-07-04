-- ─────────────────────────────────────────────────────────────────────────────
-- Business CRUD backend — admin management of the core entities.
--  1. Creates the missing `vehicles` table (fleet management).
--  2. Adds admin-write RLS policies (auth_is_admin) so the admin CRUD pages can
--     Create/Update/Delete. Additive: existing role policies are untouched and
--     OR-combined; we do NOT toggle RLS on tables that already manage it.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Vehicles — RLS + policies on the REFERENCE table ─────────────────────────
-- Phase-1 DB stabilization (2026-07): `public.vehicles` is the REFERENCE / vehicle-TYPE
-- table defined in 20260614000028_operations_engine.sql (columns: type, capacity,
-- speed_kmh, pricing_modifier, is_active) and consumed by ops/vehicle.service.ts and the
-- dispatch RPCs. The earlier draft of THIS migration re-declared `vehicles` as a fleet-
-- INSTANCE table (plate/status/driver_id/insurance_expiry). That was a DUPLICATE that
--   (a) no-op'd, because `create table if not exists` sees the table already created by
--       28 (which sorts earlier), so the fleet columns were never added; and
--   (b) then built idx_vehicles_driver / idx_vehicles_status on driver_id / status —
--       columns that do NOT exist on the reference table — which HARD-FAILS a fresh
--       `supabase db push` / `db reset` and blocks every later migration (000006-000008,
--       incl. payment_idempotency and tenants). Verified: this batch is currently
--       UNAPPLIED on the linked project (live is at 20260614000036), so this edit is
--       drift-free — the fixed migration applies cleanly on first apply.
-- The duplicate CREATE and the two broken indexes are removed. Fleet-instance management
-- (plate/insurance/driver assignment — used by the admin "Vehicles" CRUD + DriverWorkspace)
-- belongs in a DEDICATED `fleet_vehicles` table + an app repoint; that is a Phase-2
-- follow-up tracked in docs/stabilization/DATABASE_MIGRATION_PLAN.md. It is intentionally
-- NOT created here, to avoid shipping an unused placeholder table.
-- Below only ensures the reference table has RLS + read/admin-write policies, because 28
-- enables RLS on `vehicles` but ships NO policy (default-deny → unreadable in live mode).
-- Policy name `vehicles_read` matches the live DB (converges a pre-existing drift where a
-- `vehicles_read` policy exists live but in no migration file).
alter table public.vehicles enable row level security;
drop policy if exists vehicles_public_read on public.vehicles;
drop policy if exists vehicles_read on public.vehicles;
create policy vehicles_read on public.vehicles for select using (true);
drop policy if exists vehicles_admin_write on public.vehicles;
create policy vehicles_admin_write on public.vehicles for all
  using (public.auth_is_admin()) with check (public.auth_is_admin());

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
