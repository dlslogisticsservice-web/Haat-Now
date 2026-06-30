# Productization Master Plan V2 — Final Architecture

The Website is **not a marketing page** — it is a **first-class presentation layer** of the same platform,
multi-tenant and multi-audience, sharing one config spine with the apps. This document supersedes V1. It is
**architecture only — no implementation until approved.**

---

## 0. The unified architecture (one platform, many surfaces)

There is **one config spine** (the tenant) that cascades to **every** surface. No surface stores its own
brand/theme/content — they all *consume* the spine.

```
                         ┌───────────────  TENANT (tenant.service)  ───────────────┐
                         │  Brand identity      → White Label Brand Manager (exists) │
                         │  Theme (DesignConfig)→ Design Center · applyDesign → :root │
                         │  Subscription/plan/   → Phase 0 (subscriptions+memberships)│
                         │   trial/usage limits                                       │
                         │  Feature flags        → features_json (exists)             │
                         │  Website content      → Experience CMS (new `website` type)│
                         │  Permissions          → RBAC (exists)                      │
                         │  SEO/domain/SSL       → tenant metadata + Phase 0          │
                         └───────────────────────────┬───────────────────────────────┘
                                                     │ consumed by (read-only)
   ┌──────────────┬──────────────┬──────────────┬───┴────────┬──────────────┬───────────────┐
 WEBSITE        CUSTOMER        DRIVER         MERCHANT      ADMIN         EMAIL/PDF/INVOICE
 (new public    APP             APP            PORTAL        DASHBOARD     (token+template
  layer)                                                                    consumers)
```

**Principle locks (apply to every phase):**
- **One theme engine** — `design/designSystem.ts` (`applyDesign`→`:root`). Website tokens are *additive fields*.
- **One brand model** — `services/tenant.service.ts` + White-Label Brand Manager. Website *reads* it; changing
  logo/colors/typography/brand/domain there instantly re-themes Website + all apps (shared `:root`) — no
  duplicated config.
- **One CMS** — `experience/experience.service.ts` (draft/publish/version/rollback). Website content is a new
  *content type*, not a new CMS.
- **One auth/session** — the website is a **pre-auth presentation layer** of the same app; tenant resolved by
  hostname (`custom_domain`/`subdomain` already on the tenant).
- **One RBAC, one i18n, one Integration Center, one Media Library, one Notification engine** — all reused.

---

## PHASE 0 — Commercial SaaS Foundation  (NEW — leads the sprint)

**Why first:** a sellable SaaS needs a tenant to *exist, be branded, be subscribed, and be provisioned* before
it can own a website or apps. Every later phase reads tenant + subscription + defaults produced here.

