# Productization Master Plan

Goal: make HAAT NOW a commercial, sellable SaaS — by **extending** existing architecture only. Built from
direct inspection. **No implementation in this document** — awaiting approval before any code change.

## Reuse anchors (the foundation every phase builds on — never duplicated)
| Capability | Existing implementation | Phases that reuse it |
|---|---|---|
| **Theme / design tokens** | `src/design/designSystem.ts` (`DesignConfig`, `applyDesign`→`:root`, `mergeDesign`) + `DesignContext` + `DesignCenter.tsx` | 1, 2, 3 |
| **Per-tenant brand** | `src/services/tenant.service.ts` (`tenantTheme`/`applyTheme`/`saveBranding`) + `TenantWorkspace.tsx` Brand Manager (logos, colors, typography, domain, package/bundle, store-metadata, feature flags, templates) | 1, 2 |
| **Content engine (CMS)** | `src/experience/experience.service.ts` + `experienceTypes.ts` + `ExperienceBuilder.tsx` + `MediaRenderer`/`MediaPicker` — draft/publish/**version/rollback**, per-country, media-aware | 1, 2 |
| **Provider registry** | `src/platform/platform.service.ts` (Integration Center) — analytics/SEO providers | 1, 2 |
| **Permissions** | `src/services/rbac.service.ts` + `useRbac`/`<Can>` | 2, 3 |
| **i18n / RTL** | `AppConfigContext` + i18next (AR/EN) | 1, 4, 6 |
| **Maps** | `OpsSvgMap.tsx` (SVG sim), `OrderTrackingMap.tsx` (Google Maps), `DriverMiniMap` (in DriverApp) | 7 |

---

## PHASE 1 — Website Platform Integration  (architecture)
**Current:** No public website. `src/App.tsx` (888 lines) is a login-walled SPA: `splash → onboarding →
auth-wall → role routing (customer/merchant/driver/admin)`. `MarketplaceHero` is the *authenticated* home
hero, not a landing page. No public/SEO/blog routes.
**Plan (no code yet):** the website becomes **another presentation layer of the same app** — an
**unauthenticated public surface** rendered *before* the auth wall in `App.tsx`. When there is no session and
the request is the marketing entry (root path / marketing hostname), render `<MarketingSite tenant=…>` that
**consumes the same** `applyDesign` tokens, `tenant.service` brand, and `experience`-CMS content. Tenant
resolved by **hostname/subdomain** (the `custom_domain`/`subdomain` already on the tenant record). A
"Order now / Login" CTA crosses into the existing app — one codebase, one session model.
**Files involved:** `src/App.tsx` (add the pre-auth public branch), `index.html` (SEO meta already present —
make it tenant-driven), + the new renderer (Phase 2).
**Reuse / no-duplication:** zero new theme/brand/CMS/auth. The public layer is a *consumer* of existing
engines. **Estimated impact:** Medium effort, high commercial value (turns the platform into a sellable site).

## PHASE 2 — White Label Website Engine
**Current:** `experience.service` already does draft/publish/version per country for splash/login/onboarding;
`tenant.service` already stores brand identity + domain + store metadata + feature flags + templates.
**Plan:** extend `experienceTypes` with a **`website` content set** — `hero`, `sections[]` (feature/
screenshot/steps), `pricing`, `faq[]`, `policies` (privacy/terms), `contact`, `social[]`, `downloadLinks`,
`blog[]` — and key it per **tenant** (extend the store key from `country:screen` to include tenant). Reuse the
**same** `experience.service` publish/version/rollback + `MediaRenderer` for media. Brand (logo/colors/
typography/domain) comes from the **existing** `tenant.service` Brand Manager; SEO (title/description/og) from
the tenant store-metadata already added. A single `<MarketingSite>` renderer reads `{brand, theme, website
content}` and renders hero/sections/pricing/FAQ/footer.
**Editable from Admin (no code editing):** extend **`TenantWorkspace`** with a **"Website"** tab and extend
**`ExperienceBuilder`** to edit the `website` content set (same editor pattern). 
**Files involved:** `experienceTypes.ts`, `experience.service.ts`, `ExperienceBuilder.tsx`,
`tenant.service.ts`, `TenantWorkspace.tsx`, new `MarketingSite.tsx` (+ section components).
**Reuse / no-duplication:** **no second CMS, no second branding system** — website content is a new *type*
inside the existing CMS; brand is the existing tenant model. **Impact:** High effort, the core sellable feature.

## PHASE 3 — Design Center Extension
**Current:** `DesignConfig` covers colors/glass/typography/cards/buttons/icons/layout/animations/branding;
`applyDesign` writes 40+ `:root` vars; `DesignCenter.tsx` edits 9 sections with draft/publish + preview.
**Plan:** **extend `DesignConfig`** with a `website` group — `hero` (style/height/overlay), `sections`
(spacing/width), `webTypography` (display/heading/body scale for marketing), `nav`/`footer` style,
`webAnimations` — and add matching `applyDesign` `setProperty` calls (new `--web-*` vars consumed by
`MarketingSite`). Add **one "Website" panel** to `DesignCenter.tsx`. 
**Files involved:** `designSystem.ts` (interface + defaults + `applyDesign`), `DesignContext.tsx` (unchanged),
`DesignCenter.tsx` (new panel).
**Reuse / no-duplication:** **NOT another branding system** — same `DesignConfig`/`applyDesign` engine,
additive fields (backward-compatible defaults). **Impact:** Low-medium effort; unlocks all website visual editing.

## PHASE 4 — Customer App Polish  (review-only, no redesign)
**Current:** 8 screens (home 544 / restaurant 529 / checkout 973 / orders 765 / wallet 370 / profile 1156 /
discover 192 / hero 130), glass cards, bottom nav in `App.tsx`, lucide icons, safe-area insets.
**Plan:** targeted polish only — spacing rhythm, type hierarchy, micro-interactions (press states), skeleton
loaders, bottom-nav **active indicator**, safe-area audit, card/button consistency. **No architecture change.**
**Files:** the 8 screens + `App.tsx` bottom nav. **Reuse:** existing tokens. **Impact:** Low effort, premium feel.

## PHASE 5 — Merchant Portal Polish  (review-only)
**Current:** `MerchantApp` (1218, 9 tabs), `KitchenQueue` (104), `StoreManagement` (152),
`MerchantWalletCenter` (78), `MerchantReports` (162, charts).
**Plan:** visual hierarchy, table density/readability, chart styling, stat cards, inventory +/- UX, financial
clarity — **no architecture change.** **Files:** the 5 merchant files. **Impact:** Low-medium effort.

## PHASE 6 — Driver App Premium Enhancement  (HIGHEST PRIORITY — extend, do not replace)
**Current:** `DriverApp.tsx` (705) is already premium — 4 tabs (home/trip/earnings/profile), online/offline
pill with **real device signals** (WiFi/GPS/battery/shift timer), glass cards, SVG progress rings,
`DriverMiniMap` (pure-SVG animated), FAB speed-dial, bottom nav, `useCountUp`/`useDeviceLive`/`useShift`,
real GPS lifecycle, **no emoji** (lucide + Material Symbols). 
**Plan (enhance to Uber/Careem/Talabat parity — extend the existing component):**
- **Active-trip bottom sheet** (draggable) replacing the inline trip card — pickup/dropoff, customer call,
  navigate, swipe-to-advance through the lifecycle.
- **Premium trip cards** + **task queue** (stacked next-orders) on Home.
- **Refined earnings/wallet** (period selectors, payout CTA, breakdown bars).
- **Online/offline switch** polish (the marquee control) + status-driven map.
- Enhanced `DriverMiniMap` (handed to Phase 7).
**Files:** `DriverApp.tsx`, `DriverOpsPanel.tsx`, the inline `DriverMiniMap`, shared `Icon`. 
**Reuse / no-duplication:** extend the existing 705-line component + hooks; **no new driver module.**
**Impact:** High effort, highest commercial signal (the captain app is the demo centerpiece).

## PHASE 7 — Map Experience  (enhance existing)
**Current:** `OpsSvgMap` (178; 14-driver sim, vehicle-shape markers, status colors, heat zones, animated
dashed routes, layer toggles, lat/lng projection), `OrderTrackingMap` (85; Google Maps, driver/customer
markers, route, ETA, realtime+poll), `DriverMiniMap` (in DriverApp).
**Plan:** enhance these — **marker clustering** at zoom-out, **selection** (tap a driver → detail), **filtering**
(by status/vehicle), smoother **animated movement** (interpolation), richer **vehicle icons**, consistent
**status colors**, optional routing polish. SVG path stays key-free; Google path used when keyed.
**Files:** `OpsSvgMap.tsx`, `OrderTrackingMap.tsx`, `DriverMiniMap` (in `DriverApp.tsx`),
`OperationsCommandCenter.tsx`. **Reuse / no-duplication:** enhance the existing two map engines; **no third map.**
**Impact:** Medium effort, strong enterprise polish.

---

## Recommended execution order
1. **Phase 8 (this plan) → approval.**
2. **Phase 6 Driver App** — highest priority, self-contained, biggest visible win.
3. **Phase 7 Map** — supports the driver app + OCC.
4. **Phase 3 Design Center website tokens** — foundation for the website stack.
5. **Phase 2 Website engine** (content type + per-tenant editing) on the extended Design Center + CMS.
6. **Phase 1 Website integration** — public pre-auth route renders `<MarketingSite>`.
7. **Phase 4 Customer polish**, then **Phase 5 Merchant polish**.

Each phase ships through the standard gate (typecheck/lint/build/E2E + runtime verify + commit/push/deploy +
version.json) and is runtime-verified before the next. Design Center + White Label engines stay
backward-compatible (additive only).

## No-duplication guarantees (global)
- One theme engine (`designSystem`/`applyDesign`); website tokens are additive fields.
- One brand model (`tenant.service`); the website reads it, never re-stores brand.
- One CMS (`experience.service`); website content is a new content **type**, not a new service.
- One auth/session; the public website is a pre-auth presentation layer of the same app.
- One map approach per context (SVG sim / Google Maps); enhanced, not replaced.

**Awaiting approval. No implementation will begin until this plan is approved.**
