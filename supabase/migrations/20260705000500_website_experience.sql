-- ═══════════════════════════════════════════════════════════════════════════════
-- Website Platform · Wave 4 — Website Experience config
--
-- Config stores for the Homepage Builder, Collections Platform and Promotion Engine
-- (all editable from Website Center). Navigation + search config reuse website_settings.
-- STRICTLY ADDITIVE + IDEMPOTENT; no existing table altered; nothing reads these until
-- the website experience flags are enabled per tenant.
-- Depends on: public.tenants, public.auth_tenant(), public.auth_has_permission(),
-- public.website_sites. Applies after them.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Homepage sections (aggregate) ────────────────────────────────────────────────
create table if not exists public.website_homepage_sections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  key text not null,
  type text not null check (type in ('hero','collections','promo_banners','categories','offers','app_cta','stats','testimonials','custom')),
  title text,
  enabled boolean not null default true,
  position int not null default 0,
  schedule jsonb not null default '{}',
  personalization jsonb not null default '{}',
  feature_flag text,
  config jsonb not null default '{}',
  version int not null default 1,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (site_id, key)
);
create index if not exists idx_website_homepage_site on public.website_homepage_sections(site_id, position) where deleted_at is null;

-- ── Collections (aggregate) ──────────────────────────────────────────────────────
create table if not exists public.website_collections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  key text not null,
  kind text not null check (kind in ('popular','nearby','top_rated','fast_delivery','best_offers','trending','seasonal','city')),
  title text not null,
  enabled boolean not null default true,
  position int not null default 0,
  params jsonb not null default '{}',
  version int not null default 1,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (site_id, key)
);
create index if not exists idx_website_collections_site on public.website_collections(site_id, position) where deleted_at is null;

-- ── Promotions / banners (aggregate) ──────────────────────────────────────────────
create table if not exists public.website_promotions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  priority int not null default 0,
  placement text not null check (placement in ('homepage','campaign','category','checkout','global')),
  category text,
  targeting jsonb not null default '{}',
  schedule jsonb not null default '{}',
  content jsonb not null default '{}',
  version int not null default 1,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists idx_website_promotions_site on public.website_promotions(site_id, placement) where deleted_at is null;

-- ── RLS — tenant-scoped, no anon, no using(true) ─────────────────────────────────
do $$
declare t text;
  wave4_tables text[] := array['website_homepage_sections','website_collections','website_promotions'];
begin
  foreach t in array wave4_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (tenant_id = public.auth_tenant())$p$, t || '_tenant_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_write', t);
    execute format($p$create policy %I on public.%I for all to authenticated using (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit')) with check (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit'))$p$, t || '_tenant_write', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
