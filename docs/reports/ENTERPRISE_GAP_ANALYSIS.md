# Enterprise Gap Analysis — HAAT NOW vs Competitor Parity

**Date:** 2026-06-24 · Method: forensic READ-ONLY audit of the actual codebase, live Supabase schema
(59 tables, 30+ RPCs), edge functions, services, and admin/merchant/driver/customer screens. No code or
DB was modified. Brutally honest — evidence-cited; absent features marked MISSING, not assumed.

> **Scope honesty:** the competitor *screenshots* were not in this session's context. Parity is assessed
> against the **explicit Section-2 feature lists you enumerated** (treated as the competitor baseline) plus
> the Section-1 module list. Companion detail: `FEATURE_PARITY_MATRIX.md`.

---

## Executive verdict (no inflation)
HAAT NOW is a **solid single-market food-delivery MVP with a genuinely strong operations engine**, but it
is **far from the advertised enterprise/competitor surface**. Production-grade work exists in **~6 areas**;
roughly **40% of the rated catalog is MISSING**, and there is **no native mobile app at all**.

| Layer | COMPLETE | PARTIAL | MISSING |
|---|---|---|---|
| Customer app (22) | 14 | 6 | 2 |
| Merchant app (16) | 6 | 3 | 7 |
| Driver app (16) | 10 | 2 | 4 |
| Admin + enterprise (63) | 13 | 17 | 33 |
| Mobile store (13) | 0 | 0 | 13 |
| **Total (~130)** | **~43** | **~28** | **~59** |

**Genuinely production-grade (COMPLETE, real backend):** customer core commerce (auth/OTP/address/cart/
checkout/Moyasar payments/orders/coupons+atomic redeem/loyalty/reviews/notifications/support/profile);
driver ops (wallet/earnings/settlements-as-payouts/shift+breaks/online-offline/live-location/accept-reject/
analytics/leaderboard); the **Operations engine** (dispatch + smart/auto dispatch, zones, vehicles,
performance, driver payouts); **Campaigns**; **Design/Branding**; **Support ticketing**; merchant core
(profile/menu/products/inventory/orders/analytics).

## 1. What EXISTS (complete)
Backed by real tables + RPCs + wired UI. See matrix. Highlights: 4 payment edge functions (initiate/
verify/webhook/refund with HMAC + idempotency), atomic `redeem_coupon`, race-safe dispatch RPCs,
`find_nearest_drivers` scoring, FIFO driver payout settlement, per-country branding with version rollback.

## 2. What is PARTIAL (exists but stubbed / no-backend / no-UI)
- **Customer:** Wallet (real read, but top-up CTA is a no-op; `SAMPLE_TRANSACTIONS` shown when empty);
  Favorites (`product.service` DB methods exist but UI uses localStorage); Search (client-side filter over
  loaded branches only — no product/backend search); Categories (home list hardcoded); Registration (no
  profile collection — customer row auto-created on first OTP).
- **Merchant:** Branch mgmt (switch/edit only, no create/delete); Availability (auto out-of-stock only);
  Merchant wallet (earnings computed in-component as `total − 10`; **payout button is an `alert()` stub**).
- **Driver:** Vehicle mgmt (service exists, admin-only, no driver UI); Ratings (read `drivers.rating`, no
  write flow); Incentives (`bonus_earned` column only, no engine).
- **Admin:** Analytics (platform aggregates only); Finance (driver-payout only); Notifications (**DB-row
  insert only — no push/SMS/email delivery**); CMS/Feature-flags (partial); Delivery monitoring (log, not
  live); Refund (table + RLS exist, **no admin UI**); Banners/Audience-segmentation (type fields only).
- **Cross-cutting mock/hardcoded shipping in UI:** `MOCK_RESTAURANTS` (home), `SAMPLE_TRANSACTIONS`
  (wallet), `ProfileScreen` stats (Orders/Favorites/Points hardcoded), main-dashboard KPIs (completion %,
  ETA, rating, 7-day trend bars are literals), social-login + country-selector buttons are no-ops,
  `payment.service.ts` is dead simulation code (real checkout uses the edge function).

