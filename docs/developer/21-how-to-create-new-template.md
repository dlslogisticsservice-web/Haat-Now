# 21 · How To: Create a New Template

> **Goal:** add a new business-template manifest to the Template Marketplace.
> **Read first:** [08-template-marketplace.md](08-template-marketplace.md) · [09-provisioning-engine.md](09-provisioning-engine.md).

## Purpose
A "template" is a **declarative manifest** describing how a tenant of a given vertical should be provisioned. You
add data, not code — the engine already knows how to apply every generic field.

## Architecture recap
```
new TemplateManifest (data)  ──toSpec()──▶  ProvisionSpec (generic)  ──provision()──▶  configured tenant
   persisted in haat_crud_templates
```
Owned by [`src/services/templates.service.ts`](../../src/services/templates.service.ts); managed in
[`TemplateMarketplace.tsx`](../../src/features/admin/TemplateMarketplace.tsx).

## Flow: step by step
1. **Pick/prepare the theme preset** the template uses (Design Center → save preset, or reuse a system preset).
   You need its `theme_preset_id` ([24-how-to-create-new-theme.md](24-how-to-create-new-theme.md)).
2. **Author the manifest** (via the Marketplace UI, or seeded in `templates.service`):
   ```ts
   const manifest: TemplateManifest = {
     id: 'bakery', name: 'Bakery', version: 1, vertical: 'bakery',
     theme_preset_id: 'preset_warm',
     brand_defaults: { primary_color: '#C8873B', support_email: 'help@bakery.example', app_name: 'Bakery' },
     cms_structure: { pages: ['home', 'menu', 'about', 'contact'] },
     navigation: ['home', 'orders', 'wallet', 'profile'],
     roles: ['owner', 'staff'], permissions: ['orders.view', 'orders.manage', 'catalog.categories.manage'],
     integrations: ['maps'], plan: 'starter', demo_data_profile: 'bakery',
   };
   ```
3. **Validate + preview:** `templatesService.validate(manifest)` then `preview(manifest)` in the Marketplace.
4. **Save:** persists to `haat_crud_templates` (with versioning).
5. **Assign to a tenant:** `assignToTenant(tenantId)` → `toSpec()` → `provision()`.
6. **Gate:** ensure any listed `permissions` exist in `rbac.service` ([16-rbac.md](16-rbac.md)); any
   `integrations` exist in the provider catalog ([15-integration-center.md](15-integration-center.md)).

## Dependencies
- `templates.service` (author/validate/version), `themePresets.service` (the preset), `subscription.service`
  (plan key), `provisioning.service` (applies the derived spec), `rbac.service` (permissions).

## Extension points
- If a manifest needs a field the spec can't express, add a **generic** field to `ProvisionSpec` + a generic
  engine step — never a vertical branch in the engine.

## Reuse rules
- Manifest = pure data. No provisioning/theme/subscription logic in it.
- Reference existing presets/plans/permissions/providers; don't invent parallel ones.

## Files involved
- [`src/services/templates.service.ts`](../../src/services/templates.service.ts) ·
  [`src/features/admin/TemplateMarketplace.tsx`](../../src/features/admin/TemplateMarketplace.tsx) ·
  [`src/services/provisioning.service.ts`](../../src/services/provisioning.service.ts).

## Do's
- ✅ Reuse a theme preset + an existing plan + existing permissions. ✅ Version the manifest. ✅ Validate before
  assigning.

## Don'ts
- ❌ Don't put `if (vertical === …)` logic in the engine. ❌ Don't reference a preset/plan/permission/provider
  that doesn't exist. ❌ Don't add billing.

## Example (end to end)
```ts
templatesService.save(manifest);                                   // 1. persist
const spec = templatesService.toSpec(manifest, { brand_name: 'Cairo Bakery', slug: 'cairo-bakery' });
await provisioningService.provision(spec);                         // 2. stand up the tenant
```

## Next
[22-how-to-create-new-industry.md](22-how-to-create-new-industry.md)
