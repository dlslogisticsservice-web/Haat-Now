# Website Domain Model — "Website OS"

> HaaT Now · Phase 10 · Design only. Ubiquitous language + entity relationships that every
> `website_*` table, service, and API maps onto.

## 1. Aggregates & ownership

The **Tenant** is the root of every website aggregate. Nothing exists without a `tenant_id`.

```
Tenant (existing: public.tenants)
 └── Site (website_sites)                     1 tenant : N sites (usually 1, but franchises can have many)
      ├── Domain (website_domains)            1 site : N domains (1 primary + aliases)
      ├── Theme (website_themes)              1 site : 1 active theme  (+ N saved themes)
      │    └── ThemeTokens (website_theme_tokens)
      ├── Menu (website_menus)                1 site : N menus (header, footer, mobile, legal…)
      │    └── NavItem (website_navigation)   tree (parent_id) → pages/urls
      ├── Page (website_pages)                1 site : N pages   (tree via parent_id → nesting)
      │    ├── Section (website_sections)     1 page : N ordered sections (global or local)
      │    │    └── Block (website_blocks)    1 section : N ordered blocks (typed content)
      │    ├── Seo (website_seo)              1 page : 1 seo record
      │    ├── PagePermission (website_page_permissions)
      │    └── Revision (website_revisions)   append-only history per page
      ├── GlobalSection (website_sections where scope='global')  reusable across pages
      ├── Form (website_forms) → Submission (website_form_submissions)
      ├── Redirect (website_redirects)
      ├── Translation (website_translations)  per (entity, locale, field)
      ├── CustomCode (website_custom_code)    head/body injections, scoped
      ├── Setting (website_settings)          site-level config KV
      ├── FeatureFlag (website_feature_flags) per-site capability gates
      └── PublishHistory (website_publish_history)  immutable snapshots (versions)

Media (tenant-scoped, cross-site):
 Asset (website_assets)  ──has variants──►  Media (website_media)  ──used by──►  AssetUsage
 Folder/Collection (website_media_folders)

Platform-shared (not tenant-owned):
 Template (website_templates)            marketplace-installable site/page/section starters
 ComponentLibrary (website_component_library)  registry of block types + JSON schema
```

## 2. Core entities (definitions)

| Entity | Definition | Key invariants |
|---|---|---|
| **Site** | A publishable website belonging to a tenant | one `default_locale`; a `status` (draft/published/suspended); a `primary_domain_id` |
| **Page** | A routable document in a site | unique `slug` path per (site, locale); `parent_id` for nesting; `route_type` = static \| dynamic \| system |
| **Section** | An ordered container of blocks on a page | `scope` = local \| global; global sections are shared by reference |
| **Block** | A typed content unit rendered by a component | `type` ∈ ComponentLibrary; `props` JSON validated by the component's schema; `position`; per-device `visibility` |
| **Menu / NavItem** | Named navigation trees | items reference a page **by id** (not by path) so slug changes don't break nav |
| **Theme / ThemeToken** | Design system for a site | tokens resolve to CSS variables; one active theme per site |
| **Seo** | Per-page search metadata + structured data | canonical defaults to page URL; `robots` respects site status |
| **Media / Asset** | A stored file + its derived variants | one logical Asset → many Media variants (orig, webp, avif, sizes); usage tracked |
| **Form / Submission** | A data-collection surface + its entries | submissions are tenant-owned, spam-scored, optionally webhooked |
| **Redirect** | A source→target URL rule | per site; supports 301/302; wildcard/path-prefix |
| **Domain** | A hostname bound to a site | states: pending → verifying → verified → ssl_active → live; one primary per site |
| **Translation** | A localized field value | keyed (entity_type, entity_id, locale, field_path) |
| **Revision** | A snapshot of one entity at a point in time | append-only; restore creates a new revision, never mutates history |
| **PublishHistory** | An immutable site-wide snapshot at a publish point | monotonic `version`; the source of truth for the live site |
| **Template** | A reusable, installable starter | scope = site \| page \| section; platform- or tenant-owned |

## 3. Identity & routing rules
- **Nav references pages by `page_id`**, never by path — renaming a slug never breaks navigation or
  internal links (a class of bug in path-based CMSs).
- **Slugs are unique per (site_id, locale, parent_id)**; the full path is derived by walking
  `parent_id`. Changing a slug auto-creates a `website_redirects` 301 from the old path.
- **Dynamic routes** (`/blog/:slug`, `/stores/:city`) are pages with `route_type='dynamic'` and a
  `data_source` binding (e.g. blog posts, or a platform repository query scoped to the tenant).
- **System pages** (404, sitemap, robots) are `route_type='system'` and are never listed in nav.

## 4. Draft vs Published (the two-world model)
Every content entity has a **lifecycle state** and participates in two worlds:
- **Draft world** — the normalized `website_*` tables are always the *editable draft*. Editors mutate
  these; RLS restricts to `tenant_id = auth_tenant()` + `website.edit` permission.
- **Published world** — the **snapshot** (`website_publish_history` + per-page `published_snapshot`)
  is an immutable compiled copy the Rendering Engine serves. The public never reads draft tables.

A **publish** compiles the current draft graph for a site (or a subset of pages) into a new snapshot
version atomically. A **rollback** re-points the live snapshot to an earlier version. See
`PUBLISHING_ENGINE.md`.

## 5. Relationship cardinalities (quick reference)
- Tenant 1—N Site · Site 1—N Page · Page 1—N Section · Section 1—N Block.
- Site 1—N Domain (1 primary) · Site 1—1 active Theme (Theme 1—N Token).
- Site 1—N Menu · Menu 1—N NavItem (self-tree) · NavItem N—1 Page.
- Tenant 1—N Asset · Asset 1—N Media(variant) · Media N—N Block (via AssetUsage).
- Page 1—1 Seo · Page 1—N Revision · Site 1—N PublishHistory.
- Entity 1—N Translation (per locale).

## 6. Consistency & integrity
- **Tree integrity** (pages/sections/blocks/nav) is maintained transactionally in the CMS Service —
  reorder, move, and delete are single RPCs (no partial trees).
- **Referential safety on delete**: deleting a page nulls nav items pointing to it and records a
  redirect stub; deleting an asset is blocked if `AssetUsage` is non-empty (or triggers
  replace-everywhere). See `MEDIA_LIBRARY.md`.
- **Snapshot immutability**: published snapshots are never edited; a new publish always creates a new
  version row (Phase 9 idempotency pattern — publish is idempotent on a client-supplied token).
