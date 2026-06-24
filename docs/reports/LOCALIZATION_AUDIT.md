# Localization Audit

**Date:** 2026-06-25 · Honest, measured. The reported bug — *"switch to English, screens stay Arabic"* —
is **confirmed** and its root cause is identified below.

## Root cause
Whole feature areas are **hardcoded Arabic** with no `useTranslation`/i18n keys, so the language toggle
(which flips `lang` + RTL/LTR) **cannot translate them** — they remain Arabic regardless of language. This
is structural, not a toggle bug.

## Coverage (measured)
| Area | Files | Using i18n | String-level localization |
|---|---|---|---|
| **Admin** (`features/admin`) | 13 | **0** | ❌ ~0% — fully hardcoded Arabic (AdminDashboard, OperationsCenter + all 10 sub-centers) |
| **Driver** (`features/driver`) | 2 | 0 | ❌ DriverApp + DriverOpsPanel hardcoded |
| **Merchant** (`features/merchant`) | 1 | 0 | ❌ MerchantApp hardcoded |
| Customer core (home/restaurant/checkout/orders/wallet/profile) | ~9 | ~6 | 🟡 partial — top-level screens use `t()`, but several strings + new components are hardcoded |
| New customer (discover, onboarding, tracking-map, multi-review) | ~5 | 0–1 | ❌ hardcoded Arabic |
| i18n bundle (`src/i18n/index.ts`) | — | — | ~107+ keys (ar/en) — covers customer nav/common/auth/checkout etc., **not** admin/ops/finance/growth |

**Effective product-wide string coverage: ~35–40%.** The customer happy-path is mostly translatable; the
**admin/driver/merchant + newly-built customer screens are not**.

## Translated files (have `useTranslation`)
`home/HomeScreen`, `restaurant/RestaurantScreen`, `checkout/CheckoutPage`, `orders/OrdersList`,
`wallet/WalletScreen`, `profile/ProfileScreen`, `auth/LoginScreen` (+ shared nav via `i18n`).

## NOT translated (hardcoded Arabic — remaining work)
- **All admin**: AdminDashboard, OperationsCenter, OperationsCommandCenter, DispatchPanel, ZonesPanel,
  VehiclesPanel, PerformancePanel, PayoutsPanel, KycCenter, FinanceCenter, GrowthCenter, GrowthCenterB,
  CustomerCareCenter, DesignCenter, CampaignCenter, ExperienceBuilder.
- **Driver**: DriverApp, DriverOpsPanel. **Merchant**: MerchantApp.
- **New customer**: DiscoverScreen (incl. RewardsTab), OnboardingForm, OrderTrackingMap, MultiTargetReview.
- Categories of strings still hardcoded across the above: titles, buttons, placeholders, empty states,
  validation/alerts, table headers, badges, filters, chart labels, menu labels.

## Why this wasn't fixed in this pass
Localizing the above is a **large, mechanical-but-extensive** effort: extract every Arabic literal into
`i18n` keys with **professional Arabic + native English** (not machine translation) across ~16 admin files +
driver/merchant + new customer screens — realistically a dedicated multi-pass sprint. This pass prioritized
the verifiable, build-safe foundation (emoji removal + design system) and this audit, rather than a partial,
inconsistent i18n that could regress the working customer journey.

## Remediation plan (next sprint)
1. **Extend `src/i18n/index.ts`** with namespaces: `admin`, `ops`, `dispatch`, `finance`, `growth`,
   `kyc`, `support`, `driver`, `merchant`, `discover` — each with `ar` (professional modern) + `en`
   (native product) values.
2. **Wire `useTranslation`** into each file; replace literals with `t('ns.key')`.
3. Verify the toggle re-renders text + RTL/LTR + spacing live (already works for the customer core).
4. CI guard: lint rule / scan to fail on new hardcoded non-key Arabic in `features/`.

## Verdict
**Localization is the #1 open item.** Customer core is largely translatable; admin/driver/merchant + new
customer screens are **0–partial** and need the remediation sprint above. Current effective coverage
**~35–40%**; target **100%**.
