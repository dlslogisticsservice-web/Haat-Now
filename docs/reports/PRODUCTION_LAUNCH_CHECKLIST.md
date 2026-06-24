# Production Launch Checklist — HAAT NOW

**Date:** 2026-06-24 · Sequenced from measured findings (`ULTIMATE_SCALE_REPORT.md`,
`ARCHITECTURE_GAP_REPORT.md`). Grouped by what blocks which scale.

---

## A. Already done (prior sprints — verified)
- [x] Security: 0 Critical / 0 High; RLS write-policy lockdown (`app_config`, `payment_transactions`,
      `support_messages`); top-level `ErrorBoundary`.
- [x] Scale indexes applied live (`20260614000027_scale_indexes.sql`) — hot reads 0.2–3.9 ms (13–1500×);
      DB idle under load.
- [x] E2E 24/24, build, lint green.
- [x] Load tested: API ceiling 577 RPS; Realtime ceiling ~376 concurrent; admin analytics 0.1–0.9 s.

## B. Launch-blocking for ANY production (config — do before go-live)
- [ ] Set Vercel envs (`VITE_AUTH_MODE=supabase`, Supabase URL/anon key); confirm sandbox tree-shaken.
- [ ] **Rotate the Supabase management token** used by dev scripts (exposed in sprint tooling).
- [ ] Real Twilio (replace test OTP `123456`) + payment gateway keys (edge-fn env).
- [ ] Supabase Auth: site URL, redirect URLs, OTP rate limits confirmed.
- [ ] Wire `ErrorBoundary.onError` + edge-function logs to monitoring (Sentry/Logflare).
- [ ] Daily DB backups / PITR enabled.

## C. Required for ~10k orders/day (first real scale)
- [ ] **CDN-cache the public catalog** (products/merchants/branches) — highest-leverage; offloads most of
      the 577-RPS browse load.
- [ ] Move to **Supabase Pro**; size compute Small→Medium per observed CPU.
- [ ] **Raise/verify Realtime concurrency** — current ceiling ~376 < expected ~500–800 online; either Pro
      limits or begin the zone-channel redesign (below).
- [ ] Add `.range()` pagination to HomeScreen restaurant list + orders list.

## D. Required for ~50k orders/day
- [ ] **Driver location off REST** → Realtime broadcast/presence + **batched persistence** (queue/edge
      function). Removes the 1,000 req/s REST pressure (measured > 577 RPS ceiling).
- [ ] **Zone-scoped Realtime channels** (~500 zones) instead of per-driver/customer global subscriptions.
- [ ] **Background queue** for dispatch/assignment + notification fan-out + location batching
      (pg_cron+queue table → broker).
- [ ] **Redis** cache for admin dashboard aggregates (0.1–0.9 s queries) + hot catalog/config.
- [ ] **Pre-aggregate analytics** — materialized views / rollup tables refreshed by a scheduled job.
- [ ] Compute Large/XL; **Team tier** (realtime) OR Pro+zone-channels if the redesign lands.

## E. Required for ~100k orders/day
- [ ] All of D, plus compute **2XL**, Redis cluster, dedicated queue broker.
- [ ] Read-replica / connection-pooler tuning if write volume rises (DB still has headroom today).
- [ ] Realtime horizontal scaling (Team/enterprise) + zone channels mandatory.
- [ ] Load/chaos test the redesigned location + dispatch path before ramp.

## F. Edge Functions (expand existing payments usage)
- [ ] Order orchestration (validate+create+items+dispatch) server-side in one transaction.
- [ ] Driver-location ingest batcher.
- [ ] Payment/webhook callbacks.

## G. Observability (before 50k/day)
- [ ] Dashboards: API RPS + P95/P99, Realtime concurrent connections, queue backlog, DB CPU/connections.
- [ ] Alerts: P95 > 1 s, Realtime connections > 80% of tier, queue backlog growing, error rate > 1%.

---

## Cost gate summary (from ARCHITECTURE_GAP_REPORT Q8)
| Scale | Plan | Est. total/mo | Forced by |
|---|---|---|---|
| 10k orders/day | Pro + CDN | ~$60–120 | Realtime > 376 |
| 50k orders/day | Team (or Pro+zone-channels) + Redis + queue | ~$450–800 | Realtime + API RPS |
| 100k orders/day | Team + 2XL + Redis + queue | ~$1,100–1,600 | Realtime + API + analytics |

**Bottom line:** code and schema are launch-ready; the remaining work is **infrastructure & data-flow
architecture** (CDN, realtime redesign + tier, queues, Redis, pre-aggregated analytics), staged by scale.
