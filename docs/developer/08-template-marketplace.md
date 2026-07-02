# 08 · Template Marketplace

> **Audience:** developers adding or changing business templates (verticals).
> **Key principle:** business knowledge lives in **declarative manifests here**, never in the provisioning
> engine.

## Purpose
Provide a catalog of **business-template manifests** — one per vertical (Restaurant, Pharmacy, Courier, …) — that
describe how a tenant of that type should be provisioned: theme preset, brand defaults, CMS structure,
navigation, roles/permissions, integrations, subscription plan, demo-data profile. A manifest is **pure data**;
the marketplace maps it to the generic `ProvisionSpec` the [Provisioning Engine](09-provisioning-engine.md)
consumes.

## Architecture
```
TemplateManifest (declarative data)  ──templates.service.toSpec(manifest, overrides)──▶  ProvisionSpec (generic)
        │                                                                                        │
        │ CRUD / version / import-export / validate / preview / assign                           ▼
        └── persisted in haat_crud_templates                                        provisioning.service.provision()
```
- [`src/services/templates.service.ts`](../../src/services/templates.service.ts) (Phase 0.5) — 10 seeded
  manifests (Restaurant/Food Delivery/Courier/Pharmacy/Supermarket/Flowers/Laundry/Luxury/Corporate/Minimal);
  CRUD + versioning + import/export + `validate` + `preview` + `toSpec()` + `assignToTenant`.
- [`src/features/admin/TemplateMarketplace.tsx`](../../src/features/admin/TemplateMarketplace.tsx) — the admin UI.
- A `TemplateManifest` carries: `vertical`, `theme_preset_id`, `brand_defaults`, `cms_structure.pages`,
  `navigation`, `roles`/`permissions`, `integrations`, plan, `demo_data_profile`.

**Subscription note:** `subscription.service` (Phase 0.1) owns plans/trials/limits/usage — a manifest only
references a plan key; it never charges (Payment Rule).

## Flow: applying a template to a tenant
```
Admin → Template Marketplace → pick manifest → assignToTenant(tenantId)
   templates.service.toSpec(manifest, overrides)  → generic ProvisionSpec
   provisioning.service.provision(spec)            → sequences existing services (theme/brand/rbac/subscription/cms/…)
   result: a fully-configured tenant, audited in operation_events
```

## Dependencies
- `provisioning.service` (receives the derived spec — never imports templates back), `themePresets.service`
  (validate the referenced preset), `subscription.service` (validate the plan), `admin-crud` (persistence).

## Extension points
- **New vertical/template** → author a new `TemplateManifest` (data) — see
  [21-how-to-create-new-template.md](21-how-to-create-new-template.md) and
  [22-how-to-create-new-industry.md](22-how-to-create-new-industry.md).
- **New manifest field** → add to `TemplateManifest` + map it into `toSpec()` (which sets a generic spec field).

## Reuse rules
- **Business knowledge = manifests only.** Never add vertical `if (vertical === 'pharmacy')` logic to the
  provisioning engine. If the engine can't express a manifest field generically, add a **generic** spec field,
  not a vertical branch.
- Reuse the engine's `provision()`; the marketplace never provisions directly.

## Files involved
- [`src/services/templates.service.ts`](../../src/services/templates.service.ts) ·
  [`src/features/admin/TemplateMarketplace.tsx`](../../src/features/admin/TemplateMarketplace.tsx) ·
  [`src/services/provisioning.service.ts`](../../src/services/provisioning.service.ts) (`ProvisionSpec`).

## Do's
- ✅ Encode a new vertical as a manifest. ✅ Version manifests; use `validate`/`preview` before assigning.
- ✅ Keep `toSpec()` a pure mapping.

## Don'ts
- ❌ Don't put vertical logic in the engine. ❌ Don't let the engine import `templates.service`.
- ❌ Don't add billing to a manifest.

## Example
```ts
// Assign the Pharmacy template to a tenant:
const manifest = templatesService.get('pharmacy');
const spec = templatesService.toSpec(manifest, { brand_name: 'Nile Pharma', slug: 'nile-pharma' });
await provisioningService.provision(spec);
```

## Next
[09-provisioning-engine.md](09-provisioning-engine.md) · [22-how-to-create-new-industry.md](22-how-to-create-new-industry.md)
