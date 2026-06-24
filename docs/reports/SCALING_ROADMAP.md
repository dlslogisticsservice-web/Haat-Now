# Scaling Roadmap — HAAT NOW

**Date:** 2026-06-24 · Prioritized by **impact ÷ cost**, from measured evidence. **No new tests.**
Each item tagged **[CRITICAL BEFORE LAUNCH] · [IMPORTANT AFTER LAUNCH] · [FUTURE SCALE]**.

---

## Prioritization (impact vs effort)
| Rank | Fix | Impact | Effort/cost | Removes which measured limit | Class |
|---|---|---|---|---|---|
| 1 | **CDN-cache public catalog** | ★★★★★ | Low | 577-RPS browse ceiling | CRITICAL BEFORE LAUNCH |
| 2 | **Rotate mgmt token + set prod envs/keys** | ★★★★★ | Low | security/launch blocker | CRITICAL BEFORE LAUNCH |
| 3 | **Wire monitoring** (onError + edge logs) | ★★★★ | Low | blind-in-prod risk | CRITICAL BEFORE LAUNCH |
| 4 | **DB backups / PITR** | ★★★★ | Low | data-loss risk | CRITICAL BEFORE LAUNCH |
| 5 | **Raise/verify realtime limit** (Pro) + paginate lists | ★★★ | Low | ~376 socket wall (short-term) | CRITICAL BEFORE LAUNCH |
| 6 | **Driver location off REST → Realtime broadcast + batched persist** | ★★★★★ | Med | 1,000 req/s > 577 RPS | IMPORTANT AFTER LAUNCH |
| 7 | **Zone-scoped realtime channels** | ★★★★ | Med | ~376 socket wall (structural) | IMPORTANT AFTER LAUNCH |
| 8 | **Background queue** (dispatch, notifications, location batching) | ★★★★ | Med | synchronous bottleneck | IMPORTANT AFTER LAUNCH |
| 9 | **Redis cache** (admin aggregates + hot catalog) | ★★★ | Med | 0.1–0.9 s analytics recompute | IMPORTANT AFTER LAUNCH |
| 10 | **Pre-aggregated analytics** (materialized views) | ★★★ | Med | 927 ms dashboard scans | IMPORTANT AFTER LAUNCH |
| 11 | **Edge-function order orchestration** | ★★★ | Med | multi-round-trip API pressure | IMPORTANT AFTER LAUNCH |
| 12 | **Compute upgrade** (Large/XL → 2XL) | ★★★ | $$ | 577-RPS API ceiling | FUTURE SCALE |
| 13 | **Redis cluster + dedicated queue broker** | ★★★ | $$$ | 100k/day async load | FUTURE SCALE |
| 14 | **Realtime horizontal scaling** (Team/enterprise) | ★★★ | $$$ | thousands of concurrent sockets | FUTURE SCALE |
| 15 | **Read-replica / pooler tuning** | ★★ | $$ | only if write volume rises | FUTURE SCALE |

---

## Stage 0 — Launch (≤ 10k orders/day) · **[CRITICAL BEFORE LAUNCH]**
Items **1–5**. Plan: **Supabase Pro + Small/Medium compute + CDN**. Est. **~$60–120/mo**.
Removes the immediate browse ceiling (CDN) and closes all launch-blocking config/security/observability
gaps. Measured headroom: API 577 RPS, DB idle, hot reads 1–4 ms — ample for ≤10k/day.

**Exit criteria:** token rotated, envs/keys set, monitoring live, backups on, catalog cached, realtime
limit ≥ expected concurrent (drivers + trackers).

## Stage 1 — Growth (≤ 50k orders/day) · **[IMPORTANT AFTER LAUNCH]**
Items **6–11**. Plan: **Team (or Pro + zone-channels) + Large/XL compute + Redis + queue**.
Est. **~$450–800/mo**.
- **#6 + #7** lift the realtime wall (the first thing that breaks) and kill the 1,000-req/s location load.
- **#8** decouples dispatch/notifications/location-persist from the request path (DB does 10k+ rows/s in
  bulk — measured — so batching is cheap).
- **#9 + #10** cut admin analytics from 0.9 s scans to cached/pre-aggregated reads.

**Exit criteria:** realtime sustains thousands of concurrent sockets; driver location no longer hits
PostgREST per tick; admin dashboard < 200 ms; queue backlog observable + draining.

## Stage 2 — Scale (≤ 100k orders/day) · **[FUTURE SCALE]**
Items **12–15**. Plan: **Team + 2XL compute + Redis cluster + dedicated broker**.
Est. **~$1,100–1,600/mo**. Engage only after Stage 1 is proven; re-load-test the redesigned location +
dispatch path before ramping.

---

## Dependency order (do not skip)
```
Stage 0: CDN ─┬─ token/envs ─┬─ monitoring ─┬─ backups ─┬─ realtime limit   → LAUNCH ≤10k/day
Stage 1: location-off-REST ─→ zone-channels ─→ queue ─→ Redis ─→ matviews ─→ edge orchestration  →  ≤50k/day
Stage 2: compute 2XL ─→ Redis cluster + broker ─→ realtime horizontal scale  →  ≤100k/day
```

## Guiding fact (measured)
Across every test the **database tier was never the bottleneck** (idle under load, 7–12k writes/s, 1–4 ms
reads). Spend and engineering effort belong in **edge/realtime/compute/async**, in the order above — not in
the schema, which is already done.
