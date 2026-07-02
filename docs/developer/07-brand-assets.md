# 07 · Brand Assets

> **Audience:** developers working on per-tenant branding (logos, favicon, splash, media library).

## Purpose
Manage the visual identity assets a brand/tenant uses — app logo, dark/light logos, splash, favicon — plus a
reusable media/asset library. These feed the theme engine's `branding` tokens and the tenant record.

## Architecture
Two cooperating pieces:
1. **Brand fields on the design/tenant config** — `DesignConfig.branding` (`appLogo`, `splashLogo`, `favicon`,
   `darkLogo`, `lightLogo`) and the equivalent flat fields on a tenant (`logo_url`, `dark_logo_url`,
   `light_logo_url`, `splash_url`, `favicon_url`). `tenant.service.tenantTheme()` maps tenant fields →
   `branding` tokens.
2. **Media/asset library** — [`src/experience/assets.service.ts`](../../src/experience/assets.service.ts)
   indexes uploaded media (backed by Supabase Storage in live mode). UI: `AssetsManager.tsx` (library) and
   `BrandAssetsPanel.tsx` (per-tenant brand assets, Phase 0.3).

```
Upload → assets.service (media library) → asset URL
                                            └▶ set on tenant brand field (logo_url, …)
                                                 └▶ tenantTheme() → DesignConfig.branding → applyDesign() → UI
```

## Flow: setting a tenant's logo
```
Admin → Tenant Control Center → Brand Assets tab
  → pick/upload asset (AssetsManager / MediaPicker) → assets.service stores + returns URL
  → tenant.service.saveBranding(id, { logo_url }) → logs tenant_branding_updated
  → tenant.service.applyTheme(tenant) → applyDesign(tenantTheme) → logo appears across surfaces
```

## Dependencies
- `assets.service` (media library) · `storage.service` (raw image upload to Supabase Storage) ·
  `tenant.service` (brand fields + theme apply) · `designSystem` (branding tokens).
- Registry note: `storage.service` (raw uploads) and `assets.service` (library index) are a **WATCH** merge
  candidate — keep them distinct for now (see [SERVICE_REGISTRY.md](../governance/SERVICE_REGISTRY.md)).

## Extension points
- **New asset kind** (e.g. `email_header_url`) → add the flat field to the tenant record + a `branding` token in
  `DesignConfig` (default empty) + map it in `tenantTheme()`.
- **New asset source** → extend `assets.service`; do not add a second media store.

## Reuse rules
- Brand assets flow into the UI **only** through the theme engine's `branding` tokens — never hardcode a logo
  `<img src>` per surface.
- Store asset **URLs** on the tenant, not binary blobs.

## Files involved
- [`src/experience/assets.service.ts`](../../src/experience/assets.service.ts) ·
  [`src/features/admin/AssetsManager.tsx`](../../src/features/admin/AssetsManager.tsx) ·
  [`src/features/admin/BrandAssetsPanel.tsx`](../../src/features/admin/BrandAssetsPanel.tsx) ·
  [`src/components/brand/BrandLogo.tsx`](../../src/components/brand/BrandLogo.tsx) ·
  [`src/services/storage.service.ts`](../../src/services/storage.service.ts) ·
  [`src/services/tenant.service.ts`](../../src/services/tenant.service.ts) (`saveBranding`, `tenantTheme`).

## Do's
- ✅ Use `<BrandLogo>` and `var(--…)` branding tokens so logos follow the active tenant/theme.
- ✅ Upload via `assets.service`/`storage.service`; persist the returned URL on the tenant.

## Don'ts
- ❌ Don't hardcode a logo path in a component. ❌ Don't store images in `localStorage` blobs.
- ❌ Don't add a parallel media store.

## Example
```ts
// Persist a new tenant logo and re-skin live:
await tenantService.saveBranding(tenant.id, { logo_url: uploadedUrl });
tenantService.applyTheme({ ...tenant, logo_url: uploadedUrl });
```

## Next
[06-theme-engine.md](06-theme-engine.md) · [12-white-label.md](12-white-label.md)
