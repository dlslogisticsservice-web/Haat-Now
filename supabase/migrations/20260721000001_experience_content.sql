-- ════════════════════════════════════════════════════════════════════════════
-- EXPERIENCE CONTENT — authored overrides for the experience surfaces.
--
-- The Experience Studio's Visual Authoring lets an operator edit the copy of an
-- experience surface (title/body/CTA/icon/variant). The shipped defaults live in code
-- (experience-content/content.ts); only the OVERRIDES are data. One row per edited
-- experience, addressed by its flag id.
--
-- Persisted through adminCrud like every other platform-state table. RLS enabled (not
-- merely policied), following the discipline the operations-readiness migration set.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.experience_content (
  id uuid primary key default gen_random_uuid(),
  experience_id text not null unique,
  -- Partial ExperienceContentOverride as JSON; merged onto the default at read time.
  override text not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index if not exists idx_experience_content_lookup on public.experience_content(experience_id);

alter table public.experience_content enable row level security;

drop policy if exists "ops read experience content"  on public.experience_content;
drop policy if exists "ops write experience content" on public.experience_content;
create policy "ops read experience content"  on public.experience_content for select using (public.is_ops_admin());
create policy "ops write experience content" on public.experience_content for all    using (public.is_ops_admin()) with check (public.is_ops_admin());

grant select, insert, update, delete on public.experience_content to authenticated;

-- Verify RLS actually enabled (the check the earlier rls_recovery migration lacked).
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'experience_content' and c.relrowsecurity = false
  ) then
    raise exception 'experience_content: RLS not enabled';
  end if;
end $$;
