# 09 · Provisioning Engine

> **Audience:** developers touching tenant provisioning.
> **Key principle:** the engine is an **orchestrator only** — it owns **no** domain logic. Every step delegates
> to an existing service.

## Purpose
Provision a tenant end-to-end by sequencing existing services in a way that is **transactional, idempotent,
resumable, retryable, rollback-able, and audited**. It reads a generic `ProvisionSpec` (no business logic) and
produces a fully configured tenant.

## Architecture
```
ProvisionSpec (generic)
   │
   ▼   provisioning.service.provision(spec, resumeRunId?)
STEPS[] (8 generic steps, each delegates to an existing service):
   tenant → theme → brand → subscription → roles → integrations → cms → activate
   │            │      │          │           │         │          │        │
 tenant.svc  themePreset tenant  subscription rbac.svc platform  experience tenant.svc
   │
   ▼
 run-state in haat_sb_provision_runs   +   audit rows in operation_events   +   monitoring
```
- [`src/services/provisioning.service.ts`](../../src/services/provisioning.service.ts) (Phase 0.4) — governance
  header declares it orchestrator-only. `ProvisionSpec` carries generic declarative fields (`brand_name`, `slug`,
  `plan`, `theme_preset_id`, `trial_days`, `features`, `integrations`, `roles`, `permissions`, `cms_structure`,
  `navigation`, `demo_data_profile`, `template_id`, …).
- API: `provision(spec, resumeRunId?)`, `retry(runId)`, `rollback(runId)`, `verify(runId)`.
- Dev hook: `window.__prov` (loads when the Provisioning Console mounts).
- UI: [`src/features/admin/ProvisioningConsole.tsx`](../../src/features/admin/ProvisioningConsole.tsx).

## Flow: a provisioning run
```
provision(spec)
  → create run in haat_sb_provision_runs (status per step)
  → for each STEP: call the owning service (tenant/theme/brand/subscription/rbac/platform/experience)
       success → mark step done (idempotent: re-run skips completed steps)
       failure → stop, mark run failed, monitoring.capture, audit
  → retry(runId): resumes from the first incomplete step
  → rollback(runId): reverses applied steps
  → all transitions logged to operation_events (the shared audit timeline)
```

## Dependencies
- Reuses: `tenant.service`, `subscription.service`, `rbac.service`, `themePresets.service` (via tenant fields),
  `platform.service` (integrations), `experience.service` (cms), `monitoring`, `adminCrud` (`operation_events`).
- Consumed by: `ProvisioningConsole`, `TemplateMarketplace` (via derived spec), `TenantOnboardingWizard`.
- **Never imports** `templates.service` — the marketplace pushes a spec *in*.

## Extension points
- **New provisioning step** → add a generic `STEP` that delegates to the owning service and reads a **generic**
  spec field. Must be idempotent + reversible. See [23-how-to-create-new-provider.md](23-how-to-create-new-provider.md)
  for the integrations step.
- **New spec field** → add to `ProvisionSpec`; a step applies it generically.

## Reuse rules
- **No domain logic in the engine.** No vertical branches, no new tenant/subscription/theme/rbac/audit systems.
- Audit = `operation_events` (existing). The run store is engine resume-state only — not a second audit system.
- Every step must be **idempotent** (safe to re-run) and **reversible** (rollback).

## Files involved
- [`src/services/provisioning.service.ts`](../../src/services/provisioning.service.ts) ·
  [`src/features/admin/ProvisioningConsole.tsx`](../../src/features/admin/ProvisioningConsole.tsx) ·
  [`src/services/templates.service.ts`](../../src/services/templates.service.ts) (produces the spec).

## Do's
- ✅ Keep steps generic + idempotent + reversible. ✅ Delegate to the owning service.
- ✅ Log every transition to `operation_events`.

## Don'ts
- ❌ Don't add `if (vertical === …)` branches. ❌ Don't create a new persistence/audit system.
- ❌ Don't make a step that can't be retried or rolled back.

## Example
```ts
// Provision + resume-on-failure:
const run = await provisioningService.provision(spec);
if (run.status === 'failed') await provisioningService.retry(run.id);  // resumes from first incomplete step
```

## Next
[10-onboarding.md](10-onboarding.md) · [11-tenant-control-center.md](11-tenant-control-center.md)
