# Enterprise SaaS Foundation Report — HAAT NOW

Foundation-only sprint. **Additive, backward-compatible.** No existing module rewritten, no
production data migrated, no mandatory `tenant_id`. The registries initially point to the existing
HAAT NOW brand/config.

## Architecture changes (new, additive)
- **`src/platform/platformModel.ts`** — future-ready data model: `BrandConfig`, `ApplicationConfig`,
  `ProviderConfig`, `FeatureFlag`, `EnvironmentConfig`, `PlatformRegistry` + `DEFAULT_PLATFORM`
  seeded from the live config (designSystem colors, `Cairo` font, `com.haatnow.app`, the 6 home
  verticals, current providers/envs).
- **`src/platform/platform.service.ts`** — registry service: list/get per registry, `toggleApplication`,
  `setFlagState` (cycle), **`isFlagOn(key)`** (the connection seam for existing modules). localStorage
  store with `DEFAULT_PLATFORM` fallback so nothing breaks if empty; documented Supabase path.
- **`src/features/admin/PlatformRegistry.tsx`** — bilingual admin UI, 5 sub-tabs.

## New registries (all exist + reachable + bilingual)
| Registry | Seeded with | Interactive |
|---|---|---|
| **Brand Registry** | HAAT NOW (logos/colors/fonts/package/bundle/store/support/legal/status) | read + status |
| **Application Registry** | Food, Market, Pharmacy, Flowers (active); Express, Logistics (draft) | enable/disable toggle |
| **Provider Registry** | Storage(Supabase), Maps(Google), SMS, Push(FCM), Payment, Email, Analytics — per-country | read + status |
| **Feature Flag Center** | 8 flags (live_map, global_search, realtime_notifications, design_center, experience_builder, audit_logs, multi_tenant, push_notifications) with enabled/beta/experimental/disabled + scope | cycle state |
| **Environment Registry** | production, sandbox, staging, development (api/cdn/storage/domain) | read |

## Connected modules
- Reached from **one location**: Platform Center (`DesignCenter.tsx`) → new **"Platform Registry"**
  section (super-admin, sidebar `design`). Sits alongside Theme Engine / Design Center / Experience
  Builder / Assets / Country Branding — **no duplicate pages**.
- `platformService.isFlagOn(key)` is the wiring seam; flags are seeded to match real module state
  (live_map/global_search/etc. = enabled) so future gating is non-breaking. (Per Part 9 "prepare
  only the foundation", existing modules are NOT yet gated — avoids any regression.)

## Database impact
- **`supabase/migrations/20260626000002_platform_registry_foundation.sql`** — ADDITIVE: 6 new
  `platform_*` tables (organizations, brands, applications, providers, feature_flags, environments)
  with admin-read RLS + grants. No existing table touched. **Not yet applied** (MCP read-only;
  app uses the localStorage fallback meanwhile, so the file is safe to apply later).

## Multi-tenant readiness
- Model has `organization_id → brand_id → application/provider` hierarchy; flags carry `scope`
  (global/country/brand/application). The design layer already keys on `country` and can extend to
  `byTenant`. **Remaining for full multi-tenancy** (out of scope, per mission): `tenant_id` across
  core entities + tenant-scoped RLS, tenant resolution (domain/login), per-tenant provider secrets,
  per-flavor mobile builds. (See `03_WHITE_LABEL_STATUS.md`.)

## Navigation impact
- One new section pill inside the Platform Center. No top-level nav change. No existing route altered.

## Localization
- PlatformRegistry fully bilingual (AR/EN + RTL/LTR via `useAppConfig` `L(ar,en)`). 0 emoji
  (Lucide icons). Verified EN capture: `28-platform-registry-en.png`, `29-platform-flags-en.png`.

## Validation
- TypeScript ✅ · ESLint ✅ · Build ✅ · E2E 24/24 ✅ · 0 page errors. Existing modules untouched
  (only `DesignCenter.tsx` gained one import + one section render).
