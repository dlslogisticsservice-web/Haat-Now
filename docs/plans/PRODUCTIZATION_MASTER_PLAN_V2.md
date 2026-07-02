# Productization Master Plan V2 — Final Architecture

The Website is a **first-class, multi-tenant, multi-audience presentation layer** of the same platform, driven
by one config spine. This is the final architecture document (revised with the Provisioning Engine, Export/
Import, Template Marketplace, Theme Presets, Brand Asset Manager, Multi-Site, and reserved AI seams).
**Architecture only — no implementation until approved.**

---

## 0. The unified architecture (one platform, many surfaces)

One **config spine** (the tenant) cascades to **every** surface — no surface stores its own brand/theme/content.

```
                  ┌──────────────────  TENANT (tenant.service)  ──────────────────┐
                  │ Brand identity     → White-Label Brand Manager (exists)         │
                  │ Theme (DesignConfig)→ Design Center · applyDesign → :root        │
                  │ Subscription/plan/  → subscription.service + subscriptions/      │
                  │  trial/usage limits   memberships tables (Phase 0)               │
                  │ Feature flags       → features_json + platform.service flags      │
                  │ Website content     → Experience CMS (new `website` type, multi-site)│
                  │ Brand assets        → assets.service / AssetsManager (exists)      │
                  │ Integrations/analytics/storage → platform.service registry        │
                  │ Permissions         → RBAC                                        │
                  │ SEO/domain/SSL      → tenant metadata + Phase 0 state machine      │
                  └───────────────────────────┬──────────────────────────────────────┘
                                              │ consumed read-only by
   ┌──────────┬──────────┬──────────┬─────────┴────┬──────────┬───────────────────────┐
 WEBSITE(S)  CUSTOMER   DRIVER     MERCHANT       ADMIN      EMAIL / PDF / INVOICE
 (multi-site) APP        APP        PORTAL         DASHBOARD  (token + template + asset consumers)
```

**Principle locks:** one theme engine (`designSystem.applyDesign`), one brand model (`tenant.service` + Brand
Manager), one CMS (`experience.service`), one auth/session, one RBAC, one i18n, one Integration Center, one
**Media/Asset Library** (`assets.service`), one Notification engine. New capabilities are **additive fields +
orchestrators over these**, never parallel systems.

---

## PHASE 0 — Commercial SaaS Foundation + Tenant Provisioning Engine  (leads the sprint)

**Why first:** nothing is sellable until a tenant can be **provisioned, branded, subscribed, and activated**
automatically. Every later phase reads what this produces.

### 0.1 Tenant Provisioning Engine (the orchestrator — fully automated)
A single `provisionTenant(spec)` flow that **automatically creates and configures** every artifact by calling
the **existing** services in sequence (orchestration, not new subsystems). One call → a fully-operational tenant:

| Artifact auto-created | Produced by (reused engine) |
|---|---|
| Tenant + **Slug** | `tenant.service.provision` (exists) |
| **Brand** + **Theme** + **Design Tokens** | `tenant.service.saveBranding` + a chosen **Theme Preset** → `DesignConfig` |
| **Website** + **CMS Content** + **Default Pages** | Experience CMS `website` type, seeded from a **Business Template** |
| **Roles** + **Default Admin** | `rbac.service` per-tenant role seed + create tenant admin user |
| **Merchant Workspace** / **Driver Config** / **Customer Config** | default `features_json` + seed config records |
| **Email Templates** + **Notification Templates** | tenant templates (Brand Manager — exists) |
| **Feature Flags** | `features_json` + `platform.service` flags |
| **Subscription** + **Usage Limits** | `subscription.service` over `subscriptions`/`memberships` |
| **Integrations** + **Analytics Config** + **Storage Config** | `platform.service` provider registry (per tenant) |

- **Deliverables:** `services/provisioning.service.ts` (the orchestrator) + `subscription.service.ts`;
  extend `tenant.service` (defaults seeding on activate); `TenantOnboardingWizard.tsx` (guided UI driving it).
