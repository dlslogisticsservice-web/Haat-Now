# Architecture Refactor Plan
**HaaT Now — Phase 3 Enterprise Production Stabilization · PHASE 2 of 9**
Date: 2026-07-04. Goal: enforce the layered architecture **UI → Hooks → Services → Repositories → Supabase**, remove direct-Supabase-from-components, move business logic into services, split oversized components, and de-duplicate persistence — **incrementally, with zero regressions** (each slice gated by `tsc` + build + E2E 24/24).

> This phase delivers this plan **plus one proven pilot slice** (HomeScreen), so the pattern is executable and validated rather than theoretical. The remaining slices are sequenced below for approval-gated execution.

---

## 1. Target architecture
```
UI (features/*.tsx)              — render + local UI state only; no data source knowledge
  ↓ calls
Hooks (src/hooks/*)              — fetch lifecycle (loading/error/result), memoization
  ↓ calls
Services (src/services/*)        — business logic, validation, orchestration, types
  ↓ calls
Repositories (src/repositories/*) — the ONLY layer allowed to touch Supabase; thin typed data access
  ↓ calls
Supabase (src/lib/supabase.ts)   — client (dual-mode: sandbox stub / live)
```
**Rule:** `src/lib/supabase` may be imported **only** by `src/repositories/*` (and the existing thin service data-access already in `src/services/*` during migration). No `features/*` file imports it.

## 2. Pilot — PROVEN this phase (template for all remaining work)
**HomeScreen** migrated end-to-end and verified (tsc ✓ / build ✓ / E2E 24/24):
- `src/repositories/catalog.repository.ts` — `listBranches()`, `listActiveOffers(now)` (Supabase access only).
- `src/services/home.service.ts` — `homeService.getFeed()` + owns `BranchWithMerchant`/`DBOffer`/`HomeFeed` types.
- `src/hooks/useHomeFeed.ts` — fetch lifecycle (loading + unmount-safe).
- `src/features/home/HomeScreen.tsx` — now `const { branches, offers, loading } = useHomeFeed();`; **no `lib/supabase` import**.

Behaviour is byte-for-byte equivalent (same queries, same error-logging, same mock fallback). This is the exact shape every slice below follows.

## 3. Current violations (evidence, multiline-accurate 2026-07-04)
**10 feature files still import `lib/supabase`** (~29 raw calls). Grouped by the repository that should own them:

| Feature file | Raw calls | Target repository | Notes |
|---|---:|---|---|
| `checkout/CheckoutPage.tsx` | 7 | `orders.repository` + `payments.repository` | order create + Moyasar init + status polling |
| `merchant/MerchantApp.tsx` | 6 | `catalog.repository` + `orders.repository` | products/inventory/order queries |
| `orders/OrdersList.tsx` | 4 | `orders.repository` | list + tracking |
| `orders/MultiTargetReview.tsx` | 4 | `reviews.repository` | review submit/read |
| `driver/DriverApp.tsx` | 3 | `driver.repository` (ops) | jobs/status |
| `restaurant/RestaurantScreen.tsx` | 1 | `catalog.repository` | `products` by branch (already partially served by `product.service`) |
| `onboarding/OnboardingForm.tsx` | 1 | `onboarding.repository` | applicant insert |
| `admin/SystemLogs.tsx` | 1 | `audit.repository` | audit log read |
| `admin/OperationsCenter.tsx` | 1 | `ops.repository` | ops query |
| `admin/AdminDashboard.tsx` | 1 | `admin.repository` | one direct query |

