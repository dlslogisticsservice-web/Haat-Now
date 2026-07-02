# 16 · RBAC (Roles & Permissions)

> **Audience:** any developer gating a feature by permission.
> **Key principle:** `rbac.service` is the **single source of truth** for "who can do what." Gate UI with
> `<Can>`; never invent an ad-hoc role check.

## Purpose
Define roles, permissions, permission groups, and role templates, and enforce them across the UI with a
consistent guard. One permission model powers every gated surface.

## Architecture
```
rbac.service (roles + permissions + matrix + guards)   ──▶  haat_sb_rbac_roles / _acting  |  roles/permissions tables (live)
     │  PERMISSION_GROUPS · PERMISSIONS · ROLE_TEMPLATES
     ▼
useRbac() hook  +  <Can perm="…">  guard   ──▶  render/deny features
     ▲
window event 'rbac-acting-changed' → live guard re-render when the acting role changes
```
- [`src/services/rbac.service.ts`](../../src/services/rbac.service.ts):
  - `PERMISSION_GROUPS` — operations, fleet, orders, catalog, finance, compliance, support, marketing, records,
    **platform**, **security**, system.
  - `PERMISSIONS` — dotted keys, e.g. `ops.command.view`, `orders.manage`, `platform.tenants.manage`.
  - `Role` — `{ scope: 'super'|'country'|'merchant'|'driver'|'support', permissions: string[], … }`.
  - `RoleTemplate` — reusable permission sets (`'*'` = all).
- [`src/hooks/useRbac.tsx`](../../src/hooks/useRbac.tsx) — the `useRbac()` hook + `<Can>` guard component.
- [`src/features/admin/RbacCenter.tsx`](../../src/features/admin/RbacCenter.tsx) — the admin UI (matrix editor).

## Flow: gating a feature
```
Define/choose a permission key in rbac.service (PERMISSIONS)
Assign it to a role/template (RbacCenter or defaults)
Guard the UI:  <Can perm="platform.tenants.manage"> … </Can>
At runtime: useRbac() checks the acting role's permissions; acting-role change fires 'rbac-acting-changed' → re-render
```

## Dependencies
- Storage: `haat_sb_rbac_*` (sandbox) / roles·permissions·role_permissions·user_roles tables (live).
- Consumers: `useRbac`/`<Can>`, RbacCenter, Integration Center, Tenant Control Center, and every gated admin
  console. The Provisioning Engine's "roles" step assigns permissions via this service.

## Extension points
- **New permission** → add a `Permission` to `PERMISSIONS` (correct group) in `rbac.service`, then gate the UI
  with `<Can perm="…">` and add it to the relevant role templates. Additive.
- **New role/template** → add a `RoleTemplate`; assign scope + permission set.

## Reuse rules
- **One permission source.** Every gate reads `rbac.service` via `useRbac`/`<Can>` — no bespoke
  `if (user.role === 'admin')` checks scattered in components.
- New permissions belong in `rbac.service` (per the Implementation Standard §7), added in the same commit as the
  feature that needs them.

## Files involved
- [`src/services/rbac.service.ts`](../../src/services/rbac.service.ts) ·
  [`src/hooks/useRbac.tsx`](../../src/hooks/useRbac.tsx) ·
  [`src/features/admin/RbacCenter.tsx`](../../src/features/admin/RbacCenter.tsx).

## Do's
- ✅ Gate every sensitive action with `<Can perm="…">`. ✅ Add new permission keys to `rbac.service`.
- ✅ Verify both allowed **and** denied paths at runtime (Definition of Done §3).

## Don'ts
- ❌ Don't hardcode role checks in components. ❌ Don't create a second permission list.
- ❌ Don't ship a gated feature without adding its permission to `rbac.service`.

## Example
```tsx
import { Can } from '../hooks/useRbac';
<Can perm="platform.tenants.manage">
  <button onClick={onDelete}>Delete tenant</button>
</Can>
```

## Next
[17-authentication.md](17-authentication.md) · [18-multi-tenancy.md](18-multi-tenancy.md)
