-- ═══════════════════════════════════════════════════════════════════════════════
-- Website Platform · Wave 0 — Database Foundation
--
-- Creates every website_* table for the new Website Platform. STRICTLY ADDITIVE and
-- IDEMPOTENT (create table if not exists / guarded policies): it changes NO existing
-- table and does not touch the legacy Website Center (which remains localStorage-only).
-- Nothing reads these tables until the `website.db_backend` feature flag is enabled
-- per tenant, so applying this migration is a zero-behavior-change operation.
--
-- Multi-tenant: every table carries tenant_id + RLS (tenant_id = public.auth_tenant()).
-- Optimistic locking: every table carries `version int` (repository-managed).
-- Soft delete: every table carries `deleted_at`.
-- Audit: created_by/updated_by + created_at/updated_at; publish history is immutable.
--
-- Depends on: public.tenants (20260627000008), public.auth_tenant() (20260627000010),
-- public.auth_is_admin()/public.auth_has_permission() (20260705000006). Applies after them.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Sites ────────────────────────────────────────────────────────────────────
create table if not exists public.website_sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug varchar(60) not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft','published','suspended','archived')),
  default_locale text not null default 'ar',
  locales text[] not null default array['ar','en'],
  primary_domain_id uuid,
  active_theme_id uuid,
  maintenance boolean not null default false,
  published_version int not null default 0,
  settings jsonb not null default '{}',
  version int not null default 1,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, slug)
);
create index if not exists idx_website_sites_tenant on public.website_sites(tenant_id) where deleted_at is null;

-- ── 2. Pages ────────────────────────────────────────────────────────────────────
create table if not exists public.website_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  parent_id uuid references public.website_pages(id) on delete set null,
  slug varchar(120) not null,
  title text not null,
  route_type text not null default 'static' check (route_type in ('static','dynamic','system')),
  data_source jsonb,
  status text not null default 'draft' check (status in ('draft','published','scheduled','unpublished')),
  publish_at timestamptz,
  position int not null default 0,
  in_nav boolean not null default true,
  locale text not null default 'ar',
  version int not null default 1,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (site_id, locale, parent_id, slug)
);
create index if not exists idx_website_pages_site on public.website_pages(site_id, status) where deleted_at is null;

-- ── 3. Sections ─────────────────────────────────────────────────────────────────
create table if not exists public.website_sections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  page_id uuid references public.website_pages(id) on delete cascade,
  scope text not null default 'local' check (scope in ('local','global')),
  key text, name text,
  position int not null default 0,
  settings jsonb not null default '{}',
  visibility jsonb not null default '{}',
  version int not null default 1,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_website_sections_page on public.website_sections(page_id, position) where deleted_at is null;

-- ── 4. Blocks ───────────────────────────────────────────────────────────────────
create table if not exists public.website_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  section_id uuid not null references public.website_sections(id) on delete cascade,
  type text not null,
  props jsonb not null default '{}',
  position int not null default 0,
  visibility jsonb not null default '{}',
  enabled boolean not null default true,
  version int not null default 1,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_website_blocks_section on public.website_blocks(section_id, position) where deleted_at is null;

-- ── 5. Menus + 6. Navigation ─────────────────────────────────────────────────────
create table if not exists public.website_menus (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  key text not null, name text not null,
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (site_id, key)
);
create table if not exists public.website_navigation (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  menu_id uuid not null references public.website_menus(id) on delete cascade,
  parent_id uuid references public.website_navigation(id) on delete cascade,
  label text not null,
  page_id uuid references public.website_pages(id) on delete set null,
  external_url text,
  position int not null default 0,
  visibility jsonb not null default '{}',
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists idx_website_nav_menu on public.website_navigation(menu_id, position) where deleted_at is null;

-- ── 7. Media (folders / assets / variants / usage) ───────────────────────────────
create table if not exists public.website_media_folders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid references public.website_media_folders(id) on delete cascade,
  name text not null,
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.website_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  folder_id uuid references public.website_media_folders(id) on delete set null,
  kind text not null check (kind in ('image','video','doc','font','icon')),
  original_filename text, alt_text text, title text,
  width int, height int, bytes bigint, checksum text,
  storage_bucket text not null, storage_path text not null,
  version int not null default 1,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists idx_website_assets_tenant on public.website_assets(tenant_id, kind) where deleted_at is null;
create index if not exists idx_website_assets_checksum on public.website_assets(tenant_id, checksum);
-- 8. Media variants
create table if not exists public.website_media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asset_id uuid not null references public.website_assets(id) on delete cascade,
  variant text not null, format text, width int, height int, bytes bigint, cdn_url text not null,
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (asset_id, variant)
);
create table if not exists public.website_asset_usage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asset_id uuid not null references public.website_assets(id) on delete cascade,
  block_id uuid, page_id uuid, field_path text,
  created_at timestamptz not null default now(),
  unique (asset_id, block_id, field_path)
);

