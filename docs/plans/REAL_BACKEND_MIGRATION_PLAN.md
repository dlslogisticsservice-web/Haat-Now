# REAL_BACKEND_MIGRATION_PLAN.md

Roadmap to convert the validated **sandbox** workflow (10/10 PASS) into a **real Supabase** workflow. No code changed by this document.

## Key finding
For **every** sandbox operation a working real Supabase service method **already exists**. The sandbox is a thin `if (SANDBOX) { sandboxStore… } else { <real service> }` fork. So the migration is mostly **(a) infrastructure** (auth + grants + RLS fix) and **(b) removing/flag-gating the sandbox forks** — plus **one real feature to build: notification generation**.

## sandboxStore integration audit (every call site)
| File:line | Sandbox call | Replaced real service |
|---|---|---|
| `CheckoutPage.tsx:293` | `createOrder` | `orderService.createOrder` |
| `OrdersList.tsx:190` | `getCustomerOrders` | `orderService.getCustomerOrders` |
| `MerchantApp.tsx:183` | `getMerchantOrders` | `merchantService.getBranchOrders` |
| `MerchantApp.tsx:232` | `setStatus` | `orderService.updateOrderStatus` |
| `DriverApp.tsx:109–111` | `getDriverAvailable/Active/Delivered` | `supabase.from('orders')` feed + `driverService.getActiveJobs/getEarnings` |
| `DriverApp.tsx:164–165` | `assignDriver`+`setStatus` | `driverService.acceptDelivery` |
| `DriverApp.tsx:180–181` | `completeDelivery`/`setStatus` | `walletService.completeDelivery` (RPC) / `orderService.updateOrderStatus` |
| `AdminDashboard.tsx:69` | `getOrders().length` | `adminService.getGlobalAnalytics` |

## Infrastructure prerequisites (P0 — gate everything below)
Already prepared as SQL/migrations; require Supabase dashboard/SQL access:
1. Enable **Phone provider + Test OTP** (real login). 2. Apply **`0019_authenticated_grants`** (else logged-in users `42501`). 3. Apply **`order_country_code` SECURITY DEFINER** fix (admin RLS recursion). 4. Run **`seed_demo_accounts.sql`** (provision `user_roles`/`admin_users`/driver/merchant rows). 5. Verify money/delivery RPCs are `SECURITY DEFINER` (`prosecdef=true`).
**Effort:** ~0.5 day (dashboard + SQL Editor; not codebase work).

---

## Feature 1 — Orders
- **Current sandbox:** `sandboxStore.createOrder` (localStorage) on checkout confirm; `getCustomerOrders`/`getMerchantOrders`/`setStatus`.
- **Existing Supabase:** `orderService.createOrder` (inserts `orders` + `order_items` + `order_status_history`), `getCustomerOrders`, `getOrderDetails`, `updateOrderStatus`; `merchantService.getBranchOrders`. RLS policies + Realtime subscriptions already wired (`MerchantApp`/`OrdersList`/`DriverApp`).
- **Missing pieces:** real `auth.uid()` (P0-1); `authenticated` GRANTs on `orders`/`order_items`/`order_status_history` (P0-2); restore the real checkout (address + payment-initiate) path that the sandbox fork bypasses.
- **Exact files to modify:** `CheckoutPage.tsx` (remove `SANDBOX` order fork @293), `OrdersList.tsx` (remove fork @190), `MerchantApp.tsx` (remove forks @183/@232).
- **Effort:** Low (~2–3h) — real path exists; mostly delete forks + verify under auth.

## Feature 2 — Order Items
- **Current sandbox:** items embedded in `SbOrder.items` (no separate table).
- **Existing Supabase:** `orderService.createOrder` inserts `order_items` (with variant resolution @CheckoutPage `handlePlaceOrder`); `getOrderDetails` reads them.
- **Missing pieces:** `authenticated` GRANT on `order_items` + `product_variants` (variant auto-create path); nothing new to build.
- **Exact files:** `CheckoutPage.tsx` (the variant-resolution + `createOrder` real path already present below the fork).
- **Effort:** Low (~1h) — covered by removing the orders fork.

## Feature 3 — Wallets
- **Current sandbox:** `sandboxStore.getWallet`/`completeDelivery` credits a localStorage wallet.
- **Existing Supabase:** `walletService.getWallet` (`wallets`), `getTransactions` (`wallet_transactions`), `completeDelivery` → **RPC `complete_delivery`** (atomic status + earnings + wallet). `WalletScreen` already uses the real `walletService`.
- **Missing pieces:** `authenticated` SELECT on `wallets`/`wallet_transactions` (P0-2); RPC must be `SECURITY DEFINER` (P0-5, unverified); `wallet_transactions` rows must be written by the RPC (verify).
- **Exact files:** `DriverApp.tsx` (earnings come from sandbox @109–111; real path = `reloadDriverState`→`driverService.getEarnings` already present). No `WalletScreen` change.
- **Effort:** Low–Med (~3h) — verify RPC `SECURITY DEFINER` + grants; delete driver fork.

