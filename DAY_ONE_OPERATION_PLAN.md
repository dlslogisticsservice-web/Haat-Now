# Day-One Operation Plan — HAAT NOW

The runbook for launch day and the first weeks of live operation. Pairs with `PRODUCTION_HANDOVER.md`.

## 1. Monitoring schedule
| Window | Cadence | Watch |
|---|---|---|
| **Launch day (first 4h)** | every 15 min | `/health.json` uptime · Sentry errors · payment success rate · SLA monitor (delayed orders) · live order volume |
| **Day 1 (rest)** | hourly | error rate · failed-order incident log · driver availability · wallet/settlement sanity |
| **Week 1** | 3×/day | KPIs (below) · slow queries (Supabase advisors) · crash-free rate · push delivery |
| **Steady state** | daily + alerts | dashboards + automated alerts only |
- **Automated alerts**: uptime monitor on `/health.json`; Sentry alert rules (error spike); Supabase
  alerts (CPU/connections); payment webhook failure alert.

## 2. Support workflow
1. **Channels**: in-app support tickets (`support_tickets`) + WhatsApp/email (Profile → Support).
2. **L1 (Support agent)**: triage tickets, answer FAQs, use the **Admin → Customer Care / Support**
   console; issue refunds/wallet credits via Finance where authorized.
3. **L2 (Ops)**: order/driver issues → **Operations → Execution Console** (reassign / pause) +
   **Incident Log** (failed orders + reasons).
4. **L3 (Engineering on-call)**: platform/payment/deploy issues → rollback / PITR / gateway support.
- **SLA targets**: first response < 15 min (launch day) / < 1h (steady); resolution < 4h for P1.

## 3. Incident escalation
| Severity | Example | Owner | Escalate after |
|---|---|---|---|
| **P1** | site down / payments failing / data loss | Engineering on-call | immediate |
| **P2** | dispatch broken / push down / region slow | Ops + Eng | 15 min |
| **P3** | single merchant/zone issue / UI glitch | Ops / Support | 1h |
| **P4** | cosmetic / feature request | Backlog | next sprint |
- Path: L1 → L2 (Ops) → L3 (Eng on-call) → Platform vendor (Supabase/Vercel/Paymob/Moyasar).

## 4. Rollback decision tree
```
Issue detected
 ├─ Started right after a deploy?  → YES → Vercel: Promote previous deployment → verify /version.json → DONE
 │                                  → NO  ↓
 ├─ Data corruption / bad migration? → YES → Supabase PITR restore to pre-incident timestamp → verify → DONE
 │                                    → NO  ↓
 ├─ External service down (payment/maps/push)? → YES → enable degraded mode (COD-only / map fallback),
 │                                                     status page, wait on vendor → monitor
 │                                              → NO  ↓
 └─ App bug → hotfix on a branch → CI green → fast-forward main → auto-deploy → verify SHA
```
- **Always verify after any action**: `/version.json` SHA + `/health.json` 200 + a smoke order.

## 5. Post-launch KPIs
| KPI | Source | Target (week 1) |
|---|---|---|
| Crash-free sessions | Sentry | > 99.5% |
| Uptime | `/health.json` monitor | > 99.9% |
| Order success rate (delivered / placed) | Finance / orders | > 90% |
| Payment success rate | payment_transactions | > 95% |
| Avg delivery time / SLA breaches | SLA monitor | < 45 min / < 5% |
| Failed-order rate (rejects/failures) | Incident log | < 8% |
| Driver acceptance time | dispatch | < 60s |
| p95 page TTFB | Vercel analytics | < 1s |
| D1/D7 retention, AOV, active merchants/drivers | analytics | track & trend |

## 6. Merchant onboarding
1. Super Admin → **Records → Merchants → Add** (or White Label provision for a brand).
2. Create **Branch** (Records → Branches) → assign **Merchant** + **Zone** (relation pickers).
3. Add **Categories** + products (Merchant portal: Store Management / catalog).
4. Set **working hours / status** (Merchant settings); verify documents (KYC/Compliance).
5. Confirm the branch shows in the customer marketplace; place a test order end-to-end.

## 7. Driver onboarding
1. Super Admin → **Records → Drivers → Add** (name, phone) → assign **Zone**.
2. Add a **Vehicle** (Records → Vehicles) → **Assign Driver** (relation picker); set insurance/license.
3. Driver logs in (phone OTP) → goes **Online** → starts a **Shift** (Execution Console / driver app).
4. Verify the driver receives an available job, can accept → pick up → deliver, and the **wallet credits**.
5. Confirm KYC/documents in Compliance; set availability.

## 8. Launch-day go/no-go (final gate)
- ☐ Production env vars + payment keys + webhook secret set · ☐ migrations applied · ☐ FCM live ·
  ☐ Maps key live · ☐ uptime + Sentry alerts armed · ☐ `/health.json` green · ☐ one real test order
  (place → accept → deliver → settle) · ☐ rollback rehearsed · ☐ support staffed.
- **All checked → GO.**
