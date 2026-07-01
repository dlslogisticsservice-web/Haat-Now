# Service Registry & Governance

The authoritative registry of every service in the platform + the permanent Service Governance standard.
Purpose: prevent duplication, keep one engine per concern, make merges/deprecations deliberate.

---

## SERVICE GOVERNANCE STANDARD (mandatory)

**Every new service created from this point forward MUST begin with this header block:**

```ts
// AUTHORIZED BY:
// Phase:
// Purpose:
// Existing services reused:
// Why a new service is required:
// Duplicate analysis:
// Consumers:
// Future merge candidate: YES/NO
```

Rules:
1. **No new service without this header** and without a "Duplicate analysis" line proving no existing service
   already covers the concern. Prefer extending an existing service.
2. **Every new service is added to this registry** in the same commit.
3. `subscription.service.ts` (Phase 0.1) predates this rule (grandfathered) — it will receive the header at its
   next edit. All services created in Phase 0.2+ must comply.

## PAYMENT RULE (active)
While `HAAT_LIVE_BACKEND` is **not** enabled: **no payment gateway integration** — no Stripe, Moyasar, Paymob,
Paddle, LemonSqueezy, RevenueCat. **Subscription management only** (plans/trials/limits/status — already
delivered in Phase 0.1). Billing/charging/proration is a **dedicated future sprint** gated on the live backend +
a provider credential. The Integration Center may *configure* payment providers (control plane), but no runtime
charge is made.

---

## Registry — core services (`src/services`)

