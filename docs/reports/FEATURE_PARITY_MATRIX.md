# Feature Parity Matrix — HAAT NOW

**Date:** 2026-06-24 · Status from actual code + live schema. ✅ COMPLETE (real backend + wired UI) ·
🟡 PARTIAL (stub/mock/no-backend/no-UI) · ❌ MISSING (no table, service, or screen).

---

## CUSTOMER APP — 14 ✅ / 6 🟡 / 2 ❌
| Module | Status | Evidence |
|---|---|---|
| Authentication | ✅ | `auth.service.ts:87-191`, `LoginScreen.tsx:44-60` (real Supabase phone OTP) |
| Registration | 🟡 | `auth.service.ts:124-129` — no signup screen; row auto-created, no profile collection |
| OTP | ✅ | `auth.service.ts:102-131`, `LoginScreen.tsx:320-414` |
| Address management | ✅ | `customer.service.ts:77-131` (CRUD + zone hierarchy) |
| Saved addresses | ✅ | `customer.service.ts:60-67,118-131` |
| Wallet | 🟡 | `wallet.service.ts:7-41` real read; top-up CTA no-op (`WalletScreen.tsx:278`); `SAMPLE_TRANSACTIONS` fallback |
| Loyalty | ✅ | `loyalty.service.ts:6-38` (balance/award/redeem RPCs) |
| Coupons | ✅ | `coupon.service.ts` + atomic `redeem_coupon` RPC |
| Orders | ✅ | `order.service.ts:7-160`, `OrdersList.tsx` |
| Reorders | ❌ | i18n label only (`i18n/index.ts:61`); 0 handler |
| Favorites | 🟡 | `product.service.ts:41-70` exists but UI uses localStorage (`RestaurantScreen.tsx:66-73`) |
| Search | 🟡 | client-side filter over loaded branches only (`HomeScreen.tsx:144-157`); no backend/product search |
| Categories | 🟡 | home categories hardcoded (`HomeScreen.tsx:31`); real `getCategories` only in merchant |
| Product details | ✅ | `product.service.ts:27-38` (variants + images) |
| Cart | ✅ | `cart.service.ts:22-258` (local + remote sync) |
| Checkout | ✅ | `CheckoutPage.tsx:311-403` |
| Payments | ✅ | Moyasar edge fn `payment-initiate` + verify poll + webhook |
| Ratings | ✅ | `OrdersList.tsx:151-157`, `product.service.ts:82-89` |
| Reviews | ✅ | `product.service.ts:73-79` |
| Notifications | ✅ (in-app) | `notification.service.ts:6-65` — in-app only; no device push |
| Referral system | ❌ | 0 code matches; no table |
| Support | ✅ | `OrdersList.tsx:319-327` (support_tickets/messages) |
| Profile | ✅ | `customer.service.ts:40-58` (but ProfileScreen stats hardcoded `:705-742`) |

## MERCHANT APP — 6 ✅ / 3 🟡 / 7 ❌
| Module | Status | Evidence |
|---|---|---|
| Merchant onboarding | ❌ | no self-registration; merchants via DB seed only |
| Merchant profile | ✅ | `MerchantApp.tsx:1044-1096`, `merchant.service.ts:29-35` |
| Branch management | 🟡 | switch/edit only (`MerchantApp.tsx:548-558`); no create/delete |
| Menu management | ✅ | `MerchantApp.tsx:288-334`, `merchant.service.ts:57-74` |
| Product management | ✅ | `merchant.service.ts:39-65` (CRUD + image) |
| Inventory | ✅ | `inventory.service.ts` + `adjust_product_stock` RPC |
| Availability | 🟡 | auto out-of-stock only (`MerchantApp.tsx:938`); no manual toggle |
| Business hours | ❌ | no model/UI |
| Promotions | ❌ | merchant cannot create promotions |
| Campaign participation | ❌ | campaigns admin-only; no merchant opt-in |
| Order management | ✅ | `MerchantApp.tsx:268-285` + realtime feed |
| Analytics | ✅ | `analytics.service.ts:30-39` |
| Merchant wallet | 🟡 | earnings computed `total − 10` in-component; payout = `alert()` stub (`:1015`) |
| Merchant settlements | ❌ | `alert()` only; no table/flow |
| Statements | ❌ | none |
| Commissions | ❌ | UI says "0 commission"; no engine |

