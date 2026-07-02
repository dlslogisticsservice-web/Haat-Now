# Phase 0.5 — Template Marketplace · Implementation Report

Implemented per `PRODUCTIZATION_MASTER_PLAN_V2` §Template Marketplace. Templates are **declarative manifests**;
the Provisioning Engine stays **generic** (reads a derived spec, holds no business/vertical logic). Ran the
full `IMPLEMENTATION_STANDARD.md` Definition of Done.

## Key constraint honored — generic engine, business knowledge in manifests
- The Provisioning Engine has **no vertical/business `if` logic**. It applies whatever the (generic)
  `ProvisionSpec` says — theme preset, plan, features, integrations, cms_structure, navigation, roles,
  permissions, demo profile — via the same generic steps.
- **Proof:** provisioning from two different templates produced **different** tenant configs with the *same*
  engine — Restaurant → `preset-default` / food / `menu` page / `stripe` / loyalty=true; Luxury → `preset-royal`
  / enterprise / tips=true. Business knowledge lives entirely in `templates.service` manifests.

## Files changed
- **New:** `src/services/templates.service.ts` — governed service. `TemplateManifest` (vertical, theme_preset,
  brand_defaults, cms_structure, roles, navigation, integrations, features, permissions, subscription,
  demo_data_profile) + **10 seeded manifests** (Restaurant, Food Delivery, Courier, Pharmacy, Supermarket,
  Flowers, Laundry, Luxury, Corporate, Minimal). Methods: list/get/create/update(+version+history)/remove/
  duplicate, export/import, **validate**, **preview**, **toSpec** (manifest→generic spec), **assignToTenant**.
  Dev `window.__tpl` hook.
- **New:** `src/features/admin/TemplateMarketplace.tsx` — grid + preview + provision-from-template + CRUD +
  import/export + validate. RBAC-gated. Wired into a Platform **"Templates"** nav.
- **Extended (generically):** `src/services/provisioning.service.ts` — `ProvisionSpec` gained optional
  declarative fields; the **existing generic steps** now write them to the tenant (features_json, integrations,
  cms_structure, navigation, roles, permissions, demo_data_profile, template_id). **No vertical logic added.**
- **Updated:** `SERVICE_REGISTRY.md` — `templates.service` entry (same commit, governance §7).

## Requirements — delivered + verified
| Requirement | Implementation | Verified |
|---|---|---|
| Template Marketplace | 10 declarative manifests | grid renders 10 |
| Template CRUD | create/update/remove/duplicate | 10→12→10 round-trip |
| Template Preview | `preview()` + UI summary | pages/integrations/features shown |
| Template Versioning | `update` bumps `version` + pushes `history` | v1→**v2**, history len 1 |
| Template Import/Export | JSON export ↔ import | export + import ok |
| Template Validation | required fields + preset/plan existence | valid ✓; invalid caught |
| Template Assignment | `assignToTenant` → `tenant.template_id` | `template_id=tpl-restaurant` on provisioned tenant |
| Provision from manifest | `toSpec(manifest) → provisioningService.provision` | Restaurant & Luxury both `completed`, distinct configs |

## Reuse / no duplication
Reuses **Provisioning Engine** (single generic flow — no duplicated provisioning), **Theme Presets** (validate
+ swatch), **Subscription** (plan validation + trial), **RBAC** (roles/permissions), **Integration Center** +
**CMS/Experience** (via declarative fields applied to tenant), **Brand Assets** (brand defaults). Manifests are
pure data. Engine received only the derived spec — it never imports `templates.service`.

## Runtime verification
- Marketplace: 10 template cards; validation (valid pass / invalid catch).
- **Manifest-driven provision:** Restaurant → completed; tenant `theme_preset_id=preset-default`, `vertical=food`,
  `cms_structure.pages` includes `menu`, `integrations` includes `stripe`, `template_id=tpl-restaurant`,
  `features_json.loyalty=true`, status `active`. Luxury → completed; `preset-royal`, plan `enterprise`,
  `features_json.tips=true` — **different config, same engine**.
- Versioning v1→v2 + history; export/import round-trip; duplicate/remove. **0 console errors.**

## Governance
New `templates.service` carries the mandatory header + owner domain (Platform) + registry entry (now 55
files). Layer/forbidden rules respected — `templates → provisioning/themePresets/subscription` (app-level),
never the reverse; **0 circular imports** (engine does not import templates). Payment Rule unaffected.

## Production verification
Typecheck 0 · Lint 0 · Build ✓ · E2E 24/24 · engine + UI runtime-verified · 0 console errors. Deployed via the
git workflow; production verified via Vercel `version.json` == merged commit (GitHub Actions API rate-limited →
gated on local CI-equivalent, IMPLEMENTATION_STANDARD §5).

**Phase 0.5 complete, deployed, production-verified. Stopping — Phase 0.6 not started.**
