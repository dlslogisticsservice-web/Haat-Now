# First-Week Monitoring Plan — HaaT Now (COD Launch)

Objective: catch regressions early and confirm the COD revenue path is healthy during the first
7 days of real traffic. Owner: on-call engineer + ops lead.

## Signals & sources
| Signal | Source | Green | Watch | Act |
|---|---|---|---|---|
| App availability | `/health.json` uptime check (external monitor, 1-min) | 200, fresh SHA | 1 miss | 2 consecutive misses → rollback |
| JS error rate | Sentry (`VITE_SENTRY_DSN`) | < 0.5% sessions | 0.5–2% | > 2% → investigate/rollback |
| Auth success | Supabase Auth logs | OTP delivered < 10s; verify > 95% | 90–95% | < 90% → check SMS provider |
| COD order creation | `orders` rows/hr + `payment_attempts` provider=`cod` | steady | drop vs baseline | zero for 15 min in peak → page |
| Checkout completion | funnel (`website-platform/analytics/funnel.ts`) | ≥ 60% | 40–60% | < 40% → UX/error triage |
| Order success | delivered / created | ≥ 90% | 80–90% | < 80% → dispatch/merchant review |
| Tracking latency | tracking_update p95 (funnel) | < 8s | 8–15s | > 15s → realtime/RPC check |
| DB health | Supabase dashboard (CPU, connections, slow queries) | nominal | rising | saturation → scale plan |
| Settlement | daily `generate_*_settlement` output | runs 04:00 | skipped | missing → check pg_cron |

## Cadence
- **Day 0 (launch) — h1 to h+4:** live watch. Re-run the role smoke tests (`GO_LIVE_CHECKLIST.md`) at h+1. Confirm first real COD order end-to-end (browse → COD → track → delivered → wallet credit).
- **Days 1–3:** twice-daily review (morning + peak). Confirm nightly settlements + segment recompute ran.
- **Days 4–7:** daily review. Trend the funnel metrics; compare day-over-day.

## Dashboards to have open
- Sentry issues (new + regressions).
- Supabase → Database (load), Auth (sign-ins), Logs (edge functions if cards enabled).
- Vercel → Analytics + Deployment status.
- Funnel metrics (checkout completion, abandonment, order success, tracking latency).

## Daily standing checks
- [ ] `/health.json` 200 with current SHA.
- [ ] COD orders flowing; none stuck in `pending` > 30 min without merchant action.
- [ ] No auth failure cluster.
- [ ] Driver wallet credits posting on delivery.
- [ ] Settlement job ran (04:00) and finance dashboard totals sane.
- [ ] Sentry error budget intact.

## Exit criteria (end of week 1)
Stable if: availability ≥ 99.5%, error rate < 1%, COD order-success ≥ 90%, no unresolved P0/P1,
settlements posted daily. Then relax to normal on-call cadence.