**Note:** an earlier single-line grep reported 25; the multiline-accurate count is ~29 (e.g. RestaurantScreen's `await supabase\n.from('products')` spans lines). The plan targets **every** direct import, not a count.

## 4. Oversized components (split targets)
| File | LOC | Decomposition |
|---|---:|---|
| `merchant/MerchantApp.tsx` | 1220 | already tab-hosts StoreManagement/KitchenQueue; extract catalog/inventory/order logic into `merchant.service` + `useMerchant*` hooks; split tabs into sub-components |
| `profile/ProfileScreen.tsx` | 1156 | extract payment-method domain (`ProfileScreen.tsx:59-83`) → `account.service`/`payment-methods.service`; split into ProfileHome / Addresses / PaymentMethods / Settings sub-screens |
| `checkout/CheckoutPage.tsx` | 974 | extract order/coupon/polling logic → `checkout.service` + `useCheckout` hook; keep gesture/UI in the component |
| `orders/OrdersList.tsx` | 760 | `useOrders` hook + `OrderCard`/`TrackingMap` sub-components (also enables `React.memo` — Perf P4) |
| `driver/DriverApp.tsx` | 751 | `useDriverJobs` hook; extract shift/earnings via existing ops services |
| `admin/AdminDashboard.tsx` | 726 | already a shell; extract the inline CRUD field configs into a config module |

Split order follows the data-layer migration (extracting the fetch into a hook/service naturally shrinks the component).

## 5. Duplicated persistence (consolidation)
`admin-crud.service.ts` is the canonical localStorage CRUD (`haat_crud_${table}`). **7 services re-implement the same inline reader/writer** (`cx.service.ts:5`, `finance.service.ts:13`, `growthb.service.ts:6`, `onboarding.service.ts:33`, `subscription.service.ts`, `demoSeed.ts:8`, `ops/command.service.ts`). Plan:
1. Introduce `src/lib/kv.ts` — a single namespaced localStorage wrapper (`kv.get/set/list/remove(table)`), the storage primitive `adminCrud` and all sandbox stores build on.
2. Migrate the 7 services to `kv`/`adminCrud` (behaviour-preserving — same keys).
3. Forbid direct `localStorage.*` outside `kv.ts`/`adminCrud` (see §7).
> Distinguish from legitimate localStorage use (cart, auth session, view prefs) — those stay but route through `kv` for a single audit point.

## 6. Cross-feature imports (fix)
Promote genuinely shared components out of features: `merchant/MerchantApp.tsx:25 → ../admin/NotificationCenter`, `driver/DriverApp.tsx:19 → ../onboarding/OnboardingForm`, `admin/WebsiteCenter.tsx:8-9 → ../website/*` → move the shared pieces to `src/components/*`. Also relocate the `User` type out of `features/auth/types` into `src/services/types` (service→feature inversion, `auth.service.ts:2`).

## 7. Boundary enforcement (make regressions impossible)
The repo currently lints with `tsc --noEmit` only (no ESLint). Add a **lightweight guard** without new heavy tooling:
- A `scripts/check-architecture.cjs` (grep-based) that fails CI if any `src/features/**` file imports `lib/supabase`, or any file outside `src/lib`/`repositories`/`admin-crud` touches `localStorage`. Wire into `.github/workflows/ci.yml` after typecheck.
- (Optional later) adopt ESLint with `no-restricted-imports` for the same rules.
Enable the guard **only after** the violations above are migrated, so CI stays green throughout.

## 8. Sequenced execution — STATUS (each slice: tsc + build + E2E 24/24 + commit + push)
Executed as independent, validated slices (commit SHAs):
1. ✅ **Pilot** — repository layer established + HomeScreen migrated (`a503aa2`).
2. ✅ **S1 — Orders** — OrdersList → orders/support repositories (`a666dd8`).
3. ✅ **S2 — Reviews** — MultiTargetReview → reviews repository (`54bb04e`).
4. ✅ **S3 — Checkout** — CheckoutPage → checkout/payments repositories via checkout.service (`58792fa`).
5. ✅ **S4 — Catalog** — RestaurantScreen + MerchantApp → catalog/merchant repositories (`f5e9724`).
6. ✅ **S5 — Driver/Ops** — DriverApp + OperationsCenter → driver repository (`4f0b767`).
7. ✅ **S6 — Admin/Onboarding** — AdminDashboard + SystemLogs + OnboardingForm → audit/support repositories + auth.service (`fc206c7`).
8. ✅ **S7 — Persistence consolidation** — `src/lib/kv.ts` + 7 services delegated (`8a085fe`).
9. ✅ **S8 — CI architecture guard** — `scripts/check-architecture.cjs` wired into `npm run lint` (this slice).

**Result: 0 of 11 feature files import `lib/supabase` (was 11).** The boundary is enforced in CI.

### Remaining Phase-2 items (larger refactors — recommended as their own dedicated, gated passes)
- **Component splits (§4):** the 6 oversized components (MerchantApp 1220, ProfileScreen 1156, CheckoutPage, OrdersList, DriverApp, AdminDashboard). Data-fetch extraction in S1–S6 already trimmed logic out of several; the remaining structural decomposition (sub-screens, `useX` hooks, `React.memo`) is high-touch on live UI and is best done screen-by-screen with focused manual + E2E verification. **Not done in this pass to avoid UI-regression risk.**
- **Cross-feature import fixes + `User` type relocation (§6):** move `NotificationCenter`/`OnboardingForm`/website pieces to `src/components/*`; relocate `User` out of `features/auth/types`. Small but touches shared imports — a clean standalone slice.
- **Deeper service→repository migration:** services still call Supabase directly (allowed by the guard, which targets features). Migrating services behind repositories is the next architectural layer.

Each slice was small, behaviour-preserving, and validated (`tsc` + `npm run build` + `node docs/testing/e2e_runner.cjs` = 24/24) before commit + push. Nothing merged to `main`.

## 9. Applied in this phase
| Change | Type | Verified |
|---|---|---|
| `src/repositories/catalog.repository.ts` | new (repository layer established) | tsc/build/E2E |
| `src/services/home.service.ts` | new (service) | ✓ |
| `src/hooks/useHomeFeed.ts` | new (hook) | ✓ |
| `src/features/home/HomeScreen.tsx` | refactor — removed direct Supabase; now uses hook | E2E 24/24 |
| `src/features/restaurant/RestaurantScreen.tsx` | reverted an incorrect import removal (it has a real `products` query — S2 target) | tsc ✓ |

**Net:** direct-Supabase feature files 11 → **10**; the layered pattern is established and proven; the remaining ~29 calls + splits + persistence dedup are sequenced (S1–S8) for approval-gated execution.

## 10. Non-negotiables honored
No feature removed, no UI changed (HomeScreen renders identically — same queries, same mock fallback), no regression (E2E 24/24), no rebuild-from-scratch (pure refactor), backward compatible. The one mistake made mid-slice (removing RestaurantScreen's import, assuming it was dead) was caught by the `tsc` gate and reverted — evidence the verification gate works.
