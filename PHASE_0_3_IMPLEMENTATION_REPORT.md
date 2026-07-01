# Phase 0.3 — Brand Asset Manager · Implementation Report

Implemented exactly per `PRODUCTIZATION_MASTER_PLAN_V2` §D (Brand Asset Manager). Extend-only: reused the
existing `assets.service` + upload/storage pipeline and `tenant.service`. **No `BrandManager2`/`AssetStore2`,
no second upload system.** Ran the full `IMPLEMENTATION_STANDARD.md` Definition of Done.

## Implementation constraint honored — Brand ⊥ Theme (loosely coupled)
- Brand assets (Logo/SVG/PNG/Favicon/App Icon/Splash/Invoice Logo/Email Header/Social Banner/Brand Images)
  are the **Brand** domain only. **Zero dependency on Theme Presets.**
- Verified by static check: `BrandAssetsPanel.tsx` and the `assets.service` brand additions import **no**
  `themePresets`/`designSystem`/design code. Theme Presets likewise never import assets. Relationship stays
  loosely coupled — brand assets are plain URLs on the tenant record, independent of any theme.

## Files changed
- **Extended:** `src/experience/assets.service.ts` — added the `BrandSlot` type + `BRAND_SLOTS` taxonomy
  (10 slots, each mapping to a tenant brand field + an asset category). No change to the upload/storage
  pipeline — it is reused as-is.
- **New:** `src/features/admin/BrandAssetsPanel.tsx` — per-tenant brand-slot manager (component, not a service).
  Reuses `assetsService.upload` (the ONE pipeline) + `tenant.service.saveBranding`. RBAC-gated.
- **Extended:** `src/features/admin/workspaces/TenantWorkspace.tsx` — added a **"Brand Assets" (أصول العلامة)**
  tab that renders the panel.
- No new service ⇒ no new `SERVICE_REGISTRY.md` row required (governance §7); `assets.service` extension is
  additive to an existing registered service.

## Reuse proof (no duplication)
- **`assets.service` upload/storage/asset pipeline** — brand uploads call `assetsService.upload(file, category)`
  (sandbox → data URL, prod → `experience-assets` bucket + CDN). No new upload/storage code.
- **`tenant.service`** — assets persist to tenant brand fields via `saveBranding` (the existing tenant store).
- **RBAC** — upload + save gated by `<Can perm="platform.whitelabel.manage">`.
- **AssetsManager library** — same `assets.service` index (`haat_sb_experience_assets_v1`) is reused for
  uploaded assets; no parallel index.

## Brand slots (10) + tenant fields
Logo→`logo_url` · SVG→`svg_url` · PNG→`png_url` · Favicon→`favicon_url` · App Icon→`app_icon_url` ·
Splash→`splash_url` · Invoice Logo→`invoice_logo_url` · Email Header→`email_header_url` · Social Banner→
`social_banner_url` · Brand Image→`brand_image_url`. (New fields: svg/png/invoice_logo/email_header/
social_banner/brand_image; the rest already existed on the tenant.) Consumed by White-Label + Website +
Email/PDF/Invoice surfaces that read the tenant brand fields.

## Runtime verification (real UI)
- Open tenant → **Brand Assets** tab → **10 slots render** (`#brandslot_*`).
- Set slot values (logo + the NEW `email_header` + `social_banner`, and `invoice_logo` via a data URL) →
  **Save** → tenant record persisted all three/four fields (existing + new).
- **Persistence:** survives reload (marked tenant retains the URLs).
- **Upload path:** realistic path uses data URLs (sandbox) / CDN (prod) — verified **0 console errors** with a
  data-URL asset (the earlier `ERR_NAME_NOT_RESOLVED` entries were only fake external test URLs failing to
  load in the preview `<img>`, not app errors).
- **RBAC:** acting role = Driver → Upload + Save controls hidden; Super Admin → visible.

## Persistence verification
Brand fields persist on the tenant record (`haat_crud_tenants`) via `tenant.service.saveBranding`; uploaded
assets index in `haat_sb_experience_assets_v1` (existing store). All survive reload.

## Production verification
Typecheck 0 · Lint 0 · Build ✓ · E2E 24/24 · runtime + persistence + RBAC verified · 0 console errors
(realistic path). Deployed via the git workflow; production verified via Vercel `version.json` == merged commit
(GitHub Actions API rate-limited → gated on local CI-equivalent per IMPLEMENTATION_STANDARD §5).

## Remaining blockers
- None for the Brand Asset Manager. Email/Invoice/PDF **rendering** of the new headers/logos arrives with those
  surfaces (email delivery is credential-gated; PDF/invoice generation is a later sprint) — the fields are
  stored + ready. Payment Rule unaffected.

**Phase 0.3 complete, deployed, production-verified. Stopping.**
