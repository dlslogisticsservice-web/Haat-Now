# Database Stress Report — HAAT NOW

**Date:** 2026-06-24 · **Method:** real data populated into a contained `stress` schema on the live
Supabase project (`umwbzradvbsirsybfxfb`), measured with `EXPLAIN (ANALYZE, BUFFERS)`, then dropped.
**These are measured numbers, not estimates.**

## Data populated (target scale)
| Table | Rows | Insert time |
|---|---|---|
| customers | 100,000 | 878 ms |
| merchants | 10,000 | 384 ms |
| branches | 10,000 | 330 ms |
| drivers | 20,000 | 424 ms |
| products | 50,000 | 558 ms |
| **orders** | **500,000** | 2,953 ms |
| **order_items** | **1,500,000** | 9,215 ms |
| index build (7 idx) | — | 13,035 ms |

## Hot-query latency — BEFORE vs AFTER indexes (EXPLAIN ANALYZE execution time)
| Query (representative of app code) | Before (PK only) | Plan | After (indexed) | Plan | Speedup |
|---|---|---|---|---|---|
| customer order list (`customer_id` + `created_at` sort, limit 20) | **190.4 ms** | Seq Scan | **3.4 ms** | Index | 55× |
| order detail items (`order_id`) | **423.9 ms** | Seq Scan | **1.9 ms** | Index | 223× |
| merchant orders (`branch_id` + sort, limit 30) | **125.2 ms** | Seq Scan | **3.9 ms** | Index | 32× |
| driver orders (`driver_id` + status) | **33.8 ms** | Seq Scan | **2.6 ms** | Index | 13× |
| products by branch (active) | **85.6 ms** | Seq Scan | **1.3 ms** | Index | 66× |
| product search (`name ILIKE '%…%'`) | **13.3 ms** | Seq Scan | **1.7 ms** | Bitmap (GIN trgm) | 8× |
| order_items ⋈ products (per order) | **325.9 ms** | Seq Scan | **0.2 ms** | Index | 1500× |

## Write latency (single row, indexed)
- order insert: DB-side sub-millisecond (252 ms wall incl. remote Management-API round-trip).
- driver status update (PK): DB-side sub-millisecond (network-dominated wall time).

## Index efficiency / table-scan risk
- **Before:** every hot read was a **Seq Scan** — cost grows **linearly** with row count. At 500k orders /
  1.5M items the order-detail and join paths already hit **0.3–0.4 s per query**, which collapses under
  concurrency.
- **After:** all hot reads use **index / bitmap-index scans** — **O(log n)**, flat 1–4 ms regardless of
  table size. Table-scan risk on the hot paths is eliminated.

## Verdict
The database **scales to the target volumes** (500k orders / 1.5M items / 100k customers) at single-digit-
millisecond hot-query latency **once the covering indexes exist** — which they now do (applied to the real
schema via `20260614000027_scale_indexes.sql`). Pre-fix, the missing indexes were a hard scaling wall.
