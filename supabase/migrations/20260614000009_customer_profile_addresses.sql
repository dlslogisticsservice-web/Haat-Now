-- 0009_customer_profile_addresses.sql
-- Phase 10: Customer Profile + Address Management + Security Hardening
--
-- Idempotency: all statements use IF NOT EXISTS or ON CONFLICT or DROP/CREATE.
--
-- Changes:
--   1. customers    — add avatar_url, created_at
--   2. addresses    — add is_default; enable RLS (was completely missing)
--   3. customers    — add UPDATE policy (previously only SELECT existed)
--   4. avatars      — new Storage bucket + 4 scoped RLS policies
--
-- Security model:
--   customers SELECT   — auth.uid() = id                      (existing, from 0000)
--   customers UPDATE   — auth.uid() = id                      (NEW)
--   addresses ALL      — customer_id = auth.uid()             (NEW — full table RLS)
--   avatars write      — foldername[1] = auth.uid()::text     (NEW, same as merchant-logos)
--   avatars SELECT     — public                               (NEW)

-- =====================================================================
-- 1. Schema additions
-- =====================================================================
alter table customers add column if not exists avatar_url  text;
alter table customers add column if not exists created_at  timestamptz not null default timezone('utc', now());
alter table addresses add column if not exists is_default  boolean not null default false;

-- =====================================================================
-- 2. Customer UPDATE policy
--    Previously only "Users can see own data" (SELECT) existed.
--    Without this UPDATE policy, customerService.updateProfile() is
--    silently rejected in production.
-- =====================================================================
drop policy if exists "Customers can update own profile" on customers;
create policy "Customers can update own profile" on customers
  for update to authenticated
  using     (auth.uid() = id)
  with check (auth.uid() = id);

-- =====================================================================
-- 3. Addresses RLS
--    The addresses table had NO policies and NO RLS enabled.
--    Any authenticated (or even anon) user could read/write all rows.
--    This enables strict customer-scoped access.
-- =====================================================================
alter table addresses enable row level security;

drop policy if exists "Customers own addresses" on addresses;
create policy "Customers own addresses" on addresses
  for all to authenticated
  using     (customer_id = auth.uid())
  with check (customer_id = auth.uid());

-- =====================================================================
-- 4. Avatars Storage bucket
--    Path convention: {customerId}/avatar.{ext}
--    public = true → CDN URL readable without authentication
--    file_size_limit = 2 MB
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- =====================================================================
-- 5. Avatars Storage RLS policies
--    Same DROP/CREATE pattern used in 0008 for idempotency.
--    Write gate: (storage.foldername(name))[1] = auth.uid()::text
--      → each customer can only write to their own folder.
-- =====================================================================
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_auth_insert" on storage.objects;
drop policy if exists "avatars_auth_update" on storage.objects;
drop policy if exists "avatars_auth_delete" on storage.objects;

create policy "avatars_public_read" on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy "avatars_auth_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_auth_update" on storage.objects
  for update to authenticated
  using  (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_auth_delete" on storage.objects
  for delete to authenticated
  using  (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- MAPS FOUNDATION — MIGRATION PROPOSAL (NOT APPLIED)
-- Apply as a separate migration when Google Maps integration is ready.
-- =====================================================================
--
-- Option A: Simple decimal columns (no extensions required)
--
--   alter table addresses add column if not exists latitude  decimal(10, 8);
--   alter table addresses add column if not exists longitude decimal(11, 8);
--
-- Option B: PostGIS geography (enable PostGIS in Supabase dashboard first)
--
--   create extension if not exists postgis;
--   alter table addresses add column if not exists coordinates geography(Point, 4326);
--   create index if not exists idx_addresses_coordinates on addresses using gist(coordinates);
--
-- TypeScript model to add to types.ts when applied:
--   interface AddressCoordinates {
--     latitude:  number;
--     longitude: number;
--   }
--   interface Address {
--     ...existing fields...
--     latitude?:  number | null;   -- Option A
--     longitude?: number | null;   -- Option A
--   }
--
-- Service method to add to customer.service.ts:
--   async updateAddressCoordinates(
--     addressId: string,
--     coords: AddressCoordinates,
--   ): Promise<{ error: any }> {
--     const { error } = await supabase
--       .from('addresses')
--       .update({ latitude: coords.latitude, longitude: coords.longitude })
--       .eq('id', addressId);
--     return { error };
--   }
-- =====================================================================
