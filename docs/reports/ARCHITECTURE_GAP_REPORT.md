# Architecture Gap Report — HAAT NOW

**Date:** 2026-06-24 · Answers grounded in the measurements in `ULTIMATE_SCALE_REPORT.md`.
Where a number is not directly measured (orders→requests mapping, pricing), it is **labelled
"assumption" or "list price"** and the math is shown.

---

## Q1 — What breaks first?
**The Realtime WebSocket connection ceiling.** Measured saturation at **~376 concurrent connections**
(24 of 400 errored at ~376) on the current tier. The driver fleet + live order tracking each hold a
socket, so this wall is hit by **a few hundred simultaneously-online drivers/customers** — long before
the database (idle under load) or even the browse API (577 RPS).

Order of failure as you scale:
1. **Realtime sockets** — ~376 concurrent.
2. **Driver location over REST** — 5,000 drivers × update/5 s = **1,000 req/s > 577 RPS** API ceiling.
3. **API / compute** — browse saturates at **577 RPS ≈ 2,500–4,600 concurrent users**.
4. **Admin analytics** — 0.1–0.9 s/query at 500k orders, **linear** growth.
5. **Core CRUD DB** — not a bottleneck (7–12k writes/s; indexed reads 1–4 ms).

## Q2 — At what scale?
- Realtime sockets: **~376 concurrent subscribers** (current tier). Target is thousands (5k drivers).
- Driver-location stream: breaks at **~3,000–5,000 active drivers** (REST path).
- Browse/API: **~2,500–4,600 concurrent users** (577 RPS, think-time dependent).
- Admin analytics UX: degrades **≥ 500k cumulative orders**.

## Q3 — Required architecture changes (priority order)
1. **CDN / edge cache the public catalog** (products/merchants/branches — anon, read-mostly). Removes the
   majority of the 577-RPS browse load. *Highest leverage, lowest effort.*
2. **Move driver location OFF per-request REST** → Realtime **broadcast/presence** (peer fan-out, no DB
   write per tick) with **batched persistence** (write last-known position every N seconds via a queue or
   edge function). Eliminates the 1,000 req/s REST pressure.
3. **Zone-scoped Realtime channels** (~500 zones) instead of per-driver/per-customer global subscriptions
   → bounds concurrent channels and fan-out; pairs with a higher Realtime tier.
4. **Pre-aggregate admin analytics** — materialized views / rollup tables refreshed by a **background job**
   (or cached in Redis), so the dashboard reads pre-computed rows instead of 0.9 s full scans.
5. **Edge Functions for order orchestration** — validate + create order + items + dispatch in one
   server-side transaction, cutting multi-round-trip client REST pressure.
6. **Upgrade compute tier** for API/PostgREST headroom (linear RPS gain).

## Q4 — Do we need Redis?  **YES.**
Evidence-backed uses:
- **Admin dashboard cache** — aggregates cost 0.1–0.9 s each (measured); cache for 30–60 s to avoid
  re-scanning per load.
- **Hot catalog / config cache** — offload repeat reads from the 577-RPS-bound API.
- **Ephemeral driver-location store** — high-write (1,000 writes/s) live positions belong in an in-memory
  store, not Postgres WAL.
- **Rate limiting / abuse control** at the edge.
*(Managed option: Upstash Redis; or self-host. Not required for a < ~10k-orders/day launch, required by
50k+.)*

## Q5 — Do we need background queues?  **YES (by 50k orders/day).**
- **Order assignment / driver dispatch** — async matching instead of blocking the request.
- **Notification fan-out + push delivery** — decouple from the write path (inserts 7,151/s but delivery is
  slow/external).
- **Batched driver-location persistence** — coalesce the 1,000 req/s stream into periodic bulk writes
  (DB does 10,965 rows/s in bulk — measured).
- **Analytics rollups** — refresh materialized views off the request path.
*(Options: Supabase `pg_cron` + a queue table for light needs; a real broker — SQS/Redis Streams/QStash —
at 50k+/day.)*

## Q6 — Do we need Edge Functions?  **YES (already in use; expand).**
Payments already run as edge functions (service-role, server-side). Extend to: **order orchestration**
(single server-side transaction), a **driver-location ingest batcher**, **webhook/payment callbacks**, and
**dispatch triggers**. This consolidates client round-trips and keeps secrets server-side.

## Q7 — Do we need CDN caching?  **YES — the single highest-leverage change.**
The browse path (anon, RLS-public catalog) is what saturated the API tier at 577 RPS. Edge-caching it
(Cloudflare/Vercel/Supabase Storage CDN) offloads the **bulk** of read traffic before it reaches compute,
directly raising effective user capacity. Already partially true for static assets; extend to catalog API
responses (short TTL + revalidation).

## Q8 — Monthly infrastructure cost
**List prices** are Supabase published rates (facts). **Assumptions** (labelled) bridge orders→load:
peak hour ≈ 15% of daily orders; ≈ 25 requests/order (browse-heavy); ≈ 1 driver online per 40 daily
orders. Components broken out so you can re-derive.

| | **10k orders/day** | **50k orders/day** | **100k orders/day** |
|---|---|---|---|
| Peak orders/hr (15%) | 1,500 (0.42/s) | 7,500 (2.1/s) | 15,000 (4.2/s) |
| Drivers online (~/40) | ~250 | ~1,250 | ~2,500 |
| Realtime concurrent (drivers+trackers) | ~500–800 | ~2,500–4,000 | ~5,000–8,000 |
| **Binding constraint** | Realtime > 376 | Realtime + API RPS | Realtime + API + analytics |
| Supabase plan | **Pro** $25 | **Team** $599 (realtime) | **Team** $599 |
| Compute add-on | Small/Medium $15–60 | Large/XL $110–210 | 2XL $410 |
| Redis (Upstash) | optional ~$10 | ~$50 | ~$100 |
| Queue/edge (QStash/functions) | included/low | ~$20 | ~$50 |
| CDN (Cloudflare) | $0–20 | $20 | $20–50 |
| Egress + realtime msgs | ~$10 | ~$50–100 | ~$150–250 |
| **Estimated total / mo** | **~$60–120** | **~$450–800** | **~$1,100–1,600** |

Notes:
- The **realtime socket count**, not the database, is what forces **Team** at 50k+/day (Pro default ≈ 500
  concurrent). A **zone-channel redesign** (Q3.3) can keep 50k/day on **Pro + XL compute (~$235 + Redis)**
  instead of Team — a meaningful saving, contingent on the realtime rework.
- Costs **exclude** Twilio/SMS (OTP) and the payment gateway's per-transaction fees (pass-through).
- The DB tier needs **no premium** for these volumes (idle under load) — spend goes to compute/realtime/CDN.

## Summary
Nothing in the **application code or database schema** is the blocker — the gaps are **infrastructure and
data-flow architecture**: CDN, realtime redesign + tier, queues, Redis cache, and pre-aggregated analytics.
The launch checklist in `PRODUCTION_LAUNCH_CHECKLIST.md` sequences these.
