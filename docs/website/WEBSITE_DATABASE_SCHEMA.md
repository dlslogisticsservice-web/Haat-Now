# Website Database Schema — "Website OS"

> HaaT Now · Phase 10 · Design only (no migration is created in this phase). Production-ready DDL
> sketches for all `website_*` tables. **Every table is multi-tenant** (`tenant_id` + RLS).

## 0. Conventions (apply to every table)
- `id uuid primary key default gen_random_uuid()`.
- `tenant_id uuid not null references public.tenants(id) on delete cascade` + index.
- `site_id uuid` (where applicable) `references website_sites(id) on delete cascade` + index.
- `created_at/updated_at timestamptz not null default now()`; `created_by/updated_by uuid`.
- **RLS enabled on every table.** Standard policy pair:
  - *tenant read/write:* `using (tenant_id = public.auth_tenant()) with check (tenant_id = public.auth_tenant())` gated additionally by `public.auth_has_permission('website.…')` for writes (Phase 9 RBAC).
  - *no anon/public table access* — the public site is served by the Rendering Engine edge function (service role) reading published snapshots only.
- Money/critical mutations (publish, clone, domain-verify) go through **SECURITY DEFINER RPCs** with idempotency keys (Phase 9 pattern), not direct table writes.
- `status`/lifecycle columns use `check` constraints (learn from the Phase 8 finding that `orders.status` was unconstrained).

> DDL below is **illustrative** — column lists are complete enough to build against; final types/
> constraints are settled in the implementation phase.

---

## 1. website_sites
```sql
create table website_sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug varchar(60) not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft','published','suspended','archived')),
  default_locale text not null default 'ar',
  locales text[] not null default array['ar','en'],
  primary_domain_id uuid,                       -- FK added after website_domains
  active_theme_id uuid,                         -- FK to website_themes
  maintenance boolean not null default false,
  published_version int not null default 0,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index idx_website_sites_tenant on website_sites(tenant_id);
```

## 2. website_pages
```sql
create table website_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, site_id uuid not null references website_sites(id) on delete cascade,
  parent_id uuid references website_pages(id) on delete set null,   -- nesting
  slug varchar(120) not null,                                       -- segment, not full path
  title text not null,
  route_type text not null default 'static' check (route_type in ('static','dynamic','system')),
  data_source jsonb,                                                -- dynamic route binding
  status text not null default 'draft' check (status in ('draft','published','scheduled','unpublished')),
  publish_at timestamptz,                                           -- scheduled publish
  position int not null default 0,
  in_nav boolean not null default true,
  locale text not null default 'ar',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (site_id, locale, parent_id, slug)
);
create index idx_website_pages_site on website_pages(site_id, status);
```

## 3. website_sections
```sql
create table website_sections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, site_id uuid not null,
  page_id uuid references website_pages(id) on delete cascade,       -- null when scope='global'
  scope text not null default 'local' check (scope in ('local','global')),
  key text,                                                          -- stable key for global sections
  name text, position int not null default 0,
  settings jsonb not null default '{}',                              -- background, padding, width
  visibility jsonb not null default '{}',                            -- {desktop,tablet,mobile}
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_website_sections_page on website_sections(page_id, position);
```

## 4. website_blocks
```sql
create table website_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, site_id uuid not null,
  section_id uuid not null references website_sections(id) on delete cascade,
  type text not null references website_component_library(type),     -- validated block type
  props jsonb not null default '{}',                                 -- validated by component schema
  position int not null default 0,
  visibility jsonb not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_website_blocks_section on website_blocks(section_id, position);
```

## 5. website_navigation & 6. website_menus
```sql
create table website_menus (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, site_id uuid not null references website_sites(id) on delete cascade,
  key text not null,                        -- 'header' | 'footer' | 'mobile' | 'legal' | custom
  name text not null,
  unique (site_id, key)
);
create table website_navigation (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, site_id uuid not null,
  menu_id uuid not null references website_menus(id) on delete cascade,
  parent_id uuid references website_navigation(id) on delete cascade,  -- nested nav
  label text not null,
  page_id uuid references website_pages(id) on delete set null,        -- reference by id, not path
  external_url text,
  position int not null default 0,
  visibility jsonb not null default '{}'
);
create index idx_website_nav_menu on website_navigation(menu_id, position);
```

