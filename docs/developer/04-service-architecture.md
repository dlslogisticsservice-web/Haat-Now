# 04 · Service Architecture

> **Audience:** anyone writing or changing business logic.
> **Authoritative source:** [../governance/SERVICE_REGISTRY.md](../governance/SERVICE_REGISTRY.md) — this page is
> the developer-facing summary. The registry is **frozen governance**; obey it.

## Purpose
Every piece of business logic and data access lives in a **service** (`src/services/*.ts`). Services are the only
layer allowed to touch storage. This page explains the layering, the reuse/governance rules, and how to add one
correctly (spoiler: usually you shouldn't — you extend an existing one).

## Architecture: the layers
```
UI            src/features/*, src/components/*        (may call hooks + services)
HOOKS         src/hooks/useRbac                        (may call services; never called BY services)
APP SERVICES  src/services/*.ts, src/services/ops/*    (domain logic; may compose siblings if acyclic)
PLATFORM/EXP  platform.service, experience.service,    (cross-cutting engines; storage+types only)
              assets.service, design/designSystem
STORAGE       sandboxStore, localStorage, Supabase      (leaves)
TYPES         services/types, platformModel, …          (leaves — import nothing)
```

### Layer rules (downward only)
- **UI** may import hooks + application/platform services. Never touch storage directly — go through a service.
- **Hooks** may import services; must **not** be imported by services.
- **Application services** may import platform/experience engines, storage, types, and **sibling** application
  services **only if acyclic** (orchestrators like `payment-orchestrator` compose siblings).
- **Platform/experience** may import storage + types only.
- **Storage + types** are leaves.

### Forbidden (never)
❌ services → UI · ❌ services → hooks · ❌ platform/experience → application services ·
❌ storage → anything upward · ❌ types → anything · ❌ **any circular import**.
Current status: **0 circular imports**.

## Flow: a component reads/writes data
```
Component  →  someService.method()  →  (sandbox) localStorage  OR  (live) supabase
           ←  typed result          ←
```
The component never knows which backend answered — the service hides it behind `VITE_AUTH_MODE`.

## The service registry (summary)
40+ services. The engines you will touch most:

| Service | Purpose | Doc |
|---|---|---|
| `admin-crud.service` | **Generic CRUD engine** (localStorage/Supabase). Reused everywhere. | — |
| `auth.service` | Auth/session/OTP (dual-mode). **Frozen.** | [17](17-authentication.md) |
| `rbac.service` | Roles + permissions + guards. Single permission source. | [16](16-rbac.md) |
| `tenant.service` | White-label tenants + theme apply. Config spine. | [12](12-white-label.md) |
| `subscription.service` | Plans/trials/limits/usage-guard/status (no billing). | [08](08-template-marketplace.md) |
| `themePresets.service` | Reusable `DesignConfig` snapshots. | [06](06-theme-engine.md) |
| `provisioning.service` | **Orchestrator-only** tenant provisioning. | [09](09-provisioning-engine.md) |
| `templates.service` | Declarative business manifests → spec. | [08](08-template-marketplace.md) |
| `platform.service` | Integration Center registry (providers/flags/brands). | [15](15-integration-center.md) |
| `experience.service` | CMS (screen experiences, draft/publish/version). | [13](13-cms.md) |
| `assets.service` | Media/asset library. | [07](07-brand-assets.md) |

Full table (deps, consumers, health, owner domain, merge roadmap) →
[SERVICE_REGISTRY.md](../governance/SERVICE_REGISTRY.md).

## Dependencies
Services depend on: `admin-crud`/`sandboxStore`/Supabase (storage), `platformModel`/types, and **sibling
services only when acyclic**. Example acyclic chains: `payment-orchestrator → payment → wallet → notification`;
`subscription → tenant → designSystem`.

## Extension points
- **Add a capability** → add a method to the **existing** owning service.
- **Add a genuinely new concern** → a new service, but only with the governance header + registry entry (below).

## Reuse rules (mandatory governance)
1. **No new service without the header block** proving no existing service covers the concern:
   ```ts
   // AUTHORIZED BY:
   // Phase:
   // Purpose:
   // Existing services reused:
   // Why a new service is required:
   // Duplicate analysis:
   // Consumers:
   // Future merge candidate: YES/NO
   ```
2. **Every new service gets a `SERVICE_REGISTRY.md` entry in the same commit** (category, owner domain, health,
   deps, consumers).
3. New permission → `rbac.service`. New provider → `platform.service`. Respect layer + forbidden rules.
4. **Payment Rule:** while `HAAT_LIVE_BACKEND` is disabled, no payment gateway — subscription management only.

## Files involved
- [`src/services/`](../../src/services/) — all services. `src/services/ops/` — operations domain.
- [`src/services/admin-crud.service.ts`](../../src/services/admin-crud.service.ts) — the shared CRUD engine.
- [`src/services/types.ts`](../../src/services/types.ts) — shared types.

## Do's
- ✅ Extend before you create. Prefer a method on an existing service.
- ✅ Keep a service to one owner domain (Identity/Commerce/Finance/Operations/Growth/Experience/Platform).
- ✅ Route all storage access through `admin-crud` or the owning service.

## Don'ts
- ❌ Don't create a parallel engine for theming, CMS, RBAC, or the provider registry.
- ❌ Don't import UI or hooks from a service. ❌ Don't create a circular import.
- ❌ Don't add a service without the header **and** the registry entry in the same commit.

## Example: adding a capability the right way
```ts
// tenant needs an "archive reason" — DON'T make a new service. Extend tenant.service:
async archiveWithReason(id: string, reason: string) {
  const r = await tenants.update(id, { status: 'archived', archive_reason: reason });
  if (!r.error) await logLifecycle('tenant_archived', id, { reason });
  return r;
}
```

## Next
[05-database.md](05-database.md) · governance: [20-coding-standards.md](20-coding-standards.md)