## 3. What is MISSING entirely (no table, no service, no UI)
Confirmed absent at the **database level** (no backing tables) AND code level:
- **Finance:** settlement engine / `settlements` / `commissions`+`commission_rules` / settlement scheduler /
  merchant payouts / compensation / accounting exports / finance reports.
- **Trust & compliance:** merchant & driver **approval workflows**, **KYC**/`driver_documents`/
  `merchant_documents`, contracts, **suspension**/**ban**/`account_status`, **risk**, **fraud** management.
- **Growth (entire section):** referral engine/`referrals`, invite engine, affiliate, influencer tracking,
  cashback.
- **Driver mgmt:** onboarding (self-signup), documents, **penalties**, **incentives** engine.
- **Merchant:** self-onboarding, **business hours**, merchant-created promotions, campaign participation,
  statements.
- **Maps/geo:** live orders/drivers/merchants maps, **heat maps**, batch dispatch (LocationPicker is a
  static placeholder image — no real map anywhere).
- **Marketing delivery:** push / SMS / email campaigns, audience segmentation engine, loyalty **tiers**.
- **Support:** escalation, **SLA tracking**, admin refund workflow.
- **Analytics:** cohort, geographic, customer analytics, conversion (beyond campaign CTR).
- **Admin CRUD screens:** country/city/user/customer/role/permissions/loyalty/admin-wallets/reports/
  merchant/driver management — tables exist for several, but **no admin UI**.
- **Native mobile + device push** (Section 4) — see below.

## SECTION 3 — Scalability readiness (measured, prior sprints)
| Tier | Verdict | Evidence |
|---|---|---|
| **10k orders/day** | ✅ READY (Pro + CDN) | DB idle under load; indexed reads 1–4 ms; 7–12k writes/s |
| **50k orders/day** | 🟡 NEEDS WORK | realtime redesign (zone channels) + queue + Redis + Team tier |
| **100k orders/day** | 🔴 NOT READY | full async layer + 2XL compute + Redis cluster |

Per-subsystem (measured): **DB/indexes** ✅ (not the bottleneck); **Realtime** ⚠️ ~376 concurrent socket
ceiling (breaks first); **Dispatch** ✅ RPC-based (no batch); **Driver tracking** ⚠️ `driver_locations`
INSERT per GPS tick over REST = ~1,000 req/s at 5k drivers > 577 RPS API ceiling; **Notifications** ⚠️
in-app realtime only, no push; **Wallet/Loyalty/Coupon** ✅ RPC, fast; **Analytics** ⚠️ full-scan on
`orders` (927 ms @ 500k, **no materialized views**); **Edge fns** ✅ serverless; **API** ⚠️ 577 RPS
compute-bound on entry tier. (Full data: `ENTERPRISE_LOAD_TEST_REPORT.md`, `ULTIMATE_SCALE_REPORT.md`.)

## SECTION 4 — Mobile store readiness: ❌ NONE
**It is a pure web SPA — not even a PWA.** No Capacitor, no `android/`/`ios/`, no native project, no
manifest/service worker, no icons/splash, no deep links, **no device push (FCM/APNs)**, no native
permissions. **Cannot be submitted to Google Play or the Apple App Store today.** `push_tokens` table +
`registerPushToken()` exist but are never called (only a sandbox stub). Shipping to stores is a full
from-zero effort (Capacitor wrapper → icons/splash → permissions → push → deep links → store assets +
privacy policy).

## Brutal bottom line
- **Strengths are real and deep** in: ops/dispatch, driver lifecycle, customer commerce, campaigns,
  branding, payments, support tickets.
- **The "enterprise" half is largely absent:** no finance/settlement engine, no trust/compliance
  (KYC/approval/suspension/fraud), no growth (referral/affiliate/cashback), no maps, no push, no native
  app, and admin is only 7 tabs.
- **Launch is viable** as a **controlled COD/Saudi web soft-launch** after the config + mock-data items in
  `PRE_LAUNCH_MASTER_CHECKLIST.md`. **Enterprise/app-store parity is a multi-month roadmap**
  (`POST_LAUNCH_ROADMAP.md`).
