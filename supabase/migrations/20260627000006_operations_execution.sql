-- ─────────────────────────────────────────────────────────────────────────────
-- Operations execution layer — the operations event log (timeline) + driver shifts.
-- Every manual ops action (reassign, unassign, pause/resume, shift) writes an
-- operation_events row. Admin-only via auth_is_admin RLS. Additive.
-- ─────────────────────────────────────────────────────────────────────────────

-- Operations timeline
create table if not exists public.operation_events (
  id          uuid primary key default uuid_generate_v4(),
  actor_id    uuid,
  action      text not null,          -- order_reassigned | order_unassigned | driver_paused | ...
  entity_type text,                   -- order | driver | zone | merchant | shift
  entity_id   uuid,
  meta        jsonb,
  created_at  timestamptz default now()
);
alter table public.operation_events enable row level security;
drop policy if exists operation_events_admin on public.operation_events;
create policy operation_events_admin on public.operation_events for all
  using (public.auth_is_admin()) with check (public.auth_is_admin());
create index if not exists idx_operation_events_created on public.operation_events (created_at desc);

-- Driver shifts (check-in / check-out, attendance)
create table if not exists public.driver_shifts (
  id         uuid primary key default uuid_generate_v4(),
  driver_id  uuid references public.drivers(id),
  started_at timestamptz default now(),
  ended_at   timestamptz,
  status     text default 'open',     -- open | closed
  created_at timestamptz default now()
);
alter table public.driver_shifts enable row level security;
drop policy if exists driver_shifts_admin on public.driver_shifts;
create policy driver_shifts_admin on public.driver_shifts for all
  using (public.auth_is_admin()) with check (public.auth_is_admin());
create index if not exists idx_driver_shifts_driver on public.driver_shifts (driver_id, status);