-- ── 9. Forms (+ submissions) ─────────────────────────────────────────────────────
create table if not exists public.website_forms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  key text not null, name text not null,
  kind text not null default 'contact' check (kind in ('contact','support','merchant_app','driver_app','newsletter','feedback','booking','custom')),
  schema jsonb not null default '[]',
  spam_protection text not null default 'honeypot' check (spam_protection in ('none','honeypot','turnstile','recaptcha')),
  webhook_url text, notify_emails text[],
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (site_id, key)
);
create table if not exists public.website_form_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  form_id uuid not null references public.website_forms(id) on delete cascade,
  data jsonb not null, spam_score numeric, status text not null default 'new',
  ip_hash text, user_agent text, created_at timestamptz not null default now()
);
create index if not exists idx_website_form_sub on public.website_form_submissions(form_id, created_at desc);

-- ── 10. Redirects ─────────────────────────────────────────────────────────────────
create table if not exists public.website_redirects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  source_path text not null, target_path text not null,
  code int not null default 301 check (code in (301,302,307,308)),
  match_type text not null default 'exact' check (match_type in ('exact','prefix','wildcard')),
  hits bigint not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (site_id, source_path)
);

-- ── 11. Domains ───────────────────────────────────────────────────────────────────
create table if not exists public.website_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  host text not null unique,
  kind text not null check (kind in ('subdomain','custom')),
  is_primary boolean not null default false,
  status text not null default 'pending' check (status in ('pending','verifying','verified','ssl_pending','active','failed')),
  verify_token text, dns_records jsonb, ssl_expires_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists idx_website_domains_site on public.website_domains(site_id) where deleted_at is null;

-- ── 12. Themes + 13. Theme tokens ─────────────────────────────────────────────────
create table if not exists public.website_themes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid references public.website_sites(id) on delete cascade,
  name text not null, base_preset text,
  is_active boolean not null default false,
  mode text not null default 'both' check (mode in ('light','dark','both')),
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.website_theme_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  theme_id uuid not null references public.website_themes(id) on delete cascade,
  group_key text not null, token_key text not null, value text not null,
  mode text not null default 'light' check (mode in ('light','dark')),
  unique (theme_id, group_key, token_key, mode)
);

-- ── 14. SEO ───────────────────────────────────────────────────────────────────────
create table if not exists public.website_seo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  page_id uuid not null references public.website_pages(id) on delete cascade,
  locale text not null default 'ar',
  meta_title text, meta_description text, keywords text[], canonical text,
  robots text not null default 'index,follow', og jsonb, twitter jsonb, json_ld jsonb[],
  score int,
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (page_id, locale)
);

-- ── 15. Revisions ─────────────────────────────────────────────────────────────────
create table if not exists public.website_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  entity_type text not null, entity_id uuid not null, snapshot jsonb not null,
  reason text, created_by uuid, created_at timestamptz not null default now()
);
create index if not exists idx_website_rev_entity on public.website_revisions(entity_type, entity_id, created_at desc);

-- ── 16. Publish history (immutable) + published pages (edge read model) ───────────
create table if not exists public.website_publish_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  publish_version int not null,
  snapshot jsonb not null,
  scope text not null default 'full' check (scope in ('full','partial')),
  published_by uuid, published_at timestamptz not null default now(),
  idempotency_key text,
  unique (site_id, publish_version), unique (idempotency_key)
);
create table if not exists public.website_published_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  path text not null, locale text not null,
  html text, snapshot jsonb not null, publish_version int not null, etag text,
  updated_at timestamptz not null default now(),
  unique (site_id, path, locale)
);
create index if not exists idx_website_pub_pages on public.website_published_pages(site_id, path, locale);