- **Files affected:** new `provisioning.service.ts`, `subscription.service.ts`; `tenant.service.ts`,
  `rbac.service.ts`, `platform.service.ts`, `experience.service.ts` (seed website), `assets.service.ts` (seed
  brand assets); `features/admin/TenantOnboardingWizard.tsx`; `TenantWorkspace.tsx` (Subscription tab).
- **Dependencies:** none upstream. **Reuse:** every artifact comes from an existing engine — the provisioning
  service only *orchestrates*. **Risk:** Medium (additive; behind the wizard; existing provision untouched).
  **Rollback:** remove orchestrator + wizard; the individual services are unchanged. **Completion:** one
  `provisionTenant(spec)` yields an **active** tenant with brand, theme, website, pages, roles, admin, configs,
  subscription+trial+limits, integrations seeded. **Production verification:** wizard → active tenant; every
  artifact present in its store; typecheck/lint/build/E2E green; prod SHA == commit.

### 0.2 Subscription lifecycle · trial · usage limits · domain/SSL · environment provisioning
As in V1 §Phase 0 — subscription states (trialing/active/past_due/canceled), trial window, per-plan usage caps
(`usageGuard`), domain-verification + SSL **state machine** (real status fields; DNS/SSL action credential-
gated), environment defaults seeded by the provisioning engine. Billing/proration **modeled + flagged** (payment
provider credential), never faked.

### 0.3 Platform Operations (the tenant control plane)
Operational tooling **over** the Provisioning Engine — all reusing existing engines (`tenant.service`,
`provisioning.service`, Export/Import, Integration Center health, `operation_events` audit, version sources).

**(a) Tenant Lifecycle Manager** — one console for every transition:
- **Provision · Activate · Suspend · Resume · Archive · Clone · Backup · Restore · Delete.**
- Mapping to engines: provision/activate/suspend/archive already in `tenant.service`; **Resume** = activate from
  suspended; **Clone/Backup** = `exportTenant` (snapshot) ; **Restore** = `importTenant`; **Delete** = soft-
  delete + purge stores (guarded, audited). Every transition writes an `operation_events` row.
- *Files:* `tenant.service.ts` (resume/clone/backup/restore/delete), new `features/admin/TenantLifecycle.tsx`.
  *Reuse:* lifecycle + Export/Import + audit. *Risk:* Medium (delete is destructive → confirm + backup-first).
  *Rollback:* destructive actions backup before mutating; restore from the snapshot. *Completion:* every verb
  works + audited. *Verification:* full lifecycle round-trip incl. clone→restore == identical tenant.

**(b) Tenant Health Dashboard** — read-only aggregation per tenant: **Storage · Payments · Maps ·
Notifications · Analytics · AI · SSL · Domains · Usage · Warnings · Errors.**
- *Reuse (no new monitoring):* provider rows = Integration Center `platform.service.providerHealth`
  (payments/maps/notifications/analytics/AI/storage); SSL/Domains = the Phase-0 state machine; Usage =
  `usageGuard` vs plan limits; Warnings/Errors = `operation_events` + `monitoring.service`.
- *Files:* new `features/admin/TenantHealth.tsx`, `platform.service.ts` (health read), `monitoring.service.ts`.
  *Risk:* Low (read-only). *Rollback:* remove the view. *Completion:* each tile reflects real state
  (connected/failed/within-limits). *Verification:* a failed provider + an over-limit usage surface correctly.

**(c) Provisioning Timeline** — every provisioning **step logged** (start/ok/fail per artifact) so a run is
auditable + resumable. *Reuse:* `provisioning.service` emits an `operation_events` row per step (the existing
audit channel); the timeline renders them in order. *Files:* `provisioning.service.ts` (step logging),
`features/admin/ProvisioningTimeline.tsx`. *Risk:* Low. *Rollback:* logging is additive. *Completion:* a
provision run shows an ordered, timestamped step list with per-step status. *Verification:* a forced step
failure appears as `failed` with its error.

