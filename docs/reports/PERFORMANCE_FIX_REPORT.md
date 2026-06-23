# Performance Fix Report — HAAT NOW

**Date:** 2026-06-24

## Fixes implemented (Phase 8)
**`supabase/migrations/20260614000027_scale_indexes.sql`** — applied live + recorded. 18 covering indexes
on hot-path foreign keys / filters / sorts + `pg_trgm` for search. Additive only (no schema/data change).

Hot FKs newly covered: `orders(customer_id,created_at)`, `orders(branch_id,created_at)`,
`orders(driver_id) partial`, `order_items(order_id)`, `order_items(variant_id)`,
`product_variants(product_id)`, `product_images(product_id)`, `products(category_id)`,
`products.name trgm`, `merchant_branches(merchant_id/zone_id)`, `drivers(zone_id)`,
`favorites(customer_id)`, `cart_items(product_id)`, `coupon_usages(order_id/coupon_id)`,
`reviews(order_id)`, `subscriptions(customer_id)`.

Result: **unindexed FKs 29 → 13** (remaining are low-traffic).

## Before → After (measured EXPLAIN ANALYZE @ 500k orders / 1.5M items)
| Path | Before | After | Speedup |
|---|---|---|---|
| order detail items | 423.9 ms | 1.9 ms | **223×** |
| order ⋈ products | 325.9 ms | 0.2 ms | **1500×** |
| customer order list | 190.4 ms | 3.4 ms | **55×** |
| merchant orders | 125.2 ms | 3.9 ms | **32×** |
| products by branch | 85.6 ms | 1.3 ms | **66×** |
| driver orders | 33.8 ms | 2.6 ms | **13×** |
| product search | 13.3 ms | 1.7 ms | **8×** |

## Re-test after fix
- Build: ✅ passes. Lint: ✅ clean. E2E: ✅ 24/24.
- DB hot paths: all index/bitmap scans, 0.2–3.9 ms (flat with table size).

## Not auto-fixed (by design)
- **Realtime 20k-driver connection ceiling** (BN-H1): tier/architecture, not a code bug — see
  `BOTTLENECK_REPORT.md` for the Team-tier / zone-channel mitigation.
- 13 low-traffic FK indexes, client pagination — backlog (Medium).
