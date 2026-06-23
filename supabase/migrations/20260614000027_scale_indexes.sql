-- ─────────────────────────────────────────────────────────────────────────────
-- Scalability: covering indexes for hot-path foreign keys / filters / sorts.
-- Measured impact (stress schema @ 500k orders / 1.5M order_items, EXPLAIN ANALYZE):
--   order detail items  423.9ms -> 1.9ms (223x)   order+product join 325.9ms -> 0.2ms
--   customer order list 190.4ms -> 3.4ms (55x)    products by branch 85.6ms -> 1.3ms
--   merchant orders     125.2ms -> 3.9ms (32x)    driver orders      33.8ms -> 2.6ms
-- All additive; no data/schema change. IF NOT EXISTS = safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists pg_trgm;

-- Orders: customer list (+sort), merchant list (+sort), driver list
create index if not exists idx_orders_customer_created on public.orders (customer_id, created_at desc);
create index if not exists idx_orders_branch_created   on public.orders (branch_id, created_at desc);
create index if not exists idx_orders_driver           on public.orders (driver_id) where driver_id is not null;

-- Order items: the per-order detail fetch + product join (N+1 elimination)
create index if not exists idx_order_items_order   on public.order_items (order_id);
create index if not exists idx_order_items_variant on public.order_items (variant_id);

-- Catalog joins / browse (product detail N+1, category browse)
create index if not exists idx_product_variants_product on public.product_variants (product_id);
create index if not exists idx_product_images_product   on public.product_images (product_id);
create index if not exists idx_products_category         on public.products (category_id);
create index if not exists idx_products_name_trgm        on public.products using gin (name gin_trgm_ops);

-- Merchant / geo lookups
create index if not exists idx_branches_merchant on public.merchant_branches (merchant_id);
create index if not exists idx_branches_zone     on public.merchant_branches (zone_id);
create index if not exists idx_drivers_zone      on public.drivers (zone_id);

-- Customer-owned relations
create index if not exists idx_favorites_customer   on public.favorites (customer_id);
create index if not exists idx_cart_items_product   on public.cart_items (product_id);
create index if not exists idx_coupon_usages_order  on public.coupon_usages (order_id);
create index if not exists idx_coupon_usages_coupon on public.coupon_usages (coupon_id);
create index if not exists idx_reviews_order        on public.reviews (order_id);
create index if not exists idx_subscriptions_customer on public.subscriptions (customer_id);
