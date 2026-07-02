# Phase 0.2 — Theme Presets · Implementation Report

Implemented exactly per `PRODUCTIZATION_MASTER_PLAN_V2` §Theme Presets. Extend-only, reuse the existing theme
engine — no `ThemeEngine2`/`ThemeService2`/`DesignStore2`/`BrandStore2`, no duplicate token model. Ran to the
full `IMPLEMENTATION_STANDARD.md` Definition of Done.

## Files changed
- **New:** `src/services/themePresets.service.ts` — governed service (header incl. AUTHORIZED BY / Phase /
  reuse / duplicate analysis / consumers / merge candidate). Model + CRUD + save/apply/duplicate/export/import
  + `effective()` (preset + overrides). Owner domain: Platform/Experience.
- **New:** `src/features/admin/ThemePresetsPanel.tsx` — Design Center panel (not a redesign; a new section).
- **Extended:** `src/design/DesignContext.tsx` — added one additive method `applyPreset(config)` (atomic
  set-base-and-publish; fixes patch+publish staleness). No engine redesign.
- **Extended:** `src/features/admin/DesignCenter.tsx` — added the **"Presets" (القوالب)** section that renders
  the panel. No token editors touched.
- **Extended:** `src/services/tenant.service.ts` — `tenantTheme()` now uses the tenant's assigned preset as the
  **base** (`theme_preset_id`), with the flat brand fields as overrides.
- **Updated:** `SERVICE_REGISTRY.md` — `themePresets.service` entry (same commit, per governance §7).

## Reuse proof (no duplication)
- **`designSystem`** — presets store a `DesignConfig`; reuse `applyDesign`/`mergeDesign`/`DEFAULT_DESIGN`. No
  new token/color/typography/spacing/radius/shadow model.
- **`DesignContext`/`applyDesign`** — apply propagates through the **existing** publish → `DesignProvider`
  effect → `:root`. No new synchronization logic.
- **adminCrud persistence namespace** — presets persist in `haat_crud_theme_presets` (the existing localStorage
  `haat_crud_*` mechanism); **no second persistence mechanism**.
- **`tenant.service`** — assignment writes only `theme_preset_id` (tenant stores **id + overrides**, never a
  preset copy).
- **RBAC** — preset mutations gated by `<Can perm="platform.design.manage">`.
- **Existing CRUD engine / White Label / Experience / Platform** — reused; nothing duplicated.

## The 10 requirements — delivered + verified
| # | Requirement | Implementation | Verified |
|---|---|---|---|
| 1 | Theme Preset Model | `ThemePreset { id, name, config: DesignConfig, system, created_at }` | — |
| 2 | Preset CRUD | list/get/create/update/remove | seeded 4, ops work |
| 3 | Save current as preset | `create(name, d.draftConfig)` (Design Center) | button wired |
| 4 | Apply preset | `d.applyPreset(config)` → publish → `:root` | **`--color-primary-fixed` a3f95b→38bdf8**, button bg `rgb(56,189,248)` |
| 5 | Duplicate | `duplicate(id)` | 4→5 |
| 6 | Export | `exportPreset(id)` → JSON (clipboard) | service returns JSON |
| 7 | Import | `importPreset(json)` | creates preset |
| 8 | Default preset | 4 system presets seeded (HAAT NOW/Ocean/Sunset/Royal) | present |
| 9 | Preview | `applyConfig(config)` (transient) | live preview |
| 10 | Assign to tenants | `theme_preset_id` via `tenant.service.update` (multi-select) | tenant assigned = preset-ocean |

## Runtime verification (real UI)
Design Center → **Presets**: 4 presets render → **Apply Ocean** → `:root --color-primary-fixed = #38bdf8` +
a live component bg = `rgb(56,189,248)` → **Duplicate** (5) → **Assign** to a tenant (`theme_preset_id`) →
**Delete** non-system (4). **0 console errors.**

## Propagation verification (all presentation layers)
Apply → `d.applyPreset` publishes the config to the design store → `DesignProvider` applies `publishedConfig`
to `:root` on **every** surface mount. Since Customer/Driver/Merchant/Admin (and the future Website) all read
the same `:root` tokens, the change propagates with **no additional sync logic**. Verified: after apply, the
**published store** (`haat_design_store_v1.published.base.colors.primary`) = `#38bdf8`, and it **re-applies on
reload** (`:root` stays `#38bdf8`) — so any surface rendered next inherits it.

## Persistence verification
Presets persist in `haat_crud_theme_presets` (count stable across reload). Applied theme persists via the
design store. Tenant assignment persists (`theme_preset_id`). All survive reload.

## Bug found & fixed
`apply()` initially called `patchDraft` then `publish()` synchronously — `publish` read the **stale**
`store.draft` closure and republished the pre-patch config (`:root` unchanged). **Fix:** added an atomic
`DesignContext.applyPreset(config)` (single `setStore`, sets base + published + a rollback version). Re-verified
apply now cascades correctly.

## Production verification
Typecheck 0 · Lint 0 · Build ✓ · E2E 24/24 · runtime + propagation + persistence verified · 0 console errors.
Deployed via the git workflow; production verified via Vercel `version.json` == merged commit (GitHub Actions
API rate-limited → gated on local CI-equivalent, per IMPLEMENTATION_STANDARD §5).

## Remaining blockers
- None for Theme Presets. **Per-tenant runtime resolution** (each tenant's preset auto-applied by hostname on
  the public site) arrives with the Website Platform (Phase 1) + live multi-tenant boot — the resolver
  (`tenantTheme` preset base) is already in place. **Payment Rule** unaffected (no billing here).

**Phase 0.2 complete, deployed, production-verified. Stopping — not continuing to Phase 0.3.**
