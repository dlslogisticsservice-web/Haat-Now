# Website Platform · Database Reference (Wave 0)

> Reference for `supabase/migrations/20260705000100_website_platform_foundation.sql`.
> All tables are `public.website_*`, multi-tenant, RLS-enabled, additive/idempotent.

## Conventions (every tenant-scoped table)
- `id uuid pk default gen_random_uuid()`, `tenant_id uuid not null references tenants(id) on delete cascade`.
- `version int not null default 1` (optimistic locking — repository-managed).
- `deleted_at timestamptz` (soft delete), `created_at`/`updated_at timestamptz not null default now()`.
- `created_by`/`updated_by uuid` where user attribution matters.
- RLS: `select` → `tenant_id = auth_tenant()`; write (`all`) → `+ auth_has_permission('website.edit')`.
- No `to anon` grants. No `using(true)` on tenant tables.

## Tables

| # | Table | Purpose | Key constraints / indexes |
|---|---|---|---|
| 1 | `website_sites` | publishable site per tenant | `unique(tenant_id, slug)`; status CHECK |
| 2 | `website_pages` | routable pages (tree via `parent_id`) | `unique(site_id, locale, parent_id, slug)`; status/route CHECK |
| 3 | `website_sections` | ordered block containers | `scope` CHECK; idx `(page_id, position)` |
| 4 | `website_blocks` | typed content units | idx `(section_id, position)` |
| 5 | `website_menus` | named nav trees | `unique(site_id, key)` |
| 6 | `website_navigation` | nav items (ref page by id) | idx `(menu_id, position)` |
| 7 | `website_media_folders` | media folder tree | — |
| 8 | `website_assets` | uploaded originals | idx `(tenant_id, kind)`, `(tenant_id, checksum)`; kind CHECK |
| 9 | `website_media` | derived variants (webp/avif/sizes) | `unique(asset_id, variant)` |
| 10 | `website_asset_usage` | usage graph (delete-safety) | `unique(asset_id, block_id, field_path)` |
| 11 | `website_forms` | data-collection surfaces | `unique(site_id, key)`; kind/spam CHECK |
| 12 | `website_form_submissions` | form entries | idx `(form_id, created_at desc)` |
| 13 | `website_redirects` | URL rules | `unique(site_id, source_path)`; code/match CHECK |
| 14 | `website_domains` | host bindings | `unique(host)`; kind/status CHECK |
| 15 | `website_themes` | per-site themes | mode CHECK |
| 16 | `website_theme_tokens` | design tokens | `unique(theme_id, group_key, token_key, mode)` |
| 17 | `website_seo` | per-page SEO | `unique(page_id, locale)` |
| 18 | `website_revisions` | append-only revisions | idx `(entity_type, entity_id, created_at desc)` |
| 19 | `website_publish_history` | immutable snapshots (versions) | `unique(site_id, publish_version)`, `unique(idempotency_key)`; scope CHECK |
| 20 | `website_published_pages` | edge read model (O(1) render) | `unique(site_id, path, locale)`; idx lookup |
| 21 | `website_templates` | installable starters | scope/visibility CHECK; nullable tenant = platform |
| 22 | `website_component_library` | block-type registry (global) | pk `type`; category CHECK |
| 23 | `website_page_permissions` | page-level RBAC | ability CHECK |
| 24 | `website_settings` | site KV | `unique(site_id, key)` |
| 25 | `website_translations` | per-field translations | `unique(entity_type, entity_id, locale, field_path)` |
| 26 | `website_custom_code` | head/body injections | scope CHECK; `requires_flag` |
| 27 | `website_feature_flags` | per-tenant/site capability gates | `unique(tenant_id, coalesce(site_id,…), flag)`; state CHECK |

*(The brief lists 23 named tables; 4 supporting tables — media_folders, asset_usage,
form_submissions, published_pages — complete the aggregates. All 27 are `website_*`, all additive.)*

## RLS policy shape (per tenant table)
```sql
alter table public.website_pages enable row level security;
create policy website_pages_tenant_read on public.website_pages for select to authenticated
  using (tenant_id = public.auth_tenant());
create policy website_pages_tenant_write on public.website_pages for all to authenticated
  using (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit'))
  with check (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit'));
```
Special cases: `website_templates` also exposes `tenant_id is null and visibility='marketplace'`
for shared marketplace items; `website_component_library` is a global read-only registry (admin-managed).

## Publishing & audit support
- **Versioning**: `version` on every table (optimistic lock) + `website_publish_history.publish_version`
  (monotonic per site) + `website_sites.published_version`.
- **Publishing**: immutable `website_publish_history` (idempotency_key unique) + denormalized
  `website_published_pages` for edge reads.
- **Audit**: `created_by`/`updated_by` + immutable `website_revisions`; platform `operation_events`
  captures publish/domain/permission actions (later waves).

## Public read model
Visitors never read these tables directly. The (future) edge Rendering Engine uses the service role
to read `website_published_pages` (published version only), scoped to the resolved tenant/host.
