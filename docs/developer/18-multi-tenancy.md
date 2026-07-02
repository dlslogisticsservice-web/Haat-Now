# 18 · Multi-Tenancy

> **Audience:** developers reasoning about tenant isolation and per-tenant config.
> **Roadmap:** see [../plans/TENANT_ISOLATION_ROADMAP.md](../plans/TENANT_ISOLATION_ROADMAP.md).

## Purpose
Explain how one deployment serves many tenants: where tenant config lives, how a tenant's identity is applied,
and the isolation model in sandbox vs live mode.

## Architecture: the tenant as config spine
```
tenant record (tenant.service / haat_crud_tenants)  ── THE config spine ──
   brand/theme · subscription · features · permissions · website/cms · domains
        │
        ├─ applyTheme(tenant) → theme cascade → all surfaces re-skin        (visual isolation)
        ├─ subscription.service → plan/limits/usage                          (commercial isolation)
        ├─ rbac.service → roles/permissions                                  (access isolation)
        └─ experience.service → per-country/tenant screen content            (content isolation)
```
Every tenant-varying concern hangs off the tenant record and is consumed by the owning service — so serving a new
tenant is a **config** operation ([09-provisioning-engine.md](09-provisioning-engine.md)), not a code change.

## Architecture: isolation model
| Mode | Isolation |
|---|---|
| **sandbox** | Single-browser demo: one active tenant/brand applied at a time via the theme cascade. Data lives in shared `localStorage` namespaces; there is no cross-user boundary (it's a demo). |
| **supabase (live)** | Real isolation is enforced at the database layer (tenant-scoped rows + RLS as the roadmap lands). Config still flows through the tenant record. |

Because production ships as sandbox today, "multi-tenancy" in the demo means **switchable branded config**, and
the live roadmap adds row-level tenant isolation. Keep new features tenant-aware (scope by tenant/country) so
they're ready for live isolation.

## Flow: a tenant becomes active
```
Select/provision tenant → tenant.service.applyTheme(tenant) → brand live
Surfaces read tenant-scoped config through the owning services (subscription/rbac/experience)
Tenant Control Center manages the tenant lifecycle (see doc 11)
```

## Dependencies
- `tenant.service` (spine + theme), `subscription.service`, `rbac.service`, `experience.service`,
  `platform.service`, `provisioning.service`. Storage: `haat_crud_tenants` / tenants table.

## Extension points
- **New per-tenant setting** → add a field to the tenant record + read it via the owning service. Default =
  current global behavior (backward compatible).
- **Tighter isolation (live)** → follow the isolation roadmap (tenant-scoped queries + RLS).

## Reuse rules
- Tenant config = the tenant record + owning services. Don't scatter tenant settings into component state or new
  stores.
- Scope tenant-varying data by tenant/country so it's isolation-ready.

## Files involved
- [`src/services/tenant.service.ts`](../../src/services/tenant.service.ts) ·
  [`src/features/admin/workspaces/TenantWorkspace.tsx`](../../src/features/admin/workspaces/TenantWorkspace.tsx) ·
  [`src/config/countries.ts`](../../src/config/countries.ts) ·
  [../plans/TENANT_ISOLATION_ROADMAP.md](../plans/TENANT_ISOLATION_ROADMAP.md).

## Do's
- ✅ Hang per-tenant config off the tenant record. ✅ Scope new data by tenant/country.
- ✅ Keep tenant defaults = current global behavior.

## Don'ts
- ❌ Don't assume the sandbox's shared-store model is real isolation. ❌ Don't fork code per tenant.
- ❌ Don't store tenant config outside the tenant record.

## Example
```ts
// Switch the active brand (visual multi-tenancy in the demo):
tenantService.applyTheme(tenantA);   // whole app becomes Tenant A's brand
// …later
tenantService.applyTheme(tenantB);   // instantly Tenant B
```

## Next
[12-white-label.md](12-white-label.md) · [05-database.md](05-database.md)
