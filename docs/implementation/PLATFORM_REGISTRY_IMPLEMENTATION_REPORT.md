# Platform Registry — Implementation Report

**Sprint:** Platform Governance UI — the Platform Registry (runtime administration module).
**Scope:** a runtime module catalog inside the existing Admin Portal. Not documentation. Reuse-first, no
duplicate registries, no Admin redesign — extends the existing Platform section.

## Outcome
✅ Implemented and runtime-verified. Gate green: **typecheck 0 · build ✓ · sandbox E2E 24/24 · runtime probe
PASS**. Sandbox behavior unchanged (additive, super-admin-gated console).

## What was built
| File | Role |
|---|---|
| `src/platform/moduleRegistry.ts` (new) | **The single canonical runtime module catalog** — 37 platform modules with owner, dependencies, status, production-ready, version, entry point, doc path, test coverage, health, feature-flag keys, permission keys. Leaf module: pure data + helpers (`dependentsOf`, `registrySummary`, `docUrl`, `sourceUrl`). |
| `src/features/admin/PlatformModuleRegistry.tsx` (new) | The admin console (presentation-only) rendering the catalog. |
| `src/features/admin/AdminSidebar.tsx` (edit) | New `registry` NavKey + Platform-group item "Platform Registry" (super-only). |
| `src/features/admin/AdminDashboard.tsx` (edit) | `registry` tab + render `{activeTab==='registry' && isSuper && <PlatformModuleRegistry/>}`. |

## Displayed fields (all 14 required)
Module Name · Description · Owner · Dependencies · Status · Production Ready · Version · Entry Point ·
Documentation Link · Test Coverage · Health · Feature Flags · Permissions · Related Services.

## Supported interactions (all required)
- **Search** — by name / owner / description / id / related service (`#registry_search`).
- **Filtering** — by group, status (stable/beta/experimental/planned), and production readiness.
- **Grouping** — modules grouped by owner domain (Surfaces / Platform / Identity / Experience / Commerce /
  Finance / Operations / Growth).
- **Dependencies visualization** — per module: "Depends on" + "Used by" (reverse graph, computed via
  `dependentsOf`); clicking a dependency chip sets a **dependency focus** (module + its deps + dependents),
  highlighting the focused card.
- **Open documentation / Open source entry** — links built from real repo paths (GitHub blob URLs).
- **Health indicators** — colored status dots (operational / degraded / planned / unknown) + a header rollup
  (total / production-ready / operational / degraded / planned).

## Reuse-first — no duplication (as mandated)
- **Feature-flag STATE** is read live from `platform.service.flags()` (the Integration Center provider registry) —
  the registry stores only flag **keys**, resolving state at render (`FLAG_COLOR` + live `state`).
- **Permission LABELS** are read live from `rbac.service.permissions()` — the registry stores only permission
  **keys**, resolving the bilingual label at render.
- **Doc/source links** are constructed from real repo paths (`REPO_BLOB_BASE`), not hardcoded per row.
- **UI** reuses `components/admin/EnterpriseUI` primitives (`WorkspaceHeader`, `MetricCard`, `EmptyStateBox`) and
  design tokens — no new design system, no Admin redesign.
- The catalog metadata that has **no runtime source** (name/owner/deps/version/entry/coverage) is defined once in
  `moduleRegistry.ts` — this **is** the canonical runtime registry (derived from the frozen
  [SERVICE_REGISTRY.md](../governance/SERVICE_REGISTRY.md)); it is not a duplicate of any existing runtime data.
- **Distinct from** the existing `PlatformRegistry.tsx` (which is the Integration Center's providers/brands/apps/
  flags/environments viewer). This module is a **module catalog**; they do not overlap.

## Runtime verification (Definition of Done — behavior, not code-presence)
A Puppeteer probe logged in as super admin (`+201000000005`), opened the Platform Registry nav item, and asserted:
```
navClicked: true · #platform_module_registry present · 37 module cards · search present · #mod_auth present
live feature-flag chips render · permission chips render · console errors: 0  → PROBE PASS
```

## Governance
- No new **service** was created (the catalog is a leaf **data** module like `platformModel.ts`), so no
  SERVICE_REGISTRY service header was required. The Platform Registry is itself listed as a module in the catalog
  (self-referential).
- Layer rules respected: `moduleRegistry.ts` imports nothing (leaf); the console (UI layer) imports
  `platform.service` + `rbac.service` (allowed).
- Gated by `isSuper` (Platform group) — only super admins reach it.

## Known limitations
- Some module facts (version, test coverage) are curated in the catalog; where a live source exists (flags,
  permissions) it is used. A future enhancement could derive test coverage from a CI report artifact.
- Health is a curated baseline reflecting the audit (e.g. payments/dispatch/analytics = degraded, website
  platform = planned); it is not yet a live health-check.

## Rollback
Additive + super-gated. Revert the code commit (`git revert <sha>`) or remove the `registry` nav item + render
line — no other module is affected; the sandbox demo and all existing admin consoles are unchanged.
