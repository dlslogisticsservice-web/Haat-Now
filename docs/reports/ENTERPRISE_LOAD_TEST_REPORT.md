# Enterprise Load Test Report — HAAT NOW

**Date:** 2026-06-24
**Target:** production data path — Supabase PostgREST REST API
`https://umwbzradvbsirsybfxfb.supabase.co/rest/v1` (anon key + RLS, the real customer-browse path).
**Query under test:** product grid with embedded images + variants
(`products?select=…,product_images(url),product_variants(…)&is_active=eq.true&limit=20`) — representative
of the dominant browse traffic; runs against the indexed schema from the scale sprint.
**Tool:** k6/Artillery were not reliably available in this sandbox; used an equivalent **Node closed-loop
concurrent load generator** (`docs/testing/loadtest.cjs`) — real concurrent HTTP, real percentile stats.
Raw data: `docs/testing/loadtest_results.json`.

---

## Measured results (ramping concurrency, 8 s per stage)

| Concurrency (in-flight) | RPS | P50 | P95 | P99 | Max | Failed % | Status codes |
|---|---|---|---|---|---|---|---|
| 10 | 53 | 167 ms | 231 ms | 787 ms | 816 ms | 0% | 200 |
| 50 | 266 | 175 ms | 212 ms | 586 ms | 727 ms | 0% | 200 |
| 100 | 486 | 190 ms | 301 ms | 437 ms | 603 ms | 0% | 200 |
| 250 | **577** | 379 ms | 964 ms | 1082 ms | 1435 ms | 0% | 200 |
| **500** | 461 | 656 ms | 1185 ms | **10519 ms** | 10566 ms | **1.73%** | 200 + timeouts |
| 1000 | 506 | 623 ms | **10550 ms** | 10670 ms | 10852 ms | **10.03%** | 200 + timeouts |
| 2000 | 379 | 787 ms | 12458 ms | 12667 ms | 12735 ms | **32.03%** | 200 + timeouts |

**Peak sustainable throughput ≈ 577 RPS** (at concurrency 250, 0% errors, P95 < 1 s). Beyond ~250–500
concurrent, RPS plateaus/declines while P95/P99 explode to **10–12 s timeouts** and failures climb.

## Requested metrics

| Metric | Measurement | Source |
|---|---|---|
| **P50 / P95 / P99** | see table (167 ms / 231 ms / 787 ms at low load → 656 ms / 1185 ms / 10519 ms at the knee) | load harness |
| **Response time** | 167–379 ms healthy; 10–12 s when saturated (timeouts) | load harness |
| **Failed requests %** | 0% ≤ conc 250; **1.73% @ 500**, 10.03% @ 1000, 32.03% @ 2000 | load harness |
| **Database connections** | **idle 16 total / 1 active; under load (conc 250) STILL 16 / 1 active; `max_connections = 60`** | `pg_stat_activity` (live) |
| **Realtime connections** | not WS-load-tested this sprint; tier limits Free **200** / Pro **500** default (see `DRIVER_STRESS_REPORT.md`) | Supabase docs |
| **CPU / Memory (host)** | not directly observable on managed infra; **inferred** as the bottleneck (DB idle ⇒ API/compute CPU saturates) | inference from DB-idle evidence |
| **Network** | reflected in response latency (TLS + transfer); cold first request ~1.3 s, warm ~170–210 ms | load harness |

## The decisive evidence — it is NOT the database
Under full load (concurrency 250, ~577 RPS), `pg_stat_activity` showed **1 active connection out of 16
pooled / 60 max** — the **database sat idle**. The request-handling tier (PostgREST + Kong gateway +
the compute instance's CPU for query planning/JSON serialization) is what saturates. The scale-sprint
indexes are working (DB cost is negligible); the ceiling is the **API/compute tier size**, not the schema.

## Notes / honesty
- "Concurrency" = simultaneous in-flight requests from one Node process; very high stages may also touch
  client-side socket limits, but the **error onset (conc 500) and DB-idle evidence** are unaffected by that.
- `max_connections=60` and ~577 RPS saturation indicate a **small compute tier** (Free/entry). Pro/Team
  larger compute raises both. Public catalog is anon-cacheable → a CDN would offload most of this traffic.
