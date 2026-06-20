-- 0007_catalog_rls.sql
-- Add Row Level Security to product catalog tables.
--
-- Gap: products, product_variants, and product_images had no RLS, allowing any
-- authenticated user to insert, update, or delete any record — including a rival
-- merchant's menu items.
--
-- Fix:
--   SELECT  → open to everyone (product catalogs are public data)
--   INSERT/UPDATE/DELETE → scoped to the merchant who owns the branch

-- =====================================================================
-- 1. products — merchant-scoped write, public read
-- =====================================================================
alter table products enable row level security;

create policy "Products are publicly readable" on products
  for select using (true);

create policy "Merchants can insert products into own branches" on products
  for insert to authenticated
  with check (
    branch_id in (
      select id from merchant_branches where merchant_id = auth.uid()
    )
  );

create policy "Merchants can update own branch products" on products
  for update to authenticated
  using  (branch_id in (select id from merchant_branches where merchant_id = auth.uid()))
  with check (branch_id in (select id from merchant_branches where merchant_id = auth.uid()));

create policy "Merchants can delete own branch products" on products
  for delete to authenticated
  using  (branch_id in (select id from merchant_branches where merchant_id = auth.uid()));

-- =====================================================================
-- 2. product_variants — merchant-scoped write via product → branch chain
-- =====================================================================
alter table product_variants enable row level security;

create policy "Product variants are publicly readable" on product_variants
  for select using (true);

create policy "Merchants can insert variants for own branch products" on product_variants
  for insert to authenticated
  with check (
    product_id in (
      select p.id from products p
      join merchant_branches mb on mb.id = p.branch_id
      where mb.merchant_id = auth.uid()
    )
  );

create policy "Merchants can update own branch product variants" on product_variants
  for update to authenticated
  using (
    product_id in (
      select p.id from products p
      join merchant_branches mb on mb.id = p.branch_id
      where mb.merchant_id = auth.uid()
    )
  )
  with check (
    product_id in (
      select p.id from products p
      join merchant_branches mb on mb.id = p.branch_id
      where mb.merchant_id = auth.uid()
    )
  );

create policy "Merchants can delete own branch product variants" on product_variants
  for delete to authenticated
  using (
    product_id in (
      select p.id from products p
      join merchant_branches mb on mb.id = p.branch_id
      where mb.merchant_id = auth.uid()
    )
  );

-- =====================================================================
-- 3. product_images — merchant-scoped write via product → branch chain
-- =====================================================================
alter table product_images enable row level security;

create policy "Product images are publicly readable" on product_images
  for select using (true);

create policy "Merchants can manage images for own branch products" on product_images
  for all to authenticated
  using (
    product_id in (
      select p.id from products p
      join merchant_branches mb on mb.id = p.branch_id
      where mb.merchant_id = auth.uid()
    )
  )
  with check (
    product_id in (
      select p.id from products p
      join merchant_branches mb on mb.id = p.branch_id
      where mb.merchant_id = auth.uid()
    )
  );