**(d) One-Click Demo Tenant** — generate a **complete** demo tenant for sales/testing in one action.
- *Reuse:* `provisionTenant(spec)` + a **"Demo" Template** (Template Marketplace) + the validated seed harness
  (the 1000-order simulation pattern) → a tenant with brand, website, catalog, drivers/merchants/customers,
  orders, finance, all populated. *Files:* `provisioning.service.ts` (demo spec), `templates/templateCatalog.ts`
  (Demo bundle), `features/admin/TenantLifecycle.tsx` (button). *Risk:* Low (additive). *Rollback:* delete the
  demo tenant. *Completion:* one click → a fully-operational, data-rich demo tenant. *Verification:* the demo
  tenant's admin/website/apps all show coherent populated data; 0 errors.

**(e) Tenant Version Manager** — track per tenant: **Platform Version · Theme Version · CMS Version · Migration
Version · Build Version.** *Reuse:* Platform/Build = `version.json` (`APP_VERSION`/SHA, already emitted); Theme =
`DesignConfig` design-store version; CMS = `experience.service` `version_number`/history; Migration = the
migrations dir. The manager **stamps** these onto the tenant at provision/publish and shows drift. *Files:*
`tenant.service.ts` (version stamp), `features/admin/TenantVersions.tsx`. *Risk:* Low. *Rollback:* additive
fields. *Completion:* a tenant shows its five versions + drift vs current. *Verification:* publishing CMS bumps
the CMS version; a platform deploy bumps build version.

**(f) Tenant Diagnostics** — runtime diagnostics for **every subsystem**: a diagnostic runner that probes each
(storage readable, providers configured, CMS published, RBAC roles seeded, theme applied, subscription active,
domain/SSL state) and reports pass/fail + remediation hint. *Reuse:* Integration Center `testConnection`,
`monitoring.service`, RBAC/CMS/tenant reads — diagnostics **call** existing checks, no new probes invented.
*Files:* new `services/diagnostics.service.ts` (runner over existing checks), `features/admin/TenantDiagnostics.tsx`.
*Risk:* Low (read-only probes). *Rollback:* remove the runner. *Completion:* a diagnostics run yields a
per-subsystem pass/fail report. *Verification:* a misconfigured subsystem (e.g. no maps key) reports `fail` with
the exact reason; a healthy tenant reports all-green.

---

## CROSS-CUTTING PLATFORM CAPABILITIES (extend existing engines)

### A. Tenant Export / Import
- **Plan:** `tenant.service.exportTenant(id)` serializes the **entire** tenant config — brand, theme
  (`DesignConfig`), website content (all sites/versions), feature flags, subscription, roles, integration
  configs, templates, brand-asset references — into one **versioned JSON** document. `importTenant(json)` feeds
  the **Provisioning Engine** to recreate it in another environment (idempotent, id-remapped).
- **Files:** `tenant.service.ts` (export/import), `provisioning.service.ts` (import path), `TenantWorkspace.tsx`
  (Export/Import buttons). **Reuse:** all data already lives in JSON stores/tables — export is a read+bundle;
  import is provisioning. **Risk:** Low-Medium (import validates schema + dry-run). **Rollback:** import is
  transactional (stage → commit); failure leaves no partial tenant. **Completion:** export tenant A → import →
  identical tenant B in a clean environment. **Verification:** round-trip a tenant; diff config == 0.

### B. Template Marketplace (predefined business templates)
- **Plan:** a **catalog of business templates** (data, not code) — **Restaurant · Food Delivery · Courier ·
  Pharmacy · Supermarket · Flowers · Laundry · Luxury · Corporate · Minimal** — each a bundle of
  `{ theme preset, website content set (hero/sections/pricing copy), default feature flags, vertical +
  categories, default pages }`. Selecting a template in the **Onboarding Wizard** seeds the new tenant via the
  Provisioning Engine.
