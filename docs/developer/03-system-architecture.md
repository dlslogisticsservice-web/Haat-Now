# 03 · System Architecture

> **Audience:** developers who need the big picture before changing anything.
> **Authoritative source:** [../architecture/SYSTEM_DEPENDENCY_MAP.md](../architecture/SYSTEM_DEPENDENCY_MAP.md).

## Purpose
Describe how a single SPA serves four portals over a swappable backend, and how a change (a theme, a tenant, an
order) propagates across surfaces.

## Architecture: one app, four surfaces, two backends
```
                       ┌─────────────────────────────────────────────┐
                       │   ONE React 19 + Vite SPA (src/App.tsx)      │
                       │   role router → customer | driver |          │
                       │                 merchant | admin             │
                       └───────────────┬─────────────────────────────┘
                                       │ every surface reads the SAME
                                       │ services · design tokens · RBAC
                       ┌───────────────▼─────────────────────────────┐
                       │            SERVICE LAYER (src/services)      │
                       └───────────────┬─────────────────────────────┘
                                       │  VITE_AUTH_MODE decides ↓
                 ┌─────────────────────┴─────────────────────┐
        sandbox  │ localStorage (haat_sb_* / haat_crud_*)     │  supabase
                 │ demo backend, no network                   │  Postgres+Auth+Storage+Realtime
                 └────────────────────────────────────────────┘
```
- **Sandbox** is the default and what production ships as (forced in `vite.config.ts`; opt out with
  `HAAT_LIVE_BACKEND=1`).
- Both modes run identical UI, services, theme engine, and RBAC. Mode swaps only the storage floor.

## Architecture: provider / boot tree (`src/main.tsx`)
```
AppConfigProvider     (lang / dir / i18n)             contexts/AppConfigContext
 └─ DesignProvider    (writes 40+ CSS vars → :root)   design/DesignContext + designSystem.applyDesign
     └─ ExperienceProvider (splash/onboarding/login)  experience/ExperienceContext
         └─ App        (role router → the 4 surfaces)
```
**DesignProvider is the theming cascade**: `applyDesign()` writes CSS variables to `:root`; every surface reads
the same variables, so a White-Label/theme change propagates globally with **zero per-surface edits**. This is
the single most important architectural lever — see [06-theme-engine.md](06-theme-engine.md).

## Flow: how a change propagates
- **Theme/brand change** → `applyDesign()` → `:root` CSS vars → all four surfaces re-skin live.
- **An order** → `sandboxStore` writes it **and mirrors it into `haat_crud_orders`** → Admin Orders, Finance,
  and Analytics all see it (the "orders bridge").
- **A permission change** → `rbac.service` → `useRbac`/`<Can>` guards re-render (via the `rbac-acting-changed`
  window event).
- **A tenant/config change** → `tenant.service` writes the tenant record → surfaces that consume tenant config
  (brand, theme, features, subscription) reflect it.

## Dependencies (layering)
```
UI (features/*, components/*)
  → hooks (useRbac)
    → application services (order, finance, tenant, subscription, ops/*, …)
      → platform / experience / design engines (platform.service, experience.service, designSystem)
        → storage (sandboxStore, localStorage, Supabase)
  TYPES are leaves — imported by any layer, import nothing.
```
Allowed direction is **downward only**. Full rules + the forbidden-dependency list live in
[04-service-architecture.md](04-service-architecture.md).

## Realtime / events
- Supabase realtime is **gated OFF in sandbox** (the `lib/supabase` stub returns no-op channels). Cross-surface
  propagation in demo mode = **shared localStorage + poll/refresh** (e.g. order-tracking poll, the Operations
  Command Center live-sim). In supabase mode, channels (`driver_locations`, `order_status`) activate.
- **Window events**: `rbac-acting-changed` drives live RBAC re-render.

## Extension points
- New cross-surface propagation → write through the owning service so every consumer sees it; never write to a
  store two components share directly.
- New provider context → add it to the boot tree in `main.tsx` (mind the order: config → design → experience).

## Reuse rules
- One theme engine (`designSystem`), one CMS (`experience.service`), one permission source (`rbac.service`), one
  provider registry (`platform.service`). Do not create a parallel engine for any of these.

## Files involved
- [`src/main.tsx`](../../src/main.tsx), [`src/App.tsx`](../../src/App.tsx),
  [`src/services/sandboxStore.ts`](../../src/services/sandboxStore.ts) (demo backend + order→finance bridge),
  [`src/lib/supabase.ts`](../../src/lib/supabase.ts) (mode gate).

## Do's
- ✅ Add cross-surface behavior at the **service** layer so all surfaces get it for free.
- ✅ Assume both backends: test that a flow works in sandbox (the shipped mode).

## Don'ts
- ❌ Don't rely on Supabase realtime in a flow that must work in sandbox.
- ❌ Don't reach across surfaces by importing another surface's components.

## Example
```
Show a new metric on both Admin and Merchant dashboards:
  add it to a SERVICE (e.g. analytics.service) → both dashboards call the service.
  Do NOT compute it twice in two components.
```

## Next
[04-service-architecture.md](04-service-architecture.md) · [05-database.md](05-database.md)
