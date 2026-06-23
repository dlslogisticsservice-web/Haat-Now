# Bottleneck Report — HAAT NOW

**Date:** 2026-06-24 · Evidence: measured `EXPLAIN ANALYZE` at 500k orders / 1.5M items (see
`DATABASE_STRESS_REPORT.md`).

---

## CRITICAL

### BN-C1 — Missing hot-path indexes → full table scans on every order/product read — **FIXED ✅**
- **Root cause:** 29 foreign keys had **no covering index**; the order/checkout/driver/merchant read paths
  ran **Seq Scans** (cost ∝ row count). Measured at scale: order-detail items **423.9 ms**, order⋈product
  join **325.9 ms**, customer list **190.4 ms**, merchant list **125.2 ms**.
- **Affected files / objects:** `orders`, `order_items`, `products`, `product_variants`, `product_images`,
  `merchant_branches` (DB); consumed by `src/services/order.service.ts`, `driver.service.ts`,
  `merchant.service.ts`, `src/features/home/HomeScreen.tsx`, `restaurant/RestaurantScreen.tsx`.
- **Estimated max capacity BEFORE:** order-detail at 0.42 s/query → a single connection saturates at
  ~2 order-views/s; with a 15-pool, **~35 order-views/s** before queueing. Linear decay as orders grow.
- **Exact fix (applied):** `migrations/20260614000027_scale_indexes.sql` — composite/partial/GIN indexes on
  all hot FKs + `products.name` trigram. **After: 0.2–3.9 ms** (13–1500×). Capacity → thousands/s.

### BN-C2 — N+1 join on order detail (`order_items ⋈ products/variants`) — **FIXED ✅**
- **Root cause:** the per-order item+catalog join had no index on `order_items.order_id` /
  `order_items.variant_id` → 325.9 ms Seq Scan per order view.
- **Fix (applied):** `idx_order_items_order`, `idx_order_items_variant`, `idx_product_variants_product`,
  `idx_product_images_product` → **0.2 ms**.

## HIGH

### BN-H1 — Realtime concurrent-connection ceiling for the driver fleet — **ARCHITECTURE/CONFIG**
- **Root cause:** 20,000 drivers each holding a Realtime subscription exceeds Supabase Realtime concurrent-
  connection defaults (**Free 200, Pro 500**). This is the binding constraint for the fleet — **not** query
  latency (driver status update measured sub-ms / 2.6 ms read).
- **Affected:** any per-driver global Realtime channel; notification/location subscriptions.
- **Estimated max capacity:** ~200 (Free) / ~500 (Pro default) concurrent driver sockets before drops.
- **Exact fix (recommended, not auto-applied — config/architecture, not a code bug):**
  (a) move to **Supabase Team** (configurable higher concurrency), and/or
  (b) **regional/zone channels** instead of per-driver global subscriptions (one channel per zone, ~500
  zones → bounded fan-out), and/or (c) poll-on-interval for low-priority driver state. Latency is not the
  limiter, connection count is.

### BN-H2 — Product search via `ILIKE '%…%'` — **FIXED ✅**
- **Root cause:** leading-wildcard `ILIKE` cannot use a btree index → Seq Scan (13.3 ms at 50k products,
  grows linearly).
- **Fix (applied):** `pg_trgm` GIN index `idx_products_name_trgm` → **1.7 ms** bitmap-index scan.

## MEDIUM
- **BN-M1:** 13 remaining unindexed FKs on low-traffic tables (`addresses.zone_id`, `user_roles.role_id`,
  `payment_transactions.payment_method_id`, geo tables). Low volume; add opportunistically.
- **BN-M2:** Client list fetches (`HomeScreen` restaurant list, orders list) should paginate (`.range`)
  rather than fetch-all as catalogs grow.
- **BN-M3:** Entry bundle ≈ 312 KB (already split); fine, monitor.

## Summary
**0 Critical, 0 High outstanding in the database tier** (BN-C1/C2/H2 fixed via indexes). BN-H1 is a
**tier/architecture** constraint (Realtime connection count) with a documented mitigation — it is not a
code defect and is the single remaining gate to the full 20k-driver realtime target.
