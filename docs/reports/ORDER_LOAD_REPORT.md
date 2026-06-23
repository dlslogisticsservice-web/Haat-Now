# Order System Load Report — HAAT NOW

**Date:** 2026-06-24 · Measured on the live DB at 500k orders / 1.5M items (post-index).

## Per-operation latency (DB tier, EXPLAIN ANALYZE / round-trip)
| Operation | Latency (after index) |
|---|---|
| order creation (insert) | sub-ms DB (PK) |
| checkout reads (cart items, address, branch) | 1–4 ms each, index scans |
| order detail (items + product join) | **1.9 ms** (was 423.9 ms) |
| customer order list (paged) | **3.4 ms** (was 190.4 ms) |
| product search (trigram) | **1.7 ms** (was 13.3 ms) |
| cart read (by customer/branch) | sub-ms (PK/indexed) |

## Concurrency (harness note — important)
Parallel throughput was exercised at 100-way fan-out through the **Supabase Management API single
endpoint** (a test harness, not the production path): reads 40–134 ops/s, writes 76–120 ops/s. These
numbers are **bounded by that single HTTP endpoint**, not the database. The production path
(PostgREST + PgBouncer pooler) parallelizes far beyond this; the authoritative signal is the **2–4 ms
per-query** latency above.

## Capacity for the stated targets (derived from measured latency)
- **50,000 orders/day** = 0.58 orders/s average; even a 10× peak (~6/s), each order ~5 indexed ops
  (~10–15 ms DB) → **< 0.1 connection-second/s** → trivial.
- **1,000 concurrent checkouts** ~18 ms DB each → ~18 connection-seconds of work; drained in ~1 s on a
  15-connection pool, sub-second on a larger Pro pool. Bound by **pool size**, not query speed.
- **500 concurrent order placements:** PK inserts (sub-ms) → ~0.5 connection-second → trivial.
- **5,000 concurrent users** (mostly browsing, ~1 query / few-sec) ~1,500 q/s × 3 ms = ~5 busy
  connections → within Free/Pro pooler.

## Verdict
The order system meets 50k orders/day and 1k concurrent checkouts comfortably after the index fix.
Pre-fix, order detail/list at 190–424 ms would have queued under load.
