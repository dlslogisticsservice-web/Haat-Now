# Merchant System Stress Report — HAAT NOW

**Date:** 2026-06-24 · Measured on the live DB at 10k merchants / 10k branches / 50k products (post-index).

## Product / inventory / offer / branch operations
| Operation | Latency (after index) | Notes |
|---|---|---|
| product list by branch (active) | **1.3 ms** (was 85.6 ms) | `idx_products_branch` partial |
| product create/update | sub-ms DB | PK writes |
| inventory/stock update | sub-ms DB | PK update on `products` |
| offer creation | sub-ms DB | small table |
| branch update | sub-ms DB | PK update; `idx_branches_merchant/zone` for lookups |
| merchant → branches lookup | index scan | `idx_branches_merchant` (was unindexed FK) |

## Capacity
- 10,000 merchants × catalog CRUD is **light** load (each op sub-ms / 1.3 ms). Product browse by branch is
  now index-backed at any catalog size.
- 50,000 products: `products` reads are index/trigram-backed (search 1.7 ms; by-branch 1.3 ms).

## Verdict
Merchant operations scale to 10k merchants / 50k products at single-digit-ms after the index fix; no
merchant-tier bottleneck remains.