- **Files:** new `templates/templateCatalog.ts` (the bundles), `provisioning.service.ts` (apply-template),
  `TenantOnboardingWizard.tsx` (template picker). **Reuse:** Theme Presets + Experience CMS website content +
  `features_json` — a template is just a named bundle the engine applies. **Risk:** Low (pure data).
  **Rollback:** remove a template from the catalog; tenants already provisioned are unaffected. **Completion:**
  pick "Pharmacy" → tenant gets pharmacy theme/site/flags/categories. **Verification:** each of the 10 templates
  provisions a coherent tenant; 0 errors.

### C. Theme Presets (reusable, tenant-independent)
- **Plan:** named **`DesignConfig` snapshots** independent of any tenant — a `theme-presets` catalog the Design
  Center can **save/apply**, referenced by Template Marketplace + Provisioning. Applying a preset = `applyDesign`
  + persist to the tenant's theme.
- **Files:** new `design/themePresets.ts` (+ store `haat_theme_presets`), `DesignCenter.tsx` (Save-as-preset /
  Apply-preset), `provisioning.service.ts` (apply on provision). **Reuse:** `DesignConfig` + `applyDesign` — a
  preset is just a stored config. **Risk:** Low (additive). **Rollback:** remove preset catalog; tenant themes
  unaffected. **Completion:** save current design as a preset; apply it to another tenant → identical theme.
  **Verification:** preset save/apply round-trip; `:root` matches.

### D. Brand Asset Manager (extend the existing AssetsManager)
- **Plan:** **extend** the existing `assets.service` + `AssetsManager.tsx` (Supabase Storage bucket
  `experience-assets`, already present) with **per-tenant brand-asset slots**: Logo · SVG · PNG · Favicon ·
  Splash · App Icon · **Email Header · Invoice Header · PDF Logo · Social Images**. Each slot maps to the tenant
  brand fields (`logo_url`, `favicon_url`, `splash_url`, `app_icon_url`, + new `email_header_url`,
  `invoice_logo_url`, `pdf_logo_url`, `social_image_url`) consumed by White-Label + Website + Email/PDF/Invoice.
- **Files:** `experience/assets.service.ts` (slot taxonomy), `AssetsManager.tsx` (slots UI),
  `tenant.service.ts` (new brand-asset fields), `TenantWorkspace.tsx` (Brand tab wiring). **Reuse:** the **one**
  asset library + storage — no second uploader. **Risk:** Low (additive slots). **Rollback:** new slots optional;
  old assets unaffected. **Completion:** upload a logo once → it appears on website + apps + email/PDF headers.
  **Verification:** one asset upload cascades to every surface that references that slot.

### E. Multi-Site Support (refines Phase 2)
- **Plan:** a tenant owns **multiple websites** — **Main · Careers · Help Center · Documentation · Status ·
  Blog** — all in the **same CMS**. The website content key extends from `tenant:website` to
  `tenant:website:<siteKey>`; each site is its own versioned/publishable content set. The Website Builder gets a
  **site selector**; the public layer routes by site (path or subdomain).
- **Files:** `experience/experienceTypes.ts` (siteKey), `experience.service.ts` (multi-site keying),
  `ExperienceBuilder.tsx` (site selector), `features/website/*` (site router). **Reuse:** the existing CMS
  versioning/rollback per site. **Risk:** Low-Medium (key extension; default site = Main preserves single-site).
  **Rollback:** collapse to the Main site key. **Completion:** create a Careers + Help-Center site under one
  tenant; publish/rollback each independently. **Verification:** multi-site publish isolation; correct routing.

### F. AI Website Generator — RESERVED EXTENSION POINTS (no implementation)
Architecture is reserved; **AI is not implemented**. Defined seams so it drops in later with zero refactor:
1. **`websiteGenerator.service` interface** (stub): `generate({ brand, businessType, prompt, locale }) →
   WebsiteContentSet`. No body now — interface + types only.
2. **Provider source:** consumes the **Integration Center AI providers** (OpenAI/Anthropic/Gemini already in the
   registry) — the generator reads keys/priority from `platform.service`, not a new config.