| Service | Purpose | Dependencies | Consumers | Created phase | Duplicate candidate | Merge candidate | Deprecate? | Notes |
|---|---|---|---|---|---|---|---|---|
| `auth.service` | Auth/session/OTP (sandbox + Supabase) | supabase, sandboxStore | App, all portals, orchestrator | Foundation | No | No | No | **Frozen** (auth) |
| `account.service` | Account deletion + logout cleanup | supabase | ProfileScreen | Foundation | No | No | No | Clears `haat_*` on logout |
| `admin-crud.service` | Generic CRUD engine (localStorage/Supabase) | supabase | CrudManager, tenant/subscription/onboarding/finance/etc. | Foundation | No | No | No | **Shared engine** — reused everywhere |
| `admin.service` | Global analytics, audit logs, support triage | supabase | AdminDashboard, GlobalSearch, SystemLogs | Foundation | No (≠ admin-crud) | No | No | Read/aggregation |
| `analytics.service` | Order/earnings analytics | supabase, `haat_crud_*` | dashboards | Foundation | No | Watch (vs admin.service) | No | Small; could fold into admin later |
| `cart.service` | Shopping cart | supabase, `haat_cart` | Customer app | Foundation | No | No | No | |
| `checkout.service` | Checkout, coupons, payment methods | supabase, coupon | CheckoutPage, orchestrator | Foundation | No | No | No | |
| `coupon.service` | Coupon validation | supabase, `coupons` | checkout, cart | Foundation | ⚠ overlaps growthb coupons | Watch | No | Validation vs admin-mgmt (growthb) |
| `country-detection.service` | Country/language detection | — | AppConfig | Foundation | No | No | No | |
| `customer.service` | Customers + addresses | supabase | home, profile, checkout | Foundation | No | No | No | |
| `cx.service` | Support tickets, reviews, tracking, search | supabase, `haat_sb_tickets` | CustomerCareCenter, OrdersList, discover | Foundation (+Care persist) | No | No | No | Ticket store added in Care sprint |
| `driver.service` | Drivers + earnings | supabase | DriverApp | Foundation | No | No | No | |
| `finance.service` | Finance, settlements, commission, refunds | `haat_crud_orders`, `haat_sb_fin_*` | FinanceCenter | Foundation (+persist) | No | No | No | Reads unified order store |
| `growth.service` | Growth Engine: affiliates/influencers/segments/loyalty tiers | supabase | GrowthCenter | Foundation | ⚠ vs growthb | **YES** (merge to one growth svc) | No | UI already consolidated |
| `growthb.service` | Growth Mgmt: coupons/loyalty/promos/analytics | supabase, `haat_crud_*` | GrowthCenterB, AdminDashboardHome, Discover | Foundation | ⚠ vs growth | **YES** | No | Broader consumer set |
| `inventory.service` | Products + stock movements | supabase | MerchantApp | Foundation | No | No | No | |
| `location.service` | Distance/ETA/geo helpers | — | DistanceBadge, EtaBadge, OrdersList | Foundation | No | No | No | Thin but **live** (not dead) |
| `loyalty.service` | Loyalty points transactions (basic) | supabase, `loyalty_transactions` | WalletScreen | Foundation | ⚠ vs growthb loyalty | Watch | No | Keep (wallet uses it) |
| `merchant.service` | Merchants/branches/products | supabase | Merchant portal | Foundation | No | No | No | |
| `merchant-settings.service` | Per-branch settings | merchant.service, `haat_merchant_settings_*` | Merchant portal | Foundation | No | No | No | |
| `monitoring.service` | Error/crash reporting seam | (Sentry DSN) | ErrorBoundary | Foundation | No | No | No | Thin but **live** |
| `notification.service` | Notifications + push | supabase, `notifications` | order/wallet, NotificationCenter | Foundation | No | No | No | Leaf dependency |
| `onboarding.service` | KYC / supply onboarding | supabase, `haat_sb_kyc` | KycCenter | Foundation (+persist) | No | No | No | Decision store added |
| `order.service` | Orders | notification.service | checkout, OrdersList, DriverApp, MerchantApp | Foundation | No | No | No | |
| `payment.service` | Payment gateway **adapters** (config only) | wallet.service | orchestrator, checkout | Foundation | No | No | No | **No live charge** (Payment Rule) |
| `payment-orchestrator.service` | Payment pipeline: idempotency/retry/audit | payment, checkout, wallet, finance, auth | CheckoutPage | Foundation | No (composition) | No | No | High-value; composes, not duplicates |
| `product.service` | Products/catalog/favorites/reviews | supabase | home, restaurant | Foundation | No | No | No | |
| `rbac.service` | Roles, permissions, matrix, guards | `haat_sb_rbac_*` | RbacCenter, useRbac/`<Can>`, IntegrationCenter, TenantWorkspace | Phase 1 (Enterprise Security) | No | No | No | Single permission source |
| `release.service` | App version gates / maintenance | supabase, `settings` | App boot | Foundation | No | No | No | |
| `storage.service` | Supabase Storage (images) | supabase storage | product/merchant uploads | Foundation | ⚠ vs assets.service | Watch | No | Images vs media library |
| `subscription.service` | Plans/trial/limits/usage-guard/status | tenant.service, `subscriptions`/`memberships` | TenantWorkspace (Subscription tab) | **Phase 0.1** | No | No | No | **NEW**; no billing (Payment Rule) |
| `tenant.service` | White-label tenants + theme apply | admin-crud, designSystem | TenantWorkspace, subscription.service, provisioning (future) | Enterprise (white-label) | No | No | No | Config spine anchor |
| `tracking.service` | Driver location tracking | supabase, `driver_locations` | OrderTrackingMap, DriverApp | Foundation | No | No | No | Realtime gated in sandbox |
| `wallet.service` | Wallets + transactions | notification.service, sandboxStore | WalletScreen, MerchantWalletCenter | Foundation | No | No | No | |

