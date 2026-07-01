# Phase 0.3 — Brand Asset Integration Report

End-to-end **runtime-consumption** verification (not persistence). Honest audit of whether each brand asset is
actually rendered by the platform, with the one integration fix applied. No new services, no asset-system
redesign — reused `assets.service` + the design/theme cascade + `useDesign`.

## Fix applied (the only code change)
- **`BrandLogo`** (`src/components/brand/BrandLogo.tsx`) — reads the published `branding.appLogo` (which maps
  from a tenant's brand Logo asset via the theme cascade) and renders it at runtime, with a fallback. Wired
  into **`AdminSidebar`** brand block. No new service; reuses the existing `useDesign` token.
- Confirmed **favicon** consumption (already wired: `applyDesign` sets `link[rel~='icon'].href` from
  `branding.favicon`).

## Runtime consumption verified (real proof)
| Asset | Source | Consumer (runtime) | Runtime proof | Screenshot |
|---|---|---|---|---|
| **4. Admin logo** | `branding.appLogo` ← tenant `logo_url` (theme cascade) | `AdminSidebar` via `BrandLogo` | Publishing a brand logo → `img[data-brand-logo]` src = the asset; unset → `Layers` fallback | `admin_brand_logo.png`, `admin_brand_fallback.png` |
| **8/9. Favicon / browser icon** | `branding.favicon` ← tenant `favicon_url` | `applyDesign` → `<link rel=icon>` | After publish, favicon `href` = the brand asset | (same run) |
| **13. White-Label tenant switching** | tenant record | `tenant.service.applyTheme` → `applyDesign` | Applying a tenant theme re-applies favicon + theme tokens to `:root` (verified in Phase 0.1/WL) | — |
| **14. Runtime replacement (no rebuild)** | design store publish | `DesignProvider` effect + `BrandLogo` | Publishing brand logo/favicon updates the UI on the next render with **no rebuild** | `admin_brand_logo.png` |
| **15. Fallback when missing** | — | `BrandLogo` / `applyDesign` guard | Empty `appLogo` → `Layers` icon (no `img`); `applyDesign` only sets favicon when set | `admin_brand_fallback.png` |

## Missing integrations (honest — NOT faked, NOT force-added as new features)
| # | Asset | Current source | Status | Why / recommended wiring |
|---|---|---|---|---|
| 1 | **Customer App logo** | — | **No runtime consumer** | The customer surface is a marketplace (hero + category grid) with **no platform-logo chrome**; its `logo_url` refs are *merchant* store logos, not the platform brand. Shared customer brand entry = splash/login (Experience engine). Adding a platform-logo bar = a new feature (out of scope). |
| 2 | **Driver App logo** | — | **No runtime consumer** | Driver chrome is icon-based (no platform-logo slot). Same note as #1. |
| 3 | **Merchant Portal logo** | merchant `logo_url` | **Merchant's own store logo IS consumed**; the *platform* brand logo is not | Merchant `logo_url` = the merchant's store logo (uploaded in store settings), correctly rendered — distinct from the tenant/platform brand. |
| 5 | **Website logo** | — | **N/A (surface not built)** | The public Website is Phase 1. The `BrandLogo` + brand fields are ready for it. |
| 6 | **Splash Screen** | Experience engine `cfg.media` | **Branded, but via the Experience engine**, not tenant `logo_url` | Splash renders `MediaRenderer(cfg.media)` from `experience.service` — a valid, separate brand surface. Wiring tenant brand Logo → the Experience default is a **Phase-1** experience/website integration. |
| 7 | **Login branding** | Experience engine `cfg.media`/`brandText` | Same as #6 | Same recommendation. |
| 10 | **Invoice logo** | tenant `invoice_logo_url` (stored) | **No render surface yet** | No invoice/receipt PDF is generated in-app; field stored + ready for the invoicing sprint. |
| 11 | **Email header** | tenant `email_header_url` (stored) | **No render surface yet** | No in-app email rendering; delivery is credential-gated. Field stored + ready. |
| 12 | **Social sharing image** | `index.html` OG/Twitter (static `/icons/icon-1024.png`) | **Static, not per-tenant** | Per-tenant OG images require SSR/edge meta (not possible in a static SPA build). `social_banner_url` stored; consumed when the Website (Phase 1, server-rendered meta) lands. |

## Summary
- **Genuinely consumed at runtime now:** Admin logo (fixed), Favicon, Theme tokens, tenant-theme apply,
  runtime replacement, fallback.
- **Stored + ready, no consumer surface yet:** Customer/Driver platform-logo chrome (no slot by design),
  Splash/Login (Experience-engine sourced), Invoice/Email (no render surface), Social OG (SSR-gated), Website
  (Phase 1). These are **honest gaps**, documented — not faked and not force-wired as new features.
- The Brand Asset **pipeline** (upload → tenant field → theme cascade → runtime render) is proven end-to-end
  on the Admin surface + favicon; the same `BrandLogo`/token path is ready to wire into Website + Experience
  surfaces when they arrive (Phase 1).

## Validation
Typecheck 0 · Lint 0 · Build ✓ · E2E 24/24 · runtime consumption verified (admin logo + favicon + fallback) ·
0 console errors. Screenshots in `docs/testing/e2e_shots/phase03_integration/`. No new services; asset system
reused, not redesigned. Deployed via the git workflow; production verified via `version.json` == commit.

**Verification complete. Stopping — Phase 0.4 not started.**
