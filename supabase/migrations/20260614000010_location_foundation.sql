-- 20260614000010_location_foundation.sql
-- Location foundation: coordinates, delivery model, driver tracking readiness.
--
-- What is NOT here (already covered by earlier migrations):
--   addresses.is_default        → added by 20260614000009
--   merchant_branches.is_active → added by 20260614000008
--   merchant_branches.cover_image_url → added by 20260614000008
--
-- All ADD COLUMN statements use IF NOT EXISTS for safe re-runs.
-- All CREATE INDEX statements use IF NOT EXISTS for safe re-runs.
-- All new columns are nullable — existing rows require no backfill.

-- =====================================================================
-- 1. ADDRESSES — GPS coordinate support
-- =====================================================================
alter table addresses
  add column if not exists latitude  decimal(10,8),
  add column if not exists longitude decimal(11,8);

-- =====================================================================
-- 2. MERCHANT BRANCHES — GPS coordinate support
-- =====================================================================
alter table merchant_branches
  add column if not exists latitude  decimal(10,8),
  add column if not exists longitude decimal(11,8);

-- =====================================================================
-- 3. DRIVER LOCATIONS — timestamp for history + future live tracking
--    The existing table only stores the latest coords per driver (upsert
--    pattern in trackingService). recorded_at enables a future switch to
--    append-only history rows for live tracking replay.
-- =====================================================================
alter table driver_locations
  add column if not exists recorded_at timestamp with time zone
    default timezone('utc'::text, now());

-- =====================================================================
-- 4. ORDERS — delivery address link + coordinate snapshots
--
--    address_id        → which address the customer chose at checkout
--    delivery_lat/lng  → coordinate snapshot of that address at order time
--    branch_lat/lng    → coordinate snapshot of the branch at order time
--
--    Snapshots freeze the geometry even if addresses or branches move later.
--    All columns nullable: every existing order row remains valid.
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

-- Bounding-box branch search (latitude-first for common lat range filter)
create index if not exists idx_merchant_branches_lat_lng
  on merchant_branches(latitude, longitude)
  where latitude is not null and longitude is not null;

-- Driver location history: latest-first per driver
create index if not exists idx_driver_locations_driver_time
  on driver_locations(driver_id, recorded_at desc);

-- Order → address join (sparse — only rows with an address set)
create index if not exists idx_orders_address_id
  on orders(address_id)
  where address_id is not null;

-- Address lookup sorted by default flag (used in checkout)
create index if not exists idx_addresses_customer_default
  on addresses(customer_id, is_default desc);
