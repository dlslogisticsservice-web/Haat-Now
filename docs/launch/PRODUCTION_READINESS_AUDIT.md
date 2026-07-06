# Production Readiness Audit — Launch Sprint 3 (Part 6)

Date: 2026-07-07 · Scope: `src/**` · Method: repository-wide search for `TODO`, `FIXME`,
`MOCK`, `DEMO`, `SANDBOX`, `PLACEHOLDER`, `TEMP`, `HARDCODED`, `fake`, `dummy`, `fallback`.

## Executive summary

| Signal | Count | Severity | Notes |
|---|---:|---|---|
| `VITE_AUTH_MODE === 'sandbox'` branches | 37 across 32 files | **P0 (launch)** | The dual-mode split. Production **ships sandbox** (forced in `vite.config.ts`), so every sandbox branch is the ACTIVE path in prod → **no live backend**. See migration plan. |
| `TODO` / `FIXME` | 2 | P3 | 1 documented seam (`platform/platform.service.ts`), 1 is an input `placeholder="G-XXXX"` (false positive). No real code debt. |
| Hardcoded fees | 1 (fixed this sprint) | P1→resolved | `luxuryFee = 5.00` in `CheckoutPage.tsx` → extracted to `config/fees.ts::DEFAULT_SERVICE_FEE`. |
| `mock` / `fake` / `dummy` / `placeholder` | 187 across 64 files | Mostly P3 | Overwhelmingly UI (`Skeleton`, admin table demo rows, input placeholders). A handful are demo-data fallbacks (below). |

There is **no meaningful TODO/FIXME debt**. The single production blocker is the
**sandbox dependency**, which is architectural (the app ships a self-contained demo build).

## P0 — Sandbox / demo-data dependencies (the launch blocker)

The app runs in one of two modes decided by `VITE_AUTH_MODE`. Production currently ships
`sandbox`, where `lib/supabase.ts` is a **no-op stub** returning empty results, and services
fall back to `sandboxStore` (localStorage) or inline demo data. Live data requires
`VITE_AUTH_MODE` unset/`live` **and** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.

Service-layer sandbox branches (19 files): `website.service`, `order.service`,
`notification.service`, `account.service`, `release.service`, `auth.service`,
`ops/command`, `onboarding.service`, `growthb.service`, `finance.service`, `cx.service`,
`rbac.service`, `ops/payout`, `ops/shift`, `ops/dispatch`, `merchant-settings.service`,
`cart.service`, `campaign.service`, `admin-crud.service`.

UI/feature sandbox branches: `App.tsx` (×3), `WalletScreen`, `RestaurantScreen`,
`CheckoutPage`, `OrdersList` (×2), `AdminDashboard` (×2), `main.tsx`, `DriverApp`,
`MerchantApp`, `LoginScreen`, plus the experience/assets services.

**Assessment:** these are legitimate demo-mode branches, not accidental mocks. They are the
right pattern for a self-contained demo, but every one must resolve to the LIVE service in
production. The gate is environment configuration + backend provisioning, not code removal.

### Inline demo-data fallbacks worth noting (not accidental, but must be off in prod)
- `home.service` empty → `HomeScreen` `MOCK_RESTAURANTS`; `RestaurantScreen` `sandboxMenu`.
- `sandboxStore.getProducts()` returns 3 seed items when empty (used by the app AND now the
  website menu in demo mode — same shared store, not a new mock).
- `finance.service` models commission/settlements from seeded orders in sandbox.

## P1 — Hardcoded fees

- `CheckoutPage.tsx` `luxuryFee = 5.00` → **fixed**: now `DEFAULT_SERVICE_FEE` in
  `config/fees.ts`. `DEFAULT_DELIVERY_FEE = 10` already centralised.
- The new website checkout uses the **pure financial engine** (`website-platform/finance/pricing.ts`);
  it hardcodes no fee — all fees/rates come from `FeeConfig`.
- **Remaining:** VAT rate (0.15) and free-delivery threshold live as defaults in
  `features/website/checkout.ts::websiteFeeConfig()`; wire these to admin app-config before launch.

## P2/P3 — Cosmetic / expected

- `mock`/`placeholder` hits are dominated by `Skeleton`, `AdminDataTable`/`CrudManager`
  demo rows, form `placeholder=` attributes, and admin center sample content. None affect the
  customer commerce path.
- The website marketplace homepage uses **curated** marketing content by design (Sprint 1);
  it hydrates from live services when a backend is present (Sprint 2), else shows curated —
  the same graceful pattern the app uses.

## What is production-ready now

- **Financial engine** (pricing/tax/tip/service-fee/receipt) — pure, tested (9 tests), no hardcoded fees.
- **Website commerce** (menu → cart → checkout → order → tracking → reorder/refund/support) —
  reuses existing services + the financial engine; completes on the website; verified 9/9.
- **Decision engine + lossless app hand-off + funnel metrics** — Sprint 2, tested.

## Verdict

Zero code-debt blockers. The **single** launch blocker is provisioning a live backend and
flipping `VITE_AUTH_MODE` off sandbox (see `SANDBOX_TO_PRODUCTION_MIGRATION.md`). Everything
else is either production-ready or intentional demo behaviour gated by that one switch.
