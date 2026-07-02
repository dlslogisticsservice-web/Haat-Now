# Enterprise Platform Inventory

Built from **direct codebase inspection** (folders, services, migrations, nav wiring), not assumption.
Legend: ✅ Complete · 🟡 Partial · 🔴 Missing · ⚠ Duplicate/Consolidation.

## Duplicate / consolidation audit (checked first, per policy)
| Suspected pair | Verdict |
|---|---|
| `OperationsCommandCenter` vs `OperationsCenter` | **NOT duplicate** — `OperationsCommandCenter` is the live-map sub-view *imported by* `OperationsCenter`. One wired module (`OperationsCenter`), composed of sub-panels. |
| `GrowthCenter` vs `GrowthCenterB` (+ `growth.service` vs `growthb.service`) | **⚠ Consolidation candidate** — both rendered as separate tabs (`growth`, `growthb`) in `OperationsCenter`. Growth A = basic; Growth B = enterprise (advanced coupons/loyalty/segments). Overlapping intent; should be merged into one Growth module with sub-tabs. **Do NOT add a third.** |
| `OpsExecutionConsole`/`OpsSlaMonitor`/`OpsIncidentLog`/`OpsSvgMap` | Distinct sub-panels of Operations — not duplicates. |
No other duplicate modules/services/pages found.

## Module inventory

### Operations  ✅ (folder `src/features/admin/`)
- Components: `OperationsCenter` (wired, tabbed) → `OperationsCommandCenter`, `OpsSvgMap`, `OpsExecutionConsole`, `OpsSlaMonitor`, `OpsIncidentLog`, `ZoneCoverageEditor`.
- Services: `command`, `dispatch`, `ops-execution`, `performance`. Tables: `orders`, `driver_locations`, `order_status_history`. Route: `ops:*` nav keys.
- Completion **~92%**. Missing: cross-zone overlap analytics, real map tiles (external key). Action: **extend** OCC.

### Fleet · Drivers · Vehicles  🟡
- Components: CRUD via `CrudManager` (`drivers`,`vehicles`) + `DriverApp` (captain). Services: `driver`,`vehicle`,`shift`,`performance`. Tables: `drivers`,`driver_locations`,`driver_earnings` (⚠ **no `vehicles` table in migrations** — sandbox-only). Route: `mgmt:drivers/vehicles`, `ops:performance/vehicles`.
- Completion **~85%**. Missing: `vehicles` DB schema, shift DB table. Action: **extend** (add migration when backend unfreezes).

### Dispatch  ✅
- In `OperationsCenter` + `dispatch.service` (auto/manual/reassign/timeout RPCs, sandbox-gated). Tables: `dispatch_assignments` (sandbox). Completion **~90%**. Action: extend.

### Maps  ✅
- `OpsSvgMap` (no-key SVG sim) + Google Maps path when keyed; captain `DriverMiniMap`. Completion **~90%** (real tiles need external key). Action: extend.

### Orders  ✅
- `OrdersList` (customer) + admin `orders` CRUD + lifecycle. Services: `order`,`tracking`,`cx`. Tables: `orders`,`order_items`,`order_status_history`. Completion **~95%**. Action: extend (POD photo).

### Customers  ✅
- CRUD + customer app (`home`,`discover`,`restaurant`,`checkout`,`profile`,`wallet`,`orders`). Services: `customer`,`account`,`cart`,`checkout`. Tables: `customers`,`addresses`,`favorites`,`customer_carts`,`cart_items`. Completion **~95%**.

### Merchants · Branches  ✅
- `MerchantApp`,`KitchenQueue`,`StoreManagement`,`MerchantWalletCenter`,`MerchantReports` + CRUD. Services: `merchant`,`merchant-settings`,`inventory`,`product`. Tables: `merchants`,`merchant_branches`,`products`,`product_variants`,`product_images`,`categories`. Completion **~92%**.

### Finance  ✅
- `FinanceCenter` (revenue/settlements/compensation/refunds/exports) + payouts + wallets. Services: `finance`,`payout`,`wallet`,`payment`,`payment-orchestrator`. Tables: `wallets`,`wallet_transactions`,`driver_earnings`,`payment_transactions`,`payment_methods`. Completion **~90%** (sandbox figures wired this phase).

