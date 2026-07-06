-- ═══════════════════════════════════════════════════════════════════════════════
-- Website Platform · Wave 2 — Publishing + Conversion + Analytics
--
-- Adds the config store for the App Conversion Engine and the website analytics event
-- table. STRICTLY ADDITIVE + IDEMPOTENT; no existing table altered; nothing reads these
-- until the website feature flags are enabled per tenant. Publishing itself reuses the
-- Wave 1 website_snapshots + website_publish_history + the website_published_current view.
-- Depends on: public.tenants, public.auth_tenant(), public.auth_has_permission(),
-- public.website_sites (Wave 0/1). Applies after them.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── App Conversion Engine — config rules (aggregate) ─────────────────────────────
create table if not exists public.website_conversion_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid references public.website_sites(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  priority int not null default 0,
  trigger_match text not null default 'all' check (trigger_match in ('all','any')),
  targeting jsonb not null default '{}',      -- countries/languages/devices/platforms/visitor
  triggers jsonb not null default '[]',       -- [{type, threshold?, value?}]
  content jsonb not null default '{}',        -- title/body/ctas/media/coupon/deepLink/storeLinks
  frequency jsonb not null default '{}',      -- dismissible/showOnce/maxPerSession/cooldownSeconds
  timing jsonb not null default '{}',         -- delaySeconds
  version int not null default 1,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_website_conv_rules_tenant on public.website_conversion_rules(tenant_id, enabled) where deleted_at is null;
create index if not exists idx_website_conv_rules_site on public.website_conversion_rules(site_id) where deleted_at is null;

-- ── Website analytics events (append-only; beacon ingestion) ──────────────────────
create table if not exists public.website_analytics_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null,
  anon_id text not null,                       -- salted, cookieless; NO PII
  path text, locale text, device text, country text, campaign_source text,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_website_analytics_type on public.website_analytics_events(tenant_id, type, created_at desc);
create index if not exists idx_website_analytics_anon on public.website_analytics_events(tenant_id, anon_id);

-- ── RLS — tenant-scoped, no anon, no using(true) ─────────────────────────────────
do $$
declare t text;
  wave2_tables text[] := array['website_conversion_rules','website_analytics_events'];
begin
  foreach t in array wave2_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (tenant_id = public.auth_tenant())$p$, t || '_tenant_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_write', t);
    execute format($p$create policy %I on public.%I for all to authenticated using (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit')) with check (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit'))$p$, t || '_tenant_write', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
