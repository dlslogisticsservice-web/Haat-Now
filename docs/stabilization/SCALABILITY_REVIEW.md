# Scalability Review — HaaT Now

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> Target load: 100k orders/day · 10k concurrent drivers · 1k merchants · 100 tenants · 20 countries. Evidence cited `file:line`.

## Architecture at a glance

- **Client:** React 19 SPA (Vite), Capacitor for mobile. Vendor chunk splitting configured (`vite.config.ts:27-34`).
- **Backend (live mode):** Supabase (Postgres + PostgREST + Realtime + Storage) + 4 Deno edge functions (payments only).
- **No application server, no queue, no cache, no worker tier, no scheduler.** All business logic is either in the browser or in Postgres RPCs.

## Verdict up front

The **shipped default build does not scale — because it is a single-browser localStorage app** (sandbox). Question is moot until `HAAT_LIVE_BACKEND=1`. In **live mode**, the DB-centric design is reasonable for moderate load but hits real ceilings well before the target numbers, primarily due to **the absence of a job/queue tier**, **realtime fan-out**, and **unbounded/aggregation queries**.

---

## Bottlenecks

### 🔴 1. No background-job / queue tier
Everything time-based is a manual button (dispatch expiry, reassignment, settlement, segment recompute, reconciliation — see OPERATIONS). At 100k orders/day (~70/min sustained, higher at peaks) **automatic dispatch and offer-timeout must run continuously**; there is no mechanism to do so. This is the #1 scaling blocker — it is not a tuning problem, it is a missing component.

### 🔴 2. Realtime fan-out
Ops console subscribes to `driver_locations`, `drivers`, `orders` postgres_changes (`command.service.ts:109-114`); customers subscribe per order (`cx.service.ts:107-113`). With 10k drivers streaming GPS, `driver_locations` change events explode; Supabase Realtime broadcasts each change to every matching subscriber. No throttling/batching/geohash partitioning. Location writes on every `watchPosition` tick (`DriverApp.tsx:193-212`) with no debounce → write amplification + realtime storm.

### 🟠 3. GPS location model
GPS writes to `driver_locations.coords` but reads happen from `drivers.current_lat/lng` (never updated by the loop) — so today it's *stale* rather than *hot*, but once fixed, per-tick row updates on `drivers` (10k rows churning) become a write-hotspot. Needs a dedicated time-series/append store or PostGIS + batched upserts.

### 🟠 4. Aggregation / analytics queries on hot tables
`analytics.service.ts:13-51` and finance/growth RPCs aggregate directly over `orders`/`driver_earnings` at request time. At 100k/day these tables grow ~36M rows/year; unindexed or full-scan aggregations degrade. Some indexes exist (`20260614000027_scale_indexes`, `20260627000002_performance_indexes`, `20260627000009_phase1_index_reconciliation`) — good — but there are **no materialized views / rollup tables** for dashboards; every dashboard load re-aggregates live.

### 🟠 5. Client-authored totals & cart in localStorage
Cart is localStorage-only (`cart.service.ts`); totals computed client-side. Fine for scale, but means no server-side cart analytics/abandonment and re-trust issues at checkout.

### 🟡 6. Order creation = 3 round-trips
Non-transactional multi-insert (`order.service.ts:25-77`) is 3-4 network round-trips per order vs one RPC. At peak this multiplies PostgREST connection pressure. A `create_order` RPC would cut latency and fix atomicity simultaneously.

### 🟡 7. Connection pooling / PostgREST limits
All reads/writes go through PostgREST on one Supabase project. 100 tenants + 20 countries on one project shares one connection pool and one Postgres instance — no sharding, no read replicas configured. Supabase can scale vertically + pooler, but there is no horizontal strategy documented.

### 🟡 8. Notifications
In-app DB inserts per event; no batching. Push/SMS/email delivery is absent — when added, it MUST be a queue-backed worker, which doesn't exist yet.

---

## What's already good for scale

- 🟢 Money-path RPCs are single-round-trip, locked, idempotent (wallet, delivery, coupon, webhook) — these scale well and safely.
- 🟢 Index migrations show deliberate attention (`20260614000027`, `20260627000002/09`).
- 🟢 Vendor chunk splitting keeps the entry bundle small.
- 🟢 Webhook idempotency handles provider retry storms gracefully.

---

## Caching & async opportunities (currently unused)

| Opportunity | Status |
|---|---|
| Redis/edge cache for catalog & storefront | ❌ none |
| Materialized views / rollups for analytics | ❌ none |
| Queue (dispatch, notifications, settlements) | ❌ none |
| Scheduled workers (pg_cron / cron edge) | ❌ none |
| Read replicas | ❌ none |
| CDN for assets | 🟡 Vercel/static implied, not documented |
| Realtime throttling / geohash channels | ❌ none |

## Verdict

**Scalability grade: prototype-to-early-production.** The synchronous, DB-only architecture with no job/queue/cache tier is appropriate for a pilot (single country, thousands of orders/day) but **will not meet the stated enterprise targets** without adding: (1) a scheduled worker/queue tier, (2) realtime throttling + a proper location store, (3) rollup tables for analytics, (4) a horizontal DB strategy for 100 tenants / 20 countries. None of these are architectural dead-ends — but they are **not built**.