**Current state (extend, don't rebuild):** `tenant.service` already has `provision/activate/suspend/archive`
+ `plan` + slug + lifecycle audit; `subscriptions`+`memberships` tables exist; `features_json` per tenant; the
White-Label Brand Manager already edits brand/domain/store-metadata/templates.

**Deliverables:**
- **Subscription lifecycle** (extend `tenant.service` + a thin `subscription.service` over the existing
  `subscriptions`/`memberships` tables): plan catalog (free/starter/business/enterprise), **trial** (start/days
  remaining/expiry), upgrade/downgrade, status (trialing/active/past_due/canceled). *Billing/proration =
  credential-gated (payment provider) — modeled, flagged, not faked.*
- **Usage limits** per plan (orders/drivers/merchants/branches caps) read by a `usageGuard` helper.
- **Feature flags** per plan + per tenant (reuse `features_json` + `platform.service` flags).
- **Domain verification + SSL** state machine on the tenant (`pending→verifying→verified`; SSL
  `pending→issued`) — real status fields + a verify action (DNS TXT check is credential/runtime-gated; the
  state machine + UI are real).
- **Environment provisioning** — default records created on activate: default branding (HAAT defaults),
  **default website** (seeded `website` content set), default mobile config (package/bundle placeholders),
  default permissions (seed RBAC roles for the tenant), default email templates (reuse tenant templates).
- **Tenant Onboarding Wizard** (`TenantOnboardingWizard.tsx`, admin) — guided: identity → brand → plan/trial →
  domain → defaults → **activate**. Drives `tenant.service.provision` + the new subscription + defaults seeding.
- **Tenant activation flow** — `activate()` extended to seed defaults + emit `tenant_activated`.

**Files affected:** `services/tenant.service.ts` (extend), new `services/subscription.service.ts`,
`features/admin/workspaces/TenantWorkspace.tsx` (Subscription tab), new
`features/admin/TenantOnboardingWizard.tsx`, `services/rbac.service.ts` (per-tenant role seed),
`platform.service.ts` (flags), migrations `subscriptions`/`memberships` (real path; sandbox via adminCrud).
**Dependencies:** none upstream (foundation). **Reuse:** tenant + subscriptions/memberships tables + RBAC +
features_json + Brand Manager. **Risk:** Medium (touches tenant lifecycle — additive, behind the wizard).
**Rollback:** all additive fields/services; remove the wizard route + revert `tenant.service` diff; existing
provision/activate untouched in behavior. **Completion criteria:** create a tenant via the wizard → it gets a
plan+trial, default brand/website/permissions, domain in `pending`, and reaches `active`; usage guard returns
limits. **Production verification:** wizard creates an active tenant; Subscription tab shows plan+trial+limits;
defaults present in stores; typecheck/lint/build/E2E green; prod SHA == commit.

---

## PHASE 1 — Website Platform  (first-class, multi-audience)

**Current:** no public site (login-walled SPA). **Plan:** a **pre-auth public layer** `<TenantSite>` resolved
by hostname → loads tenant config → renders a **multi-page** site, not a landing page:
- **Marketing**: hero · features · pricing · FAQ · testimonials.
- **Audience funnels** (deep-link into apps): For Customers (→ order) · For Merchants (→ partner signup) · For
  Drivers (→ driver onboarding) · **Enterprise** · **White-Label prospects** · **Investors** · **Careers**.
- **Platform pages**: Support · Documentation · Knowledge Base · Blog/Articles · **Status** · Legal
  (Terms/Privacy) · Partners · Contact.
- **SEO surface**: per-tenant `<title>`/meta/OpenGraph/structured-data (JSON-LD) + generated `robots.txt` +
  `sitemap.xml`.

**Deliverables:** `TenantSite` shell + router (public paths), hostname→tenant resolver, page components reading
CMS content, SEO head manager, robots/sitemap generation. **Files affected:** `src/App.tsx` (pre-auth branch),
`index.html` (tenant-driven head), new `src/features/website/*` (shell + pages + SEO). **Dependencies:** Phase 0
(tenant + defaults), Phase 2 (content), Phase 3 (tokens). **Reuse:** `applyDesign` tokens, tenant brand, CMS
content, i18n, Integration Center (analytics), Media Library. **Risk:** Medium (adds a pre-auth route — guarded
so authenticated flows are untouched). **Rollback:** feature-flag the public layer (`website_enabled`);
disabling restores the login-first SPA exactly. **Completion:** visiting the marketing host (unauthenticated)
renders the tenant's branded multi-page site with working audience CTAs into the apps. **Production
verification:** public site renders per tenant; SEO head correct; CTAs reach the apps; 0 console errors; prod
SHA == commit.

---

## PHASE 2 — White Label Website Engine  (extend the CMS, no new CMS)

**Current:** `experience.service` = draft/publish/**version/rollback**, keyed `country:screen`, media-aware.
**Plan:** add a **`website` content type** to `experienceTypes` and extend the store key to include **tenant**
(`tenant:website`). Editable content set: Hero · Sections · Features · Screenshots · Pricing · FAQ · Blog ·
Articles · Downloads · App-Store/Google-Play links · Policies · Terms · Contact · Footer · Navigation · SEO ·
OpenGraph · Structured Data · Robots · Sitemap. **Every tenant owns a website automatically** (Phase 0 seeds a
default `website` set on activation); editing is **from Admin, no code**.

**Deliverables:** `website` schema in `experienceTypes`; `experience.service` website read/publish/version per
tenant; a **Website tab** in `TenantWorkspace` + Website mode in `ExperienceBuilder` (reuse the editor pattern +
`MediaRenderer`/`MediaPicker`). **Files affected:** `experience/experienceTypes.ts`,
`experience/experience.service.ts`, `features/admin/ExperienceBuilder.tsx`,
`features/admin/workspaces/TenantWorkspace.tsx`. **Dependencies:** Phase 0. **Reuse:** the **entire** existing
CMS infra (versioning/rollback/media) — no second CMS. **Risk:** Low-Medium (additive content type; existing
splash/login/onboarding types untouched). **Rollback:** website type is isolated; remove it without touching
existing screen types. **Completion:** edit hero/pricing/FAQ in Admin → Publish → live on the tenant site →
Rollback restores prior version. **Production verification:** publish+rollback round-trip on the website type;
per-tenant isolation; prod SHA == commit.

---

## PHASE 3 — Design Center Extension  (extend, no new theme engine)

**Current:** `DesignConfig` + `applyDesign` (40+ `:root` vars) + `DesignCenter` (9 sections, draft/publish/
preview). **Plan:** add a **`website` token group** to `DesignConfig` (hero style/height/overlay, section
spacing/width, web typography scale, nav/footer style, web animations) → matching `applyDesign` `--web-*`
vars consumed by `TenantSite`. Add **one "Website" panel** to `DesignCenter`. Website inherits the *same*
colors/typography/spacing/buttons/cards/animations/glass/brand/icons/dark/RTL/LTR — because it reads the same
`:root`. **Files affected:** `design/designSystem.ts`, `features/admin/DesignCenter.tsx`. **Dependencies:**
none (additive); consumed by Phases 1–2. **Reuse:** the one theme engine. **Risk:** Low (additive, backward-
compatible defaults = no visual change until edited). **Rollback:** remove the additive fields/panel; existing
tokens unaffected. **Completion:** changing a website token in Design Center re-styles the site live (`:root`).
**Production verification:** token edit cascades to the site; apps unchanged; prod SHA == commit.

---

## PHASE 4 — Driver App Premium Experience  (extend the existing 705-line app)
**Current:** premium already (4 tabs, real device signals, SVG map, rings, FAB, no emoji). **Plan (enhance to
Uber/Careem/Talabat parity):** draggable **active-trip bottom sheet**, premium **trip cards** + **task queue**,
refined **earnings/wallet**, polished **online/offline** switch, status-driven map. **Files affected:**
`features/driver/DriverApp.tsx`, `DriverOpsPanel.tsx`, inline `DriverMiniMap`, shared `Icon`. **Dependencies:**
benefits from Phase 5 (map). **Reuse:** existing component + hooks + tokens. **Risk:** Medium (high-traffic
screen — incremental, behind the same tabs). **Rollback:** per-component; revert the diff. **Completion:** full
trip lifecycle via the new bottom sheet; earnings/queue premium; 0 console errors across the driver flow.
**Production verification:** driver lifecycle runtime-verified; 0 errors; prod SHA == commit.

## PHASE 5 — Maps  (enhance existing two engines)
**Plan:** clustering, selection, filtering, smoother interpolated movement, richer vehicle icons, consistent
status colors, routing polish — on `OpsSvgMap` (SVG, key-free) + `OrderTrackingMap` (Google) + `DriverMiniMap`.
**Files:** `features/admin/OpsSvgMap.tsx`, `features/orders/OrderTrackingMap.tsx`, `DriverMiniMap` (in
DriverApp), `OperationsCommandCenter.tsx`. **Dependencies:** none. **Reuse:** the existing maps. **Risk:**
Low-Medium. **Rollback:** per-component. **Completion:** clustering+selection+filtering work; movement smooth.
**Production verification:** OCC + driver + tracking maps render enhanced; 0 errors; prod SHA == commit.

## PHASE 6 — Customer App Polish  (review-only)
**Plan:** spacing/hierarchy/micro-interactions/skeletons/bottom-nav active indicator/safe-areas/type/cards/
buttons. **Files:** the 8 customer screens + `App.tsx` bottom nav. **Risk:** Low. **Rollback:** per-screen.
**Completion:** premium feel, no overflow, 0 errors. **Production verification:** UI pass across viewports.

## PHASE 7 — Merchant Portal Polish  (review-only)
**Plan:** hierarchy/tables/charts/cards/stats/inventory+financial UX. **Files:** the 5 merchant files. **Risk:**
Low. **Rollback:** per-file. **Completion:** clean tables/charts; 0 errors. **Production verification:** UI pass.

---

## Execution order + technical justification (revised, final)
**Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7**

1. **Phase 0 (Commercial Foundation) first** — nothing can be *sold* or *provisioned* without tenant +
   subscription + defaults. Every later phase reads tenant/subscription/feature-flags this phase produces. It
   has **no upstream dependency**, so it unblocks everything.
2. **Phase 1 (Website Platform) before 2/3** *as scaffolding* — the public route + tenant resolver + page shell
   must exist for the content (2) and tokens (3) to have a surface to render into. *(Build order nuance: land
   the shell behind a feature flag, then fill content/tokens — so 1 ships dark, 2+3 light it up.)*
3. **Phase 2 (Website Engine) before 3** — content structure defines which tokens matter; the CMS website type
   is the data the Design Center website panel will style.
4. **Phase 3 (Design Center Extension)** — styles the now-existing site content; additive tokens, lowest risk,
   so it lands after the surface+content are real.
5. **Phase 4 (Driver) before 5 (Maps)?** — Driver is the highest *product* priority and is self-contained, but
   it consumes the map. We sequence **4 then 5** because the driver bottom-sheet/trip work defines what the map
   must show; map polish (5) then completes the driver + OCC experience. *(If map regressions are a concern,
   5 can precede 4 — both are isolated.)*
6. **Phases 6–7 (Customer/Merchant polish) last** — pure review-only refinement, zero architectural risk, best
   done once the platform/website/driver work is stable so polish targets the final layout.

> Net: **commercial foundation → sellable website stack → flagship apps → polish.** Foundation-up by
> dependency, priority-weighted within independent tiers.

## Global rollback & safety
- Every phase is **additive + feature-flagged** where it touches a live surface (website layer, tenant
  lifecycle). Disabling the flag restores prior behavior exactly.
- Design Center + White Label remain **backward-compatible** (default values = no visual change until edited).
- Each phase ships through the gate: **typecheck 0 · lint 0 · build ✓ · E2E 24/24 · runtime verify · commit →
  push → deploy → `version.json` == commit**, and is runtime-verified before the next.

**This is the final architecture document. STOP. No implementation until approved.**
