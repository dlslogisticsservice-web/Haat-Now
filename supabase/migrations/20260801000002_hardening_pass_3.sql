-- ════════════════════════════════════════════════════════════════════════════
-- HARDENING PASS #3 — eliminate the two surviving Red Team exploits (RED_TEAM_*):
--   RT-1  driver spoofs OWN GPS      (direct UPDATE drivers.current_lat/current_lng)
--   RT-2  driver inflates OWN score  (direct UPDATE drivers.priority_score)
--
-- Root cause (identical to B1/B6): the `drivers` table has a table-wide UPDATE grant to
-- `authenticated` + an own-row RLS policy, and NO column lock — so a driver can PATCH their
-- own operational/scoring columns via PostgREST. Hardening Pass #2 applied the column-lock
-- model to `orders` and `driver_earnings` but did NOT cover `drivers`.
--
-- This pass applies the SAME protection model to `drivers` and nothing else:
--   1. drivers_guard (SECURITY INVOKER) — operational/scoring columns are immutable to
--      direct client writes (authenticated/anon); INSERT-seeding of those columns is reset
--      to safe defaults. SECURITY DEFINER RPCs (owner role) + service_role pass through.
--   2. Ownership-validated SECURITY DEFINER RPCs for the legitimate operational writes
--      (location / presence / availability): auth.uid() + driver ownership + tenant +
--      coordinate validation + rate limit.
--   3. Profile columns (full_name, phone, vehicle_plate, licence, …) remain client-editable.
--
-- Scope is strictly RT-1/RT-2. No other subsystem, RPC, or table is changed. Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. drivers_guard — operational/scoring columns are not client-writable ─────────────────
-- Detection model matches orders_guard (Pass #2): SECURITY INVOKER, so `current_user`
-- reflects the REAL writer. Direct PostgREST writes run as `authenticated`/`anon` and are
-- constrained; validated SECURITY DEFINER RPCs (owner role) and the ops-admin path pass.
create or replace function public.drivers_guard()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_admin boolean;
begin
  -- Guard ONLY direct client writes. DEFINER RPCs (owner role) + service_role pass through.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  v_admin := public.is_ops_admin();
  if v_admin then
    return new;  -- Ops admins manage drivers through the admin console (RLS: drivers_admin_write).
  end if;

  if tg_op = 'INSERT' then
    -- Self-registration stays allowed, but a client can never SEED operational/scoring
    -- columns. Force them to the table defaults regardless of what was submitted.
    new.current_lat           := null;
    new.current_lng           := null;
    new.last_seen_at          := null;
    new.priority_score        := 0;
    new.active_orders         := 0;
    new.rating                := 5.0;
    new.max_concurrent_orders := 1;
    new.status                := 'offline';
    new.is_online             := false;
    return new;
  end if;

  -- UPDATE: operational, scoring, presence, and isolation columns are immutable to clients.
  -- These are written only by validated RPCs (driver_update_location / driver_set_presence /
  -- driver_set_availability / respond_dispatch / recalc_driver_performance), which run as owner.
  if new.current_lat           is distinct from old.current_lat
     or new.current_lng        is distinct from old.current_lng
     or new.priority_score     is distinct from old.priority_score
     or new.rating             is distinct from old.rating
     or new.active_orders      is distinct from old.active_orders
     or new.max_concurrent_orders is distinct from old.max_concurrent_orders
     or new.status             is distinct from old.status
     or new.is_online          is distinct from old.is_online
     or new.last_seen_at       is distinct from old.last_seen_at
     or new.zone_id            is distinct from old.zone_id
     or new.tenant_id          is distinct from old.tenant_id
     or new.owner_user_id      is distinct from old.owner_user_id then
    raise exception 'drivers: protected operational column is not client-writable' using errcode = '42501';
  end if;

  return new;
end;$$;

drop trigger if exists drivers_guard_trg on public.drivers;
create trigger drivers_guard_trg before insert or update on public.drivers
  for each row execute function public.drivers_guard();

-- ── 2. Ownership-validated operational RPCs ────────────────────────────────────────────────
-- Every RPC verifies: auth.uid() present · driver ownership (id = auth.uid() OR
-- owner_user_id = auth.uid()) · tenant isolation · (location) valid coordinates · rate limit.
-- Ownership is the BINDING isolation check — a caller can only ever touch their own driver
-- row. Tenant/country are defense-in-depth: `drivers` has no per-row country column (country
-- derives from the tenant), and tenant_id is nullable (not populated at registration today),
-- so the tenant check rejects only a *mismatched* forged cross-tenant token and never
-- hard-fails a legitimate null-tenant driver.

-- Location: the secure replacement for a direct PATCH of current_lat/current_lng.
create or replace function public.driver_update_location(p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare d record; v_claim_tenant text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = 'P0001'; end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid coordinates' using errcode = 'P0001';
  end if;

  select id, tenant_id, last_seen_at into d
    from public.drivers
   where id = auth.uid() or owner_user_id = auth.uid()
   for update;
  if not found then raise exception 'permission denied' using errcode = '42501'; end if;
  if d.tenant_id is null then raise exception 'driver tenant not resolved' using errcode = 'P0001'; end if;
  -- Rate limit: at most one location write per second per driver.
  -- Rate limit on wall-clock (clock_timestamp), not now() (which is frozen at tx start), so
  -- the limiter measures real elapsed time between calls: at most one write per second.
  if d.last_seen_at is not null and d.last_seen_at > clock_timestamp() - interval '1 second' then
    raise exception 'rate limited' using errcode = 'P0001';
  end if;

  update public.drivers
     set current_lat = p_lat, current_lng = p_lng, last_seen_at = now()
   where id = d.id;
end;$$;

-- Presence: online/offline toggle (replaces the direct is_online PATCH).
create or replace function public.driver_set_presence(p_is_online boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare d record; v_claim_tenant text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = 'P0001'; end if;
  if p_is_online is null then raise exception 'Invalid presence' using errcode = 'P0001'; end if;

  select id, tenant_id, status, last_seen_at into d
    from public.drivers
   where id = auth.uid() or owner_user_id = auth.uid()
   for update;
  if not found then raise exception 'permission denied' using errcode = '42501'; end if;
  -- Tenant isolation (defense in depth): a forged cross-tenant token cannot act on this
  -- driver. Null tenant (drivers created before tenant backfill) is allowed — ownership binds.
  v_claim_tenant := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id';
  if d.tenant_id is not null and v_claim_tenant is not null and v_claim_tenant <> d.tenant_id::text then
    raise exception 'tenant mismatch' using errcode = '42501';
  end if;
  -- Rate limit on wall-clock (clock_timestamp), not now() (which is frozen at tx start), so
  -- the limiter measures real elapsed time between calls: at most one write per second.
  if d.last_seen_at is not null and d.last_seen_at > clock_timestamp() - interval '1 second' then
    raise exception 'rate limited' using errcode = 'P0001';
  end if;

  update public.drivers
     set is_online = p_is_online,
         -- Presence never overrides a system-managed 'busy'; it only flips available/offline.
         status = case
                    when not p_is_online then 'offline'
                    when d.status = 'offline' then 'available'
                    else d.status
                  end,
         last_seen_at = now()
   where id = d.id;
end;$$;

-- Availability: driver-selectable status, whitelisted to non-operational values only.
create or replace function public.driver_set_availability(p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare d record; v_claim_tenant text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = 'P0001'; end if;
  -- 'busy' is system-managed (set by respond_dispatch on accept); drivers cannot self-assign it.
  if p_status is null or p_status not in ('available', 'offline') then
    raise exception 'Invalid availability status' using errcode = 'P0001';
  end if;

  select id, tenant_id, last_seen_at into d
    from public.drivers
   where id = auth.uid() or owner_user_id = auth.uid()
   for update;
  if not found then raise exception 'permission denied' using errcode = '42501'; end if;
  -- Tenant isolation (defense in depth): a forged cross-tenant token cannot act on this
  -- driver. Null tenant (drivers created before tenant backfill) is allowed — ownership binds.
  v_claim_tenant := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id';
  if d.tenant_id is not null and v_claim_tenant is not null and v_claim_tenant <> d.tenant_id::text then
    raise exception 'tenant mismatch' using errcode = '42501';
  end if;
  -- Rate limit on wall-clock (clock_timestamp), not now() (which is frozen at tx start), so
  -- the limiter measures real elapsed time between calls: at most one write per second.
  if d.last_seen_at is not null and d.last_seen_at > clock_timestamp() - interval '1 second' then
    raise exception 'rate limited' using errcode = 'P0001';
  end if;

  update public.drivers
     set status = p_status, is_online = (p_status <> 'offline'), last_seen_at = now()
   where id = d.id;
end;$$;

-- Only authenticated drivers may call these; never anon/public.
revoke execute on function public.driver_update_location(double precision, double precision) from anon, public;
revoke execute on function public.driver_set_presence(boolean)  from anon, public;
revoke execute on function public.driver_set_availability(text)  from anon, public;
grant execute on function public.driver_update_location(double precision, double precision) to authenticated;
grant execute on function public.driver_set_presence(boolean)  to authenticated;
grant execute on function public.driver_set_availability(text) to authenticated;
