# Enterprise Due-Diligence Report
**HAAT NOW — CTO-level Production-Readiness Audit**
Date: 2026-07-04 · Branch: `feat/website-platform-architecture` · Scope: entire codebase (`src/` 169 files ~28.6k LOC, `supabase/` 48 migrations + 4 edge functions, config, CI). **Read-only** — no code was modified, created, or deleted (audit policy). Method: static analysis (import graph, migration inspection, bundle inspection) across six parallel evidence passes; every finding cites `file:line`. **Prior reports were not relied upon** — all findings are re-derived from the implementation.

This is the master report. Companion files in `docs/due-diligence/`:
- `DUPLICATION_ANALYSIS_REPORT.md` (Part 2)
- `DEAD_CODE_REPORT.md` (Part 3)
- `ARCHITECTURE_AUDIT_REPORT.md` (Part 4)
- `PRODUCTION_READINESS_REPORT.md` (Parts 9 & 10 — security + readiness)
- `LAUNCH_BLOCKERS_REPORT.md` (Part 13)
- `EXECUTIVE_SUMMARY.md` (board-level digest)

This file carries **Part 1 (Feature Inventory), Part 5 (Database), Parts 6-7 (White Label & Website summary), Part 8 (Performance), Part 11 (Code Quality), Part 12 (Scores), Part 14 (Cleanup Plan).**

---

## Verification method & confidence
- **Static, evidence-based.** File/line citations throughout. Import-graph proofs for wiring, duplication, and dead code. Migrations read directly (the consolidated `supabase/.temp/schema_dump.sql` is **0 bytes**, so schema was reconstructed from the 48 migration files — live DB state is **not** verifiable from files).
- **Runtime status** is asserted from static wiring + the project's own gate (build ✓; prior E2E harness 24/24). No live runtime probe was run in this audit (read-only scope); items needing a live check (final RLS/index state) are marked accordingly.
- **Honesty on limits:** where something cannot be proven from the codebase, it is stated explicitly.

---

# PART 1 — Feature Inventory

Legend — **Status:** Complete / Partial / Experimental / Duplicate / Deprecated. **Readiness:** `Demo` = works in shipped sandbox; `Live-gated` = code present, needs live backend + config; `Missing` = not implemented.

## 1.1 Role applications & runtime shells

| Module | Status | Location | Entry point | Key services | Runtime | Readiness |
|---|---|---|---|---|---|---|
| **Customer App** | Complete | `features/{home,restaurant,checkout,orders,wallet,profile,discover}` | `App.tsx:317` (role `customer`); `HomeScreen` eager, rest `React.lazy` `App.tsx:12-17` | cart, order, product, customer, coupon, wallet, location, checkout | Wired ✓ | Demo / Live-gated |
| **Merchant Portal** | Complete | `features/merchant/*` (`MerchantApp` 1220 LOC + StoreManagement/KitchenQueue/MerchantReports) | `App.tsx:632` (role `merchant`), lazy `:20` | merchant, merchant-settings, inventory, product, order, notification | Wired ✓ | Demo / Live-gated |
| **Captain / Driver App** | Complete | `features/driver/*` (`DriverApp` 751 + DriverOpsPanel + OnboardingForm) | `App.tsx:633` (role `driver`), lazy `:21` | driver, ops/dispatch, ops/shift, ops/payout, tracking | Wired ✓ | Demo / Live-gated |
| **Admin Dashboard** | Complete | `features/admin/*` (40 files) | `App.tsx:634` (role `admin`), lazy `:22` | ~all services | Wired ✓ | Demo / Live-gated |
| **Website Runtime (public site)** | Complete | `features/website/{runtime,PublicSiteApp,blocks}` | `main.tsx:18,56` via `resolvePublicRequest` | website, tenant, assets | Wired ✓ | Demo (localStorage persistence) |

## 1.2 Website / CMS subsystem

