-- ─────────────────────────────────────────────────────────────────────────────
-- Enterprise SaaS / White-Label FOUNDATION (PHASE ENTERPRISE-P).
-- ADDITIVE ONLY. No existing table is modified. No mandatory tenant_id is added
-- to existing entities. These tables are the future-ready registry foundation;
-- the app currently reads them via a localStorage fallback (platform.service.ts)
-- so this migration is safe to apply later without breaking production.
-- ─────────────────────────────────────────────────────────────────────────────

-- Organizations (future tenant root). Initially one row = HAAT NOW.
create table if not exists public.platform_organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  status varchar(20) not null default 'active',
  created_at timestamptz default timezone('utc', now())
);

-- Brand registry (per organization). Initially one row = HAAT NOW.
create table if not exists public.platform_brands (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.platform_organizations(id) on delete cascade,
  name text not null,
  display_name text,
  config jsonb not null default '{}'::jsonb,  -- logos/colors/fonts/store links/legal/support
  status varchar(20) not null default 'active',
  created_at timestamptz default timezone('utc', now())
);

-- Application registry (verticals). food/market/pharmacy/flowers/express/logistics.
create table if not exists public.platform_applications (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references public.platform_brands(id) on delete cascade,
  name text not null,
  vertical varchar(30) not null,
  enabled boolean not null default true,
  status varchar(20) not null default 'active',
  created_at timestamptz default timezone('utc', now())
);

-- Provider registry (payment/sms/email/maps/push/storage/analytics), per country.
create table if not exists public.platform_providers (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references public.platform_brands(id) on delete cascade,
  type varchar(20) not null,
  name text not null,
  country varchar(4) not null default '*',
  config jsonb not null default '{}'::jsonb,
  status varchar(20) not null default 'active',
  created_at timestamptz default timezone('utc', now())
);

-- Feature flags (per global/country/brand/application scope).
create table if not exists public.platform_feature_flags (
  key varchar(60) primary key,
  label text,
  state varchar(20) not null default 'disabled',   -- enabled|disabled|beta|experimental
  scope varchar(20) not null default 'global',      -- global|country|brand|application
  scope_value text,
  updated_at timestamptz default timezone('utc', now())
);

-- Environment / domain registry.
create table if not exists public.platform_environments (
  id uuid primary key default uuid_generate_v4(),
  name varchar(20) not null,   -- production|staging|development|sandbox
  api_endpoint text, cdn text, storage text, domain text,
  created_at timestamptz default timezone('utc', now())
);

-- Grants: admins read; super-admins write (RLS keeps it locked down).
grant select on public.platform_organizations, public.platform_brands, public.platform_applications,
  public.platform_providers, public.platform_feature_flags, public.platform_environments to authenticated;

alter table public.platform_organizations  enable row level security;
alter table public.platform_brands          enable row level security;
alter table public.platform_applications    enable row level security;
alter table public.platform_providers       enable row level security;
alter table public.platform_feature_flags   enable row level security;
alter table public.platform_environments    enable row level security;

-- Read policies (admin scope). Write policies intentionally omitted until the
-- multi-tenant rollout (foundation stays read-only server-side for now).
do $$
declare t text;
begin
  foreach t in array array['platform_organizations','platform_brands','platform_applications',
    'platform_providers','platform_feature_flags','platform_environments'] loop
    execute format('drop policy if exists "admins read %1$s" on public.%1$I', t);
    execute format('create policy "admins read %1$s" on public.%1$I for select to authenticated using (public.auth_is_admin())', t);
  end loop;
end $$;
