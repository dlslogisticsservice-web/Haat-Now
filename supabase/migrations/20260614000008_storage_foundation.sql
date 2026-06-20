-- 0008_storage_foundation.sql
-- Add media columns to existing tables, create Supabase Storage buckets,
-- and apply production-grade scoped RLS policies on storage.objects.
--
-- Idempotency guarantee:
--   ALTER TABLE … ADD COLUMN IF NOT EXISTS       → safe to re-run
--   INSERT INTO storage.buckets ON CONFLICT …    → safe to re-run
--   DROP POLICY IF EXISTS before CREATE POLICY   → safe to re-run
--
-- Security model per bucket:
--   SELECT        — public; anyone (complements bucket public = true for CDN access)
--   product-images write — merchant who owns the product
--                          via products → merchant_branches → auth.uid()
--                          verified through storage.foldername(name)[1] = productId
--   merchant-logos write — merchant whose UUID is the first path segment
--                          (storage.foldername(name))[1] = auth.uid()::text
--   banners write        — admin role only (user_roles JOIN roles WHERE name = 'admin')
--   offer-images write   — admin role only (same pattern as banners)

-- =====================================================================
-- 1. Schema additions
-- =====================================================================
alter table merchants         add column if not exists logo_url        text;
alter table merchant_branches add column if not exists cover_image_url text;
alter table merchant_branches add column if not exists is_active       boolean not null default true;
alter table offers            add column if not exists image_url       text;
alter table products          add column if not exists description     text;

-- =====================================================================
-- 2. Supabase Storage buckets (idempotent via ON CONFLICT DO NOTHING)
--    public = true  → CDN URL readable without authentication
--    file_size_limit in bytes: 5 MB = 5242880, 2 MB = 2097152, 10 MB = 10485760
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880,  array['image/jpeg','image/png','image/webp','image/gif']),
  ('merchant-logos', 'merchant-logos', true, 2097152,  array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('banners',        'banners',        true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('offer-images',   'offer-images',   true, 5242880,  array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- =====================================================================
-- 3. Storage RLS policies on storage.objects
--
--    DROP POLICY IF EXISTS before each CREATE POLICY makes the entire
--    policy section idempotent. The DROP and CREATE execute within the
--    same migration transaction, so there is no unprotected window.
-- =====================================================================

-- -------------------------------------------------------------------
-- 3a. product-images
--
--     Path convention:  {productId}/{timestamp}.{ext}
--     (storage.foldername(name))[1]  →  productId (first path segment)
--
--     Write gate: the productId in the path must belong to a product
--     whose branch is owned by the calling merchant.
--     Ownership chain:  auth.uid()
--                       → merchant_branches.merchant_id
--                       → products.branch_id
--                       → products.id  (= path segment [1])
-- -------------------------------------------------------------------
drop policy if exists "product_images_public_read" on storage.objects;
drop policy if exists "product_images_auth_insert" on storage.objects;
drop policy if exists "product_images_auth_update" on storage.objects;
drop policy if exists "product_images_auth_delete" on storage.objects;

create policy "product_images_public_read" on storage.objects
  for select
  using (bucket_id = 'product-images');

create policy "product_images_auth_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select p.id::text
      from   products p
      join   merchant_branches mb on mb.id = p.branch_id
      where  mb.merchant_id = auth.uid()
    )
  );

create policy "product_images_auth_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select p.id::text
      from   products p
      join   merchant_branches mb on mb.id = p.branch_id
      where  mb.merchant_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select p.id::text
      from   products p
      join   merchant_branches mb on mb.id = p.branch_id
      where  mb.merchant_id = auth.uid()
    )
  );

create policy "product_images_auth_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select p.id::text
      from   products p
      join   merchant_branches mb on mb.id = p.branch_id
      where  mb.merchant_id = auth.uid()
    )
  );

