# HAAT NOW — Codebase Audit Master Report

**Type:** Full read-only codebase audit. No code, docs, or config were modified. No commit. No deploy.
**Method:** Evidence from **actual source only** — file reads, `rg`/`grep`, import-graph and store/table reference
scans, and five parallel deep-inventory passes over the whole `src/`, `supabase/`, and native/build surface.
The plan, prior reports, and documentation were **not** used as a source of truth; where this report and the docs
disagree, this report reflects the code.

---

## 0. The one fact that frames everything

**The application is built and shipped in SANDBOX mode.** `vite.config.ts` sets
`authMode = process.env.HAAT_LIVE_BACKEND === '1' ? 'supabase' : 'sandbox'` and injects it as
`import.meta.env.VITE_AUTH_MODE`. `.env`, `.env.production`, and `.env.example` all set `VITE_AUTH_MODE=sandbox`.

There are therefore **two backends in the code**:

| | Sandbox (shipped default) | Supabase / live (opt-in `HAAT_LIVE_BACKEND=1`) |
|---|---|---|
| Storage | Browser `localStorage` (`haat_sb_*`, `haat_crud_*`) | Postgres (48 migrations, ~110 tables) + Storage + Realtime + 4 edge functions |
| Client | `src/lib/supabase.ts` returns a **recursive Proxy stub** — every call resolves `{data:[],error:null}`, every channel is a no-op (zero HTTP, zero websockets) | Real `createClient` (needs `VITE_SUPABASE_URL`/`ANON_KEY`) |
| Realtime | Off (feature-gated + stubbed) | On (order/driver/notification/audit channels) |
| Payments | No gateway — success modal shown immediately | Real Moyasar edge function |
| Demo data | `demoSeed.ts` + `sandboxStore.ts` | `supabase/seed*.sql` (needs a manual auth-user step) |

**Consequence for "readiness":** every readiness number below is split. *Sandbox readiness* = how well the
module works in the deployed demo. *Production readiness* = how ready it is for a real live-backend launch,
which is **unproven at runtime** — the E2E suite exercises the sandbox path only. Many services have **no
sandbox branch** and rely entirely on the live Supabase path + unseen Postgres RPCs; in the shipped demo those
calls hit the no-op stub, and the demo's real behaviour comes from `sandboxStore`.

---

## 1. Codebase metrics (measured)

| Metric | Value |
|---|---|
| `src` TypeScript/TSX files | **161** |
| `src` total LOC | **27,178** |
| Services (`src/services` + `ops/`) | 42 + 7 = **49 files**, ~6,250 LOC |
| Admin feature files (`src/features/admin/**`) | **31 top-level + workspaces**, ~5,296 LOC |
| Shared components (`src/components/**`) | **27 files**, 3,656 LOC |
| Supabase migrations | **48 files**, **108 `CREATE TABLE` statements** (~110 distinct tables, all `IF NOT EXISTS`) |
| Legacy migrations (`src/db/migrations`) | 8 files (`0000`–`0007`) — superseded subset |
| Edge functions (`supabase/functions`) | **4** (all payment: initiate/verify/refund/webhook) + `_shared` |
| Distinct `supabase.from('…')` tables referenced in client code | **78** |
| Distinct `adminCrud('…')` entities | 13 |
| Distinct `haat_*` localStorage namespaces | **54** |
| `TODO` / `FIXME` / `HACK` markers in `src` | 1 / 0 / 1 (very few; "coming soon"/placeholder matches are HTML `placeholder=` attrs) |
| `VITE_AUTH_MODE` referenced in | 30 files |
| `HAAT_LIVE_BACKEND` referenced in runtime `src` | **0** files (build-time only, in `vite.config.ts`) |
| Confirmed dead source files | 5 (+1 dead barrel) — see §5 |

---

## 2. Module-by-module inventory

Legend for backing store: **DB** = real Supabase writes · **LOCAL** = localStorage/sandboxStore only ·
**HYBRID** = Supabase in live, localStorage in sandbox · **STUB** = no-op in sandbox (Supabase-only, no sandbox
branch). Percentages: **Cmpl** = feature completeness of the code that exists · **Prod** = live-launch readiness
· **Sbx** = works in the shipped sandbox demo.

### 2.1 Admin Portal
- **Purpose:** Super/country admin control plane — operations, finance, KYC, care, growth, RBAC, integrations,
  design, provisioning, tenants, records.
- **Files:** `src/features/admin/**` (40 files incl. `workspaces/`). Entry `App.tsx:622` → lazy `AdminDashboard.tsx`
  (721) + `AdminSidebar.tsx` (184, 11 nav groups).
