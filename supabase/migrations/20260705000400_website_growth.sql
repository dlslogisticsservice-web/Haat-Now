-- ═══════════════════════════════════════════════════════════════════════════════
-- Website Platform · Wave 3 — App Growth Engine + Experimentation
--
-- Config store for the Mobile App Growth Engine (multi-campaign, A/B variants) and the
-- experiment results counters. STRICTLY ADDITIVE + IDEMPOTENT; no existing table altered;
-- nothing reads these until the website growth flags are enabled per tenant.
-- Depends on: public.tenants, public.auth_tenant(), public.auth_has_permission(),
-- public.website_sites. Applies after them.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Growth campaigns (aggregate: version + soft delete) ──────────────────────────
create table if not exists public.website_growth_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid references public.website_sites(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft','active','paused','expired')),
  priority int not null default 0,
  targeting jsonb not null default '{}',      -- countries/languages/devices/platforms/visitor
  utm jsonb not null default '{}',            -- source/medium/campaign
  trigger_match text not null default 'all' check (trigger_match in ('all','any')),
  triggers jsonb not null default '[]',       -- delay/scroll%/checkout%/cartValue/visitCount/referral
  frequency jsonb not null default '{}',      -- frequency/cooldown
  timing jsonb not null default '{}',         -- delay
  starts_at timestamptz,
  expires_at timestamptz,
  variants jsonb not null default '[]',       -- [{key, weight, content{title/body/ctas/media/coupon/deeplink/store}}]
  version int not null default 1,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_website_growth_tenant on public.website_growth_campaigns(tenant_id, status) where deleted_at is null;
create index if not exists idx_website_growth_site on public.website_growth_campaigns(site_id) where deleted_at is null;

-- ── Experiment results (per campaign variant counters) ────────────────────────────
create table if not exists public.website_experiment_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.website_growth_campaigns(id) on delete cascade,
  variant_key text not null,
  exposures bigint not null default 0,
  conversions bigint not null default 0,
  installs bigint not null default 0,
  coupon_redemptions bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (campaign_id, variant_key)
);
create index if not exists idx_website_experiment_campaign on public.website_experiment_results(tenant_id, campaign_id);

-- ── RLS — tenant-scoped, no anon, no using(true) ─────────────────────────────────
do $$
declare t text;
  wave3_tables text[] := array['website_growth_campaigns','website_experiment_results'];
begin
  foreach t in array wave3_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (tenant_id = public.auth_tenant())$p$, t || '_tenant_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_write', t);
    execute format($p$create policy %I on public.%I for all to authenticated using (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit')) with check (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit'))$p$, t || '_tenant_write', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
