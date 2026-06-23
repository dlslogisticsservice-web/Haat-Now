# Capacity Limit Report — HAAT NOW

**Date:** 2026-06-24 · Evidence: `ENTERPRISE_LOAD_TEST_REPORT.md` + live `pg_stat_activity` sampling.
All numbers measured against the **production Supabase REST API** on the **current (entry/small) compute
tier** (`max_connections = 60`).

---

## Q1 — At what exact point does the system begin failing?

**Measured break point: ~500 concurrent in-flight requests (≈ the moment offered load exceeds ~577 RPS).**

| Load | Behaviour |
|---|---|
| ≤ 250 concurrent / ≤ **577 RPS** | **Healthy** — 0% failures, P95 < 1 s |
| **500 concurrent** | **Failure onset** — **1.73%** timeouts, P99 jumps **1.08 s → 10.5 s** |
| 1000 concurrent | Degraded — 10.0% failures, P95 10.5 s |
| 2000 concurrent | Collapsing — 32.0% failures, P95 12.5 s |

**Mapped to concurrent users** (a browsing user issues ~1 request every *T* seconds of think-time):

| Think-time *T* | Healthy ceiling (577 RPS) | Failure onset (~500 RPS effective) |
|---|---|---|
| 3 s | ~1,700 users | ~1,500 users |
| 5 s | **~2,900 users** | ~2,500 users |
| 8 s | ~4,600 users | ~4,000 users |

> **Exact answer:** on the current tier the system is healthy to **~577 requests/second** and **begins
> failing at ~500 simultaneous requests**, which is **≈ 2,500–4,600 concurrent active browsing users**
> (think-time dependent). It does **not** reach the 10,000-concurrent-user target on this tier — failure
> begins at roughly **a quarter to a half** of that.

## Q2 — What is the first bottleneck?  → **The API / compute tier. NOT the database.**

| Candidate | Verdict | Evidence |
|---|---|---|
| **Database** | ❌ not the bottleneck | Under full load (577 RPS) `pg_stat_activity` = **1 active / 16 pooled / 60 max** — DB idle. Scale-sprint indexes keep query cost negligible. |
| **API / compute (PostgREST + Kong + instance CPU)** | ✅ **first bottleneck** | Throughput plateaus at **~577 RPS** and P99 explodes to 10 s **while the DB is idle** → the request-handling/serialization layer (compute CPU) is saturated, not the data layer. |
| **Realtime** | ❌ not hit here | Separate subsystem; its own ceiling (Free 200 / Pro 500 sockets) is the *driver-fleet* limiter (see `DRIVER_STRESS_REPORT.md`), not the browse path. |
| **Frontend** | ❌ not the bottleneck | Static assets are CDN-served; entry bundle 312 KB, lazy routes. The wall is server-side request throughput. |

**Why it's the API tier and not the DB — the smoking gun:** at ~577 RPS the database reported **1 active
connection out of 60**. If the DB were the limit we would see connections pinned near 60 with high active
counts. Instead the pooler multiplexes everything onto ~16 backends that sit idle — the ceiling is the
**compute instance's CPU** doing TLS/HTTP/PostgREST planning/JSON serialization.

## Q3 — Evidence
- Percentile table + RPS curve: `ENTERPRISE_LOAD_TEST_REPORT.md`, raw `docs/testing/loadtest_results.json`.
- DB-idle-under-load: `pg_stat_activity` sampled 4× during a 577-RPS burst → constant `1 active / 16 total`.
- `max_connections = 60` (current tier).

## How to raise the ceiling (in priority order)
1. **CDN-cache the public catalog** (products/merchants/branches are anon, RLS-public, read-mostly).
   Caching the browse path at the edge removes the **majority** of the 577-RPS load before it reaches
   compute — the single highest-leverage change. *(App/infra change, not a schema bug.)*
2. **Upgrade Supabase compute tier** (Pro/Team = more CPU for PostgREST/Kong + larger pooler) → linearly
   raises the RPS ceiling. The DB schema is already not the limit.
3. **Trim the browse payload** — the embed (`product_images` + `product_variants`) inflates serialization
   CPU per request; a lighter list query (image cover only, variants on detail) reduces per-request cost.

## Bottom line
- **Database & schema: not the bottleneck** (idle under load; scale-sprint indexes working).
- **First bottleneck: API/compute tier**, saturating at **~577 RPS ≈ 2,500–4,600 concurrent users** on the
  current entry tier.
- **Path to 10,000 concurrent users:** edge-cache the public catalog + upgrade compute — no code defect to
  fix; these are infra/config levers.
