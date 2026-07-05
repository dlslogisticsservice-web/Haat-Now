# Hidden Technical Debt — HaaT Now

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> Debt **not already documented** in existing reports. Evidence cited `file:line`.

## D-1 — The dual-mode fork is the largest structural debt 🔴
Nearly every service carries **two code paths** — a sandbox (localStorage) branch and a live (Supabase) branch — gated on `VITE_AUTH_MODE` (`if (SANDBOX) …` appears across 30+ services). This doubles surface area, and the two paths **drift**: the sandbox path is richer and better-tested (it ships), the live path is thinner and, in several places (loyalty accrual, campaign conversion, dispatch triggering, provisioning schema), **never exercised**. The demo working end-to-end creates false confidence that the live backend does too. This is debt masquerading as a feature.

## D-2 — Provisioning writes to non-existent columns 🔴
`provisioning.service.ts:43-57` sets ~19 fields (`theme_preset_id`, `brand_seeded`, `roles_seeded`, `features_json`, `default_admin`, `cms_structure`, …) that are **not columns on `tenants`** (`20260627000008_tenants.sql:9-33`). Live mode would throw; only localStorage's schemaless JSON tolerates it. Latent breakage hidden by sandbox.

## D-3 — Dead / orphaned code 🟠
- `finalize_driver_delivery` RPC — **zero callers** (verified); wrapped but never invoked → driver workload never freed.
- `loyaltyService.awardPoints` / `growthbService.awardPoints` — **zero callers** (verified).
- `campaignService.track('conversion')` — **zero callers**.
- `dispatch.service` autoDispatch/expireOffers etc. — only wired to admin buttons, dead in sandbox (the shipped build).

## D-4 — Duplicate parallel modules ("A/B" siblings) 🟠
Two growth stacks coexist: `growth.service.ts` (91) + `GrowthCenter.tsx` (214) **and** `growthb.service.ts` (187) + `GrowthCenterB.tsx` (323). Two implementations of the same domain = ambiguous source of truth and double maintenance. Similar smell between `admin.service.ts` and `admin-crud.service.ts`.

## D-5 — God components 🟠
Feature files far exceed a maintainable size, mixing data-fetching, business logic, and view:
`MerchantApp.tsx` 1210 · `ProfileScreen.tsx` 1156 · `CheckoutPage.tsx` 939 · `App.tsx` 900 · `OrdersList.tsx` 751 · `DriverApp.tsx` 744 · `AdminDashboard.tsx` 726. Business rules (order totals, status transitions, failure handling) live inside these `.tsx` files rather than services — e.g. checkout computes totals and drives coupon/payment orchestration in the component.

## D-6 — Business logic in the UI layer 🟠
`CheckoutPage.tsx` re-computes totals (`:287-290`), orchestrates coupon redemption after payment (`:108-119`), and owns the create→pay→redeem sequence. `MerchantApp.tsx` drives raw status transitions (`:270-300`). The architecture guard enforces "features don't import `lib/supabase`" but **does not** prevent business logic leaking into components via services — the abstraction is porous.

## D-7 — Two location stores, unreconciled 🟠
`driver_locations.coords` (written by GPS loop) vs `drivers.current_lat/lng` (read by `order_tracking`/`find_nearest_drivers`, written only by `set_driver_status`). No reconciliation → tracking reads stale data. A latent correctness bug hidden because sandbox has no tracking.

## D-8 — No order state machine at the DB 🟠
`orders.status` is a free-text `varchar(50)` with **no CHECK, no enum, no transition trigger** (`init_schema.sql:23`). The lifecycle lives in `types.ts` as advisory constants; `updateOrderStatus` only blocks writing the *same* status (`order.service.ts:98`). Any illegal transition (`delivered → pending`) would persist.

## D-9 — Magic values & config drift 🟡
- Fixed sandbox OTP `123456` in source (`auth.service.ts:15`).
- Hard-coded commission 15% both in SQL default (`finance_engine.sql`) and in `finance.service.ts:15`.
- Hard-coded analytics deltas/sparklines (`AdminDashboardHome.tsx:101-106`).
- ETA hard-coded at 30 km/h (`customer_parity.sql:116-117`).
- Demo account UUIDs embedded in auth logic.

## D-10 — ~159 TODO/placeholder/"not present" markers 🟡
Grep across `src` + migrations returns ~159 hits for `TODO|FIXME|HACK|placeholder|not implemented|not present`, including load-bearing admissions like `send_message_campaign` "actual push/SMS/email delivery … (not present)" (`growth_engine.sql:251`) and the tenant-isolation "foundation only" notes.

## D-11 — Migration/applied-state drift 🟡
`rls_recovery.sql:5-8` documents that 21 tables were once RLS-enabled with zero policies and that 0018's policies "never landed". The migration files are not a reliable description of the live DB — an operational debt requiring a live `pg_policies` reconciliation.

## D-12 — `.single()` on potentially-multi-row tables 🟡
`wallet.repository.ts:15-17` can create duplicate wallets (no `UNIQUE(owner_type,owner_id)`); `getWallet` uses `.single()` which errors on duplicates. Latent.

---

## Debt heat map

| Area | Severity | Type |
|---|---|---|
| Dual-mode fork | 🔴 | Architecture drift |
| Provisioning schema mismatch | 🔴 | Latent breakage |
| Dead/orphaned code | 🟠 | Cruft + correctness |
| Duplicate A/B modules | 🟠 | Weak boundaries |
| God components | 🟠 | Maintainability |
| Logic in UI | 🟠 | Leaky layering |
| Two location stores | 🟠 | Correctness |
| No order state machine | 🟠 | Integrity |
| Magic values | 🟡 | Config hygiene |
| TODO markers | 🟡 | Incompleteness |
| Migration drift | 🟡 | Ops reliability |

**Overall:** The codebase is **clean-looking** (layered, arch-guarded, typed, `noUnusedLocals`) but carries **deep hidden debt** concentrated in the sandbox↔live divergence and the "engine" modules that are wired only in the demo. The polish masks incompleteness.
