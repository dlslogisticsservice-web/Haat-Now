# 10 · Tenant Onboarding Wizard

> **Audience:** developers changing the tenant onboarding flow.
> **Key principle:** the wizard is a **presentation layer only**. It contains **no** business logic.

## Purpose
Collect the inputs needed to create a tenant through a friendly, resumable, RTL/LTR, autosaving wizard — then
hand off to the [Provisioning Engine](09-provisioning-engine.md). Its only job: **collect → validate → select
template → call the engine → show progress → show result.**

## Architecture
```
TenantOnboardingWizard (UI, 12 steps)
  Welcome → Company Info → Business Type → Template → Branding → Theme → Subscription
          → Domain → Review → Provision → Progress → Success
        │
        ▼  on submit
  provisioningService.provision( templatesService.toSpec(selectedManifest, formInput) )
```
- [`src/features/admin/TenantOnboardingWizard.tsx`](../../src/features/admin/TenantOnboardingWizard.tsx)
  (Phase 0.6) — presentation only. Autosaves a draft to localStorage; can resume an interrupted onboarding.
- It **reuses** the Template Marketplace (to pick a manifest) and the Provisioning Engine (to do the work). It
  does not provision, theme, subscribe, create assets, assign roles, or set up integrations itself.

## Flow
```
User fills steps → draft autosaved each change
Resume: draft loaded in a useState LAZY INITIALIZER (so it isn't clobbered by the autosave effect on mount)
Review → Provision step calls provisioning.service.provision(spec)
Progress step polls/reads the run state → Success shows the result
```

## Dependencies
- Reuses **only**: `templates.service` (`toSpec`), `provisioning.service` (`provision`), the theme/preset data,
  `subscription.service` plan catalog (for display), `inputDialog` + shared UI.
- Persists just its **draft** (a UI concern), never tenant data directly.

## Extension points
- **New step** → add a step to the wizard array + its validation. Keep it input-collection only.
- **New collected field** → add to the form + include it in the `overrides` passed to `toSpec()`. The engine
  applies it; the wizard doesn't.

## Reuse rules
- No business logic in the wizard — if you're tempted to write provisioning/theme/subscription logic here, put
  it in the owning service and call it.
- Load the resume draft in a lazy `useState` initializer (see the fixed bug below), never in a mount effect that
  races the autosave effect.

## Files involved
- [`src/features/admin/TenantOnboardingWizard.tsx`](../../src/features/admin/TenantOnboardingWizard.tsx) ·
  [`src/services/templates.service.ts`](../../src/services/templates.service.ts) ·
  [`src/services/provisioning.service.ts`](../../src/services/provisioning.service.ts) ·
  [`src/services/onboarding.service.ts`](../../src/services/onboarding.service.ts) (KYC/supply onboarding — a
  **different** flow: merchant/driver KYC, not tenant creation).

## Do's
- ✅ Keep it input-only. ✅ Autosave + resume. ✅ Support RTL/LTR + graceful error recovery.
- ✅ Delegate all work to `provision()`.

## Don'ts
- ❌ Don't provision/theme/subscribe/assign-roles inside the wizard. ❌ Don't load the resume draft in a mount
  effect (it gets clobbered). ❌ Don't confuse this with `onboarding.service` (that's KYC).

## Example
```ts
// The wizard's entire "work" is one call:
const spec = templatesService.toSpec(selectedManifest, {
  brand_name: form.company, slug: form.slug, plan: form.plan, primary_color: form.primary,
});
const run = await provisioningService.provision(spec);
```

## Next
[11-tenant-control-center.md](11-tenant-control-center.md)