-- -------------------------------------------------------------------
-- 3b. merchant-logos
--
--     Path convention:  {merchantId}/logo.{ext}
--     (storage.foldername(name))[1]  →  merchantId (first path segment)
--
--     Write gate: the first path segment must equal auth.uid()::text.
--     merchants.id = auth.uid() per the RLS model in 0004_security_hardening.sql,
--     so this restricts each merchant to writing only inside their own folder.
-- -------------------------------------------------------------------
drop policy if exists "merchant_logos_public_read" on storage.objects;
drop policy if exists "merchant_logos_auth_insert" on storage.objects;
drop policy if exists "merchant_logos_auth_update" on storage.objects;
drop policy if exists "merchant_logos_auth_delete" on storage.objects;

create policy "merchant_logos_public_read" on storage.objects
  for select
  using (bucket_id = 'merchant-logos');

create policy "merchant_logos_auth_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'merchant-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "merchant_logos_auth_update" on storage.objects
  for update to authenticated
  using  (bucket_id = 'merchant-logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'merchant-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "merchant_logos_auth_delete" on storage.objects
  for delete to authenticated
  using  (bucket_id = 'merchant-logos' and (storage.foldername(name))[1] = auth.uid()::text);

-- -------------------------------------------------------------------
-- 3c. banners
--
--     Path convention:  {bannerId}.{ext}
--     SELECT: public
--     Write gate: caller must hold the 'admin' role in user_roles.
--     Uses the same EXISTS / user_roles JOIN roles pattern as
--     0005_admin_rls_policies.sql for consistency.
-- -------------------------------------------------------------------
drop policy if exists "banners_public_read" on storage.objects;
drop policy if exists "banners_auth_insert" on storage.objects;
drop policy if exists "banners_auth_update" on storage.objects;
drop policy if exists "banners_auth_delete" on storage.objects;

create policy "banners_public_read" on storage.objects
  for select
  using (bucket_id = 'banners');

create policy "banners_auth_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'banners'
    and exists (
      select 1
      from   user_roles ur
      join   roles r on r.id = ur.role_id
      where  ur.user_id = auth.uid()
        and  r.name = 'admin'
    )
  );

create policy "banners_auth_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'banners'
    and exists (
      select 1
      from   user_roles ur
      join   roles r on r.id = ur.role_id
      where  ur.user_id = auth.uid()
        and  r.name = 'admin'
    )
  )
  with check (
    bucket_id = 'banners'
    and exists (
      select 1
      from   user_roles ur
      join   roles r on r.id = ur.role_id
      where  ur.user_id = auth.uid()
        and  r.name = 'admin'
    )
  );

create policy "banners_auth_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'banners'
    and exists (
      select 1
      from   user_roles ur
      join   roles r on r.id = ur.role_id
      where  ur.user_id = auth.uid()
        and  r.name = 'admin'
    )
  );

-- -------------------------------------------------------------------
-- 3d. offer-images
--
--     Path convention:  {offerId}.{ext}
--     SELECT: public
--     Write gate: admin role only (identical pattern to banners above).
-- -------------------------------------------------------------------
drop policy if exists "offer_images_public_read" on storage.objects;
drop policy if exists "offer_images_auth_insert" on storage.objects;
drop policy if exists "offer_images_auth_update" on storage.objects;
drop policy if exists "offer_images_auth_delete" on storage.objects;

create policy "offer_images_public_read" on storage.objects
  for select
  using (bucket_id = 'offer-images');

create policy "offer_images_auth_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'offer-images'
    and exists (
      select 1
      from   user_roles ur
      join   roles r on r.id = ur.role_id
      where  ur.user_id = auth.uid()
        and  r.name = 'admin'
    )
  );

create policy "offer_images_auth_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'offer-images'
    and exists (
      select 1
      from   user_roles ur
      join   roles r on r.id = ur.role_id
      where  ur.user_id = auth.uid()
        and  r.name = 'admin'
    )
  )
  with check (
    bucket_id = 'offer-images'
    and exists (
      select 1
      from   user_roles ur
      join   roles r on r.id = ur.role_id
      where  ur.user_id = auth.uid()
        and  r.name = 'admin'
    )
  );

create policy "offer_images_auth_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'offer-images'
    and exists (
      select 1
      from   user_roles ur
      join   roles r on r.id = ur.role_id
      where  ur.user_id = auth.uid()
        and  r.name = 'admin'
    )
  );
