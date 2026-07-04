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

-- Driver shifts — RLS + policies (attendance).
-- Phase-1 DB stabilization (2026-07): `public.driver_shifts` is already defined in
-- 20260614000028_operations_engine.sql (scheduled_start/end, actual_start/end, status
-- scheduled|active|closed) — the shape ops/shift.service.ts actually consumes. The earlier
-- draft here re-declared it with a DIFFERENT shape (started_at/ended_at, status open|closed);
-- because `create table if not exists` sees the 28 table, that CREATE only ever no-op'd and
-- misrepresented the schema. It is removed — the 28 definition is the single source of truth.
-- The RLS + policies + index below apply to that surviving table. A driver SELF-READ policy
-- is added (permissive SELECT — can only broaden access, never restrict) so drivers can read
-- their own shifts in live mode: shift.service active()/history() query driver_shifts as the
-- driver, and an admin-only policy alone would lock them out. Admin retains full access.
alter table public.driver_shifts enable row level security;
drop policy if exists driver_shifts_admin on public.driver_shifts;
create policy driver_shifts_admin on public.driver_shifts for all
  using (public.auth_is_admin()) with check (public.auth_is_admin());
drop policy if exists driver_shifts_self_read on public.driver_shifts;
create policy driver_shifts_self_read on public.driver_shifts for select
  using (driver_id = auth.uid());
create index if not exists idx_driver_shifts_driver on public.driver_shifts (driver_id, status);
