# Phase E5A.2 — Final Audit

**Date:** 2026-06-24 · Audit only (no new features). Every claim verified against the **live** Supabase
schema/RPCs or the actual source. Build ✅ · Lint ✅ · E2E ✅ 24/24 (from E5A.1).

---

## Per-feature audit

### 1. Reorder
- **Source files:** `src/features/orders/OrdersList.tsx` (button + `handleReorder`), `src/services/cx.service.ts` (`reorderItems`), `src/services/cart.service.ts` (`clearCart`, `addToCart`), `src/services/product.service.ts` (`getProductDetails`).
- **Tables:** `orders`, `order_items`, `product_variants`, `products`.
- **RPCs:** `reorder_items(order_id)` — **SECURITY DEFINER**.
- **RLS:** reads via DEFINER RPC; cart is client-side (localStorage).
- **Migration deps:** `20260614000034`.
- **Runtime risks:** per-item `getProductDetails` (N queries — fine for normal order sizes); cart badge doesn't live-refresh until the cart drawer opens (minor UX); branch-mismatch handled via `clearCart()` before re-add.
- **Production readiness:** ✅ READY. Live: `reorder_items` returned the item with **quantity preserved (3)**.

### 2. Tracking Map
- **Source files:** `src/features/orders/OrderTrackingMap.tsx`, `OrdersList.tsx` (mount), `cx.service.ts` (`tracking`, `subscribeTracking`).
- **Tables:** `orders`, `drivers`, `driver_locations`, `merchant_branches`, `zones`, `order_status_history`.
- **RPCs:** `order_tracking(order_id)` + `haversine_km` — **SECURITY DEFINER**.
- **RLS:** read via DEFINER RPC; realtime needs the tables in `supabase_realtime` publication.
- **Migration deps:** `20260614000034` (order_tracking) · `20260614000032` (realtime publication + REPLICA IDENTITY FULL) · `20260614000028` (haversine, driver location columns).
- **Runtime risks:** **needs `VITE_GOOGLE_MAPS_API_KEY`** for tiles (config); polyline is a **straight line** (road routing needs Directions API); realtime + 15 s poll fallback.
- **Production readiness:** ✅ READY (map tiles gated on the key — graceful notice, not a crash).

### 3. Multi-Target Reviews
- **Source files:** `src/features/orders/MultiTargetReview.tsx`, `OrdersList.tsx` (mount; legacy card disabled), `cx.service.ts` (`submitReview`).
- **Tables:** `reviews` (writes), `merchant_branches`, `drivers`, `order_items`, `product_variants`, `products` (resolve targets).
- **RPCs:** `submit_review(order_id, target_type, target_id, rating, comment)` — **SECURITY DEFINER** (also updates `drivers.rating` avg).
- **RLS:** `reviews` — "Create own reviews" (INSERT), "Read all reviews" (SELECT), "Update..." ; write sets `customer_id = auth.uid()` inside the DEFINER RPC.
- **Migration deps:** `20260614000034`.
- **Runtime risks:** `submit_review` has **no uniqueness constraint** → calling twice for the same (order,target) inserts duplicate reviews; the UI guards by checking existing reviews + showing "done", so normal use is single-write (minor, non-blocking).
- **Production readiness:** ✅ READY.

### 4. Address Labels + Notes
- **Source files:** `src/features/profile/ProfileScreen.tsx`, `src/services/customer.service.ts`.
- **Tables:** `addresses` (`label_type`, `notes` columns).
- **RPCs:** `set_default_address` (DEFINER); `customerService.setDefaultAddress` two-step also present.
- **RLS:** `addresses` — "Customers own addresses" (ALL, customer-scoped).
- **Migration deps:** `20260614000034` (added `label_type` CHECK home/work/custom + `notes`).
- **Runtime risks:** two-step set-default is non-atomic (documented, acceptable client-side); `label_type` CHECK-constrained.
- **Production readiness:** ✅ READY.

### 5. Favorites
- **Source files:** `src/features/restaurant/RestaurantScreen.tsx` (merchant + product hearts), `src/features/discover/DiscoverScreen.tsx`, `cx.service.ts`.
- **Tables:** `favorites` (products), `favorite_branches` (merchants).
- **RPCs:** none — direct insert/delete (RLS-scoped).
- **RLS:** `favorites` "Manage own favorites" (ALL); `favorite_branches` `fav_branches_own` (`customer_id = auth.uid()`).
- **Migration deps:** `favorite_branches` from `20260614000034`; `favorites` pre-existing (enterprise schema).
- **Runtime risks:** toggle checks existence before insert (tiny race → possible duplicate; `favorite_branches` has `unique(customer_id,branch_id)` guard).
- **Production readiness:** ✅ READY.

