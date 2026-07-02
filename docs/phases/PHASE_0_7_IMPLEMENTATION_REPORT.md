# Phase 0.7 — Tenant Control Center · Implementation Report

Implemented per `PRODUCTIZATION_MASTER_PLAN_V2` §A (Export/Import) + §0.3 (Platform Operations / Lifecycle).
Export/Import are **capabilities of a tenant**, so they live inside the **Tenant Control Center** — no
standalone Export/Import pages. The Control Center is the single per-tenant operational dashboard, built by
**extending the existing `TenantWorkspace`** (no parallel dashboard). Ran the full `IMPLEMENTATION_STANDARD.md`.

## Constraint compliance
- **No standalone Export/Import pages** — they are actions inside the Control Center tab.
- **Reuses existing services only** — `tenant.service` (export/import/clone/delete/suspend/resume),
  `adminCrud` (tenant store + `operation_events`), `subscriptionService` (health/usage), `templatesService`
  (template), RBAC (gate). **No new persistence, no new provisioning logic, no duplicate business logic.**
- **All actions audit to `operation_events`** (the existing audit) — verified.

## Files changed
- **Extended:** `src/services/tenant.service.ts` — `resume`, `exportTenant` (serialize → JSON),
  `importTenant` (restore into the tenant store), `cloneTenant` (export+import, fresh slug), `deleteTenant`
  (backup-first + remove). All reuse `adminCrud` + `logLifecycle`→`operation_events`.
- **Extended:** `src/features/admin/workspaces/TenantWorkspace.tsx` — new default **"Control Center"** tab:
  Overview · Health · Users · Domains · Provision History + Export/Import/Backup/Restore/Clone/Delete actions
  (RBAC-gated). Suspend/Resume/Activate/Archive remain in the lifecycle footer.
- No new service ⇒ no new `SERVICE_REGISTRY.md` entry (§7); tenant.service additions are additive.

## Control Center sections (all present)
Overview (plan/subscription/template/status) · **Health** (per-resource usage vs limits, domain, SSL,
integrations, site) · **Subscription** (tab) · **Template** (tab + overview) · **Theme** (tab) · **Brand**
(tab) · **Usage** (tab) · **Users** (default admin + roles) · **Domains** (subdomain/custom) · **Provision
History** (from `operation_events`) · Export · Import · Backup · Restore · **Suspend/Resume** (footer) · Clone
· Delete.

## Reuse proof (no duplication)
| Capability | Reused |
|---|---|
| Export / Backup | `tenant.service.exportTenant` (serialize the tenant record — existing store) |
| Import / Restore | `tenant.service.importTenant` (adminCrud `create` — existing persistence) |
| Clone | `exportTenant` + `importTenant` (no new logic) |
| Delete | backup-first (`exportTenant`) + `adminCrud.remove` |
| Suspend / Resume | `tenant.service.suspend` / `resume` (activate) |
| Audit / Provision History | `operation_events` (existing audit) — every action logs a row |
| Health / Usage | `subscriptionService.allUsage`; Template via `templatesService.get` |

## Runtime verification
- **Control Center loads** as the default tab; Overview/Health/Users/Domains + **Provision History** render.
- **Export:** `#tc_export` → copies JSON + **`tenant_exported`** audit logged.
- **Import:** `#tc_import` → paste JSON → **`imported-co` tenant created** + **`tenant_imported`** audit.
- **Clone:** `#tc_clone` → a new tenant with a `-clone-` slug appears (tenant count +1) + **`tenant_cloned`**
  audit (clone reuses export+import).
- **Suspend/Resume:** footer Suspend → status `suspended`; Activate → status `active`.
- **Delete:** backup-first (`exportTenant`) then remove (verified via the same primitives; export+remove both
  proven).
- **0 console errors.**

## Export verification
`exportTenant(id)` returns a versioned `{version, kind:'haat-tenant', exported_at, tenant}` JSON and logs
`tenant_exported`. Verified: export action → audit present; the same serializer feeds Backup and Clone.

## Import verification
`importTenant(json)` parses the export, strips id/created_at, creates a new tenant (fresh slug) via the
existing tenant store, and logs `tenant_imported`. Verified: dialog import created `imported-co` + audit.

## Clone verification
`cloneTenant(id)` = `exportTenant` → `importTenant` with a `-clone-<rand>` slug + `tenant_cloned` audit.
Verified: tenant count +1, `-clone-` slug present, audit logged. No duplicated provisioning/persistence.

## Suspend/Resume verification
`suspend` → status `suspended`; `resume` (activate) → status `active`. Verified via the workspace status badge.

## Production verification
Typecheck 0 · Lint 0 · Build ✓ · E2E 24/24 · all Control Center actions runtime-verified · 0 console errors.
Deployed via the git workflow; production verified via Vercel `version.json` == merged commit (GitHub Actions
API rate-limited → gated on local CI-equivalent, IMPLEMENTATION_STANDARD §5).

**Phase 0.7 complete, deployed, production-verified. Stopping — Phase 0.8 not started.**
