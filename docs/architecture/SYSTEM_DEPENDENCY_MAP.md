# System Dependency Map

Factual map from code inspection. The platform is a single React+Vite SPA (admin + customer + driver +
merchant surfaces) over a **sandbox backend** (localStorage) in demo mode, or Supabase when
`VITE_AUTH_MODE!=='sandbox'`. One codebase, one token layer, one auth.

## Provider / context tree (boot order — `src/main.tsx`)
```
AppConfigProvider (lang/dir, i18n)            contexts/AppConfigContext
  └─ DesignProvider (applies design tokens → :root, on boot + change)   design/DesignContext + designSystem.applyDesign
       └─ ExperienceProvider (splash/onboarding/login content per country)  experience/ExperienceContext
            └─ App (role router: customer / driver / merchant / admin)
```
- **DesignProvider is the theming cascade**: `applyDesign()` writes 40+ CSS vars to `:root`; every surface
  (customer/driver/merchant/admin) reads the same vars → White-Label/theme changes propagate globally with
  no per-surface edits.

## Stores (localStorage namespaces)
| Namespace | Owner | Holds |
|---|---|---|
| `haat_sb_*` | `sandboxStore` | orders, wallets, notifs, reviews, products, stock, coupons, loyalty, push, addresses, seq |
| `haat_crud_*` | `adminCrud` | drivers, vehicles, merchants, merchant_branches, **orders**, customers, categories, zones, tenants, operation_events |
| `haat_sb_rbac_roles` / `_acting` | `rbac.service` | roles + permissions, acting role |
| `haat_platform_registry` / `haat_webhook_logs` | `platform.service` | providers/flags/brands/envs, webhook logs |
| `haat_design_store_v1` | `DesignContext` | published/draft design config |
| `haat_sb_kyc` · `haat_sb_tickets`(+msgs) · `haat_sb_fin_paid`/`_comp` · `haat_sb_campaigns` | onboarding / cx / finance / campaign services | KYC decisions, support tickets, paid settlements + compensation, campaigns |
| `haat_sandbox_session` | `auth.service` | demo session |

## Services → {storage, tables/rpcs, key deps}
| Service | Writes/Reads | Calls / imports |
|---|---|---|
| `sandboxStore` | `haat_sb_orders/wallets/notifs/loyalty/...` **+ bridges to `haat_crud_orders`** | — |
| `order.service` | orders | `notification.service` |
| `finance.service` | `haat_crud_orders` (delivered/cancelled), `haat_sb_fin_*` | — |
| `payout.service` | `sandboxStore.getWallet` | sandboxStore |
| `wallet.service` | wallets | `notification.service` |
| `payment.service` / `payment-orchestrator` | — | wallet, checkout, finance, auth, payment |
| `cx.service` | `haat_sb_tickets`, reviews | supabase (gated) |
| `onboarding.service` | `haat_sb_kyc` | supabase (gated) |
| `campaign.service` | `haat_sb_campaigns` | — |
| `growthb`/`growth`/`coupon`/`loyalty` | coupons/loyalty/`haat_crud_*` | — |
| `rbac.service` | `haat_sb_rbac_*` | — (consumed by `useRbac`/`<Can>`) |
| `platform.service` | `haat_platform_registry`, `haat_webhook_logs` | `platformModel` |
| `tenant.service` | `haat_crud_tenants` | `adminCrud`, `designSystem` (theme apply) |
| `dispatch`/`command`/`shift`/`ops-execution` | seeded `haat_crud_*` | adminCrud |

## Pages → services (edges)
- **Customer** (home/discover/restaurant/checkout/orders/wallet/profile) → `sandboxStore`, `cart`, `checkout`,
  `cx`, `coupon`, `loyalty`, `customer`, `account`.
- **Driver** (`DriverApp`) → `sandboxStore`, `driver`, `shift`, `performance`, `wallet`.
- **Merchant** (`MerchantApp`/`KitchenQueue`/`StoreManagement`/`MerchantWalletCenter`/`MerchantReports`) →
  `merchant`, `merchant-settings`, `inventory`, `product`, `sandboxStore`.
- **Admin** (`AdminDashboard` → OperationsCenter, FinanceCenter, RbacCenter, IntegrationCenter, DesignCenter,
  TenantWorkspace, CrudManager×N) → all of the above + `rbac`, `platform`, `finance`, `cx`, `onboarding`,
  `tenant`, `campaign`, `growthb`.

## Realtime / events
- **Supabase realtime is gated OFF in sandbox** (`lib/supabase` stub returns no-op `channel/subscribe`).
  Cross-surface propagation in demo = **shared localStorage + poll/refresh** (e.g. checkout tracking poll,
  OCC live-sim animation). The OCC map runs a client-side LIVE SIM (no socket).
- **App events**: `rbac-acting-changed` (window event) drives live RBAC guard re-render (`useRbac`).
- In Supabase mode, realtime channels would activate (driver_locations, order_status) — present in code,
  gated by `VITE_AUTH_MODE`.

## Database (Supabase, 41 tables — migrations)
orders, order_items, order_status_history · customers, addresses, favorites, customer_carts, cart_items ·
merchants, merchant_branches, products, product_variants, product_images, categories · drivers,
driver_locations, driver_earnings · wallets, wallet_transactions, payment_transactions, payment_methods ·
coupons, coupon_usages, memberships, subscriptions, offers, banners · support_tickets, support_messages,
reviews, notifications, push_tokens · roles, permissions, role_permissions, user_roles, admin_users ·
audit_logs, app_config, settings, zones, countries, cities. (Sandbox mirrors the needed ones in localStorage.)

## Cross-module bridges (the integration seams)
- **Orders bridge (added this audit):** `sandboxStore` mirrors every lifecycle order into `haat_crud_orders`
  → Admin Orders, Finance, Analytics see live orders (was a disconnect).
- **Theme cascade:** `applyDesign` → `:root` → all surfaces. `tenant.service.applyTheme` reuses it.
- **RBAC layer:** `rbac.service` → `useRbac`/`<Can>` → guards (e.g. Integration Center) — single permission source.
- **Integration registry:** `platform.service` providers (control plane). NOTE: runtime consumers (maps) still
  read env keys directly — see readiness report.