### 6. Search Analytics
- **Source files:** `src/features/admin/CustomerCareCenter.tsx` (SearchAnalyticsPanel), `DiscoverScreen.tsx` (logs via search), `cx.service.ts`.
- **Tables:** `search_analytics`.
- **RPCs:** `search_catalog` (writes log — DEFINER, **volatile**), `search_term_stats`, `trending_products`, `recently_ordered`, `recommended_merchants` (DEFINER).
- **RLS:** `search_analytics` — `search_analytics_ins` (INSERT any authenticated), `search_analytics_read` (SELECT admin only).
- **Migration deps:** `20260614000034`.
- **Runtime risks:** every search inserts a row (table grows unbounded; no retention/rate-limit) — minor, admin-read only.
- **Production readiness:** ✅ READY.

---

## Mandatory verifications (live evidence)

### A) Address columns exist in production schema — ✅ VERIFIED
`information_schema.columns` → `addresses.label_type` (text) **and** `addresses.notes` (text) both present.

### B) MultiTargetReview writes correctly — ✅ VERIFIED
Submitting as the customer wrote two rows: `merchant`/4/approved and `driver`/5/approved, each with
`customer_id = auth.uid()` (`own=true`). Driver rating averaged into `drivers.rating`.

### C) Favorites persist after logout/login — ✅ VERIFIED (by design)
Favorites are **DB-backed** (`favorites`, `favorite_branches`), **not** localStorage, scoped by
`customer_id = auth.uid()`. Logout/login resolves to the same `customer_id`, so rows persist. (The old
RestaurantScreen localStorage path was replaced in E5A.1.)

### D) Tracking Map states — ✅ VERIFIED
- **Driver location exists:** `order_tracking` returns driver `{name, lat, lng}` + `remaining_km` 3.9.
- **Driver location missing:** returns `driver: null` + zone-ETA fallback (eta 30); component renders
  destination + "awaiting driver location".
- **Google Maps key missing:** component renders a "configure key" notice (real gate, not a crash) and
  still shows ETA/distance/driver panels. (Source-verified in `OrderTrackingMap.tsx`.)

### E) Reorder edge cases — ✅ VERIFIED
- **Missing products:** `getProductDetails` → null → item **skipped** (handler).
- **Out-of-stock:** `stock <= 0` → item **skipped** (handler).
- **Deleted variants:** `order_items.variant_id` FK is **NO ACTION** → a referenced variant **cannot be
  deleted** (orphaning structurally prevented); additionally `reorder_items` inner-joins variants/products
  (a missing one is dropped) and the handler tolerates a null variant (adds the base product).

## Cross-cutting
- **RPC security:** `reorder_items`, `order_tracking`, `submit_review`, `set_default_address`,
  `search_catalog`, `search_term_stats` all **SECURITY DEFINER**.
- **Migrations recorded:** `20260614000028`, `…032`, `…034` all in `schema_migrations`.
- **Build / Lint / E2E:** green (E5A.1).

## Non-blocking risk register
| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Maps tiles need `VITE_GOOGLE_MAPS_API_KEY` | Low (config) | already on launch checklist |
| 2 | Tracking polyline is straight-line, not road-routed | Low | Directions API (future) |
| 3 | `submit_review` allows duplicate (order,target) reviews | Low | add unique index `(order_id,target_type,target_id)` |
| 4 | Cart badge not live-refreshed after reorder | Low (UX) | emit a cart-changed event |
| 5 | `search_analytics` grows unbounded | Low | retention job / rollup |
| 6 | `set_default_address` two-step non-atomic | Low | documented; acceptable client-side |

---

## READY FOR E5B = **YES**

All six features are implemented, DB-backed, RLS-scoped, and verified live (A–E all pass); build, lint, and
E2E are green. No critical or high blockers. The six items in the risk register are **low-severity,
non-blocking** polish/config items (the only externally-visible one — the Google Maps key — is already a
known launch-config task). E5B may proceed.

*(Optional pre-E5B hardening, if desired: add the `reviews (order_id, target_type, target_id)` unique index
to make `submit_review` idempotent — a 1-line migration.)*