## DRIVER APP — 10 ✅ / 2 🟡 / 4 ❌
| Module | Status | Evidence |
|---|---|---|
| Driver onboarding | ❌ | "not registered, contact admin" (`DriverApp.tsx:217-222`) |
| Vehicle management | 🟡 | `vehicle.service.ts:15-37` admin-only; no driver UI |
| Driver documents | ❌ | 0 matches; no model |
| Driver wallet | ✅ | `payout.service.ts:33-45`, `DriverOpsPanel.tsx:110-129` |
| Earnings | ✅ | `driver_earnings` + `driver.service.ts:64-70` |
| Settlements | ✅ | request payout + admin approve/reject FIFO (`payout.service.ts:48-62`) |
| Availability (shift) | ✅ | `shift.service.ts` + `DriverOpsPanel.tsx:32-37` |
| Online/offline | ✅ | `driver.service.ts:6-12` |
| Live location | ✅ | `tracking.service.ts:17-43` → `driver_locations` |
| Order acceptance | ✅ | TOCTOU-safe `driver.service.ts:28-50` + `respond_dispatch` |
| Order rejection | ✅ | `dispatch.service.ts:65-70` |
| Driver analytics | ✅ | `performance.service.ts:38-52` |
| Driver ratings | 🟡 | reads `drivers.rating`; no write flow |
| Driver penalties | ❌ | no model |
| Driver incentives | ❌ | `bonus_earned` column only; no engine |
| Driver leaderboard | ✅ | `performance.service.ts:55-64` |

## ADMIN PANEL — 7 ✅ / 8 🟡 / 8 ❌  *(panel exposes only 7 tabs total)*
| Module | Status | Evidence |
|---|---|---|
| Dashboard | ✅ | `AdminDashboard.tsx:293-458` (but trend bars/KPIs hardcoded `:364,378`) |
| Analytics | 🟡 | platform aggregates only (`analytics.service.ts:12`) |
| Country management | ❌ | seed only; no CRUD UI |
| City management | ❌ | seed only |
| Zone management | ✅ | `OperationsCenter.tsx:170-220` (fee/ETA/active; no polygon drawing) |
| User management | ❌ | no UI |
| Merchant management | ❌ | no admin merchant screen |
| Driver management | 🟡 | leaderboard + payouts only (`OperationsCenter.tsx:271-306`); no CRUD |
| Customer management | ❌ | no UI |
| Role management | ❌ | tables exist; no UI |
| Permissions | ❌ | tables exist; no UI/enforcement in admin |
| Coupons | ✅ | `AdminDashboard.tsx:463-510` |
| Campaigns | ✅ | `CampaignCenter.tsx` (CRUD/clone/targeting/analytics) |
| Loyalty | ❌ | service exists; no admin screen |
| Wallets (admin) | ❌ | no admin wallet screen |
| Settlements | ❌ | none |
| Finance | 🟡 | driver payout approve/reject only |
| Support | ✅ | `AdminDashboard.tsx:609-761` (ticket list/reply/close) |
| Reports | ❌ | no reporting/export |
| Notifications | 🟡 | DB insert only; no push/SMS/email; no broadcast UI |
| CMS | 🟡 | Design Center experience/assets only |
| Branding | ✅ | `DesignCenter.tsx` + per-country + version rollback |
| Feature flags | 🟡 | persistence exists; no toggle screen |

## SECTION 2 — ENTERPRISE (Admin Ops / Ops Center / Finance / Marketing / Support / Analytics / Growth)
| Area | ✅ COMPLETE | 🟡 PARTIAL | ❌ MISSING |
|---|---|---|---|
| **Admin ops** | — | — | merchant approval, driver approval, KYC, merchant contracts, driver contracts, suspension, ban, risk, fraud |
| **Operations center** | dispatch center, smart dispatch, auto dispatch, reassignment (backend) | delivery monitoring | live orders/drivers/merchants maps, heat maps, batch dispatch |
| **Finance center** | driver payouts | revenue dashboard, refund mgmt (table, no UI) | commission engine, settlement engine, settlement scheduler, merchant payouts, compensation, accounting exports, finance reports |
| **Marketing center** | campaign manager, promo codes | dynamic promotions, banners, audience segmentation | referral campaigns, loyalty tiers, push campaigns, SMS campaigns, email campaigns |
| **Support center** | ticketing | complaint mgmt, support analytics | escalation, refund workflow (admin), SLA tracking |
| **Analytics center** | — | merchant, driver, order, revenue, conversion (campaign-scoped) | customer, cohort, geographic |
| **Growth** | — | — | referral engine, invite engine, affiliate, influencer tracking, cashback |

## MOBILE STORE (Section 4) — 0 ✅ / 0 🟡 / 13 ❌
Capacitor · @capacitor pkgs · android/ · ios/ · build.gradle/applicationId · Info.plist/bundle-id ·
icons/splash · deep/universal links · push (FCM/APNs) · native permissions · PWA manifest/SW · store
metadata/privacy policy — **all MISSING**. Pure web SPA; not submittable to either store.

## EDGE FUNCTIONS (4, all payment)
`payment-initiate` (Moyasar hosted page) · `payment-verify` (status poll) · `payment-webhook` (HMAC +
idempotency via `webhook_events`) · `payment-refund` (admin). **No dispatch/notification/push edge fns.**
