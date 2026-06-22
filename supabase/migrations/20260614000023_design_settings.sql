-- ─────────────────────────────────────────────────────────────────────────────
-- 20260614000023_design_settings.sql
-- Server-backed persistence for the enterprise Design System (PHASE A).
-- Stores draft + published theme configs (global + per-country) with versioning.
-- The frontend currently persists to localStorage; this table is the optional
-- server sync (designService can read/write it). Additive + idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.design_settings (
  id           uuid primary key default gen_random_uuid(),
  state        varchar(20) not null check (state in ('draft','published')),
  country_code varchar(5),            -- null = global/base theme
  config       jsonb not null,
  version      integer not null default 1,
  is_active    boolean not null default true,
  updated_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_design_settings_lookup on public.design_settings(state, country_code, created_at desc);

alter table public.design_settings enable row level security;

-- The PUBLISHED theme must be readable by everyone (anon + authenticated) so the app
-- can theme before login. Writes are restricted to Super Admins.
grant select on public.design_settings to anon, authenticated;
grant insert, update, delete on public.design_settings to authenticated;

do $$ begin
  create policy "Anyone reads design settings" on public.design_settings
    for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Super admins manage design settings" on public.design_settings
    for all to authenticated
    using (public.auth_is_admin() and public.auth_admin_scope() = 'super')
    with check (public.auth_is_admin() and public.auth_admin_scope() = 'super');
exception when duplicate_object then null; end $$;
