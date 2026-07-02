# 11 · Tenant Control Center

> **Audience:** developers extending per-tenant management.
> **Key principle:** Export/Import/Backup/Restore/Clone/Delete are **capabilities of a tenant** — they live
> inside the Tenant Control Center, not as standalone pages.

## Purpose
Give operators one place to see and manage a single tenant: overview, health, subscription, template, theme,
brand, usage, users, domains, provision history, and lifecycle actions (Export, Import, Backup, Restore,
Suspend, Resume, Clone, Delete).

## Architecture
```
TenantWorkspace.tsx (tabs)
  ├─ Control Center (default tab)  overview · health · users · domains · provision history · data & lifecycle
  ├─ Subscription                  (subscription.service)
  └─ Brand Assets                  (assets/brand)
Lifecycle actions → tenant.service methods → operation_events audit + Provision Timeline
```
- [`src/features/admin/workspaces/TenantWorkspace.tsx`](../../src/features/admin/workspaces/TenantWorkspace.tsx)
  (Phase 0.7) — the Control Center tab is the default. Lifecycle actions are gated by
  `<Can perm="platform.tenants.manage">`.
- Data actions on [`src/services/tenant.service.ts`](../../src/services/tenant.service.ts):
  - `exportTenant(id)` → versioned JSON `{ version, kind:'haat-tenant', exported_at, tenant }` (logs
    `tenant_exported`).
  - `importTenant(json, {slugSuffix})` → recreate via `adminCrud` with a fresh slug (logs `tenant_imported`).
  - `cloneTenant(id)` → export + import with `-clone-<rand>` suffix (logs `tenant_cloned`).
  - `deleteTenant(id)` → **backup-first** (returns the export JSON) then `adminCrud.remove` (logs
    `tenant_deleted`).
  - `suspend`/`resume`/`activate`/`archive` → status transitions, each logs a lifecycle event.

## Flow: export → import (round-trip)
```
Export:  tenant.service.exportTenant(id) → JSON document (download)
Import:  tenant.service.importTenant(json, {slugSuffix:'-import'}) → new tenant (fresh slug/id)
Delete:  tenant.service.deleteTenant(id) → returns backup JSON, THEN removes (never lose data)
Every action → logLifecycle() → operation_events (the shared audit timeline)
```

## Dependencies
- `tenant.service` (all lifecycle + data actions), `subscription.service` (`allUsage` for health), `adminCrud`
  (`operation_events`), `templates.service` (template tab), `rbac` (`<Can>` gating).
- **No new persistence, no new provisioning logic** — reuses the tenant store + the existing export/import
  pipeline + the audit system.

## Extension points
- **New tenant action** → add a method to `tenant.service` that reuses `adminCrud` + `logLifecycle`, then a
  gated button in the Control Center tab.
- **New Control Center panel** → add a section to the Control tab reading from existing services.

## Reuse rules
- Export/Import/Backup/Restore **reuse the same pipeline** (`exportTenant`/`importTenant`). Delete/Clone are
  built on top of them — no parallel serialization.
- All actions audit through `operation_events`. Don't invent a second audit log.
- Gate destructive actions with `<Can perm="platform.tenants.manage">`.

## Files involved
- [`src/features/admin/workspaces/TenantWorkspace.tsx`](../../src/features/admin/workspaces/TenantWorkspace.tsx) ·
  [`src/services/tenant.service.ts`](../../src/services/tenant.service.ts) ·
  [`src/services/subscription.service.ts`](../../src/services/subscription.service.ts).

## Do's
- ✅ Add tenant actions as `tenant.service` methods. ✅ Backup before destructive ops (delete returns the
  backup). ✅ Log every action to `operation_events`.

## Don'ts
- ❌ Don't build a standalone Export/Import page. ❌ Don't add a second persistence or audit system.
- ❌ Don't skip the permission gate on destructive actions.

## Example
```ts
// Clone a tenant (reuses export+import under the hood):
const { data, error } = await tenantService.cloneTenant(tenant.id);
// Delete safely (get the backup first):
const { backup } = await tenantService.deleteTenant(tenant.id);   // keep `backup` to restore later
```

## Next
[12-white-label.md](12-white-label.md) · [09-provisioning-engine.md](09-provisioning-engine.md)