3. **Call site:** a "Generate website" action in the **Website Builder** that, when an AI provider is enabled,
   calls the interface and feeds the result into the **same** `experience.service` publish flow (versioned/
   rollback-capable) — output is an ordinary website content set, indistinguishable from hand-authored.
4. **Provisioning hook:** an optional `generateContent` step in `provisionTenant(spec)` (off by default) that the
   engine can call when AI is enabled.
- **Reuse:** Integration Center (providers) + Experience CMS (output sink) + Template Marketplace (seed prompt).
  **Risk:** None now (interfaces only). **Completion criterion (for the reservation):** the interface + call
  site + provisioning hook exist as **typed no-op seams**; enabling AI later requires only implementing the
  service body — no changes to CMS/website/provisioning.

---

## PHASE 1 — Website Platform (first-class, multi-audience)
Hostname-resolved `<TenantSite>` → multi-page public layer: Marketing (hero/features/pricing/FAQ); audience
funnels (Customers/Merchants/Drivers/Enterprise/White-Label/Investors/Careers) deep-linking into the apps;
platform pages (Support/Docs/KB/Blog/Status/Legal/Partners/Contact); SEO surface (meta/OG/JSON-LD/robots/
sitemap). **Files:** `src/App.tsx` (pre-auth branch, feature-flagged), `index.html`, new
`src/features/website/*`. **Dependencies:** Phase 0, 2, 3. **Reuse:** tokens/brand/CMS/i18n/Integration Center/
assets. **Risk:** Medium (guarded pre-auth route). **Rollback:** `website_enabled` flag off → login-first SPA.
**Completion/Verification:** branded multi-page tenant site renders unauthenticated; SEO correct; CTAs reach
apps; 0 errors; prod SHA == commit.

## PHASE 2 — White-Label Website Engine (extend CMS, multi-site)
Add a **`website` content type** (Hero · Sections · Features · Screenshots · Pricing · FAQ · Blog · Articles ·
Downloads · App-Store/Play links · Policies · Terms · Contact · Footer · Navigation · SEO · OpenGraph ·
Structured Data · Robots · Sitemap) to `experienceTypes`, keyed **per tenant per site** (Multi-Site §E). Every
tenant gets a default site auto-seeded on provision. Edited from Admin (Website tab + Builder), versioned/
publishable/rollback. **Files:** `experienceTypes.ts`, `experience.service.ts`, `ExperienceBuilder.tsx`,
`TenantWorkspace.tsx`. **Dependencies:** Phase 0. **Reuse:** the entire CMS infra. **Risk:** Low-Medium
(additive type). **Rollback:** isolate/remove the website type. **Completion/Verification:** edit→publish→live→
rollback round-trip per tenant per site.

## PHASE 3 — Design Center Extension (extend, no new theme engine)
Add a `website` token group to `DesignConfig` (hero/sections/web-typography/nav/footer/web-animations) →
`--web-*` `:root` vars consumed by `TenantSite`; one "Website" panel in `DesignCenter`. Website inherits the
same colors/typography/spacing/buttons/cards/animations/glass/brand/icons/dark/RTL/LTR. **Files:**
`designSystem.ts`, `DesignCenter.tsx`. **Risk:** Low (additive, backward-compatible). **Rollback:** remove
fields/panel. **Completion/Verification:** website token edit cascades live; apps unchanged.

## PHASE 4 — Driver App Premium Experience (extend the 705-line app)
Active-trip **bottom sheet**, premium **trip cards** + **task queue**, refined **earnings/wallet**, polished
**online/offline** switch, status-driven map. **Files:** `DriverApp.tsx`, `DriverOpsPanel.tsx`, inline
`DriverMiniMap`, `Icon`. **Dependencies:** benefits from Phase 5. **Reuse:** existing component + hooks + tokens.
**Risk:** Medium. **Rollback:** per-component. **Completion/Verification:** full trip lifecycle via bottom
sheet; 0 errors.