## 7. website_assets & 8. website_media  (see MEDIA_LIBRARY.md)
```sql
create table website_media_folders (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  parent_id uuid references website_media_folders(id) on delete cascade, name text not null
);
create table website_assets (                        -- logical asset (one per uploaded original)
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  folder_id uuid references website_media_folders(id) on delete set null,
  kind text not null check (kind in ('image','video','doc','font','icon')),
  original_filename text, alt_text text, title text,
  width int, height int, bytes bigint, checksum text,
  storage_bucket text not null, storage_path text not null,
  created_at timestamptz not null default now()
);
create table website_media (                          -- derived variants of an asset
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  asset_id uuid not null references website_assets(id) on delete cascade,
  variant text not null,                              -- 'orig'|'webp'|'avif'|'w320'|'w768'|'w1600'
  format text, width int, height int, bytes bigint,
  cdn_url text not null
);
create table website_asset_usage (                    -- replace-everywhere + delete-safety graph
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  asset_id uuid not null references website_assets(id) on delete cascade,
  block_id uuid, page_id uuid, field_path text,
  unique (asset_id, block_id, field_path)
);
```

## 9. website_forms  (+ submissions)  (see WEBSITE_BUILDER_SPEC.md · Forms)
```sql
create table website_forms (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid not null,
  key text not null, name text not null,
  kind text not null default 'contact' check (kind in ('contact','support','merchant_app','driver_app','newsletter','feedback','booking','custom')),
  schema jsonb not null default '[]',              -- field definitions + validation
  spam_protection text not null default 'honeypot' check (spam_protection in ('none','honeypot','turnstile','recaptcha')),
  webhook_url text, notify_emails text[],
  unique (site_id, key)
);
create table website_form_submissions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  form_id uuid not null references website_forms(id) on delete cascade,
  data jsonb not null, spam_score numeric, status text default 'new',
  ip_hash text, user_agent text, created_at timestamptz not null default now()
);
create index idx_form_sub_form on website_form_submissions(form_id, created_at desc);
```

## 10. website_redirects
```sql
create table website_redirects (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid not null,
  source_path text not null, target_path text not null,
  code int not null default 301 check (code in (301,302,307,308)),
  match_type text not null default 'exact' check (match_type in ('exact','prefix','wildcard')),
  hits bigint not null default 0, created_at timestamptz not null default now(),
  unique (site_id, source_path)
);
```

## 11. website_domains  (see WHITE_LABEL_WEBSITE.md)
```sql
create table website_domains (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  site_id uuid not null references website_sites(id) on delete cascade,
  host text not null unique,                       -- 'brand.com' or 'brand.haatnow.app'
  kind text not null check (kind in ('subdomain','custom')),
  is_primary boolean not null default false,
  status text not null default 'pending' check (status in ('pending','verifying','verified','ssl_pending','active','failed')),
  verify_token text, dns_records jsonb, ssl_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_website_domains_site on website_domains(site_id);
```

## 12. website_themes & 13. website_theme_tokens  (see THEME_ENGINE.md)
```sql
create table website_themes (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid,
  name text not null, base_preset text,            -- extends a system preset
  is_active boolean not null default false, mode text default 'both' check (mode in ('light','dark','both')),
  created_at timestamptz not null default now()
);
create table website_theme_tokens (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  theme_id uuid not null references website_themes(id) on delete cascade,
  group_key text not null,                          -- 'color'|'typography'|'spacing'|'radius'|'shadow'|'glass'|'button'|'card'|'navbar'|'footer'
  token_key text not null, value text not null, mode text default 'light' check (mode in ('light','dark')),
  unique (theme_id, group_key, token_key, mode)
);
```

## 14. website_seo
```sql
create table website_seo (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  page_id uuid not null references website_pages(id) on delete cascade, locale text not null default 'ar',
  meta_title text, meta_description text, keywords text[], canonical text,
  robots text default 'index,follow', og jsonb, twitter jsonb, json_ld jsonb[],
  score int, unique (page_id, locale)
);
```

## 15. website_revisions
```sql
create table website_revisions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid not null,
  entity_type text not null,                        -- 'page'|'section'|'block'|'theme'|'nav'
  entity_id uuid not null, snapshot jsonb not null,
  reason text, created_by uuid, created_at timestamptz not null default now()
);
create index idx_website_rev_entity on website_revisions(entity_type, entity_id, created_at desc);
```

