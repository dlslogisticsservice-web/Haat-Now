# 12 · White-Label

> **Audience:** developers working on multi-brand / white-label capabilities.
> **Frozen:** the White-Label engine is a frozen system — extend via config, not by rewriting the engine.

## Purpose
Let one codebase serve many branded tenants, each with its own identity (theme, logos, colors, fonts), features,
subscription, and domain — with **zero per-surface code changes** when a brand changes.

## Architecture: the config spine
```
tenant record  (the config spine — tenant.service / haat_crud_tenants)
   ├─ brand/theme:  theme_preset_id + flat overrides (primary_color, logo_url, …)
   ├─ subscription: plan, sub_status, trial_ends_at            (subscription.service)
   ├─ features:     feature flags                              (per-tenant capability)
   ├─ permissions:  roles/permissions                          (rbac.service)
   └─ website/cms:  screen experiences                         (experience.service)
        │
        ▼  tenant.service.applyTheme(tenant) → applyDesign(tenantTheme(tenant))
   40+ CSS vars on :root → EVERY surface re-skins to this brand — no per-surface edit
```
The tenant record is the **spine**: brand/theme/subscription/features/website/permissions all hang off it and are
consumed by every surface. The White-Label magic is the theme cascade ([06-theme-engine.md](06-theme-engine.md)):
one `applyDesign()` call re-skins the whole app.

## Flow: standing up a branded tenant
```
Template Marketplace / Onboarding Wizard → Provisioning Engine
   → tenant.service.provision(spec)           (creates the spine record)
   → theme/brand/subscription/roles/cms steps (fill the spine, reusing each owning service)
   → tenant.service.applyTheme(tenant)        (brand goes live across surfaces)
```

## Dependencies
- `tenant.service` (spine + theme apply) · `designSystem`/`themePresets` (look) · `subscription.service` (plan) ·
  `rbac.service` (permissions) · `experience.service` (website/CMS) · `platform.service` (integrations).
- Managed in the UI via the [Tenant Control Center](11-tenant-control-center.md) and provisioned via the
  [Provisioning Engine](09-provisioning-engine.md).

## Extension points
- **New brandable property** → add a field to the tenant record + map it into `tenantTheme()` (if visual) or the
  relevant service. Additive, default = current behavior.
- **New white-label capability** → see [25-how-to-create-new-white-label.md](25-how-to-create-new-white-label.md).

## Reuse rules
- Everything brandable flows through the **tenant record + theme engine**. Never fork a surface per brand.
- A tenant stores a **preset id + overrides**, never a full theme copy.
- Reuse the provisioning engine to stand up tenants; don't hand-roll tenant setup.

## Files involved
- [`src/services/tenant.service.ts`](../../src/services/tenant.service.ts) (`tenantTheme`, `applyTheme`,
  lifecycle) · [`src/design/designSystem.ts`](../../src/design/designSystem.ts) ·
  [`src/features/admin/workspaces/TenantWorkspace.tsx`](../../src/features/admin/workspaces/TenantWorkspace.tsx) ·
  [`src/features/admin/PlatformRegistry.tsx`](../../src/features/admin/PlatformRegistry.tsx).

## Do's
- ✅ Drive all branding from the tenant spine. ✅ Keep changes additive + backward compatible (default = today).
- ✅ Verify a brand change propagates to all four surfaces.

## Don'ts
- ❌ Don't branch UI per brand. ❌ Don't rewrite the White-Label/theme engine (frozen).
- ❌ Don't duplicate tenant config outside the tenant record.

## Example
```ts
// A brand goes live everywhere with one call:
tenantService.applyTheme(tenant);            // reads theme_preset_id + overrides → applyDesign → all surfaces
// Restore the default HAAT NOW brand:
tenantService.restoreDefaultTheme();
```

## Next
[13-cms.md](13-cms.md) · [18-multi-tenancy.md](18-multi-tenancy.md) ·
[25-how-to-create-new-white-label.md](25-how-to-create-new-white-label.md)
