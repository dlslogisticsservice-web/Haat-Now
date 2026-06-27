-- ─────────────────────────────────────────────────────────────────────────────
-- Catalog CRUD security — public read + admin write (auth_is_admin) for the
-- entities exposed in the new admin Catalog (categories, zones). Idempotent:
-- enabling RLS while adding a permissive SELECT keeps existing reads working,
-- and the admin write policy enables the new Create/Update/Delete flows.
-- ─────────────────────────────────────────────────────────────────────────────

-- Categories
alter table public.categories enable row level security;
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select using (true);
drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories for all
  using (public.auth_is_admin()) with check (public.auth_is_admin());

-- Zones
alter table public.zones enable row level security;
drop policy if exists zones_public_read on public.zones;
create policy zones_public_read on public.zones for select using (true);
drop policy if exists zones_admin_write on public.zones;
create policy zones_admin_write on public.zones for all
  using (public.auth_is_admin()) with check (public.auth_is_admin());