## Feature 4 — Notifications  ⚠️ ONLY GENUINELY-MISSING FEATURE
- **Current sandbox:** `sandboxStore` pushes a notification on every status transition (`createOrder`/`setStatus`/`completeDelivery`) → `getNotifications`.
- **Existing Supabase:** `notificationService.getUserNotifications` (read) + `sendNotification` (insert) exist; `App.tsx` subscribes to `notifications` via Realtime. **BUT nothing calls `sendNotification` during the order lifecycle** — grep shows **no real notification generation** on order events.
- **Missing pieces:** generation logic — either (a) **DB triggers** on `orders`/`order_status_history` that INSERT into `notifications`, or (b) `notificationService.sendNotification(...)` calls inside `orderService.updateOrderStatus`/`createOrder` and `driverService.acceptDelivery` + the `complete_delivery` RPC. (Optional: real **push** — `push_tokens` is never written; no FCM/web-push.)
- **Exact files:** **new migration** `…_notification_triggers.sql` (recommended) **or** edits to `services/order.service.ts`, `services/driver.service.ts`, and the `complete_delivery` RPC; (push) `services/notification.service.ts` (`registerPushToken` exists) + a new `notify` edge function.
- **Effort:** Medium (~1 day for in-app generation via triggers/service calls); **+1–2 days** if real push is in scope.

## Feature 5 — Driver Earnings
- **Current sandbox:** `sandboxStore.getDriverDelivered` → earnings list; `completeDelivery` credits `delivery_fee`.
- **Existing Supabase:** `driver_earnings` table; **`complete_delivery` RPC** inserts the earning + credits wallet atomically; `driverService.getEarnings` reads `driver_earnings`; `complete_delivery_payout(uuid,uuid,decimal)` also deployed.
- **Missing pieces:** `authenticated` SELECT on `driver_earnings` (P0-2); RPC `SECURITY DEFINER` (P0-5); `DriverApp` earnings currently from sandbox fork.
- **Exact files:** `DriverApp.tsx` (remove forks @109–111/@180–181; real `reloadDriverState` + `walletService.completeDelivery` already present).
- **Effort:** Low (~2h).

## Feature 6 — Admin Visibility
- **Current sandbox:** `sandboxStore.getOrders().length` → `analytics.totalOrders`.
- **Existing Supabase:** `adminService.getGlobalAnalytics` (count `orders`/`merchants`/`drivers`); **0018 applied** (`auth_is_admin`/`scope`/`country` + `order_country_code`) for country-scoped reads; admin order RLS policy exists.
- **Missing pieces:** `authenticated` grants; **`order_country_code` SECURITY DEFINER fix** (P0-3 — else admin order reads recurse); admins currently see aggregate KPIs only (no navigable Orders/Merchants/Drivers/Customers **list** pages).
- **Exact files:** `AdminDashboard.tsx` (remove fork @69; real `getGlobalAnalytics` present); optional new list views in `AdminDashboard.tsx` + `adminService`.
- **Effort:** Med (~0.5 day for analytics+scoping; +1 day if building list pages).

---

## Sandbox scaffolding to remove/flag-gate (after cutover)
`src/services/sandboxStore.ts` (delete or keep behind `VITE_AUTH_MODE=sandbox`), and the `SANDBOX` forks in `CheckoutPage.tsx`, `MerchantApp.tsx`, `DriverApp.tsx`, `OrdersList.tsx`, `AdminDashboard.tsx`, plus `auth.service.ts` `DEMO_ACCOUNTS`. Recommended: keep them flag-gated (sandbox stays useful for demos) rather than deleting.

## Effort summary
| Phase | Effort |
|---|---|
| P0 infrastructure (dashboard + SQL) | ~0.5 day |
| Orders + Order Items + Driver Earnings + Wallets (remove forks, verify) | ~1 day |
| **Notifications generation (the missing build)** | ~1 day (+1–2 if push) |
| Admin visibility (scoping + optional list pages) | ~0.5–1.5 days |
| **Total real-backend cutover** | **~3–4 days** (excl. real push depth) |

## Migration order
P0 infra → Orders/Items → Wallets/Earnings (verify RPC `SECURITY DEFINER`) → **build Notifications generation** → Admin scoping → flag-gate sandbox → re-run the workflow suite in `VITE_AUTH_MODE=supabase` to convert the sandbox 10/10 into real PASS/FAIL.