| Module | Status | Location | Notes |
|---|---|---|---|
| **Website Builder (Experience Builder)** | Complete | `features/admin/WebsiteCenter.tsx` | 12 block types, drag/drop, enable/dup/delete, device preview, templates, import/export. Renders via public `BlockRenderer`. |
| **Website Center (admin console)** | Complete | `WebsiteCenter.tsx:48-266` | 8 tabs: settings/nav/footer/pages/blog/seo/domain/history + preview/publish |
| **CMS** | Complete | `services/website.service.ts:42-60` | pages/nav/footer/blog/legal; CRUD + default-site seeding |
| **SEO** | Complete | `runtime.ts:80-139` | meta/canonical/OG/Twitter/robots/JSON-LD + per-tenant sitemap/robots (JS-generated; edge route not in repo) |
| **Publish / Preview / History / Rollback / Versions** | Complete | `website.service.ts:243-268` | draft→publish snapshot, `haat:website` live event, rollback, version list (cap 20) |
| **Custom Domains / SSL** | Partial | `website.service.ts:194-201`; `WebsiteCenter.tsx:236-247` | domain **resolution** real; `sslStatus` is a manual label — real DNS/TLS is external infra (Vercel), not in code |

## 1.3 Design / branding / white-label

| Module | Status | Location | Notes |
|---|---|---|---|
| **Theme Engine** | Complete | `design/designSystem.ts` (`applyDesign`), `design/DesignContext.tsx` | writes brand to `--color-primary-fixed`/`-container` (not `--color-primary`, pinned white). Correct token architecture. |
| **Design Center** | Complete | `features/admin/DesignCenter.tsx` (hub → ExperienceBuilder, PlatformRegistry, AssetsManager, ThemePresetsPanel, CountryBranding) | global publish across surfaces |
| **Brand Assets** | Complete (slots partial) | `experience/assets.service.ts` (`BRAND_SLOTS`), `features/admin/BrandAssetsPanel.tsx` | `invoice_logo_url`/`email_header_url` slots have **no consumer** (no invoice/email) |
| **Theme Presets** | Complete | `services/themePresets.service.ts`, `ThemePresetsPanel.tsx` | preset catalogue; publishes globally |
| **White Label (in-product)** | **Partial** | `tenant.service.ts:20-36,64` | true per-tenant brand only on the **website**; customer/merchant/driver/admin render a single global brand (no login-time `applyTheme`) |
| **Experience Builder (in-app screens)** | Complete | `features/admin/ExperienceBuilder.tsx`, `experience/*` | splash/onboarding/login screen content; **name collides** with the website "Experience Builder" |

## 1.4 Tenancy, provisioning, platform

| Module | Status | Location | Notes |
|---|---|---|---|
| **Provisioning** | Complete | `services/provisioning.service.ts` (orchestrator), `ProvisioningConsole.tsx`, `TenantOnboardingWizard.tsx` | delegates to tenant/subscription/rbac; clean layering |
| **Tenant Service** | Complete | `services/tenant.service.ts` | tenant store/lifecycle + per-tenant theme |
| **Subscription** | Complete | `services/subscription.service.ts` | plan/feature gating |
| **Platform Registry** | Complete | `services/platform.service.ts`, `platform/{moduleRegistry,platformModel}.ts`, `PlatformModuleRegistry.tsx` + `PlatformRegistry.tsx` | runtime module catalog; **two registry consoles** in different hubs (see Duplication D8) |
| **Templates / Marketplace** | Complete | `services/templates.service.ts`, `TemplateMarketplace.tsx` | tenant template catalogue |

## 1.5 Commerce, delivery, finance

| Module | Status | Location | Notes |
|---|---|---|---|
| **Orders** | Complete | `features/orders/*`, `services/order.service.ts` | list/track/review; DB `orders` + history |
| **Dispatch** | Complete | `services/ops/dispatch.service.ts`, `OperationsCommandCenter.tsx` | assignment engine |
| **Fleet** | **Partial (schema hazard)** | `services/ops/{vehicle,shift}.service.ts`, workspaces | backed by **duplicate/conflicting** `vehicles`/`driver_shifts` tables (Part 5 §7) |
| **Payments** | Complete (live) | `supabase/functions/payment-*`, `services/payment-orchestrator.service.ts`, `checkout.service.ts` | **real Moyasar**; HMAC webhook; live-gated |
| **Wallet** | Complete | `features/wallet/*`, `services/wallet.service.ts` | atomic RPC (`…000003`) |
| **Finance** | Complete | `services/finance.service.ts`, `FinanceCenter.tsx` | ledger/commissions/settlements (RLS coverage to verify live) |
| **Coupons / Loyalty** | Complete | `services/{coupon,loyalty}.service.ts` | redemption lifecycle |
| **Inventory** | Complete | `services/inventory.service.ts`, StoreManagement | stock movements |

