# 22 · How To: Create a New Industry (Vertical)

> **Goal:** support a whole new business vertical (e.g. car-wash, home-services) end to end.
> **Read first:** [21-how-to-create-new-template.md](21-how-to-create-new-template.md) ·
> [08-template-marketplace.md](08-template-marketplace.md).

## Purpose
An "industry"/vertical is expressed as a **template manifest** plus the supporting building blocks it references
(theme preset, permissions, providers, CMS pages, demo data). Adding a vertical is composing existing engines via
declarative data — **not** adding vertical logic to any engine.

## Architecture: what a vertical is made of
```
Vertical  =  TemplateManifest (the spine)
             ├─ theme_preset_id      → themePresets.service        (look)          [doc 24]
             ├─ brand_defaults       → tenant brand fields         (identity)      [doc 07]
             ├─ cms_structure.pages  → experience.service          (content)       [doc 13]
             ├─ navigation           → surface nav                 (IA)
             ├─ roles/permissions    → rbac.service                (access)        [doc 16]
             ├─ integrations         → platform.service catalog    (providers)     [doc 15,23]
             ├─ plan                 → subscription.service         (commercial)    [doc 08]
             └─ demo_data_profile    → demo seeding                 (sample data)
```
The generic [Provisioning Engine](09-provisioning-engine.md) applies all of this — no per-vertical code.

## Flow: step by step
1. **Design the vertical on paper:** which theme, pages, nav, roles, permissions, providers, plan, and sample
   data it needs.
2. **Create/choose the theme preset** ([24](24-how-to-create-new-theme.md)).
3. **Add any missing permissions** to `rbac.service` ([16](16-rbac.md)) and any missing providers to the catalog
   ([23](23-how-to-create-new-provider.md)). Additive.
4. **Author the template manifest** referencing all of the above ([21](21-how-to-create-new-template.md)).
5. **Add a demo-data profile** (optional) so previews/onboarding show realistic content
   ([`src/services/demoSeed.ts`](../../src/services/demoSeed.ts)).
6. **Validate → preview → save → assign** via the Template Marketplace.
7. **Verify at runtime:** provision a test tenant, confirm theme, nav, permissions, and CMS pages all apply.

## Dependencies
- Every engine the manifest references: `themePresets`, `rbac`, `platform`, `subscription`, `experience`,
  `provisioning`, `templates`. Plus `demoSeed` for sample data.

## Extension points
- If the vertical needs a genuinely new capability the engines can't express, add it **generically** (a spec
  field + a generic step, a new permission, a new provider) — never a vertical branch.

## Reuse rules
- A vertical adds **data + additive building blocks**, not engine logic. The engine stays vertical-agnostic.
- Reuse existing presets/permissions/providers/plans wherever possible.

## Files involved
- [`src/services/templates.service.ts`](../../src/services/templates.service.ts) ·
  [`src/services/themePresets.service.ts`](../../src/services/themePresets.service.ts) ·
  [`src/services/rbac.service.ts`](../../src/services/rbac.service.ts) ·
  [`src/platform/platformModel.ts`](../../src/platform/platformModel.ts) ·
  [`src/services/demoSeed.ts`](../../src/services/demoSeed.ts) ·
  [`src/services/provisioning.service.ts`](../../src/services/provisioning.service.ts).

## Do's
- ✅ Compose existing engines through a manifest. ✅ Add missing permissions/providers additively.
- ✅ Verify a provisioned test tenant end to end.

## Don'ts
- ❌ Don't add vertical `if` branches to the provisioning engine or any service.
- ❌ Don't duplicate a theme/permission/provider that already exists. ❌ Don't skip runtime verification.

## Example
```
New "Car Wash" vertical:
 1. preset 'preset_aqua'          (Design Center)
 2. permissions carwash.bookings.manage → rbac.service
 3. provider 'sms_twilio' already in catalog → reuse
 4. manifest { vertical:'carwash', theme_preset_id:'preset_aqua', cms_structure:{pages:['home','book','pricing']},
               roles:['owner','washer'], permissions:['carwash.bookings.manage'], plan:'starter' }
 5. validate → preview → save → assignToTenant
```

## Next
[23-how-to-create-new-provider.md](23-how-to-create-new-provider.md)
