# Ultimate Scale Report — HAAT NOW (full business workflow)

**Date:** 2026-06-24 · **Project:** `umwbzradvbsirsybfxfb` (eu-west-1, Postgres 17.6, entry compute,
`max_connections = 60`). All numbers **measured** on the live project; estimates are labelled as such.

Methodology: data populated to scale in a contained `stress` schema (then dropped); admin queries via
`EXPLAIN ANALYZE`; write throughput via timed bulk statements; browse via the prior closed-loop REST load
test; **Realtime via real concurrent WebSocket connections** to `wss://…/realtime/v1`. Tools:
`docs/testing/loadtest.cjs` + ad-hoc Node harnesses (k6/Artillery unavailable in env — equivalent).

Simulated scale: **10,000 customers · 2,000 merchants · 5,000 drivers · 100k customers / 50k products /
500k orders / 1.5M order_items** in the DB tier.

---

## 1. Per-workflow measurements

| # | Workflow step | What was measured | Result |
|---|---|---|---|
| 1 | Customer browsing | REST RPS / percentiles (prior sprint) | **577 RPS peak**, P50 379 ms @ conc 250; fails @ conc 500 |
| 2 | Add to cart | DB insert throughput | ~10k rows/s raw; API-bound per request (see §3) |
| 3 | Create order | bulk order insert | **10,593 rows/s** (raw DB) |
| 4 | Order assignment | UPDATE orders (status+driver) | **12,469 rows/s** (raw DB), sub-ms/row |
| 5 | Driver acceptance | UPDATE orders (PK) | sub-ms/row |
| 6 | Driver location updates | UPDATE drivers lat/lng | **10,965 rows/s** raw DB — **but 1,000 req/s needed @ 5k drivers/5s ≫ 577 RPS API** |
| 7 | Order status changes | UPDATE orders | 12,469 rows/s raw DB |
| 8 | Wallet updates | UPDATE/insert (same class as order writes) | ~10k rows/s raw DB |
| 9 | Notifications | bulk insert notifications | **7,151 rows/s** (raw DB) |
| 10 | Admin dashboard queries | `EXPLAIN ANALYZE` @ 500k orders | **122–927 ms each** (see §2) |

## 2. Admin dashboard analytics @ 500k orders / 1.5M items (EXPLAIN ANALYZE)

| Query | Time | Plan |
|---|---|---|
| today's orders + revenue | **122 ms** | index range + agg |
| orders grouped by status | **304 ms** | full aggregate |
| revenue by merchant (top 10) | **927 ms** | join + group (Seq Scan) |
| orders/day, last 30 days | **413 ms** | index range + group |
| active drivers count | **1.7 ms** | index |
| top products by qty (1.5M items) | **644 ms** | group over items (Seq Scan) |
| global revenue + AOV | **87 ms** | filtered agg |

→ A dashboard rendering ~6 of these costs **~2.5 s of DB CPU per load**, growing **linearly** with order
count (≈5× at 2.5M orders). This is the expensive, un-indexable (full-scan) query class.

## 3. The binding constraint — API/compute, not the database

From the load test: under **577 RPS** the database reported **1 active connection / 16 pooled / 60 max** —
**idle**. Raw DB write capacity is **7k–12k rows/s**. So every HTTP request is bound by the **compute
instance CPU** (PostgREST + Kong), which caps at ~577 RPS; the DB itself has ~20× headroom.

| Metric | Measurement |
|---|---|
| **RPS (browse)** | 577 peak (conc 250); declines under overload |
| **P50 / P95 / P99** | 379 / 964 / 1082 ms @ conc 250 → 656 / 1185 / **10519 ms** @ conc 500 |
| **DB CPU** | low — DB idle (1 active conn) at the API ceiling; write path 7–12k rows/s |
| **API CPU** | **saturated at ~577 RPS** (inferred: ceiling while DB idle) |
| **Memory** | not host-observable (managed); no client leak (effects clean up) |
| **DB connections** | 16 pooled / 1 active under load / 60 max |
| **Realtime throughput** | 1 broadcast → **376 receipts in <3 s** (fan-out healthy) |
| **WebSocket saturation** | **~376 concurrent connections** (24/400 errored at ~376); join p50 740 ms → p95 1244 ms |
| **Queue backlog** | N/A — **no queue exists** (synchronous request path); see ARCHITECTURE_GAP_REPORT |

## 4. Breaking points, ordered by the scale at which they hit (current tier)

| Order | Subsystem | Breaks at | Evidence |
|---|---|---|---|
| **1st** | **Realtime WebSocket connections** | **~376 concurrent subscribers** | 24/400 WS errored at ~376 |
| 2nd | Driver location over REST | **~5,000 drivers** (1,000 req/s > 577) | 5k×/5s vs measured 577 RPS |
| 3rd | API / compute (browse) | **~2,500–4,600 concurrent users** (577 RPS) | load test knee @ conc 500 |
| 4th | Admin analytics UX | noticeable **≥ 500k orders** (0.9 s queries) | EXPLAIN ANALYZE |
| — | Core CRUD database | **not a bottleneck** | idle under load; 7–12k writes/s; indexed reads 1–4 ms |

## 5. Verdict
The **data tier is healthy and over-provisioned** for the targets (indexes from the scale sprint hold).
The launch-blocking ceilings are all in the **edge/realtime/compute tier**: Realtime concurrent sockets
(~376), the per-request API throughput (577 RPS), high-frequency driver-location-over-REST, and full-scan
admin analytics. These require **architecture changes** (CDN, queues, Redis, realtime redesign, edge
functions, larger compute) — detailed in `ARCHITECTURE_GAP_REPORT.md`.
