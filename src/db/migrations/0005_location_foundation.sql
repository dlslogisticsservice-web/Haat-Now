-- 0005_location_foundation.sql
-- Location foundation: coordinates, delivery model, driver tracking readiness

-- =====================================================================
-- 1. ADDRESSES — coordinate support + is_default (used by existing code)
-- =====================================================================
alter table addresses
  add column if not exists latitude       decimal(10,8),
  add column if not exists longitude      decimal(11,8),
  add column if not exists is_default     boolean default false;

-- =====================================================================
-- 2. MERCHANT BRANCHES — coordinate support + columns used by live code
-- =====================================================================
alter table merchant_branches
  add column if not exists latitude       decimal(10,8),
  add column if not exists longitude      decimal(11,8),
  add column if not exists is_active      boolean default true,
  add column if not exists cover_image_url text;

-- =====================================================================
-- 3. DRIVER LOCATIONS — timestamp for history and future live tracking
-- =====================================================================
alter table driver_locations
  add column if not exists recorded_at   timestamp with time zone default timezone('utc'::text, now());

-- =====================================================================
-- 4. ORDERS — delivery address link + coordinate snapshots
--    All columns nullable: existing orders remain valid unchanged.
-- =====================================================================
alter table orders
  add column if not exists address_id          uuid references addresses(id) on delete set null,
  add column if not exists delivery_lat        decimal(10,8),
  add column if not exists delivery_lng        decimal(11,8),
  add column if not exists branch_lat_snapshot decimal(10,8),
  add column if not exists branch_lng_snapshot decimal(11,8);

-- =====================================================================
-- 5. PERFORMANCE INDEXES
-- =====================================================================

-- Spatial lookup: find branches within a bounding box
create index if not exists idx_merchant_branches_lat_lng
  on merchant_branches(latitude, longitude)
  where latitude is not null and longitude is not null;

-- Driver location history: latest-first per driver
create index if not exists idx_driver_locations_driver_time
  on driver_locations(driver_id, recorded_at desc);

-- Order → address join
create index if not exists idx_orders_address
  on orders(address_id)
  where address_id is not null;

-- Address lookup by customer (used in checkout)
create index if not exists idx_addresses_customer_default
  on addresses(customer_id, is_default desc);
