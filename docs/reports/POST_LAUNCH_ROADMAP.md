# Post-Launch Enterprise Roadmap — HAAT NOW

**Date:** 2026-06-24 · The path from "single-market web MVP" to "enterprise competitor parity," sequenced
by dependency and business value. Grounded in the gap analysis (what's MISSING) — not aspirational.
Effort: S < 1d · M 1–3d · L 3–7d · XL > 7d · XXL = multi-week program.

---

## Phase 0 — Stabilize the soft launch (weeks 0–2)
Close P0/P1 from `PRE_LAUNCH_MASTER_CHECKLIST.md`: auth/payment/env config, remove mock data, monitoring,
CDN, merchant earnings correctness, refund UI. **Goal:** a clean, honest COD/Saudi web launch.

## Phase 1 — Native mobile + push (weeks 2–6) · XXL
The single biggest gap for a delivery business. No native app or device push exists today.
1. Capacitor wrapper (Android + iOS), `appId`, icons/splash, native permissions (location/bg-location/
   camera/notifications).
2. Device push: Firebase project → FCM (Android) + APNs (iOS); wire real `registerPushToken` →
   `push_tokens`; **build a send-side edge function** (FCM/APNs) — none exists.
3. Order-status + dispatch push notifications (customer + driver).
4. Deep/universal links (`assetlinks.json`, `apple-app-site-association`).
5. Store assets + privacy policy + data-safety forms → submit to Play + App Store.

## Phase 2 — Supply scaling: onboarding, KYC, approval (weeks 4–9) · XXL
Today merchants/drivers exist only via DB seed — cannot scale supply.
1. Merchant self-onboarding + branch creation + business hours.
2. Driver self-onboarding + **document upload** (license/vehicle/ID) → Storage.
3. **KYC verification + approval workflow** (`account_status`: pending→approved/rejected) with admin
   review queue.
4. Contracts (merchant/driver) + acceptance tracking.
5. Suspension / ban system + audit trail.

## Phase 3 — Finance engine (weeks 6–12) · XXL
Required before real multi-merchant money movement at volume.
1. **Commission engine** (`commission_rules` per merchant/category) + per-order commission capture.
2. **Settlement engine** + **scheduler** (periodic merchant + driver settlements from earnings/commissions).
3. Merchant payouts (driver payouts already exist — generalize).
4. Compensation + refund-to-wallet workflows; **accounting exports** (CSV/ledger) + finance reports.
5. Revenue/finance dashboard (replace single-number KPI).

## Phase 4 — Operations at scale (weeks 8–14) · XL–XXL
1. **Live maps:** orders/drivers/merchants on a real map (Google Maps key) + heat maps.
2. Batch dispatch + reassignment UI + delivery monitoring (live, not log).
3. Realtime redesign: **zone-scoped channels** (lifts the ~376-socket ceiling) + driver location off REST
   → Realtime broadcast + batched persistence.
4. Background **queue** (dispatch/notifications/location/settlements) + **Redis** cache.
5. Compute upgrade per the 50k→100k/day scale roadmap.

## Phase 5 — Growth + marketing (weeks 10–16) · L–XL
1. **Referral / invite engine** (`referrals`, codes, attribution) + cashback.
2. Affiliate + influencer tracking.
3. Loyalty **tiers** (current loyalty is flat points).
4. Marketing delivery: push/SMS/email campaigns + **audience segmentation** engine.
5. Dynamic promotions (rules engine vs static campaign config).

## Phase 6 — Analytics + support maturity (weeks 12–18) · L
1. **Materialized-view pre-aggregation** (admin dashboards do full scans today: 927 ms @ 500k orders).
2. Cohort / geographic / customer / conversion analytics.
3. Support **escalation + SLA tracking** + complaint workflow + support analytics.
4. Admin CRUD screens: country/city/user/customer/role/permissions/reports + feature-flag toggles.
5. Trust & safety: **risk + fraud** management.

## Dependency order (do not skip)
```
Phase 0 stabilize ─► Phase 1 native+push ─► Phase 2 onboarding/KYC ─► Phase 3 finance engine
                                          └► Phase 4 ops-at-scale (parallel w/ 50k+ traffic)
Phase 5 growth + Phase 6 analytics/support ── after supply + finance exist
```

## Reality check
- **Already strong (do not rebuild):** ops/dispatch engine, driver lifecycle, customer commerce,
  campaigns, branding, payments, support tickets.
- **The roadmap is essentially building the "enterprise admin + finance + growth + native" half that does
  not exist yet.** Treat each phase as a program, not a ticket. Sequencing matters: finance and trust must
  precede aggressive supply/demand growth, and native+push should precede heavy marketing spend.
