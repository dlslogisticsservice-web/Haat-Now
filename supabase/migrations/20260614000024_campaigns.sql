-- ─────────────────────────────────────────────────────────────────────────────
-- 20260614000024_campaigns.sql — Campaign & Promotion platform (PHASE A).
-- Unified engine: banners, sponsored merchants/products, seasonal promotions +
-- per-event analytics. Additive + idempotent. RLS: anyone reads (for rendering),
-- Super Admins write; anyone logs impression/click events.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name varchar(160) not null,
  type varchar(40) not null default 'banner',          -- banner | sponsored_merchant | sponsored_product | promotion | seasonal
  status varchar(20) not null default 'draft'
    check (status in ('draft','scheduled','active','paused','expired','archived')),
  placement varchar(40) not null default 'hero',        -- hero | featured_merchants | featured_categories | seasonal | sponsored_products
  title text, subtitle text, image_url text, cta_label varchar(80), destination_url text,
  priority integer not null default 0,
  start_date timestamptz, end_date timestamptz,
  targeting jsonb not null default '{}'::jsonb,          -- {countries,cities,zones,merchants,branches,categories,products,segments}
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_campaigns_active on public.campaigns(status, placement, priority desc);

create table if not exists public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  event_type varchar(20) not null check (event_type in ('impression','click','conversion')),
  order_id uuid, revenue numeric(12,2),
  created_at timestamptz not null default now()
);
create index if not exists idx_campaign_events on public.campaign_events(campaign_id, event_type);

alter table public.campaigns       enable row level security;
alter table public.campaign_events enable row level security;

grant select on public.campaigns to anon, authenticated;
grant insert, update, delete on public.campaigns to authenticated;
grant select, insert on public.campaign_events to anon, authenticated;

do $$ begin
  create policy "Anyone reads campaigns" on public.campaigns for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Super admins manage campaigns" on public.campaigns for all to authenticated
    using (public.auth_is_admin() and public.auth_admin_scope() = 'super')
    with check (public.auth_is_admin() and public.auth_admin_scope() = 'super');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Anyone logs campaign events" on public.campaign_events for insert to anon, authenticated with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Admins read campaign events" on public.campaign_events for select to authenticated using (public.auth_is_admin());
exception when duplicate_object then null; end $$;