## 16. website_publish_history  (the live snapshot source of truth)
```sql
create table website_publish_history (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  site_id uuid not null references website_sites(id) on delete cascade,
  version int not null,                             -- monotonic per site
  snapshot jsonb not null,                          -- full compiled site graph (pages+blocks+nav+theme+seo)
  scope text not null default 'full' check (scope in ('full','partial')),
  published_by uuid, published_at timestamptz not null default now(),
  idempotency_key text, unique (site_id, version), unique (idempotency_key)
);
-- Per-page denormalized published snapshot for O(1) edge reads + CDN:
create table website_published_pages (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  site_id uuid not null, path text not null, locale text not null,
  html text, snapshot jsonb not null, version int not null, etag text,
  updated_at timestamptz not null default now(), unique (site_id, path, locale)
);
create index idx_pub_pages_lookup on website_published_pages(site_id, path, locale);
```

## 17. website_templates
```sql
create table website_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,                                   -- null = platform-owned marketplace template
  scope text not null check (scope in ('site','page','section')),
  name text not null, category text, preview_url text,
  payload jsonb not null,                           -- installable graph
  visibility text not null default 'private' check (visibility in ('private','tenant','marketplace')),
  installs int not null default 0, created_at timestamptz not null default now()
);
```

## 18. website_component_library  (block-type registry)
```sql
create table website_component_library (
  type text primary key,                            -- 'hero','pricing','restaurants',...
  category text not null,                            -- 'layout'|'content'|'commerce'|'dynamic'|'form'|'advanced'
  name text not null, icon text,
  schema jsonb not null,                             -- JSON-schema for props (validation + auto-form)
  is_dynamic boolean not null default false,         -- pulls live platform data
  min_plan text, feature_flag text,                 -- gating
  version int not null default 1
);
```

## 19. website_page_permissions  (page-level RBAC)
```sql
create table website_page_permissions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  page_id uuid not null references website_pages(id) on delete cascade,
  role_template text,                                -- from Phase 9 role_permissions
  user_id uuid, ability text not null check (ability in ('view','edit','publish')),
  unique (page_id, coalesce(role_template,''), coalesce(user_id,'00000000-0000-0000-0000-000000000000'::uuid), ability)
);
```

## 20. website_settings  (site KV)
```sql
create table website_settings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid not null,
  key text not null, value jsonb not null, unique (site_id, key)
);   -- cookie banner, analytics ids, favicon, default OG, maintenance message, etc.
```

## 21. website_translations
```sql
create table website_translations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid not null,
  entity_type text not null,                         -- 'page'|'block'|'section'|'seo'|'nav'
  entity_id uuid not null, locale text not null, field_path text not null,
  value text not null, source_hash text,             -- translation-memory key
  status text default 'draft' check (status in ('draft','translated','reviewed','stale')),
  unique (entity_type, entity_id, locale, field_path)
);
create index idx_website_tx_lookup on website_translations(entity_type, entity_id, locale);
```

## 22. website_custom_code
```sql
create table website_custom_code (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid not null,
  scope text not null check (scope in ('site_head','site_body','page_head','page_body')),
  page_id uuid, code text not null, enabled boolean not null default false,
  requires_flag text not null default 'website.custom_code'   -- gated by feature flag + permission
);
```

## 23. website_feature_flags
```sql
create table website_feature_flags (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid,
  flag text not null, state text not null default 'disabled' check (state in ('enabled','disabled','beta')),
  unique (coalesce(site_id,'00000000-0000-0000-0000-000000000000'::uuid), flag)
);
```

---

## RLS template (applied to every table above)
```sql
alter table website_pages enable row level security;
-- read/write your own tenant, writes additionally gated by a website permission
create policy website_pages_tenant_rw on website_pages for all to authenticated
  using (tenant_id = public.auth_tenant())
  with check (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit'));
-- publish/clone/domain are RPC-only (SECURITY DEFINER), never direct writes.
```
Public visitors get **no** table grant — the Rendering Engine edge function (service role) reads
`website_published_pages`/`website_publish_history` filtered to the resolved tenant + published
version. This closes the multi-tenant leakage class the Phase 8 audit flagged.

## Index & scale notes (10k tenants)
- Hot path is `website_published_pages(site_id, path, locale)` — a single indexed lookup, CDN-cached.
- Draft trees are queried by `site_id` with `position` ordering — composite indexes provided.
- `website_publish_history.snapshot` and `website_published_pages.snapshot` are JSONB; large sites
  are partial-published (per-page snapshot rows) so no single row is unbounded.
- Consider table partitioning by `tenant_id` hash for `website_form_submissions` and
  `website_page_analytics` at very high volume (deferred; see SCALABILITY notes in ROADMAP).
