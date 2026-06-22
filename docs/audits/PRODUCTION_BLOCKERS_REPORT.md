# PRODUCTION_BLOCKERS_REPORT.md — HAAT NOW

Final source-code audit for Production Cutover. Identification only — **nothing fixed**. Every item has file:line, severity, production impact, and the fix required. Severity reflects behavior in a **production (`supabase`) build**, where all `import.meta.env.VITE_AUTH_MODE === 'sandbox'` branches are `false` and `import.meta.env.DEV` is `false`.

Key root cause: the features completed in the feature sprint (inventory/coupons/loyalty) read `sandboxStore` and have **no real-mode (`else`) branch**, and the backend services built last sprint (`inventory/coupon/loyalty/analytics.service`) are imported by **zero components**. So in production those features fall back to empty/localStorage state.

---

## CRITICAL

### C1 — Coupons are sandbox-only (no `couponService` wiring)
- **File/Line:** `src/features/admin/AdminDashboard.tsx:65` (`refreshCoupons = () => setCoupons(sandboxStore.getCoupons())`), `:68` (`sandboxStore.createCoupon`), `:79` (`sandboxStore.updateCoupon`). No `VITE_AUTH_MODE` guard → runs in production too.
- **Production Impact:** In production, coupon admin reads/writes **browser localStorage**, never the `coupons` table. Created coupons don't persist server-side; customer checkout can't see them.
- **Fix Required:** Add real branch calling `couponService.listCoupons/createCoupon/updateCoupon`; gate `sandboxStore` on `VITE_AUTH_MODE==='sandbox'`.

### C2 — Loyalty is sandbox-only (no `loyaltyService` wiring)
- **File/Line:** `src/features/wallet/WalletScreen.tsx:62` (`refreshLoyalty` → `sandboxStore.getPoints/getLoyaltyHistory`), `:65` (`sandboxStore.redeemPoints`), `:67` (`sandboxStore.creditWallet`). No mode guard.
- **Production Impact:** Points balance/history/redemption live in localStorage; never hit `loyalty_transactions`. Cross-device/real rewards impossible.
- **Fix Required:** Real branch using `loyaltyService.getPoints/getHistory/redeemPoints`; gate sandbox path.

