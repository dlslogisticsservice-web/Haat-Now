-- ─────────────────────────────────────────────────────────────────────────────
-- White-label tenants — the multi-tenant SaaS control table. Holds tenant identity,
-- lifecycle status, branding, custom domain, and subscription plan/limits.
-- Provisioned from the Admin Panel (no manual SQL). Admin-managed via RLS; active
-- tenants are publicly readable for domain → tenant resolution.
-- NOTE: full row-level data isolation (a tenant_id on every domain table + scoped
-- RLS) is the separate isolation rollout documented in WHITE_LABEL_PLATFORM_REPORT.md.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.tenants (
  id              uuid primary key default uuid_generate_v4(),
  brand_name      varchar(100) not null,
  slug            varchar(60) unique,
  status          varchar(20) default 'draft',      -- draft | active | suspended | archived
  vertical        varchar(30) default 'food',
  country_code    varchar(5),
  contact_email   varchar(120),
  -- branding (reuses the Design Center / Theme engine tokens)
  logo_url        text,
  primary_color   varchar(9) default '#A3F95B',
  secondary_color varchar(9),
  font_family     varchar(60),
  -- domains
  subdomain       varchar(60),
  custom_domain   varchar(120),
  ssl_status      varchar(20) default 'pending',     -- pending | active | failed
  -- subscription
  plan            varchar(20) default 'starter',     -- free | starter | business | enterprise
  order_limit     integer,
  driver_limit    integer,
  merchant_limit  integer,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.tenants enable row level security;

drop policy if exists tenants_public_read_active on public.tenants;
create policy tenants_public_read_active on public.tenants for select using (status = 'active');

drop policy if exists tenants_admin_all on public.tenants;
create policy tenants_admin_all on public.tenants for all
  using (public.auth_is_admin()) with check (public.auth_is_admin());

create index if not exists idx_tenants_status on public.tenants (status);
create unique index if not exists idx_tenants_subdomain on public.tenants (subdomain) where subdomain is not null;
