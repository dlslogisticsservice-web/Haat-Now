-- ─────────────────────────────────────────────────────────────────────────────
-- Visual Experience Builder (VEB) — server-backed screen publishing.
-- Replaces the localStorage-only model so published screens propagate to ALL
-- users. Additive only: no auth, no existing-table, no deployment changes.
-- ─────────────────────────────────────────────────────────────────────────────

-- Live config: one row per (country_code, screen_type) holding the current draft
-- and published JSON for that screen.
create table if not exists public.screen_experiences (
  id              uuid primary key default gen_random_uuid(),
  country_code    text not null,
  screen_type     text not null check (screen_type in ('splash','login','onboarding')),
  draft_config    jsonb,
  published_config jsonb,
  version_number  int  not null default 1,
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (country_code, screen_type)
);

-- Version history for rollback — one row per previously-published snapshot.
create table if not exists public.screen_experience_history (
  id             uuid primary key default gen_random_uuid(),
  country_code   text not null,
  screen_type    text not null,
  version_number int  not null,
  config         jsonb not null,
  published_by   uuid,
  published_at   timestamptz not null default now()
);

create index if not exists idx_screen_experiences_country on public.screen_experiences (country_code);
create index if not exists idx_screen_exp_history_lookup on public.screen_experience_history (country_code, screen_type, version_number desc);

-- ── RLS: anyone may READ published experiences; only super-admins may WRITE ──
alter table public.screen_experiences enable row level security;
alter table public.screen_experience_history enable row level security;

-- Public read (the live app, anon + authenticated, needs published configs).
drop policy if exists screen_exp_read on public.screen_experiences;
create policy screen_exp_read on public.screen_experiences
  for select using (true);

drop policy if exists screen_exp_history_read on public.screen_experience_history;
create policy screen_exp_history_read on public.screen_experience_history
  for select using (true);

-- Writes restricted to super-admins (mirrors the design_settings policy shape).
drop policy if exists screen_exp_write on public.screen_experiences;
create policy screen_exp_write on public.screen_experiences
  for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.scope = 'super'))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.scope = 'super'));

drop policy if exists screen_exp_history_write on public.screen_experience_history;
create policy screen_exp_history_write on public.screen_experience_history
  for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.scope = 'super'))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.scope = 'super'));

-- keep updated_at fresh
create or replace function public.touch_screen_experiences() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_touch_screen_experiences on public.screen_experiences;
create trigger trg_touch_screen_experiences before update on public.screen_experiences
  for each row execute function public.touch_screen_experiences();

-- ── Storage bucket for experience assets (public CDN reads) ──
insert into storage.buckets (id, name, public)
  values ('experience-assets', 'experience-assets', true)
  on conflict (id) do nothing;

-- Public read of experience assets.
drop policy if exists experience_assets_read on storage.objects;
create policy experience_assets_read on storage.objects
  for select using (bucket_id = 'experience-assets');

-- Super-admins manage experience assets.
drop policy if exists experience_assets_write on storage.objects;
create policy experience_assets_write on storage.objects
  for all
  using (bucket_id = 'experience-assets' and exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.scope = 'super'))
  with check (bucket_id = 'experience-assets' and exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.scope = 'super'));