## Registry — ops services (`src/services/ops`)
| Service | Purpose | Consumers | Duplicate | Merge | Deprecate | Notes |
|---|---|---|---|---|---|---|
| `command.service` | Ops command-center feed | OperationsCommandCenter, AdminDashboardHome | No | No | No | Realtime gated in sandbox |
| `dispatch.service` | Dispatch/assignments | OperationsCenter, DriverOpsPanel | No | No | No | |
| `payout.service` | Driver payouts | OperationsCenter (Payouts) | No | No | No | Reads sandboxStore wallet |
| `performance.service` | Driver performance | OperationsCenter | No | No | No | |
| `shift.service` | Driver shifts | DriverApp | No | No | No | |
| `vehicle.service` | Vehicles | OperationsCenter, CRUD | No | No | No | |
| `zone.service` | Zones | OperationsCenter, ZoneCoverageEditor | No | No | No | |
| `ops-execution.service` | Ops execution console backing | OpsExecutionConsole | No | No | No | Thin but **live** |

## Registry — platform / design / experience
| Service | Purpose | Consumers | Duplicate | Merge | Deprecate | Notes |
|---|---|---|---|---|---|---|
| `platform.service` | Platform registry + **Integration Center** (providers/flags/brands/envs/webhooks) | IntegrationCenter, PlatformRegistry, (future runtime) | No | No | No | One provider registry (Phase 2 Integrations) |
| `experience.service` | CMS: screen experiences (draft/publish/version/rollback) | ExperienceBuilder, ExperienceProvider, (future website) | No | No | No | One CMS — website content extends it |
| `assets.service` | Media/asset library (Supabase Storage) | AssetsManager, MediaPicker | ⚠ vs storage.service | Watch | No | Media lib vs raw image upload |

## Engines / stores / types (not "services" — listed for completeness)
| File | Role | Notes |
|---|---|---|
| `sandboxStore.ts` | Demo backend store (orders/wallets/notifs/loyalty…) + **order→finance bridge** | Core to demo mode; not a network service |
| `demoSeed.ts` | Demo data seeder (`haat_crud_*`) | Idempotent (`haat_demo_seeded_v2`) |
| `design/designSystem.ts` | Design tokens + `applyDesign` (theme engine) | The one theme engine |
| `platform/platformModel.ts` | Provider catalog + registry types | Types/data, not a service |
| `experience/experienceTypes.ts` | CMS schema types | Types |
| `services/types.ts` | Shared types | Types |
| `hooks/useRbac.tsx` | `useRbac` hook + `<Can>` guard | Consumer of rbac.service |

---

## Duplicate / merge analysis (summary)
- **`growth.service` + `growthb.service` — MERGE CANDIDATE (YES).** Two growth services; UI already consolidated
  (one "Growth" nav, prior sprint). A future cleanup sprint can merge them into one `growth.service` with the
  combined surface (Engine + Mgmt). Not urgent; both are live and stable.
- **`coupon.service` vs `growthb` coupons — WATCH.** `coupon.service` = customer-side validation; `growthb` =
  admin coupon management. Distinct roles; keep separate but avoid drift.
- **`loyalty.service` vs `growthb` loyalty — WATCH.** `loyalty.service` = basic points (WalletScreen);
  `growthb` = tiers/rewards. Keep (wallet dependency) but consider a single loyalty core later.
- **`storage.service` vs `assets.service` — WATCH.** `storage.service` = raw image uploads; `assets.service` =
  media library index. Could converge under one asset layer (relevant to the Brand Asset Manager, Phase 0.3).
- **`payment.service` + `payment-orchestrator.service` — NOT duplicate** (adapters vs pipeline). Keep.
- **No service is currently dead / deprecatable** — the earlier audit's "possibly dead" flags
  (`loyalty`/`location`/`monitoring`/`ops-execution`) were disproven (all have live consumers).

## Governance status
- Total service-like files: **52** (35 services + 8 ops + platform/design/experience + engines/types).
- New services this program: `rbac.service` (Phase 1), `subscription.service` (Phase 0.1).
- **Standing merge candidate:** growth/growthb (deferred, non-blocking).
- **No new service** may be added in Phase 0.2+ without the governance header + a registry entry in the same commit.

**Registry generated. STOP — Phase 0.2 not started.**