### Growth  ⚠🟡
- `GrowthCenter` + `GrowthCenterB` (two tabs). Services: `growth`,`growthb`,`coupon`,`loyalty`. Tables: `coupons`,`coupon_usages`,`memberships`,`offers`,`banners`. Completion **~70%**. Action: **consolidate A/B into one Growth module** (sub-tabs), then extend.

### Coupons  ✅ (apply) / 🟡 (admin)
- Customer cart apply ✅; admin manage via Growth (`growthb.listCoupons` sandbox). Tables: `coupons`,`coupon_usages`. Action: extend within Growth.

### CRM · Customer Care  🟡
- `CustomerCareCenter`. Service: `cx`. Tables: `support_tickets`,`support_messages`,`reviews`. Completion **~70%** (read-views sandbox; mutations don't persist yet). Action: extend (persist replies/assign/close).

### Campaigns  🟡
- `CampaignCenter`. Service: `campaign` (6 sandbox gates). Completion **~60%** (no `campaigns` table). Action: extend.

### Compliance · KYC  🟡
- `KycCenter`. Service: `onboarding` (kycQueue/complianceStats sandbox). Tables: `kyc_reviews`/`account_status` (sandbox). Completion **~70%**. Action: extend (persist approve/reject/suspend/ban).

### System  ✅
- `SystemLogs`. Tables: `audit_logs`,`app_config`,`settings`,`roles`,`permissions`,`role_permissions`,`user_roles`,`admin_users`. Completion **~90%**.

### Notifications  ✅
- `NotificationCenter` + per-status sandbox notifications. Service: `notification`. Tables: `notifications`,`push_tokens`. Completion **~85%**.

### Analytics  🟡
- `AdminDashboardHome` + `MerchantReports` + growth analytics + `analytics.service`. Completion **~70%** (sandbox-computed; no predictive/AI). Action: extend.

### White Label  🟡 (blueprint: White-Label Engine — partial exists)
- `PlatformRegistry` + tenants CRUD. Service: `tenant`. Tables: `subscriptions`,`memberships` (no `tenants` migration — sandbox). Completion **~55%**. Action: **extend** (do not rebuild).

### Branding  🟡 (blueprint: Branding Engine — partial exists)
- `CountryBranding` + `AssetsManager`. Services: `assets`,`experience`. Tables: `app_config`,`banners`. Completion **~50%**. Action: **extend**.

### Design · Theme Engine  🟡 (blueprint: Theme Engine — partial exists)
- `DesignCenter` (wired). Completion **~45%** (design tokens surface; full token-cascade engine = blueprint). Action: **extend** DesignCenter into the token source-of-truth.

### CMS · Experience  🟡 (blueprint: CMS — partial exists)
- `ExperienceBuilder`,`ExperienceScreens`,`ExperienceContext`,`experience.service`,`MediaRenderer`,`MediaPicker`,`experienceTypes`,`LottieBlock`,`VideoBackgroundBlock`. **⚠ no committed migration for `screen_experiences`** (localStorage/late-migration). Completion **~55%**. Action: **extend** (this IS the CMS engine — never duplicate it).

### Settings  🟡
- `config` nav + `merchant-settings` + `app_config`/`settings` tables. Completion **~60%**. Action: extend.

### AI  🔴 Missing — no module/service. Action: greenfield (later; out of current scope).

### Website · Landing Builder · Splash · SEO  🔴 (blueprint future engines)
- Website/Landing/Splash: **not present**. SEO: only `index.html` meta/OG + `robots.txt`/`sitemap.xml` (added in RC). Splash: PWA manifest only.
- Action per directive: **do NOT implement yet**; when built they must **consume the existing** Theme/Branding/Experience layer, not duplicate it.

## Blueprint-engine coverage (what already exists to EXTEND)
| Blueprint engine | Existing partial implementation | Action |
|---|---|---|
| Theme Engine | `DesignCenter` | extend → token source of truth |
| Branding Engine | `CountryBranding` + `AssetsManager` + `assets.service` | extend |
| White-Label Engine | `PlatformRegistry` + `tenant.service` | extend |
| CMS | `ExperienceBuilder` + `experience.service` + `ExperienceScreens` | extend |
| Website / Landing / Splash / SEO | minimal (manifest, meta tags) | build later, consuming the above |
| Analytics Engine | `analytics.service` + dashboards | extend |

**No second implementation of any of the above may be created.**