## PHASE 5 — Maps (enhance existing engines)
Clustering, selection, filtering, interpolated movement, vehicle icons, status colors, routing — on
`OpsSvgMap` + `OrderTrackingMap` + `DriverMiniMap`. **Files:** `OpsSvgMap.tsx`, `OrderTrackingMap.tsx`,
`DriverApp.tsx`, `OperationsCommandCenter.tsx`. **Risk:** Low-Medium. **Rollback:** per-component.
**Completion/Verification:** clustering/selection/filtering work; smooth movement; 0 errors.

## PHASE 6 — Customer App Polish (review-only)
Spacing/hierarchy/micro-interactions/skeletons/bottom-nav indicator/safe-areas/type/cards/buttons. **Files:**
8 customer screens + `App.tsx` nav. **Risk:** Low. **Rollback:** per-screen. **Verification:** UI pass, 0 errors.

## PHASE 7 — Merchant Portal Polish (review-only)
Hierarchy/tables/charts/cards/stats/inventory+financial UX. **Files:** 5 merchant files. **Risk:** Low.
**Rollback:** per-file. **Verification:** clean tables/charts, 0 errors.

---

## Execution order + technical justification (final)
**Phase 0 (incl. Provisioning Engine + Theme Presets + Template Marketplace + Brand Asset Manager + Export/
Import) → 1 → 2 (incl. Multi-Site) → 3 → 4 → 5 → 6 → 7.**

Delivery within Phase 0 (sub-milestones, dependency-ordered):
1. **0.1 Subscription + usage limits** (no deps) → 2. **0.2 Theme Presets** (DesignConfig snapshots) →
3. **0.3 Brand Asset Manager** (asset slots) → 4. **0.4 Provisioning Engine** (orchestrates 0.1–0.3 + existing
brand/RBAC/CMS, with **Provisioning Timeline** step-logging) → 5. **0.5 Template Marketplace** (bundles consumed
by the engine) → 6. **0.6 Onboarding Wizard** (drives the engine) → 7. **0.7 Export/Import** (serialize ↔
provision) → 8. **0.8 Platform Operations** (Lifecycle Manager · Health Dashboard · One-Click Demo Tenant ·
Version Manager · Diagnostics — the operational console *over* everything above).

**Justification:** the Provisioning Engine (0.4) is the keystone but *depends on* presets (0.2), asset slots
(0.3), and subscriptions (0.1) existing to wire together — so those land first. Template Marketplace (0.5) and
Export/Import (0.7) are *consumers* of the engine, so they follow it. **Platform Operations (0.8) lands last in
Phase 0** because every tool in it (lifecycle clone/backup/restore, health tiles, demo-tenant, version stamps,
diagnostics) operates *over* the provisioning + export/import + integration-health primitives built in 0.1–0.7
— it is the control plane, so its dependencies must exist first. Only after a tenant can be fully provisioned
**and operated** do the **website stack (1→2→3)**, then the **flagship apps (4→5)** and **polish (6→7)** make
commercial sense. **AI Website Generator** stays a reserved seam throughout — implemented in no phase.

## Global rollback & safety
Every live-surface change is **additive + feature-flagged** (`website_enabled`, per-capability flags). Design
Center + White Label remain backward-compatible (defaults = no visual change). Each phase/sub-milestone ships
through the gate: **typecheck 0 · lint 0 · build ✓ · E2E 24/24 · runtime verify · commit → push → deploy →
`version.json` == commit**, runtime-verified before the next.

---

## ARCHITECTURE FROZEN
This document is the **frozen** architecture for the productization program. No further architectural changes.
The next sprint **begins implementation at sub-milestone 0.1 (Subscription + usage limits)** and proceeds in the
order above, each sub-milestone shipping through the full gate (typecheck 0 · lint 0 · build ✓ · E2E 24/24 ·
runtime verify · commit → push → deploy → `version.json` == commit) and runtime-verified before the next.

**STOP — no implementation in this turn.**
