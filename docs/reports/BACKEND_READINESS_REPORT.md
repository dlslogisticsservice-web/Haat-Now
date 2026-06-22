# BACKEND_READINESS_REPORT.md — HAAT NOW

Backend-readiness sprint. Source-only: schema migration **prepared (not executed)**, service/repository/type/query/mutation layer implemented for every completed feature. No UI, no dashboard, no migration run. `tsc` clean + `npm run build` exit 0.

## Per-subsystem readiness
Legend: ✅ exists · ➕ added this sprint (source) · 🔲 needs migration 0020 applied (cutover step)

### 1. Inventory — **PARTIALLY READY** → READY after 0020 applied
| | Status |
|---|---|
| Existing tables | `products` (no stock cols), `product_variants`, `product_images` |
| Missing tables/cols | `products.stock`, `products.low_stock_threshold`, `products.is_active`, `stock_movements` table → ➕ in migration 0020 |
| Existing services | `merchant.service` (upsertProduct/deleteProduct/images) |
| Missing services | inventory queries/mutations → ➕ **`inventory.service.ts`** (getInventory, adjustStock, getStockHistory, getInventoryStats) |
| Existing RPCs | — |
| Missing RPCs | `adjust_product_stock(uuid,int,varchar)` → ➕ in 0020 (atomic, records movement, auto out-of-stock toggle) |
| **Verdict** | **PARTIALLY READY** — service+schema source complete; apply 0020 to go READY |

### 2. Coupons — **PARTIALLY READY** → READY after 0020 applied
| | Status |
|---|---|
| Existing tables | `coupons` (id, code, discount_percent), `coupon_usages` |
| Missing cols | `max_uses, used_count, expires_at, country_code, is_active, created_at` → ➕ in 0020 |
| Existing services | `checkout.service.verifyCoupon` (apply path) |
| Missing services | admin CRUD + validation → ➕ **`coupon.service.ts`** (listCoupons, createCoupon, updateCoupon, deactivateCoupon, validateCoupon) |
| Existing RPCs | — |
| Missing RPCs | `validate_coupon(varchar,varchar)` (active/expiry/usage/country) → ➕ in 0020 |
| **Verdict** | **PARTIALLY READY** — apply 0020 to go READY |

### 3. Loyalty — **NOT READY (schema)** → READY after 0020 applied
| | Status |
|---|---|
| Existing tables | `memberships`, `subscriptions` (not points-based) |
| Missing tables | `loyalty_transactions` → ➕ in 0020 |
| Existing services | — |
| Missing services | ➕ **`loyalty.service.ts`** (getPoints, getHistory, awardPoints, redeemPoints) |
| Existing RPCs | — |
| Missing RPCs | `loyalty_balance`, `award_loyalty_points`, `redeem_loyalty_points` → ➕ in 0020 |
| **Verdict** | **NOT READY** until 0020 applied (no table today); **source fully prepared** |

### 4. Notifications — **PARTIALLY READY** → READY after 0020 applied
| | Status |
|---|---|
| Existing tables | `notifications` (target_user_id, message, type), `push_tokens` (full: user_type/user_id/token/device_type) ✅ |
| Missing cols | `notifications.is_read`, `notifications.created_at` → ➕ in 0020 |
| Existing services | `notification.service` (getUserNotifications, sendNotification, registerPushToken ✅) |
| Missing services | read-tracking → ➕ `markRead`, `markAllRead`, `getUnreadCount` |
| RPCs | none required |
| **Verdict** | **PARTIALLY READY** — push-token schema+service READY; apply 0020 for read-tracking |

### 5. Analytics — **READY (read-only)**
| | Status |
|---|---|
| Existing tables | `orders`, `driver_earnings`, `order_status_history` ✅ (sufficient) |
| Missing tables | none |
| Existing services | `admin.service.getGlobalAnalytics` |
| Missing services | platform/merchant/driver aggregates → ➕ **`analytics.service.ts`** (getPlatformAnalytics, getMerchantAnalytics, getDriverAnalytics) |
| RPCs | none required (aggregates computed in service; RLS-scoped) |
| **Verdict** | **READY** — depends only on existing tables + the 0019 grants |

## Service / repository / type layer (implemented this sprint)
- **Types** (`types.ts`): `Product.stock/low_stock_threshold/is_active`, `Coupon.{max_uses,used_count,expires_at,country_code,created_at}`, `Notification.is_read`, **`StockMovement`**, **`LoyaltyTransaction`**.
- **Services (query + mutation functions):** `inventory.service.ts`, `coupon.service.ts`, `loyalty.service.ts`, `analytics.service.ts` (new); `notification.service.ts` (+read-tracking). All follow the existing `{ data, error }` convention and call the 0020 RPCs for mutations.
- **Migration (prepared, NOT executed):** `supabase/migrations/20260614000020_feature_persistence.sql` — columns, tables, 6 RPCs (SECURITY DEFINER), grants to `authenticated`, RLS for new tables. Idempotent.

## Overall
| Subsystem | Readiness |
|---|---|
| Inventory | 🟡 PARTIALLY READY |
| Coupons | 🟡 PARTIALLY READY |
| Loyalty | 🔴 NOT READY (schema) — source prepared |
| Notifications | 🟡 PARTIALLY READY |
| Analytics | 🟢 READY |

**Single gating action:** apply migration `20260614000020_feature_persistence.sql` (one SQL Editor paste — part of the cutover runbook). Once applied, Inventory/Coupons/Loyalty/Notifications move to READY; the service layer already targets the real tables/RPCs.

## Remaining source step (cutover-time, deliberately not done now)
The UI components currently read these features from `sandboxStore` (dev mode). The **final wiring** swaps each component's data source to the new services in the `else` (supabase) branch — `MerchantApp` inventory → `inventoryService`, `AdminDashboard` coupons → `couponService`, `WalletScreen` loyalty → `loyaltyService`, notification read-state → `notificationService`. This is intentionally left for the cutover because it can only be runtime-verified against the live backend (per the "don't touch dashboard / don't execute migrations" constraint). The service signatures match the sandbox methods 1:1, so the swap is mechanical.

> No migrations were executed and no dashboard was touched. All schema is prepared in migration 0020; the service/type/query/mutation layer is implemented, compiles, and builds.
