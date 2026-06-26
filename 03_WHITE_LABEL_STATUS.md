# 03 — White-Label Status (inspection-only)

## Verdict: **PARTIAL — per-COUNTRY white-labeling YES; multi-TENANT (multi-brand) NO.**

What exists is a **single-brand, multi-country** theming/experience system — not a multi-tenant
white-label platform (no concept of separate organizations/brands with isolated data + their own
apps/domains).

## Supported today (evidence)
| Dimension | Supported? | Evidence |
|---|---|---|
| Multiple **countries** | ✅ | `countries.ts` (8), `AppConfigContext`, design `byCountry` layers |
| Multiple **themes** (color/typography/cards/buttons/icons/layout/glass/motion) | ✅ | `designSystem.ts DesignConfig`, `DesignContext` draft/published/versions, `applyDesign()` live CSS vars |
| Multiple **logos / splash / branding** per country | ✅ | `DesignConfig.branding` (appLogo/splashLogo/favicon/darkLogo/lightLogo); `CountryBranding.tsx` per-country splash; `screen_experiences` table |
| Multiple **color palettes** | ✅ | `DesignConfig.colors` editable in DesignCenter, per base/country scope |
| Per-country **experience screens** (onboarding/splash, media, Lottie/video) | ✅ | `src/experience/*`, `ExperienceBuilder.tsx`, `experience.service` → `screen_experiences` |
| Multiple **brands / companies / tenants** | ❌ | No tenant/org/company table in 38 migrations |
| Multiple **domains / subdomains** | ❌ | No domain routing; single `start_url:'/'`, single `appId` |
| Per-brand **mobile apps** (package/bundle) | ❌ | Single `appId: com.haatnow.app` in `capacitor.config.ts` |
| Per-brand **payment / SMS / email / maps providers** | ❌ | Providers are global env vars; no per-tenant provider config table |
| Per-brand **store links** | ❌ | None |
| Per-brand **feature flags** | ❌ | No feature-flag system |

## Closest thing to tenancy
- `admin_users.scope` = `super` | `country` (migration `20260614000018_admin_country_scoping.sql`)
  → country-scoped admin access. This is **country isolation**, not tenant isolation.

## Missing for true multi-tenant white-label
1. `tenants`/`organizations` table + `tenant_id` foreign keys across core tables + RLS by tenant.
2. Tenant resolution (domain/subdomain → tenant, or login → tenant).
3. Per-tenant design/experience scope (extend `byCountry` → `byTenant`/`byTenant+country`).
4. Per-tenant provider config (payment/SMS/email/maps/firebase) + secrets vault.
5. Per-tenant mobile build pipeline (dynamic `appId`/icons/splash per flavor).
6. Tenant-aware analytics + billing.

**Effort to reach multi-tenant:** large (DB schema + RLS rewrite + provider abstraction). The
**design/experience layer is already structured to extend** (it keys on `country`; adding a
`tenant` dimension is incremental there). The hard part is data isolation + provider abstraction.