### C3 — Inventory is sandbox-only (no `inventoryService` wiring)
- **File/Line:** `src/features/merchant/MerchantApp.tsx:110` (`refreshInventory` → `sandboxStore.getProducts`), `:112,:115` (`adjustStock/setProductActive`), `:191–192` (sandbox load), `:873` (`getInventoryStats`), `:918` (`getStockHistory`), `:940` (`getMerchantAnalytics`). Real `reloadBranchData` (`:214`) never sets `inventory`.
- **Production Impact:** Inventory tab is **empty in production** (real branch doesn't populate it); stock adjustments write to localStorage, not `products.stock`/`stock_movements`.
- **Fix Required:** Populate `inventory` in `reloadBranchData` via `inventoryService.getInventory`; route adjust/history through `inventoryService`.

### C4 — Migration 0019 (authenticated grants) not confirmed applied
- **File/Line:** `supabase/migrations/20260614000019_authenticated_grants.sql` (prepared; application unverified — anon cannot read `role_table_grants`).
- **Production Impact:** Without it, every logged-in user gets `42501 permission denied` on `orders/wallets/notifications/...` → app unusable post-login.
- **Fix Required:** Apply 0019 in SQL Editor + verify (8 grant rows). (DB action — not source.)

### C5 — `order_country_code` is SECURITY INVOKER (recursion)
- **File/Line:** `supabase/migrations/20260614000018_admin_country_scoping.sql:40` (function lacks `security definer`).
- **Production Impact:** Admin order reads hit `infinite recursion detected in policy for relation "orders"`; country scoping unenforceable.
- **Fix Required:** Recreate as `SECURITY DEFINER` (in migration 0020-adjacent / runbook PART 3). (DB action.)

### C6 — Phone auth provider disabled (no real login path)
- **File/Line:** infra (Supabase Auth → Providers); surfaces at `src/services/auth.service.ts:65` (`signInWithOtp`).
- **Production Impact:** `phone_provider_disabled` → no user can obtain a real session; the entire app is unreachable in production.
- **Fix Required:** Enable Phone provider / Test OTP (dashboard). (Infra — not source.)

---

## HIGH

### H1 — Migration 0020 (feature persistence) not applied
- **File/Line:** `supabase/migrations/20260614000020_feature_persistence.sql` (prepared, not executed).
- **Production Impact:** `products.stock`, `stock_movements`, coupon columns, `loyalty_transactions`, `notifications.is_read` don't exist → C1–C3 fixes would error even once wired.
- **Fix Required:** Apply 0020 (SQL Editor). Prerequisite for C1–C3.

### H2 — Portal analytics use `sandboxStore`, not `analyticsService`
- **File/Line:** `src/features/admin/AdminDashboard.tsx:282` (`sandboxStore.getPlatformAnalytics`), `src/features/merchant/MerchantApp.tsx:940` (`getMerchantAnalytics`), `src/features/driver/DriverApp.tsx:109–111` (earnings from `sandboxStore`).
- **Production Impact:** KPI/revenue/earnings cards show **localStorage-derived numbers** in production — fake analytics, not real `orders`/`driver_earnings`.
- **Fix Required:** Real branch → `analyticsService.getPlatformAnalytics/getMerchantAnalytics/getDriverAnalytics`.

### H3 — Notification read-tracking + sandbox poll not production-wired
- **File/Line:** `src/App.tsx:134–136` (sandbox branch polls `sandboxStore.getNotifications` + `registerPushToken`). Real branch exists (`notificationService.getUserNotifications`) but new `markRead/markAllRead/getUnreadCount` are unused.
- **Production Impact:** Real notifications display, but read-state never persists (`is_read`); unread badge resets per session.
- **Fix Required:** Wire `notificationService.markRead/markAllRead`; real push-token registration via `notificationService.registerPushToken`.

---

## MEDIUM

### M1 — HomeScreen mock restaurant fallback
- **File/Line:** `src/features/home/HomeScreen.tsx:49` (`MOCK_RESTAURANTS`), `:56` (`MOCK_FEATURED`), `:163` (`showMock`), `:352`, `:432`.
- **Production Impact:** If the real catalog query returns empty, customers see **fake restaurants** ("m1"–"m4") that aren't orderable. Acceptable as a transient fallback but misleading in production.
- **Fix Required:** Replace mock cards with an explicit empty-state ("no restaurants in your area yet").

### M2 — Hardcoded display metrics shown for REAL branches
- **File/Line:** `src/features/home/HomeScreen.tsx:165` (`DELIVERY_FEES`), plus `ETAS/RATINGS/MIN_ORDERS` arrays applied by `idx % 6` at `:358–363`.
- **Production Impact:** Real restaurants display **fabricated** delivery fee / ETA / rating / min-order (cycled constants), not their actual values.
- **Fix Required:** Source these from `merchant_branches`/`reviews` aggregates; remove the constant arrays.

### M3 — Hardcoded delivery-fee constant in merchant revenue math
- **File/Line:** `src/features/merchant/MerchantApp.tsx:219`, `:404`, `:623`, `:657` (`total_amount - 10`).
- **Production Impact:** Merchant net revenue assumes a flat `10` delivery fee for every order regardless of the real fee → incorrect payouts/figures.
- **Fix Required:** Use the order's actual `delivery_fee` field.

---

## LOW

### L1 — Sandbox auth artifacts present in source (DEV-gated, inert in prod)
- **File/Line:** `src/services/auth.service.ts:14` (`IS_SANDBOX = … && import.meta.env.DEV`), `:16` (`SANDBOX_OTP='123456'`), `:17` (`haat_sandbox_session`), `:22` (`DEMO_ACCOUNTS`), `:48–134` (sandbox branches).
- **Production Impact:** **None in a production build** — `DEV` is `false` ⇒ tree-shaken (proven 0/6 demo logins, `DEMO_ACCOUNTS`=0 in bundle). Source-hygiene only.
- **Fix Required:** Optional hard-removal post-cutover; not blocking.

### L2 — LoginScreen sandbox hint
- **File/Line:** `src/features/auth/LoginScreen.tsx:363` (`VITE_AUTH_MODE==='sandbox' && (…123456 hint)`).
- **Production Impact:** None — false in prod build, not rendered.
- **Fix Required:** None required.

### L3 — Order-lifecycle sandbox branches (dual-mode; real branch exists)
- **File/Line:** `CheckoutPage.tsx:11,293`; `OrdersList.tsx:15,226–240`; `DriverApp.tsx:32,164–181`; `MerchantApp.tsx:87,242–243`; `AdminDashboard.tsx:87–88`; `App.tsx:4,134–136`.
- **Production Impact:** Low — each has a real-service `else` branch (`orderService/driverService/merchantService`); sandbox path is `false` in prod. Functions correctly post-cutover.
- **Fix Required:** None functional; sandbox imports remain (inert). Optional cleanup.

### L4 — Hardcoded sandbox demo strings
- **File/Line:** `MerchantApp.tsx:185–190` (`'متجر تجريبي'`, `'الفرع التجريبي'`, category `c1`); `OrdersList.tsx:244` (`'كابتن هات ناو'`).
- **Production Impact:** None — inside sandbox-only branches, dead in prod.
- **Fix Required:** None required.

---

## Totals
| Severity | Count | Items |
|---|---|---|
| **CRITICAL** | **6** | C1 coupons sandbox-only · C2 loyalty sandbox-only · C3 inventory sandbox-only · C4 migration 0019 unapplied · C5 order_country_code invoker · C6 phone provider disabled |
| **HIGH** | **3** | H1 migration 0020 unapplied · H2 portal analytics fake · H3 notification read-tracking unwired |
| **MEDIUM** | **3** | M1 mock restaurant fallback · M2 hardcoded real-branch metrics · M3 hardcoded delivery fee |
| **LOW** | **4** | L1 sandbox auth (inert) · L2 login hint (inert) · L3 lifecycle sandbox branches (dual-mode) · L4 demo strings (inert) |

- **TOTAL CRITICAL BLOCKERS: 6** (3 source: C1–C3 · 2 DB-migration: C4–C5 · 1 infra: C6)
- **TOTAL HIGH BLOCKERS: 3**
- **TOTAL MEDIUM BLOCKERS: 3**
- **TOTAL LOW BLOCKERS: 4**

### Cutover-critical summary
The **source-code** blockers are C1–C3 + H2–H3: the inventory/coupons/loyalty/analytics/notification-read features have a real service layer (built last sprint) but **no component imports it** — they run sandbox-only and will be empty/localStorage in production. The **DB/infra** blockers are C4–C6 + H1 (apply 0019 + 0020, fix `order_country_code`, enable phone provider). Everything in MEDIUM/LOW is cosmetic or inert in a production build. No fixes were applied in this audit.
