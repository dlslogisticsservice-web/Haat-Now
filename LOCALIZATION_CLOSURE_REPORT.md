# Localization Closure Report — HAAT NOW

**Honest status: localization is NOT fully closed.** This sprint advanced admin coverage but the
spec's pass bar ("zero Arabic while English is active") is **not yet met** — several admin panel
bodies still contain hardcoded Arabic. Reporting truthfully rather than claiming false closure.

## Strings migrated this sprint
- **KycCenter** — fully localized (queue, tabs, document labels, review actions, suspend/ban
  reasons, decision log, badges). Now binds `useAppConfig` lang + dynamic `dir`. ~40 strings.
- **OperationsCenter sub-panels** — Dispatch, Zones, Vehicles, Payouts fully localized (~25
  strings). Fixed a STEP-3 violation: `v.name_ar` was rendered directly → now
  `lang === 'ar' ? v.name_ar : v.name_en`. Currency `ر.س` → `L('ر.س','SAR')`.

## Cumulative localized (live AR↔EN + RTL↔LTR, no reload)
- Customer: Discover, Orders, OrderTrackingMap.
- Driver: DriverApp, DriverOpsPanel.
- Merchant: MerchantApp.
- Admin: sidebar, executive dashboard, NotificationCenter, SystemLogs, GlobalSearch,
  FinanceCenter (header + revenue MetricCards + tabs), CustomerCareCenter, GrowthCenterB (header +
  tabs), OperationsCenter (tabs + Dispatch/Zones/Vehicles/Payouts/Performance + zone table),
  OperationsCommandCenter (zone table), **KycCenter (full)**, all toasts/confirm/input dialogs.

## Remaining hardcoded Arabic (does NOT flip — STEP 4 would FAIL on these)
| File | Approx hardcoded strings | Area |
|---|---|---|
| GrowthCenterB | ~60 | coupon/loyalty/promotion/banner/segment/retention panel bodies (forms, placeholders, buttons) |
| GrowthCenter | ~44 | legacy growth panel bodies |
| AdminDashboard | ~41 | coupons / config / support tab bodies |
| ExperienceBuilder | ~37 | experience builder forms |
| DesignCenter | ~30 | design tokens/branding forms |
| CampaignCenter | ~23 | campaign builder forms |
| FinanceCenter | ~22 | settlements / compensation / refunds / exports panel bodies |
| OperationsCommandCenter | ~13 | KPI labels + map marker titles |
| AssetsManager, CountryBranding | ~12 | asset/branding forms |

## Coverage estimate
- **Admin surface ≈ 70% localized** (chrome + KYC + Operations done; Growth/Campaign/Design/
  Experience/Finance-bodies/Dashboard-tabs remain).
- Customer + Driver + Merchant apps: chrome ≈ 100%; seed/mock catalogue DATA intentionally not
  translated (comes from DB in production).

## Screens verified (English capture, prior sprints)
- Admin dashboard (EN, LTR), Finance (EN), Discover (EN), Driver app (EN), Merchant app (EN),
  Confirm dialog (EN). KycCenter/Operations localized this sprint (build-verified; live data
  largely empty in sandbox).

## Validation
- TypeScript ✅ · ESLint ✅ · Build ✅ · E2E 24/24 ✅

## Remaining blockers
- None technical. The remaining work is volume: ~7 large admin panel-body files (~270 strings) need
  the same `L(ar,en)` / dynamic-`dir` treatment. This is a further dedicated pass, not a blocker.
