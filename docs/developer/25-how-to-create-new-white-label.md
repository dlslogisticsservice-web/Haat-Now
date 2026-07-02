# 25 · How To: Create a New White-Label (Tenant)

> **Goal:** stand up a brand-new white-label tenant end to end.
> **Read first:** [12-white-label.md](12-white-label.md) · [09-provisioning-engine.md](09-provisioning-engine.md)
> · [11-tenant-control-center.md](11-tenant-control-center.md).

## Purpose
Create a fully branded, configured tenant (identity + theme + subscription + roles + CMS + integrations) using
the existing engines — via the Onboarding Wizard (guided) or the Provisioning Engine (programmatic). No code
changes, no per-tenant forks.

## Architecture recap
```
Template/Onboarding input  ──▶  ProvisionSpec  ──provision()──▶  tenant spine (tenant.service)
                                                   steps: tenant→theme→brand→subscription→roles→integrations→cms→activate
                                                   applyTheme() → brand live on all surfaces (theme cascade)
```

## Flow: the two paths
**A. Guided (recommended)** — [Onboarding Wizard](10-onboarding.md):
```
Admin → Tenant Onboarding Wizard → fill 12 steps (company, business type, template, branding, theme, plan, domain)
  → Review → Provision → the wizard calls provisioningService.provision(templatesService.toSpec(manifest, input))
  → Success
```
**B. Programmatic** — from a template manifest:
```ts
const manifest = templatesService.get('restaurant');
const spec = templatesService.toSpec(manifest, {
  brand_name: 'Zaytoun', slug: 'zaytoun', plan: 'business',
  primary_color: '#2E7D32', support_email: 'help@zaytoun.example', country_code: 'EG',
});
const run = await provisioningService.provision(spec);
if (run.status === 'failed') await provisioningService.retry(run.id);   // idempotent resume
```

## Flow: after provisioning
```
Manage the tenant in the Tenant Control Center (doc 11): subscription, brand assets, users, domains, lifecycle
Export/Backup/Clone/Delete are tenant capabilities there (never standalone pages)
Every action is audited in operation_events
```

## Dependencies
- `templates.service` (spec source), `provisioning.service` (does the work), `tenant.service` (spine + theme),
  `subscription.service`, `rbac.service`, `themePresets.service`, `experience.service`, `platform.service`.

## Extension points
- **New brandable/tenant property** → add a field to the tenant record + map it (visual → `tenantTheme()`; else
  the owning service). Additive, default = current behavior.
- **New provisioning behavior** → a generic engine step ([09](09-provisioning-engine.md)).

## Reuse rules
- Always provision through the engine; never hand-assemble a tenant. Drive branding from the tenant spine + theme
  engine. Store `theme_preset_id` + overrides, not a theme copy. Audit via `operation_events`.
- Respect the Payment Rule: set up a subscription/plan, but no gateway charge while `HAAT_LIVE_BACKEND` is off.

## Files involved
- [`src/features/admin/TenantOnboardingWizard.tsx`](../../src/features/admin/TenantOnboardingWizard.tsx) ·
  [`src/services/provisioning.service.ts`](../../src/services/provisioning.service.ts) ·
  [`src/services/templates.service.ts`](../../src/services/templates.service.ts) ·
  [`src/services/tenant.service.ts`](../../src/services/tenant.service.ts) ·
  [`src/features/admin/workspaces/TenantWorkspace.tsx`](../../src/features/admin/workspaces/TenantWorkspace.tsx).

## Do's
- ✅ Use the wizard or `provision()`. ✅ Verify the brand applies to all four surfaces + permissions work.
- ✅ Manage the tenant via the Control Center.

## Don'ts
- ❌ Don't hand-roll tenant setup or fork a surface per brand. ❌ Don't store full themes on tenants.
- ❌ Don't build standalone export/import pages. ❌ Don't wire a live charge (Payment Rule).

## Example (verify it worked)
```ts
const run = await provisioningService.provision(spec);
await provisioningService.verify(run.id);         // confirm every step applied
tenantService.applyTheme(await getTenant(spec.slug));  // brand goes live across surfaces
```

## Done
You've completed the developer platform how-to set. Back to [INDEX.md](INDEX.md).