## 1.6 Platform services & cross-cutting

| Module | Status | Location | Notes |
|---|---|---|---|
| **Authentication** | Complete | `services/auth.service.ts`, `lib/supabase.ts`, `features/auth/LoginScreen.tsx` | dual-mode (sandbox OTP `123456` / live Supabase OTP) |
| **RBAC** | Complete (client) | `services/rbac.service.ts`, `hooks/useRbac.tsx` | fine-grained catalogue enforced **client-side**; server = coarse RLS |
| **Notifications** | Partial | `services/notification.service.ts`, `NotificationCenter.tsx` | **in-app only**; no push/email delivery; unbranded |
| **Analytics** | Partial | `services/analytics.service.ts`, `AdminDashboardHome.tsx` (recharts) | DB aggregates; telemetry env-gated |
| **Monitoring / Logging** | Partial (seam) | `services/monitoring.service.ts` | Sentry DSN seam; console fallback |
| **Integrations** | Partial | `services/*`, `IntegrationCenter.tsx`, `platformModel.ts` | provider catalogue (Twilio/WhatsApp/etc.) = config entries, mostly not wired |
| **Media Library** | Complete | `experience/assets.service.ts` (+ `services/storage.service.ts` for marketplace buckets) | single media pipeline; website reuses it |
| **Settings** | Complete | `config/*`, `contexts/AppConfigContext.tsx`, DB `settings`/`app_config` | locale/country/fees; `settings` RLS not enabled (Part 5) |
| **KYC / Trust** | Complete | `services/onboarding.service.ts`, `KycCenter.tsx` | applications/documents/review; DB `…000030` |
| **Customer Care** | Complete | `services/cx.service.ts`, `CustomerCareCenter.tsx` | support tickets/messages |
| **Growth** | **Duplicate** | `services/growth.service.ts` + `growthb.service.ts`; `GrowthCenter.tsx` + `GrowthCenterB.tsx` | two live implementations (Duplication D1) |
| **AI** | **Missing / dead dep** | — | `@google/genai` in `package.json` but **0 imports** — the "AI" module is not implemented |
| **Native shell** | Complete | `android/`, `ios/`, `capacitor.config.ts` | Capacitor 8 wrapper |

**Inventory headline:** ~30 functional modules, overwhelmingly **Complete** and **wired**. The only *Duplicate* is Growth (A/B). The only *Missing* advertised capability is **AI**. The consequential *Partial*s are **White-Label in-product** (single global brand) and **Notifications** (in-app only). **Fleet** is Complete-in-code but sits on a hazardous duplicate schema.

---

# PART 5 — Database Review

Reconstructed from 48 migrations (schema_dump.sql is empty). ~95 tables; 110 `CREATE INDEX`; 180 `CREATE POLICY`; ~85 tables `ENABLE ROW LEVEL SECURITY`.

## 5.1 Schema domains
Tenancy/geo (`countries,cities,zones,addresses,tenants,platform_*`) · Catalog (`merchants,merchant_branches,categories,products,product_variants,product_images,offers,banners,stock_movements`) · Orders (`orders,order_items,order_status_history,customer_carts,cart_items,coupons,coupon_usages/redemptions,reviews,favorites`) · Wallet/Payments/Finance (`wallets,wallet_transactions,payment_methods,payment_transactions,payment_attempts,refunds,webhook_events,payment_idempotency,ledger_entries,commissions,settlements,…`) · Delivery/Ops (`drivers,driver_locations,vehicles,driver_shifts,shift_breaks,driver_performance,payout_requests,dispatch_assignments,operation_events`) · CMS/Design (`design_settings,screen_experiences,campaigns,app_config,settings`) · Growth/Loyalty (`referrals,cashback,loyalty_*,affiliates,influencers,segments,promotions`) · Trust/KYC (`account_status,kyc_reviews,*_documents,suspensions,bans`) · Auth/RBAC (`roles,permissions,role_permissions,user_roles,admin_users`) · Audit/Support (`audit_logs,support_tickets,support_messages`).

