# Missing / Incomplete Features Report — HAAT NOW (Pre-Launch)

**Date:** 2026-06-24 · From existing reports + read-only codebase scan. **No new tests run.**

> **Theme:** the app has two modes (`VITE_AUTH_MODE`). The **sandbox/demo path is fully built and is what
> most features exercise today**; the **real Supabase path is coded but gated on a DB cutover** (migrations,
> phone provider, Moyasar secrets) and **not verified end-to-end**. "Missing" below means *not
> production-real*, not *absent from the UI*.

Effort: S < ½ day · M ½–2 d · L 2–5 d · XL > 5 d.

---

## (A) Core-commerce blockers (browse → cart → order → pay → deliver)

| # | Feature | State | Evidence | Priority | Effort | Dependencies |
|---|---|---|---|---|---|---|
| 1 | **Card payments** | SANDBOX / dead until configured | `payment-initiate/index.ts:39` hard-fails `PROVIDER_NOT_CONFIGURED`; needs `MOYASAR_SECRET_KEY` | **P2** (COD soft-launch) | M | Moyasar account + edge secrets |
| 2 | **Real-mode backend cutover** (coupons/loyalty/inventory/notifications) | PARTIAL — coded, gated | migrations 0019/0020 status unverified; `BACKEND_READINESS_REPORT` | **P0** (verify) | S–M | live DB access |
| 3 | **Real-mode E2E for all 4 apps** | PARTIAL — sandbox only | `APPLICATION_READINESS_REPORT`; POST_DEPLOY_VERIFICATION | **P0** | M | B1–B4 |
| 4 | **Egypt market transactable** | MISSING DATA — only SA seeded, yet `DEFAULT_COUNTRY='EG'` | `APPLICATION_READINESS_REPORT`; `FINAL_IMPLEMENTATION_REPORT` | **P0 decision** (scope) | L (seed) | business + content |

## (B) Peripheral / secondary

| # | Feature | State | Evidence | Priority | Effort | Dependencies |
|---|---|---|---|---|---|---|
| 5 | **Merchant "Withdraw Earnings"** | STUB — `alert()` only | `MerchantApp.tsx:1015` | P1 | M | payout service + provider |
| 6 | **Wallet empty-state** | MOCK — 5 fake `SAMPLE_TRANSACTIONS` | `WalletScreen.tsx:27-33` | P1 | S | — (replace with empty state) |
| 7 | **Home empty-state** | MOCK — `MOCK_RESTAURANTS/FEATURED` | `HomeScreen.tsx:49-57` | P1 | S | — (replace with empty state) |
| 8 | **Portal analytics** | MOCK — localStorage, not `analyticsService` | PRODUCTION_BLOCKERS H2 | P1 | M | migration 0020 |
| 9 | **Push notification delivery (FCM/APNs)** | MISSING — only in-app center + token reg | `APPLICATION_READINESS_REPORT` 🔴; `BACKEND_READINESS §4` | P2 | L | FCM/APNs credentials + SW |
| 10 | **Interactive maps** | PARTIAL — static placeholder image, no key | `LocationPicker.tsx:21,84` | P1 | S | `VITE_GOOGLE_MAPS_API_KEY` |
| 11 | **Loyalty redemption (real)** | PARTIAL — gated on 0020 | `WalletScreen.tsx:79` | P1 | S | migration 0020 |
| 12 | **Real OTP (Twilio live SMS)** | PARTIAL — Test OTP `123456` | PHONE_AUTH_REPORT | **P0** | M | Twilio account |

## Documentation mismatch worth fixing (P1, effort S)
`docs/operations/PAYMENT_ACTIVATION_GUIDE.md` documents **Stripe/Paymob/Apple/Google/Mada** — which map to
the **orphaned, stubbed `payment.service.ts`**, *not* the actual live checkout (**Moyasar** edge functions).
Whoever activates payments could configure the wrong provider. Align the guide to Moyasar, or delete the
dead `payment.service.ts`.

## What IS production-real (for balance)
Real auth OTP code path · Moyasar checkout edge functions (when keyed) · order / driver / merchant
lifecycle services · inventory/coupon/loyalty/analytics **service layer** (UI wiring is the gap) ·
RLS + role routing + super/country admin scoping · scale indexes · error boundary · i18n (AR/EN).

## Recommended launch shape (per the reports)
**COD-only, Saudi-only soft launch** — the closest-to-ready path: no payment gateway needed, SA geography
is seeded, demo→real operator swap is small. EG + card payments + push follow post-launch (P2).