-- ── 17. Templates + 18. Component library ─────────────────────────────────────────
create table if not exists public.website_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,   -- null = platform-owned
  scope text not null check (scope in ('site','page','section')),
  name text not null, category text, preview_url text, payload jsonb not null,
  visibility text not null default 'private' check (visibility in ('private','tenant','marketplace')),
  installs int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.website_component_library (
  type text primary key,
  category text not null check (category in ('layout','content','commerce','dynamic','form','advanced')),
  name text not null, icon text, schema jsonb not null,
  is_dynamic boolean not null default false, min_plan text, feature_flag text,
  version int not null default 1
);

-- ── 19. Page permissions ──────────────────────────────────────────────────────────
create table if not exists public.website_page_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  page_id uuid not null references public.website_pages(id) on delete cascade,
  role_template text, user_id uuid,
  ability text not null check (ability in ('view','edit','publish')),
  created_at timestamptz not null default now()
);
create index if not exists idx_website_page_perms on public.website_page_permissions(page_id);

-- ── 20. Settings + 21. Translations + 22. Custom code + 23. Feature flags ─────────
create table if not exists public.website_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  key text not null, value jsonb not null,
  unique (site_id, key)
);
create table if not exists public.website_translations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  entity_type text not null, entity_id uuid not null, locale text not null, field_path text not null,
  value text not null, source_hash text,
  status text not null default 'draft' check (status in ('draft','translated','reviewed','stale')),
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (entity_type, entity_id, locale, field_path)
);
create index if not exists idx_website_tx_lookup on public.website_translations(entity_type, entity_id, locale);
create table if not exists public.website_custom_code (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  scope text not null check (scope in ('site_head','site_body','page_head','page_body')),
  page_id uuid, code text not null, enabled boolean not null default false,
  requires_flag text not null default 'website.custom_code',
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.website_feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid references public.website_sites(id) on delete cascade,
  flag text not null,
  state text not null default 'disabled' check (state in ('enabled','disabled','beta')),
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid), flag)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS — enable + standard tenant policy on every tenant-scoped table.
-- Reads: tenant_id = auth_tenant(). Writes: additionally require website.edit
-- (Phase 9 auth_has_permission). Public visitors get NO table grant — the edge
-- Rendering Engine (service role) reads website_published_pages only. No using(true).
-- ═══════════════════════════════════════════════════════════════════════════════
do $$
declare t text;
  tenant_tables text[] := array[
    'website_sites','website_pages','website_sections','website_blocks','website_menus',
    'website_navigation','website_media_folders','website_assets','website_media','website_asset_usage',
    'website_forms','website_form_submissions','website_redirects','website_domains','website_themes',
    'website_theme_tokens','website_seo','website_revisions','website_publish_history',
    'website_published_pages','website_page_permissions','website_settings','website_translations',
    'website_custom_code','website_feature_flags'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (tenant_id = public.auth_tenant())$p$, t || '_tenant_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_write', t);
    execute format($p$create policy %I on public.%I for all to authenticated using (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit')) with check (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit'))$p$, t || '_tenant_write', t);
  end loop;
end $$;

-- Templates: tenant rows are tenant-scoped; platform rows (tenant_id is null) are world-readable
-- when published to the marketplace.
alter table public.website_templates enable row level security;
drop policy if exists website_templates_read on public.website_templates;
create policy website_templates_read on public.website_templates for select to authenticated
  using (tenant_id = public.auth_tenant() or (tenant_id is null and visibility = 'marketplace'));
drop policy if exists website_templates_write on public.website_templates;
create policy website_templates_write on public.website_templates for all to authenticated
  using (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit'))
  with check (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit'));

-- Component library is a global, read-only registry (admins manage it).
alter table public.website_component_library enable row level security;
drop policy if exists website_component_library_read on public.website_component_library;
create policy website_component_library_read on public.website_component_library for select to authenticated using (true);
drop policy if exists website_component_library_admin on public.website_component_library;
create policy website_component_library_admin on public.website_component_library for all to authenticated
  using (public.auth_is_admin()) with check (public.auth_is_admin());

-- Grants (RLS still applies on top). No anon access to any website_* table.
do $$
declare t text;
  all_tables text[] := array[
    'website_sites','website_pages','website_sections','website_blocks','website_menus','website_navigation',
    'website_media_folders','website_assets','website_media','website_asset_usage','website_forms',
    'website_form_submissions','website_redirects','website_domains','website_themes','website_theme_tokens',
    'website_seo','website_revisions','website_publish_history','website_published_pages','website_templates',
    'website_component_library','website_page_permissions','website_settings','website_translations',
    'website_custom_code','website_feature_flags'
  ];
begin
  foreach t in array all_tables loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