- **Services:** admin, adminCrud, analytics, coupon, notification, finance, onboarding, cx, rbac, platform,
  campaign, growth, growthb, tenant, subscription, provisioning, templates, themePresets, experience, assets,
  ops/*, auth.
- **Components/Pages:** ~30 consoles + 7 record workspaces (Tenant/Driver/Order/Customer/Merchant/Vehicle/Branch)
  over `components/admin/CrudManager`.
- **DB tables:** most Supabase-backed consoles (orders, merchants, drivers, customers, zones, vehicles,
  operation_events, coupons, campaigns, support_tickets, audit_logs, app_config, settlements, kyc_reviews, …).
- **Completion / Prod / Sbx:** **88% / 78% / 85%.** All 40 files are imported and reachable — **no dead admin
  files.** Ops/Finance/KYC/Care/Growth/Notifications/Logs/CRUD = real Supabase; RBAC/Integrations/PlatformRegistry/
  ThemePresets/Provisioning/Templates/Onboarding = LOCAL; Experience/Assets = HYBRID; OpsIncidentLog = sandbox-only.
- **Missing / limitations:** `AdminDashboardHome` charts, deltas, satisfaction, System-Health are **synthetic/
  hardcoded** (75%); `PlatformRegistry` is view/toggle-only with a "requires multi-tenant" placeholder (65%);
  `OpsIncidentLog` reads only sandbox failed orders (65%); platform-control consoles persist to localStorage, not
  Postgres.
- **Ship today?** **YES as an admin demo** (rich, reachable, mostly real handlers). **NO for live control of a
  real business** — RBAC/registry/theme/provisioning state is localStorage-only and would not survive or enforce
  server-side.

### 2.2 Customer App
- **Purpose:** Marketplace: browse → cart → checkout → order → track → review/reorder → wallet/loyalty → profile.
- **Files / Pages:** `App.tsx` (shell, 889), `home/HomeScreen` (544) + `MarketplaceHero` (130),
  `discover/DiscoverScreen` (192), `restaurant/RestaurantScreen` (529), `checkout/CheckoutPage` (973),
  `orders/OrdersList` (765) + `OrderTrackingMap` (85) + `MultiTargetReview` (96), `wallet/WalletScreen` (370),
  `profile/ProfileScreen` (1156).
- **Services:** campaign, cart, checkout, order, payment-orchestrator, cx, coupon, loyalty, wallet, customer,
  account, tracking, storage, sandboxStore, supabase.
- **DB tables (live):** orders/order_items/…, products/variants/images, customers/addresses, coupons,
  payment_transactions, favorites, reviews, wallets.
- **Completion / Prod / Sbx:** **85% / 75% / 90%.** Full real flows on the sandbox store.
- **Missing / limitations:** Home restaurant cards fall back to `MOCK_RESTAURANTS`/fabricated ETA/rating arrays
  when catalog empty; Wallet shows `SAMPLE_TRANSACTIONS` when no real txns and top-up/"view all" are inert;
  `call_driver`/`chat_driver` buttons have no handlers; reviews tab is a static empty state; Moyasar payment
  only runs on the live path (sandbox shows instant success). Google-Maps tracking needs
  `VITE_GOOGLE_MAPS_API_KEY` or falls back to a canvas map.
- **Ship today?** **YES (demo).** For real commerce, needs the live path proven + real payment (below).

### 2.3 Merchant Portal
- **Purpose:** Order queue, kitchen display, catalog, inventory, store settings, earnings/wallet, reports.
- **Files / Pages:** `merchant/MerchantApp` (1218), `KitchenQueue` (104), `StoreManagement` (152),
  `MerchantWalletCenter` (78), `MerchantReports` (162).
- **Services:** merchant, merchant-settings, order, inventory, analytics, wallet, storage, account, sandboxStore.
- **DB tables:** orders, merchant_branches, merchants, products, product_images, wallets, stock_movements.
- **Completion / Prod / Sbx:** **85% / 78% / 88%.** Order lifecycle, catalog CRUD, inventory, kitchen, store
  settings, reports, wallet-center all real.
- **Missing / limitations:** the separate **"Earnings" tab** is cosmetic — earnings = `total − 10` hardcoded fee,
  withdrawal buttons only toast; this co-exists with the real `MerchantWalletCenter` (two wallet surfaces, one
  real, one fake). Realtime order push off in sandbox (new orders appear on reload).
- **Ship today?** **YES (demo).** Live needs realtime + real payout wiring for the earnings tab.

### 2.4 Captain (Driver) App
- **Purpose:** Online toggle, nearby jobs, accept → pickup → deliver → earn, GPS, shift/dispatch/payout.
- **Files / Pages:** `driver/DriverApp` (704), `DriverOpsPanel` (137).
- **Services:** driver, order, tracking, wallet, account, sandboxStore, ops/shift, ops/dispatch, ops/payout.
- **DB tables:** orders, drivers, driver_locations, driver_earnings, driver_shifts, payout_requests.
- **Completion / Prod / Sbx:** **70% / 68% / 78%.** Core job lifecycle + ops panel (shift/dispatch/payout) are
  real.
- **Missing / limitations:** the flagship **Home/Earnings dashboard is largely fabricated** — rating,
  acceptance/completion rate, avg-delivery, rank, week/month earnings, cash-collected, bonus all derive from a
  **hash of the driver id** (`hashNum`); only `totalEarned`/`completedCount` are real. `DriverMiniMap` is a fake
  SVG; the primary "Withdraw" button only toasts (real payout is in the ops panel); FAB/profile rows inert.
- **Ship today?** **NO for a real captain** — headline earnings/performance numbers are invented. Fine as a demo.

### 2.5 Authentication
- **Purpose:** Dual-mode phone-OTP auth + role/scope resolution.
- **Files:** `services/auth.service.ts` (191), `account.service.ts` (28), `lib/supabase.ts` (41),
  `features/auth/LoginScreen.tsx` + `types.ts`.
- **APIs:** sendOtp, verifyOtp, getCurrentUser, getAdminScope, getAccessToken, subscribeToAuthChanges, signOut;
  account: deleteMyAccount (RPC `delete_my_account`).
- **DB tables:** user_roles→roles, customers, admin_users. **Store:** `haat_sandbox_session`.
- **Completion / Prod / Sbx:** **90% / 80% / 95%.** Sandbox = fixed OTP `123456` + 10 `DEMO_ACCOUNTS`. Live = real
  `signInWithOtp`/`verifyOtp` + a robust `resolveHighestRole` (documented PostgREST-ordering workaround).
- **Missing / limitations:** live SMS OTP unproven at runtime; sandbox uses static accounts. **Frozen system.**
- **Ship today?** **YES.** Most production-ready subsystem in the repo.

### 2.6 RBAC
- **Purpose:** Roles, permissions, templates, `<Can>` guards.
- **Files:** `services/rbac.service.ts` (135), `hooks/useRbac.tsx` (23), `features/admin/RbacCenter.tsx` (124).
- **APIs:** listRoles, createRole, setPermission, applyTemplate, deleteRole, hasPermission, getActingRole,
  setActingRole, can. **35 permissions / 12 groups / 9 templates.**
- **Store:** `haat_sb_rbac_roles`, `haat_sb_rbac_acting` — **localStorage only, no Supabase branch** (despite
  `roles/permissions/role_permissions/user_roles` tables existing in migrations).
- **Completion / Prod / Sbx:** **60% / 40% / 85%.** Catalog + guards + matrix UI are complete.
- **Missing / limitations:** **no server enforcement** — guards are client-side only; roles persist only to
  localStorage; **acting role defaults to `super_admin`**, so the demo runs as full super-admin. This is a real
  **security gap** for any live deployment.
- **Ship today?** **NO for live** (permissions unenforceable server-side). Fine for demo.

### 2.7 Multi-Tenant  &  2.8 White Label
- **Purpose:** One deployment, many branded tenants (identity/theme/subscription/features/CMS/domains).
- **Files:** `services/tenant.service.ts` (107), `workspaces/TenantWorkspace.tsx` (373), `config/countries.ts`;
  theme cascade via `design/*`.
- **APIs:** provision, update, saveBranding, applyTheme, restoreDefaultTheme, activate/suspend/resume/archive,
  exportTenant, importTenant, cloneTenant, deleteTenant, tenantTheme.
- **DB tables:** tenants (`haat_crud_tenants` / `tenants`), operation_events; migrations include
  `platform_organizations`/`tenants`.
- **Completion / Prod / Sbx:** **80% / 55% / 85%.** CRUD + lifecycle + export/import/clone/backup-delete all real.
- **Missing / limitations:** **no true isolation** — a single global `haat_crud_tenants` store, **theme applied
  globally to `:root`** (not tenant-scoped), and subscription usage counters computed from **platform-global**
  `haat_crud_*` (not per-tenant). White-label = switchable branding, not isolated tenants.
- **Ship today?** **NO for real multi-tenant SaaS** (no data/permission isolation). YES to demo white-labeling.

### 2.9 Theme Engine
- **Purpose:** `applyDesign()` writes ~25 CSS variables to `:root` → live re-skin, no rebuild.
- **Files:** `design/designSystem.ts` (90), `design/DesignContext.tsx` (100). **Store:** `haat_design_store_v1`.
- **APIs:** DEFAULT_DESIGN, mergeDesign, applyDesign; context: patchDraft/saveDraft/publish/applyPreset/rollback +
  20-version history + per-country layering.
- **Completion / Prod / Sbx:** **90% / 70% / 95%.** Real token engine + draft/publish/version/rollback.
- **Missing / limitations:** localStorage-only (server-sync is an unwired TODO); global (not tenant-scoped).
- **Ship today?** **YES** as the design engine; persistence won't survive server-side without wiring.

### 2.10 Design Center
- **Purpose:** Admin UI for the theme engine + presets + experience + assets.
- **Files:** `admin/DesignCenter.tsx` (224) + sub-panels `ThemePresetsPanel` (98), `ExperienceBuilder` (171),
  `CountryBranding` (81), `AssetsManager` (69), `BrandAssetsPanel` (75). **Frozen system.**
- **Completion / Prod / Sbx:** **88% / 72% / 90%.** Live token editor + preview + rollback, RBAC-gated.
- **Missing / limitations:** `CountryBranding` is a splash-only **subset of** `ExperienceBuilder` (duplication);
  design state localStorage-only.
- **Ship today?** **YES (demo).**

### 2.11 Brand Assets
- **Purpose:** Logos/favicon/splash + media library.
- **Files:** `experience/assets.service.ts` (112), `services/storage.service.ts` (152),
  `components/brand/BrandLogo.tsx`, admin `AssetsManager`/`BrandAssetsPanel`.
- **Store/buckets:** `haat_sb_experience_assets_v1`; Supabase Storage buckets `experience-assets` (assets) and
  product-images/merchant-logos/banners/offer-images/avatars (storage). **10 `BRAND_SLOTS`.**
- **Completion / Prod / Sbx:** **80% / 70% / 82%.** Real upload pipelines (data-URL in sandbox, Supabase in live).
- **Missing / limitations:** `assets.service.registerUrl()` **live branch never persists (data-loss bug) and is
  unused**; `storage.service` has no sandbox path (always calls Supabase).
- **Ship today?** **YES (demo).** Fix `registerUrl` before relying on live registration.

### 2.12 CMS  /  2.13 Experience Builder
- **Purpose:** Per-country content for **splash / login / onboarding** with draft/publish/version/rollback.
- **Files:** `experience/experience.service.ts` (172), `experienceTypes.ts` (145), `ExperienceContext.tsx` (44),
  `blocks/*` (110), admin `ExperienceBuilder.tsx`.
- **DB tables:** `screen_experiences`, `screen_experience_history` (live) / `haat_sb_screen_experiences_v1`.
- **Completion / Prod / Sbx:** **85% / 78% / 88%.** Full versioned per-country editor.
- **Missing / limitations:** **NOT a general page/website CMS** — fixed 3-screen schema only; 7 countries listed
  (`JO` declared in the type union but absent from the list).
- **Ship today?** **YES** for the 3 auth/onboarding screens. A real website CMS does **not** exist.

### 2.14 Provisioning Engine
- **Purpose:** Orchestrator-only tenant provisioning (idempotent/resumable/retryable/rollback/verify).
- **Files:** `services/provisioning.service.ts` (119), admin `ProvisioningConsole.tsx` (97). **Store:**
  `haat_sb_provision_runs`; audit `operation_events`. Dev hook `window.__prov`.
- **APIs:** steps, listRuns, getRun, provision, retry, rollback, verify — **8 real steps** (tenant→theme→brand→
  subscription→roles→integrations→cms→activate), each with an idempotency guard delegating to a real service.
- **Completion / Prod / Sbx:** **90% / 60% / 90%.** Genuine state machine; retry resumes; verify re-reads.
- **Missing / limitations:** rollback is coarse (deletes the whole tenant); run store localStorage-only.
- **Ship today?** **YES (demo).** Live depends on the underlying services being live-wired.

### 2.15 Template Marketplace
- **Purpose:** Declarative business manifests (verticals) → generic `ProvisionSpec`.
- **Files:** `services/templates.service.ts` (112), admin `TemplateMarketplace.tsx` (86). **Store:**
  `haat_crud_templates`. Dev hook `window.__tpl`.
- **APIs:** list/get/create/update/remove/duplicate/export/import/validate/preview/toSpec/assignToTenant.
  **10 seeded manifests** (restaurant/food-delivery/courier/pharmacy/supermarket/flowers/laundry/luxury/corporate/
  minimal).
- **Completion / Prod / Sbx:** **90% / 65% / 90%.** Real catalog, version+history, cross-checks preset+plan.
- **Missing / limitations:** localStorage-only.
- **Ship today?** **YES (demo).**

### 2.16 Tenant Control Center
- **Purpose:** Per-tenant management + lifecycle inside `TenantWorkspace`.
- **Files:** `workspaces/TenantWorkspace.tsx` (373). **Store:** tenants + operation_events audit.
- **APIs (via tenant.service):** export/import/clone/backup-delete + suspend/resume/activate/archive + subscription
  + brand-assets tab, gated `<Can perm="platform.tenants.manage">`.
- **Completion / Prod / Sbx:** **88% / 58% / 88%.** Real, audited, backup-first delete.
- **Missing / limitations:** inherits the multi-tenant non-isolation limits (§2.7).
- **Ship today?** **YES (demo).**

### 2.17 Integration Center
- **Purpose:** One provider registry (providers/flags/brands/apps/environments/webhook logs).
- **Files:** `platform/platform.service.ts` (112), `platformModel.ts` (137), admin `IntegrationCenter.tsx` (158),
  `PlatformRegistry.tsx` (129). **Store:** `haat_platform_registry`, `haat_webhook_logs` (localStorage-only).
- **Catalog:** **21 providers** (3 payment, 5 messaging, 3 maps, 3 storage, 4 analytics, 3 AI) + 6 apps + 8 flags +
  4 environments.
- **Completion / Prod / Sbx:** **70% / 45% / 80%.** Real registry/flags/config; `testConnection()` is
  **credential-presence validation, not a real network ping**; no server persistence (`platform_*` tables exist,
  unused).
- **Ship today?** **YES (demo config UI).** Not a live integration control plane yet.

### 2.18 Operations Center
- **Purpose:** Dispatch, zones, vehicles, performance, payouts, live command map, KYC/finance/care hubs, SLA,
  incidents, execution console.
- **Files:** `admin/OperationsCenter.tsx` (391) + `OperationsCommandCenter` (167) + `OpsSvgMap` (178) +
  `OpsExecutionConsole` (125) + `OpsSlaMonitor` (77) + `OpsIncidentLog` (68).
- **Services:** ops/{command,dispatch,zone,vehicle,performance,payout}, ops-execution.
- **DB tables:** orders, drivers, zones, vehicles, dispatch_assignments, payout_requests, driver_performance,
  operation_events, driver_shifts.
- **Completion / Prod / Sbx:** **88% / 72% / 80%.** Auto+manual dispatch, zone/vehicle save, payout approve/reject,
  live map (Google-Maps + SVG fallback) all real.
- **Missing / limitations:** `dispatch.service` is a **no-op in sandbox** (returns empty) — the ops flows are
  live-only; `OpsIncidentLog` sandbox-only.
- **Ship today?** **YES (demo shows the boards).** Real dispatch requires the live path + PostGIS RPCs.

### 2.19 Finance
- **Purpose:** Revenue, commission, settlement engine, adjustments, compensation, refunds, accounting exports.
- **Files:** `services/finance.service.ts` (185), admin `FinanceCenter.tsx` (214).
- **DB tables + RPCs:** commissions, commission_rules, settlements, merchant_/driver_settlements, compensations,
  refunds, accounting_exports; RPCs `fin_balance`, `generate_*_settlement`, `pay_*_settlement`, etc.
- **Completion / Prod / Sbx:** **80% / 65% / 80%.** Real dual-mode; sandbox computes deterministic figures (15%
  commission / 10 captain fee) from seeded orders.
- **Missing / limitations:** live correctness depends entirely on **unseen DB RPCs** (not verifiable from client).
- **Ship today?** **YES (demo).** Live money math unproven.

### 2.20 Wallet
- **Purpose:** Balances + transactions + atomic delivery completion.
- **Files:** `services/wallet.service.ts` (70); demo wallet in `sandboxStore` (`haat_sb_wallets`); UI in Customer
  Wallet, `MerchantWalletCenter`, `DriverOpsPanel`.
- **DB tables + RPC:** wallets, wallet_transactions; RPC `complete_delivery` (atomic).
- **Completion / Prod / Sbx:** **85% / 70% / 85%.** Real; **no sandbox branch** (demo wallet lives in sandboxStore).
- **Missing / limitations:** **wallet exists in ~3 sources** (wallet.service, sandboxStore, ops/payout) — drift risk.
- **Ship today?** **YES (demo).**

### 2.21 Payments  🔴
- **Purpose:** Charge/refund + webhooks.
- **Files:** `services/payment.service.ts` (685), `payment-orchestrator.service.ts` (133),
  `checkout/CheckoutPage.tsx`; edge functions `payment-initiate/verify/refund/webhook`.
- **DB tables:** payment_transactions, payment_idempotency, payment_attempts, refunds, webhook_events.
- **Completion / Prod / Sbx:** **client 35% / real-path 70% / sandbox 100% (no gateway).**
- **KEY FINDINGS (evidence):**
  - The client `payment.service.ts` is a **685-line mock** — every adapter fabricates a `Math.random()` reference
    and returns success with the real API call commented out; keys read from `process.env.*` (empty in the browser
    bundle). It is imported by **0 UI files** → **dead scaffolding** in the money path.
  - The **only real charge** is server-side: `supabase/functions/payment-initiate` makes a genuine **Moyasar**
    `POST /v1/payments` (real secret key, hosted URL), confirmed by `payment-webhook` (HMAC-SHA256 + idempotency).
    Invoked from `CheckoutPage.tsx:368` via `paymentOrchestrator.initiate()`.
  - **Stripe / Paymob / Apple Pay / Google Pay / Mada are config + mock only** — no live integration anywhere.
  - Real charge runs only when `VITE_AUTH_MODE=supabase` **and** `MOYASAR_SECRET_KEY` is set. The shipped demo
    never touches a gateway (instant success modal).
- **Ship today?** **NO for real payments** beyond a single Moyasar gateway on the (unproven) live path. The demo
  "takes payment" only cosmetically.

### 2.22 Dispatch
- **Purpose:** Auto/manual dispatch, offers, timeout sweep, reassignment.
- **Files:** `services/ops/dispatch.service.ts` (127), surfaced in OperationsCenter/CommandCenter + DriverOpsPanel.
- **DB tables + RPCs:** dispatch_assignments, orders; RPCs `auto_dispatch_order`, `manual_dispatch_order`,
  `respond_dispatch`, `reassign_order`, `expire_dispatch_offers`, `find_nearest_drivers`, `finalize_driver_delivery`.
- **Completion / Prod / Sbx:** **80% / 70% / 30%.** Real Supabase; **all methods no-op in sandbox** (`return
  {data:[]}`).
- **Ship today?** **NO** as a working demo (dispatch is invisible in sandbox); real path unproven.

### 2.23 Fleet
- **Purpose:** Drivers, vehicles, shifts, performance, GPS.
- **Files:** `ops/{vehicle,shift,performance}.service`, `driver.service`, `tracking.service`; admin
  Vehicles/Performance panels + `VehicleWorkspace`/`DriverWorkspace`.
- **DB tables:** vehicles, drivers, driver_shifts, shift_breaks, driver_performance, driver_locations,
  driver_earnings.
- **Completion / Prod / Sbx:** **80% / 70% / 65%.** Shift has a sandbox branch; vehicle/performance/tracking are
  Supabase-only (no-op in sandbox); driver flow real.
- **Ship today?** **YES (partial demo)** for shift/driver; performance/tracking live-only.

### 2.24 Orders
- **Purpose:** Order lifecycle across all surfaces.
- **Files:** `services/order.service.ts` (190); demo lifecycle in `sandboxStore.ts` (379).
- **DB tables:** orders, order_items, order_status_history, merchant_branches.
- **Completion / Prod / Sbx:** **85% / 75% / 90%.** Real create/status/cancel with notifications + orphan cleanup.
- **Missing / limitations:** only `cancelOrder` has a sandbox branch — in the demo, **order create/update run
  through `sandboxStore`, not `order.service`** (which no-ops in sandbox). Order-status label/colour maps are
  redeclared per surface (duplication).
- **Ship today?** **YES (demo via sandboxStore).**

### 2.25 Notifications
- **Purpose:** In-app notifications + broadcast + push tokens + per-user realtime.
- **Files:** `services/notification.service.ts` (99), admin `NotificationCenter.tsx` (168); demo notifs in
  `sandboxStore` (`haat_sb_notifs`).
- **DB tables + RPC:** notifications, push_tokens; RPC `broadcast_notification`.
- **Completion / Prod / Sbx:** **80% / 65% / 82%.** Real Supabase; only `broadcast` has a sandbox short-circuit.
- **Missing / limitations:** **no real push/SMS delivery** — push tokens are stored but delivery needs an unwired
  provider (GrowthCenter explicitly notes this).
- **Ship today?** **YES (in-app demo).** No real outbound push/SMS.

### 2.26 Analytics
- **Purpose:** Platform/merchant/driver aggregates.
- **Files:** `services/analytics.service.ts` (53); duplicated aggregates in `sandboxStore.getPlatformAnalytics`.
- **Completion / Prod / Sbx:** **80% / 65% / 75%.** Real Supabase (no sandbox branch); demo served by sandboxStore.
- **Missing / limitations:** admin dashboard KPIs partly synthetic (§2.1); duplicated Supabase vs localStorage impls.
- **Ship today?** **YES (demo).**

### 2.27 Loyalty
- **Purpose:** Points balance/history/award/redeem + tiers/rewards.
- **Files:** `services/loyalty.service.ts` (38) + `growthb.service` loyalty + `growth.service` tiers + sandboxStore
  points. **DB tables:** loyalty_transactions/tiers/rules/rewards.
- **Completion / Prod / Sbx:** **75% / 60% / 80%.** Real RPCs.
- **Missing / limitations:** **implemented 3× with overlapping RPCs** (see §4).
- **Ship today?** **YES (demo).**

### 2.28 Campaigns
- **Purpose:** Marketing campaigns (banners/sponsored/seasonal) + tracking/analytics.
- **Files:** `services/campaign.service.ts` (99), admin `CampaignCenter.tsx` (113) + `GrowthCenter`/`GrowthCenterB`.
  **DB tables:** campaigns, campaign_events. **Store:** `haat_sb_campaigns`.
- **Completion / Prod / Sbx:** **85% / 70% / 85%.** Real dual-mode, schedule-aware status + CTR/conversion.
- **Missing / limitations:** overlaps GrowthCenter/GrowthCenterB (§4).
- **Ship today?** **YES (demo).**

### 2.29 AI  ❌
- **Purpose:** — (none in runtime).
- **Evidence:** `@google/genai@2.4.0` is a **dependency but unused** — `grep` for genai/GoogleGenAI/GenerativeModel/
  generateContent across `src/` = **0 hits**. No `openai`/`anthropic` packages. The only match is a **provider-
  catalog entry** (`gemini`/`openai`/`anthropic`) in `platformModel.ts` (config metadata). No `GEMINI_API_KEY` use.
- **Completion / Prod / Sbx:** **~2% / 0% / 0%.**
- **Ship today?** **N/A — there is no AI feature.**

### 2.30 Monitoring
- **Purpose:** Crash/event reporting seam.
- **Files:** `services/monitoring.service.ts` (53). Reads `VITE_SENTRY_DSN`/`VITE_ANALYTICS_URL`; POSTs via
  `sendBeacon`/`fetch` when set; console-only in dev.
- **Completion / Prod / Sbx:** **70% / 55% / 60%.** Real seam, **no DSN wired** (vendor-agnostic; operator injects).
- **Ship today?** **YES as a seam.** No observability until a DSN is set.

### 2.31 Release
- **Purpose:** App-version gate / maintenance.
- **Files:** `services/release.service.ts` (47). Reads `public.settings` (min_app_version/maintenance/store_urls);
  permissive `DEFAULT_GATE` in sandbox/error.
- **Completion / Prod / Sbx:** **75% / 65% / 60%.** Real gate; no rows ship by default.
- **Ship today?** **YES.**

### 2.32 Storage
- **Purpose:** Supabase Storage wrapper (product/merchant/banner/offer/avatar buckets).
- **Files:** `services/storage.service.ts` (152). Deterministic public URLs, folder-based RLS paths.
- **Completion / Prod / Sbx:** **85% / 75% / 40%.** Real; **no sandbox path** (always calls Supabase → no-op in
  demo, so image upload doesn't work in sandbox except the assets data-URL path).
- **Ship today?** **YES (live).** Overlaps `assets.service` (§4).

### 2.33 Database  &  2.34 Supabase
- **Purpose:** Persistence for live mode.
- **Evidence:** **48 migrations / ~110 tables**, all `IF NOT EXISTS`, most `public.`-qualified. Dedicated
  `security_hardening` (×2), `rls_recovery`, `admin_rls_policies`, RLS + scale/index migrations. **4 edge
  functions** (payment initiate/verify/refund/webhook) with service-role vs RLS-scoped clients, HMAC + idempotency.
  Seeds: `seed.sql` (idempotent demo content), `seed_demo_accounts.sql` (**requires a manual auth.users creation
  step** + UUID substitution).
- **Completion / Prod / Sbx:** **schema 85% / prod 70% / sandbox n/a (mirrored in localStorage).**
- **Missing / limitations:** two migration sets (`supabase/migrations` vs legacy `src/db/migrations` 0000–0007);
  client services reference **78 tables + many RPCs** whose runtime correctness is **not exercised** by the
  sandbox-only E2E; live provisioning needs manual seeding.
- **Ship today?** Schema is **mature and launch-grade**; the live path is **unproven end-to-end** from the app.

### 2.35 Mobile readiness
- **Purpose:** Native packaging + PWA.
- **Evidence:** **Capacitor 8.4.1** (core/cli/android/ios). `capacitor.config.ts` (appId `com.haatnow.app`,
  HTTPS-only, Splash + Push plugins). **Real generated `android/` and `ios/` native projects** (Gradle,
  Xcodeproj, plugins). Icon/store pipelines (`gen-icons`, `gen-android-icons`, `gen-store-assets`). **Complete
  PWA**: `manifest.webmanifest` (standalone, RTL, 192/512+maskable, shortcuts) + `sw.js` (network-first shell,
  never intercepts `/rest`/`/auth`/`/realtime`/`/functions`), registered in prod.
- **Completion / Prod / Sbx:** **72% / 72% / n/a.**
- **Missing / limitations:** signing keys (`keystore.properties.sample` only) + store metadata are operator steps;
  push delivery not wired.
- **Ship today?** **YES to build/install**; store submission needs signing + metadata.

### 2.36 Website readiness  ❌
- **Purpose:** — (none).
- **Evidence:** **No marketing/public website or landing page** in code. "Website" appears only as a **tenant/CMS
  config placeholder** (`TenantWorkspace default_website`, provisioning `cms` step, ThemePresets copy). `public/`
  has `robots.txt`/`sitemap.xml` for the SPA.
- **Completion / Prod / Sbx:** **~5% / 5% / n/a.**
- **Ship today?** **NO — there is no website to ship.**

---

## 3. Feature matrix

Columns: **Exists** (code present) · **Prod-Ready** (works on a real live backend today) · **Needs polish** ·
**Missing** · **Planned-only** (referenced in code as a placeholder, not built).

| Feature | Exists | Prod-Ready | Needs polish | Missing | Planned-only |
|---|:--:|:--:|:--:|:--:|:--:|
| Phone-OTP auth (dual mode) | ✅ | ✅ | | | |
| Customer browse/cart/checkout | ✅ | ◑ | ✅ | | |
| Order lifecycle + tracking | ✅ | ◑ | ✅ | | |
| Merchant order/catalog/inventory | ✅ | ◑ | ✅ | | |
| Kitchen display | ✅ | ✅ | | | |
| Driver job lifecycle + GPS | ✅ | ◑ | ✅ | | |
| Driver earnings/performance | ✅ | | | ✅ (real data — currently hash-fabricated) | |
| Admin ops/finance/KYC/care | ✅ | ✅ | ✅ | | |
| RBAC enforcement | ✅ (client) | | | ✅ (server-side) | |
| Multi-tenant isolation | ◑ | | | ✅ (real isolation) | |
| White-label theming | ✅ | ◑ | ✅ | | |
| Theme engine + Design Center | ✅ | ✅ | | | |
| Theme presets | ✅ | ◑ (local only) | | | |
| Brand assets / media | ✅ | ◑ | ✅ (registerUrl bug) | | |
| CMS (splash/login/onboarding) | ✅ | ✅ | | | |
| Website CMS / marketing site | | | | ✅ | ✅ |
| Provisioning engine | ✅ | ◑ (local) | | | |
| Template marketplace | ✅ | ◑ (local) | | | |
| Tenant control center | ✅ | ◑ | | | |
| Integration center | ✅ | | ✅ (no live handshake) | | |
| Dispatch (auto/manual) | ✅ | ◑ | | | (no-op in sandbox) |
| Fleet/zones (PostGIS) | ✅ | ◑ | | | |
| Finance/settlement engine | ✅ | ◑ (unseen RPCs) | | | |
| Wallet | ✅ | ✅ | ✅ | | |
| Payments — Moyasar (edge) | ✅ | ◑ (unproven) | ✅ | | |
| Payments — Stripe/Paymob/ApplePay/GooglePay/Mada | | | | ✅ | ✅ (mock adapters) |
| Notifications (in-app) | ✅ | ✅ | | | |
| Push/SMS delivery | | | | ✅ | ✅ (tokens stored, no sender) |
| Analytics | ✅ | ◑ | ✅ (synthetic dash) | | |
| Loyalty / Campaigns / Growth | ✅ | ◑ | ✅ (duplicated) | | |
| AI | | | | ✅ | ✅ (unused dep + catalog) |
| Monitoring/observability | ✅ (seam) | | ✅ (no DSN) | | |
| Mobile (Capacitor + PWA) | ✅ | ✅ | ✅ (signing/store) | | |

`◑` = partial / conditional (works only on the unproven live path, or local-only persistence).

---

## 4. Duplication analysis (real, observed in code)

1. **Coupons — 5 code paths against the same `coupons` table:** `coupon.service` (list/create/update/deactivate/
   validate), `growthb.service` (list/create/toggle/update/delete/redeemAdvanced), `sandboxStore` (getCoupons/
   create/validate, localStorage), plus `checkoutService.verifyCoupon`/`redeemCoupon` (RPC `redeem_coupon`) and
   `cartService.applyCoupon`. Overlapping create/validate logic, different RPCs.
2. **Loyalty — 3 implementations with overlapping RPCs:** `loyalty.service` and `growthb.service` **both call
   `loyalty_balance`**; `growth.service` and `growthb.service` **both call `resolve_loyalty_tier`**; plus
   `sandboxStore` points. Same concern, three services.
3. **Growth vs GrowthB — two parallel growth services** (and two admin consoles behind a sub-toggle in
   `OperationsCenter`): overlapping tiers (`loyalty_tiers`), segments, and campaigns (`message_campaigns`).
   GrowthCenterB's campaigns panel is read-only and literally says "Created from the Growth Center."
4. **Payment mock vs real:** `payment.service.ts` (685-line mock, unused by UI) vs `payment-orchestrator.initiate`
   (real edge function). Orchestrator also exposes a mock `pay()` path alongside the real `initiate()`.
5. **Wallet — 3 balance sources:** `wallet.service` (`wallets` table), `sandboxStore` (`haat_sb_wallets`),
   `ops/payout.service` walletSummary.
6. **Analytics — duplicated aggregates:** `analytics.service` (Supabase) reimplements the same shapes as
   `sandboxStore.getPlatformAnalytics/getMerchantAnalytics` (localStorage).
7. **Wallet UI implemented 4× across surfaces:** customer `WalletScreen`, `MerchantWalletCenter` (real) +
   MerchantApp "Earnings" tab (cosmetic), `DriverOpsPanel` wallet (real) + DriverApp "Earnings" tab (fabricated).
8. **Order-status label/colour maps redeclared per surface:** MerchantApp, OrdersList, KitchenQueue,
   MerchantReports, DriverApp — no shared status registry.
9. **Four hand-rolled map/route renderers:** OrdersList canvas map **and** an embedded Google-Maps
   `OrderTrackingMap` in the same screen, DriverApp SVG mini-map, CheckoutPage SVG route.
10. **`CountryBranding ⊂ ExperienceBuilder`** — CountryBranding is a splash-only subset of the Experience Builder;
    both edit `experience.service`.
11. **Storage vs Assets** — `storage.service` and `assets.service` both wrap `supabase.storage.upload`/
    `getPublicUrl`/remove (different buckets/purposes, but identical mechanics).
12. **Per-engine localStorage `read()/write()` JSON-guard boilerplate** re-implemented ~6× (themePresets,
    templates, platform, provisioning, experience, assets) instead of a shared util.
13. **Feature-flag list duplicated:** `templates.service.feat()` and `subscription.service.planFeatures()` each
    enumerate the same hardcoded 8-feature list independently.
14. **Hardcoded ₪10 delivery fee** repeated across MerchantApp (5 sites) and finance sandbox math, not a shared
    constant.
15. **Two migration sets:** `supabase/migrations` (authoritative, 48) vs legacy `src/db/migrations` (0000–0007).

---

## 5. Legacy / dead-code analysis

**Confirmed never-imported source files (0 references — safe to delete after review):**
- `src/assets/CategoryIllustrations.tsx`
- `src/components/layout/AppPageLayout.tsx`
- `src/components/location/LocationCard.tsx`
- `src/components/location/LocationPicker.tsx`  *(note: Google-Maps picker — verify no dynamic use before deleting)*
- `src/utils/seedHelper.ts`
- `src/components/ui/index.ts` — **dead barrel** (consumers import files directly, not the barrel).

**Dead code inside live files:**
- `src/services/payment.service.ts` (**685 LOC**) — imported by 0 UI files; only reachable via the orchestrator's
  mock `pay()` path, which `CheckoutPage` does not use. Effectively dead scaffolding in the money path.
- `OrdersList.tsx:582–619` — legacy single-rating card behind `{false && …}` (comment: "superseded by
  MultiTargetReview"); `OrdersList.tsx:69 STATUS_STEPS` constant unused; `CheckoutPage.tsx SummaryRow` declared,
  never called.
- `assetsService.registerUrl` — unused **and** its live branch never persists (data-loss).
- `subscriptionService.cancel`, `platformService.reset`, `experienceTypes.mergeExperience`, `JO` CountryCode —
  exported/declared, no consumer.

**Needs migration / reconciliation:**
- Legacy `src/db/migrations/0000–0007` vs `supabase/migrations` (single source of truth needed).
- `@google/genai` dependency — installed, unused (remove or implement).

**Not dead (verified reachable):** every file under `src/features/admin/**`, and all app-surface sub-components
(MarketplaceHero, KitchenQueue, StoreManagement, MerchantWalletCenter, MerchantReports, DriverOpsPanel,
OrderTrackingMap, MultiTargetReview) have confirmed importers.

---

## 6. Project map (actual)

```
haat-now-phase2/
├── src/                                   161 files · 27,178 LOC
│   ├── main.tsx                           boot + provider tree (AppConfig→Design→Experience→App)
│   ├── App.tsx (889)                      role router (customer/driver/merchant/admin) + customer shell
│   ├── index.css (1571)                   Tailwind v4 @theme + design-token CSS vars
│   │
│   ├── features/
│   │   ├── admin/  (31 + workspaces, 5296 LOC)   AdminDashboard, AdminSidebar, OperationsCenter,
│   │   │   │                                     OperationsCommandCenter, Ops{SvgMap,Execution,Sla,Incident},
│   │   │   │                                     FinanceCenter, KycCenter, CustomerCareCenter, GrowthCenter,
│   │   │   │                                     GrowthCenterB, CampaignCenter, NotificationCenter, RbacCenter,
│   │   │   │                                     IntegrationCenter, PlatformRegistry, SystemLogs, DesignCenter,
│   │   │   │                                     ThemePresetsPanel, ExperienceBuilder, CountryBranding,
│   │   │   │                                     AssetsManager, BrandAssetsPanel, ProvisioningConsole,
│   │   │   │                                     TemplateMarketplace, TenantOnboardingWizard, ZoneCoverageEditor,
│   │   │   │                                     GlobalSearch, AdminDashboardHome
│   │   │   └── workspaces/  Tenant, Driver, Order, Customer, Merchant, Vehicle, Branch + shell
│   │   ├── auth/ (LoginScreen, types)      home/ (HomeScreen, MarketplaceHero)   discover/
│   │   ├── restaurant/  checkout/  orders/ (OrdersList, OrderTrackingMap, MultiTargetReview)
│   │   ├── wallet/  profile/
│   │   ├── merchant/ (MerchantApp, KitchenQueue, StoreManagement, MerchantWalletCenter, MerchantReports)
│   │   └── driver/  (DriverApp, DriverOpsPanel)
│   │
│   ├── services/  (42 files, 5630 LOC)     auth, account, admin, admin-crud, analytics, cart, checkout,
│   │   │                                   coupon, country-detection, customer, cx, driver, finance, growth,
│   │   │                                   growthb, inventory, location, loyalty, merchant, merchant-settings,
│   │   │                                   monitoring, notification, onboarding, order, payment,
│   │   │                                   payment-orchestrator, product, rbac, release, sandboxStore, demoSeed,
│   │   │                                   storage, subscription, templates, tenant, themePresets, tracking,
│   │   │                                   wallet, types
│   │   └── ops/ (7)  command, dispatch, payout, performance, shift, vehicle, zone, ops-execution
│   │
│   ├── platform/   platform.service, platformModel        (Integration Center registry, LOCAL)
│   ├── experience/ experience.service, experienceTypes, assets.service, ExperienceContext, blocks/  (CMS)
│   ├── design/     designSystem, DesignContext             (theme engine)
│   ├── contexts/   AppConfigContext                        (lang/dir/i18n)
│   ├── hooks/      useRbac (+ <Can>)
│   ├── components/ (27) ui/*, admin/{CrudManager,AdminDataTable,EnterpriseUI}, brand/BrandLogo,
│   │               location/{DistanceBadge,EtaBadge}, splash/, onboarding/, AppGate, ErrorBoundary
│   ├── config/     countries, version      lib/ supabase (mode gate)    i18n/    utils/    assets/
│   └── db/migrations/  (legacy 0000–0007 — superseded)
│
├── supabase/
│   ├── migrations/  48 SQL files · ~110 tables (RLS/hardening/scale migrations included)
│   ├── functions/   payment-initiate, payment-verify, payment-refund, payment-webhook, _shared, deno.json
│   └── seed.sql, seed_demo_accounts.sql
│
├── android/  ios/            real Capacitor 8 native projects
├── scripts/  gen-version.cjs, gen-icons.cjs, gen-android-icons.cjs, gen-store-assets.cjs
├── public/   manifest.webmanifest, sw.js, robots.txt, sitemap.xml
├── capacitor.config.ts   vite.config.ts   tsconfig.json   vercel.json   package.json
└── docs/     (documentation hierarchy — not a runtime source)
```

**Applications:** 4 role surfaces in one SPA (customer, merchant, driver, admin). **No separate website app.**

---

## 7. Readiness scores (0–100, evidence-based)

| Dimension | Score | Basis |
|---|:--:|---|
| **Backend (DB)** | **70** | 48 migrations / ~110 tables, RLS+hardening+scale migrations, 4 payment edge functions — mature; but gated off by default and **not exercised end-to-end** from the app; many client RPCs unseen; manual seed step. |
| **Admin Portal** | **80** | 40 reachable consoles, mostly real; weak spots = synthetic dashboard KPIs, LOCAL-only RBAC/registry/provisioning. |
| **Customer App** | **82** | Full real flows on sandbox; realtime/payment gated to live. |
| **Merchant Portal** | **80** | Real order/catalog/inventory/kitchen/wallet; cosmetic earnings tab + hardcoded fee. |
| **Captain App** | **66** | Real job lifecycle + ops panel, but flagship earnings/performance are **hash-fabricated**; withdraw is a toast. |
| **White Label** | **62** | Engines real but LOCAL-only + **no true isolation** (global stores, global theme, global usage counters). |
| **Website** | **5** | Does not exist (tenant/CMS placeholder only). |
| **Mobile** | **72** | Real Capacitor android/ios + complete PWA; needs signing + store metadata + push sender. |
| **Architecture** | **70** | Clean layering + one-engine patterns + modern stack, offset by heavy real duplication (coupons ×5, loyalty ×3, growth/growthb, payment mock) and dual sandbox/live divergence doubling surface. |
| **Documentation** | **80** | Large `docs/` hierarchy + developer platform present; but much describes gated/aspirational behaviour, not the shipped sandbox reality. |
| **Security** | **52** | Edge functions do HMAC + idempotency + RLS migrations exist (good); **but client RBAC is LOCAL-only & unenforced, acting role defaults to super_admin**, `process.env` secrets referenced in a client file, single-provider payments. |
| **Performance** | **70** | manualChunks + lazy routes + index migrations; AdminDashboard chunk ~848 KB; synthetic data avoids real load paths. |
| **Scalability** | **64** | Schema/PostGIS/settlement RPCs designed for scale; demo uses single global localStorage stores; no real tenant partitioning. |
| **Maintainability** | **66** | Modern TS + layered, but duplication + dual-path branches + dead code raise change cost. |

**Composite (unweighted mean): ~65/100.**

---

## 8. Launch readiness

**Could HAAT NOW launch today?**

- **As the deployed SANDBOX demo:** **YES.** It builds, deploys, passes 24/24 sandbox E2E, and demonstrates
  end-to-end customer/merchant/driver/admin flows on localStorage. It is an excellent, coherent product demo.
- **As a REAL live business (real users, real orders, real money, multiple tenants):** **NO.**

**Actual in-code blockers (not roadmap — each is observable in source):**

1. **The live backend path is unproven at runtime.** The app is built to sandbox; `HAAT_LIVE_BACKEND=1` is never
   exercised by the test suite. Dozens of services are Supabase-only (no sandbox branch) and depend on **unseen
   Postgres RPCs** (finance settlements, dispatch, loyalty, growth, wallet `complete_delivery`, coupon redeem,
   KYC reviews). Nothing in the repo demonstrates these run correctly against a real project.
2. **RBAC is not enforced.** `rbac.service` persists to localStorage only, guards are client-side, and the acting
   role **defaults to `super_admin`**. In live mode there is no server-side permission enforcement — a real
   security blocker for an admin control plane.
3. **Payments are effectively single-gateway and unproven.** The only real charge is a server-side **Moyasar**
   edge function (needs `MOYASAR_SECRET_KEY`, live mode). Stripe/Paymob/Apple Pay/Google Pay/Mada are **mock
   adapters**. The 685-line client `payment.service.ts` is a dead mock in the money path.
4. **No true multi-tenant isolation.** A single global `haat_crud_tenants` store, **global** theme application,
   and **platform-global** subscription usage counters. White-label cannot isolate one tenant's data/permissions
   from another's.
5. **Driver-facing business data is fabricated.** Earnings, ratings, acceptance/completion rates, rank, bonuses
   are hash-derived from the driver id — not real numbers a captain could be paid on.
6. **No real outbound notifications.** Push tokens are stored but there is **no push/SMS sender** wired
   (delivery needs an unconfigured provider).
7. **White-label / platform config does not persist server-side.** RBAC, platform registry, theme presets, and
   provisioning runs are localStorage-only despite `platform_*`/`role_permissions` tables existing.
8. **Live seeding is manual.** `seed_demo_accounts.sql` requires manually creating `auth.users` and substituting
   UUIDs — there is no automated live bootstrap.
9. **No observability by default.** Monitoring is a seam with **no DSN wired**.
10. **No automated test coverage of correctness beyond sandbox screenshots.** `lint` is `tsc --noEmit` only; the
    only tests are Puppeteer sandbox screenshots. No unit/integration/live E2E.

There is **no website** to launch, and **no AI feature** to launch (both are absent from code).

---

## 9. Top 20 implementation priorities (by real business value, from the actual code)

Ordered to unblock a *real* launch and de-risk the money/permission paths, leveraging what already exists.

1. **Prove & harden the live backend path.** Stand up a real Supabase project, flip `HAAT_LIVE_BACKEND=1`, and
   exercise every RPC the client calls (orders, checkout, wallet `complete_delivery`, finance settlements,
   dispatch, loyalty, KYC). This is the single largest unknown.
2. **Enforce RBAC server-side.** Wire `rbac.service` to `roles/permissions/role_permissions/user_roles` + RLS;
   stop defaulting the acting role to `super_admin`. Security blocker.
3. **Consolidate payments on the real edge path; delete the mock.** Make `payment-initiate/webhook` the single
   source, remove the dead 685-line `payment.service.ts`, verify Moyasar HMAC end-to-end. Add a second real
   gateway only if a market needs it.
4. **Real multi-tenant isolation.** Tenant-scope the data stores, theme application, and usage counters so
   white-label actually isolates tenants (today it's global).
5. **Replace fabricated driver KPIs with real data.** Drive DriverApp Home/Earnings from
   `performance.service`/`driver_earnings` instead of `hashNum(driverId)`.
6. **Persist platform/white-label config to Supabase.** RBAC, platform registry, theme presets, provisioning runs
   are localStorage-only; move them to the existing `platform_*` tables so config survives and is shared.
7. **De-duplicate coupons (5→1) and loyalty (3→1); merge growth/growthb.** Real drift risk across identical RPCs.
8. **Wire real outbound notifications (push/SMS).** A sender for the stored `push_tokens` (delivery is the missing
   half of the notification system).
9. **Wire admin dashboard to real data.** Remove synthetic sparklines/hardcoded System-Health/satisfaction in
   `AdminDashboardHome`.
10. **Add sandbox branches (or hide UI) for Supabase-only services** so the demo doesn't silently no-op
    (dispatch, growth, loyalty, analytics, storage, tracking) — improves both demo honesty and testability.
11. **Fix the `assets.service.registerUrl` live data-loss bug** (unused + broken); reconcile with `storage.service`.
12. **Automate live seeding/bootstrap** (replace the manual `auth.users` step in `seed_demo_accounts.sql`).
13. **Wire monitoring before live traffic** (set a Sentry DSN — the seam already exists).
14. **Connect merchant/driver "withdraw" buttons to `payout.service`** (today they only toast) or remove them.
15. **Reconcile the two migration sets** (`src/db/migrations` legacy vs `supabase/migrations`) to one source.
16. **Add a real test layer + live-mode E2E.** Currently `lint`=typecheck and tests are sandbox screenshots only.
17. **Consolidate cross-surface duplication:** one order-status registry, one shared map component, one delivery-fee
    constant (currently 4 maps, 5 status maps, hardcoded ₪10 in 5+ places).
18. **Remove confirmed dead code** (CategoryIllustrations, AppPageLayout, LocationCard/Picker, seedHelper, ui/index
    barrel, dead OrdersList/CheckoutPage fragments, unused `@google/genai` dep).
19. **Finish mobile store readiness** (real signing keys + store metadata; native shells & PWA already exist).
20. **Decide on AI and the website:** either implement the `@google/genai` dependency into a real feature or remove
    it; either build the tenant "website" CMS that the config placeholders imply or drop the placeholders.

---

## 10. Bottom line

HAAT NOW is a **large, coherent, well-architected front-end SPA (161 files, ~27k LOC) with an impressive breadth
of real, working features on a localStorage sandbox backend** — the deployed demo genuinely exercises customer,
merchant, driver, and admin journeys, a real theme/white-label engine, a provisioning/template system, and a
mature Postgres schema behind the scenes.

But **as shipped it is a demo, not a live product.** The live backend is gated off and unproven, permissions are
not enforced, payments are a single unproven gateway plus mock adapters, multi-tenancy is not isolated, and some
headline numbers (driver earnings) are fabricated. The gap between "the demo works" and "a real business can run
on it" is concentrated in the ten launch blockers in §8 and the top-20 priorities in §9 — all grounded in the
code as it exists today.

*End of report. No source files were modified; nothing was committed or deployed.*
