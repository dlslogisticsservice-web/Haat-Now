# Website Schema Migration Framework (vNext)

Makes the Website Platform survive every future release. Any stored website — from
any prior schema version, partial, corrupt, `null`, or from a *future* build — is
always upgraded to the latest schema **before it renders**, and the loader **never
throws**. This eliminates the class of "old object missing a new field" runtime
crashes (e.g. the `site.cookie.enabled` incident).

## Files
- `src/services/websiteSchema.ts` — the framework (schema version, migrations, validation, repair, backward-compat, safe loader). Depends only on a `WebsiteSite` **type** (no runtime coupling → no import cycle; the defaults are dependency-injected).
- `src/services/website.service.ts` — integration: `getPublishedSite` / `getDraftSite` route every record through `loadWebsite(...)` (via `loadSafe`), stamp `schemaVersion`, persist the upgrade once, and retain the migration report. `healthReport()` powers the Super Admin monitor. The single source of truth for defaults is `defaultSite()`, injected into the framework.
- `src/features/admin/WebsiteCenter.tsx` — the Super Admin **Website Health Monitor** badge (`#studio_health`).
- `src/website-platform/__tests__/website-schema.test.ts` — 10 framework tests.

## Concepts
- **`schemaVersion`** — the object's *structural* version (`WEBSITE_SCHEMA_VERSION = 3`). **Independent of `seedVersion`** (which tracks *content* freshness). They are never conflated.
- **Forward compatibility** — unknown fields from a newer build are preserved (the merge spreads existing keys; migrations only add/rename known fields). A `schemaVersion: 99` record keeps its extra fields and still renders.

## The safe load pipeline (`loadWebsite`)
```
raw record
  → recover        (parse; null/partial/corrupt → defaults)   [never throws]
  → backward-compat (declarative legacy → new field remaps, always run)
  → migrate         (isolated v→v+1 steps, from inferred version to latest)
  → validate        (structural checks → issues[])
  → repair          (non-destructive backfill from injected defaults)
  → stamp schemaVersion = latest
  → { site, MigrationReport }
```
Rendering **never** uses raw storage data — only the output of this pipeline.

## Migrations (isolated, chainable)
`MIGRATIONS` is an ordered list of small `{ from, to, migrate() }` steps — never a
giant function. To evolve the schema: add a `v(N)→v(N+1)` entry and bump
`WEBSITE_SCHEMA_VERSION`. Current chain:
- **v1→v2** — guarantee `cookie` + `analytics` objects.
- **v2→v3** — guarantee `footer` object + its `columns`/`legalLinks`/`social` arrays.

A migration that throws is logged to the report and skipped; `repair` is the safety
net, so the load always yields a valid site (PART 12 recovery).

## Backward compatibility (`applyBackwardCompat`, always runs)
Declarative remaps translate deprecated fields, non-destructively and idempotently:
`socialLinks → footer.social`, `legalLinks → footer.legalLinks`,
`heroTitle → first hero block .title`, `analyticsId → analytics.measurementId`.

## Validation & repair
- `validateSite(site)` → `{ valid, issues[] }` (checks pages, navigation, blog, footer arrays, cookie, analytics, seoDefaults).
- `repairSite(site, tenant, makeDefault)` → deep, **non-destructive** backfill (`mergeDefaults`) plus critical guarantees (non-empty pages, boolean `cookie.enabled`, string `footer.copyright`, valid `status`). Existing content and unknown fields are preserved.

## Migration report (PART 9) & Health Monitor (PART 10)
Every non-trivial load stores a `MigrationReport` (per tenant, `haat_sb_website_reports`):
website id, from/to version, `created` / `renamed` / `repaired` fields, `warnings`,
`errors`, `recovered`, `changed`. Surfaced **only to Super Admin** in the Website
Studio top bar (`#studio_health`): schema version vs latest, validation status,
storage size, and the last migration summary.

## Guarantees
- Never throws, never shows the Error Boundary for a bad record, never requires the user to clear storage.
- Single source of truth for defaults (`defaultSite`); no duplicated migration/validation/default logic.
- Fully typed, strict TS. No UI/design/data changes to customer-facing surfaces.