## 5.2 Findings (ranked)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| DB1 | **Critical** | No `tenant_id` and no per-tenant RLS on any domain table; multi-tenant isolation deferred to a future rollout. Tenant separation = app logic + admin country-scoping. | `…000008:6-7`; `…000018:37-39`; `…000026·2:80-81` |
| DB2 | **Critical** | Prior release shipped RLS-enabled-with-zero-policies on 21 core tables (orders/wallets/admin_users…) → full default-deny lockout; remediated in `rls_recovery`. | `…000021:2-8` |
| DB3 | **High** | `vehicles` & `driver_shifts` each defined twice, incompatibly; later `IF NOT EXISTS` no-ops; `…000027·5:26` indexes `vehicles(driver_id)`, a non-existent column → likely apply-time error / wrong physical schema vs services. | `…000028:16-24,59-67` vs `…000027·5:10-26`, `…000027·6:24-31` |
| DB4 | **High** | Insecure policies were live in `…000001`: `app_config` writable by any user; `payment_transactions` insert for any order (IDOR); `support_messages` sender impersonation — fixed only in `…000026`. | `…000001:185-186,240-241,223-224` → `…000026:16-41` |
| DB5 | **Medium** | `audit_logs` & `settings` have policies but RLS is **never enabled** → policies inert; protected only by absent grants. | `…000021:203-207,219` |
| DB6 | **Medium** | `performance_indexes` silently skips notification/merchant/reviews hot-path indexes (columns `user_id`/`merchant_id`/`is_read` don't exist) — optimization never lands. | `…000027·2:28-53` vs `init:17,23,37-38` |
| DB7 | **Medium** | Finance enables RLS on 9 tables but authors ~5 policies in-file — some money tables may be default-deny/unpoliced. Not provable from files. | `…000031:338-346` |
| DB8 | **Medium** | Identity model ambiguous: RLS assumes `customers/drivers/merchants.id = auth.uid()` but those PKs default to random UUIDs with no FK to `auth.users` (only `admin_users.user_id` is linked). | `init:10`; `…000004:156-165`; `…000018:11` |
| DB9 | **Low** | Over-broad legacy policies (`order_id in (select id from orders)` without ownership filter) remain in `…000004`. | `…000004:32-37,142-147` |
| DB10 | **Low** | `schema_dump.sql` is 0 bytes — no canonical schema artifact for diffing/CI. | `supabase/.temp/schema_dump.sql` |

**Positives:** strong idempotency from ~`…000015` onward; `…000027_scale_indexes` has measured EXPLAIN gains (orders 190ms→3.4ms) with correct columns; consistent `snake_case`/plural/`_id`/`idx_` conventions. **Migration churn** (two `security_hardening` + one `rls_recovery`) shows RLS was reactively hardened — remediated in files, but final live state **must be verified with `pg_policies`/`pg_indexes`**.

---

# PARTS 6-7 — White Label & Website (summary)

**White Label:** correct token plumbing (`--color-primary-fixed`/`-on-primary-fixed` consumed broadly; `Button.tsx:19,26` re-skins). True per-tenant runtime brand exists **only on the public website** (`PublicSiteApp.tsx:26` → `applyBrand` → `tenant.service.ts:64`, mounted outside `DesignProvider` `main.tsx:56-60`). The four in-product apps are themed by a single **platform-global** design store (`DesignContext.tsx:57-59`) — **no login-time `applyTheme(tenant)`**. Emails/PDF/Invoices are **unimplemented** (asset slots are placeholders); notifications are in-app and unbranded. → White-Label score reflects this split.

**Website:** genuinely strong. Runtime host resolution (custom domain → subdomain → `?site=`) `runtime.ts:18-36`; visual builder with 12 block types + drag/drop/enable/dup/delete/device-preview/templates/import-export `WebsiteCenter.tsx`; CMS + SEO + versioning/rollback in `website.service.ts`. **Gaps:** not code-split (public site eager in entry — Perf P2), SSL/DNS is external infra, and content persists only to `localStorage` (Launch Blocker C4).

---

# PART 8 — Performance

**Bundle (production build, `dist/assets`):**

| Asset | Size | Note |
|---|---|---|
| `AdminDashboard-*.js` | **~914 KB** | largest by 2.2×; bundles recharts + all 34 admin sub-components; exceeds Vite 500 KB warn |
| `index-*.js` (entry) | **~414 KB** | always downloaded; includes eager HomeScreen + App + **eager PublicSiteApp** |
| `index.es-*.js` | ~317 KB | recharts/d3 family |
| `vendor-react` 3.9 KB · `vendor-supabase` 1 byte | | `manualChunks` largely ineffective (react-dom leaked into entry; supabase chunk empty in sandbox) |

| # | Issue | Severity | Evidence | Fix |
|---|---|---|---|---|
| P1 | 914 KB admin chunk | High | `AdminDashboard-*.js`; recharts eager in `AdminDashboardHome.tsx:2`, `GrowthCenterB.tsx:3` | lazy-load chart views; split admin sub-modules |
| P2 | `PublicSiteApp` eager in entry chunk | Medium | `main.tsx:12` static import | `React.lazy` behind `publicReq.isPublicSite` |
| P3 | Ineffective `manualChunks` | Low | `vite.config.ts:29-33` | isolate react-dom; add recharts/maps vendor split |
| P4 | **No memoization** in hot/large components (`React.memo` = 0 repo-wide; 28 `useMemo`/23 `useCallback` total) | Medium | `OrdersList.tsx` (760) 0 memo; `MerchantApp.tsx` (1220) 0; `HomeScreen` 8 `.map` / 2 memo | memoize list rows + derived data |
| P5 | No search debounce (`debounce` = 0 matches) | Medium | live filter in `HomeScreen`, `AdminDataTable`, `AdminDashboard` | add ~250ms debounce |
| P6 | Seed-on-every-mount | Low | `AdminDashboard.tsx:117`, `main.tsx:21` (idempotent) | one-time guard |
| P7 | localStorage data layer, no cache abstraction | Low | 23/43 services touch localStorage | add query/cache layer at backend cutover |

**Positive (the big win):** role apps + non-landing customer screens **are** code-split — 9 `React.lazy` boundaries in `App.tsx:12-22`. Customers never download admin code. Timer/listener cleanup hygiene is good (`setInterval` 11 vs `clearInterval` 10; sampled effects clean up correctly).

---

# PART 11 — Code Quality

| # | Issue | Severity | Evidence |
|---|---|---|---|
| Q1 | `tsconfig` **`strict` not enabled** (no `noImplicitAny`/`strictNullChecks`) — root enabler of the casts below | **High** | `tsconfig.json`; `lint` = `tsc --noEmit` against a permissive config |
| Q2 | **100 `as any`** casts across `src/` | Medium | `grep "as any"` = 100 |
| Q3 | **Two i18n systems** — inline `L('ar','en')` in 48 files vs `react-i18next` in 11 | Medium | `i18n/index.ts` + ~1,278 inline calls |
| Q4 | Generic package name `"react-example"` | Low | `package.json:2` |
| Q5 | Two documentation roots (`docs/` + `documentation/`) | Low | both exist |
| Q6 | Low comment density (~4.8%) in god objects | Low | 1,375 comment lines / 28,653 LOC |
| Q7 | Debt markers essentially absent — **2 total** (1 real TODO + 1 false positive); **0 `@ts-ignore`** | Low (positive) | `platform.service.ts:5`; `WebsiteCenter.tsx:222` |

**Structure:** coherent feature-based slicing; main clarity debt is the overlapping `experience/` + `design/` + `platform/` trio (theming ownership spans all three). 18 non-null `!`, 17 `eslint-disable` — acceptable levels; zero `@ts-ignore` is a genuine positive.

---

# PART 12 — Scores (0-100)

Scored on evidence. Where "demo" and "live-SaaS" diverge sharply, both are given.

| Area | Score | Basis |
|---|---:|---|
| **Architecture** | **68** | Sound layering, no cycles; but DB-boundary leak (A1), god objects (A2), duplicated persistence (A3). |
| **Code Quality** | **65** | Feature-based, ~1 real TODO, 0 `@ts-ignore`; dragged by `strict` off (Q1), 100 `as any`, two i18n. |
| **Performance** | **64** | Role-app code-splitting is excellent; offset by 914 KB admin chunk, eager public site, 0 `React.memo`. |
| **Security (code)** | **74** | No client secrets, HMAC webhooks, CSP/HSTS, all dev hooks gated, 0 XSS. Residual: webhook-secret optional (S2), client-only RBAC (S3). |
| **Scalability** | **45** | No `tenant_id`/per-tenant RLS (DB1), silent-skipped indexes (DB6), localStorage data layer, single-brand apps. |
| **Maintainability** | **62** | Clean debt markers + structure; hurt by god objects, duplicated persistence, two i18n, strict off. |
| **White Label** | **58** | Correct tokens + true per-tenant website; but in-product apps single-global-brand, emails/PDF/invoices absent. |
| **Website** | **76** | Builder/runtime/CMS/SEO/versioning genuinely complete; gaps at code-split, SSL/DNS infra, server persistence. |
| **Production readiness** | **Demo 90 / Live-SaaS 42** | Demo: build ✓, E2E 24/24, strong headers/CI. Live: forced sandbox, hardcoded OTP, no per-tenant RLS, localStorage persistence, SMS/email unwired. |
| **Overall Platform** | **Demo 82 / Live-SaaS 60** | Feature-complete, well-secured, well-built **demo**; a focused backend-hardening + multi-tenancy program stands between it and live multi-tenant GA. |

---

# PART 14 — Cleanup Plan (prioritized roadmap)

### Quick Wins (effort S, low risk)
1. **Delete 9 dead files + 6 unused deps** (`@google/genai`, `react-router-dom`, `motion`, `express`, `@types/express`, `dotenv`) — gate with `tsc`/build. *(Dead-Code §1-2)*
2. **Rename `package.json` "react-example" → "haat-now".** *(Q4)*
3. **Merge `documentation/` into `docs/`;** prune superseded audit files. *(Q5, Duplication §3)*
4. **Add search debounce** to the 3 live-filter inputs. *(P5)*
5. **Rename the website "Experience Builder" → "Website Builder"** to end the name collision. *(Duplication D7)*

### Medium Refactors (effort M)
6. **Enforce the DB boundary** — move the ~25 raw `supabase` calls out of components into services; add `no-restricted-imports` lint. *(A1)*
7. **Centralize persistence** on `adminCrud`/a `kv` module; remove 7 inline `haat_crud_*` re-implementations. *(A3)*
8. **`React.lazy` the public site** + lazy-load recharts/chart views; split the 914 KB admin chunk. *(P1, P2)*
9. **Fix the 4 cross-feature imports**; relocate shared `User` type to `services/`. *(A4, A7)*
10. **Consolidate the two registry consoles** + the two MediaPickers behind shared components. *(Duplication D3, D8)*

### Major Refactors (effort L)
11. **Merge Growth A/B** into one service + one console. *(Duplication D1)*
12. **Unify i18n** onto `react-i18next`; extract inline `L()` strings to a catalogue. *(Q3, Duplication D2)*
13. **Decompose the god objects** (MerchantApp/ProfileScreen/CheckoutPage) into sub-screens + hooks + services. *(A2, A5)*
14. **Enable `tsconfig` `strict`** and burn down the 100 `as any`. *(Q1, Q2)*

### Technical Debt / Backend program (launch-gating — see Launch Blockers)
15. **Reconcile duplicate DB tables** (`vehicles`, `driver_shifts`) with a corrective migration. *(DB3)*
16. **Add `tenant_id` + per-tenant RLS** across domain tables. *(DB1)*
17. **Run a live `pg_policies`/`pg_indexes` audit;** enable RLS on `audit_logs`/`settings`; fix the silent-skip indexes. *(DB5, DB6, H2)*
18. **Wire per-tenant `applyTheme` at login** for the in-product apps. *(H4)*
19. **Server-persist website/design content** (Supabase). *(C4)*
20. **Backend cutover:** `HAAT_LIVE_BACKEND=1`, all edge secrets set (hard-fail on `PAYMENT_WEBHOOK_SECRET`), SMS/email providers wired. *(C1, C2, H1, H3)*

---

## Closing assessment
HAAT NOW is a **feature-complete, well-secured, well-structured multi-tenant commerce platform** that currently ships as a **self-contained sandbox demo**. The engineering quality of the security surface, the website subsystem, and the code-splitting is genuinely strong, and the codebase is remarkably low on debt markers and dead code for its size. The gap to a live multi-tenant SaaS is **not a rewrite** — it is a bounded, well-defined **backend-hardening + multi-tenancy program** (Parts 13 & 14, items 15-20), dominated by two themes: *make multi-tenancy real in the database*, and *flip-and-validate the live backend*. Until those land, the honest posture is: **excellent demo, not yet a launched SaaS.**
