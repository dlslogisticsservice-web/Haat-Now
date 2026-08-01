-- ════════════════════════════════════════════════════════════════════════════
-- HARDENING PASS #3 — permanent regression suite for the two surviving Red Team exploits.
--   RT-1  driver self-spoofs OWN GPS      (direct UPDATE drivers.current_lat/current_lng)
--   RT-2  driver self-inflates OWN score  (direct UPDATE drivers.priority_score)
-- Both are asserted permanently CLOSED, and the legitimate operational RPC paths + profile
-- edits are asserted still working. Run against a project with 20260801000002 applied:
--     psql "$DATABASE_URL" -f supabase/tests/hardening_pass_3_regression.sql
-- Any regression RAISES an exception (non-zero exit). All checks impersonate `authenticated`
-- and self-clean (zero residue).
-- ════════════════════════════════════════════════════════════════════════════

-- ── RT-1 + RT-2 — the exact reproduced exploits must be BLOCKED; the legit RPCs must work ──
do $$
declare
  v_uid uuid := gen_random_uuid();
  rt1 boolean := false; rt2 boolean := false;   -- true = attack blocked (good)
  rpc_loc boolean := false; rpc_avail boolean := false; rpc_pres boolean := false;
  v_lat double precision; v_pri numeric;
begin
  insert into public.drivers(id, phone_number, full_name, status, priority_score, active_orders,
                             max_concurrent_orders, rating, is_online, owner_user_id)
    values (v_uid, 'RT3-'||substr(v_uid::text,1,8), 'regr', 'offline', 0, 0, 1, 5.0, false, v_uid);

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';

  -- RT-1 — direct self-GPS spoof (the exact Red Team PATCH).
  begin update public.drivers set current_lat = 24.7, current_lng = 46.7 where id = v_uid; exception when others then rt1 := true; end;
  -- RT-2 — direct self-priority inflation (the exact Red Team PATCH).
  begin update public.drivers set priority_score = 9999 where id = v_uid; exception when others then rt2 := true; end;

  -- Legitimate operational paths (ownership-validated SECURITY DEFINER RPCs) must still work.
  begin perform public.driver_update_location(30.0444, 31.2357); rpc_loc := true;   exception when others then rpc_loc := false; end;
  perform pg_sleep(1.1);  -- clear the 1s wall-clock rate limit
  begin perform public.driver_set_availability('available');   rpc_avail := true; exception when others then rpc_avail := false; end;
  perform pg_sleep(1.1);
  begin perform public.driver_set_presence(false);             rpc_pres := true;  exception when others then rpc_pres := false; end;

  execute 'reset role';
  select current_lat, priority_score into v_lat, v_pri from public.drivers where id = v_uid;

  delete from public.drivers where id = v_uid;

  if not rt1 then raise exception 'RT-1 REGRESSION: driver self-GPS spoof accepted via direct UPDATE'; end if;
  if not rt2 then raise exception 'RT-2 REGRESSION: driver self-priority inflation accepted via direct UPDATE'; end if;
  if v_lat = 24.7 then raise exception 'RT-1 REGRESSION: current_lat holds the attacker value'; end if;
  if coalesce(v_pri, -1) <> 0 then raise exception 'RT-2 REGRESSION: priority_score was mutated by a client'; end if;
  if round(v_lat::numeric, 4) <> 30.0444 then raise exception 'RT-1 REGRESSION: legit driver_update_location did not persist'; end if;
  if not (rpc_loc and rpc_avail and rpc_pres) then raise exception 'RT REGRESSION: a legitimate operational RPC broke'; end if;
  raise notice 'RT-1 + RT-2 PASS: direct operational writes blocked; ownership-validated RPCs intact';
end$$;

-- ── Profile fields remain client-editable (no over-blocking) ──
do $$
declare v_uid uuid := gen_random_uuid(); v_name text; ok boolean := false;
begin
  insert into public.drivers(id, phone_number, full_name, status, priority_score, active_orders,
                             max_concurrent_orders, rating, is_online, owner_user_id)
    values (v_uid, 'PF3-'||substr(v_uid::text,1,8), 'before', 'offline', 0, 0, 1, 5.0, false, v_uid);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin update public.drivers set full_name = 'after', vehicle_plate = 'ABC-123' where id = v_uid; ok := true; exception when others then ok := false; end;
  execute 'reset role';
  select full_name into v_name from public.drivers where id = v_uid;
  delete from public.drivers where id = v_uid;
  if not ok or v_name <> 'after' then raise exception 'REGRESSION: legitimate driver profile edit was blocked'; end if;
  raise notice 'PROFILE PASS: driver profile fields remain client-editable';
end$$;

-- ── INSERT-seeding of operational/scoring columns is neutralized (same root-cause class) ──
do $$
declare v_uid uuid := gen_random_uuid(); v_pri numeric; v_lat double precision; v_status text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.drivers(id, phone_number, full_name, status, priority_score, active_orders,
                               max_concurrent_orders, rating, is_online, current_lat, current_lng, owner_user_id)
      values (v_uid, 'SD3-'||substr(v_uid::text,1,8), 'seed', 'available', 9999, 5, 99, 5.0, true, 24.7, 46.7, v_uid);
  exception when others then null; end;
  execute 'reset role';
  select priority_score, current_lat, status into v_pri, v_lat, v_status from public.drivers where id = v_uid;
  delete from public.drivers where id = v_uid;
  if coalesce(v_pri, -1) <> 0 then raise exception 'REGRESSION: priority_score seeded via client INSERT'; end if;
  if v_lat is not null then raise exception 'REGRESSION: current_lat seeded via client INSERT'; end if;
  if v_status is not null and v_status <> 'offline' then raise exception 'REGRESSION: status seeded via client INSERT'; end if;
  raise notice 'INSERT-SEED PASS: operational columns forced to safe defaults on client INSERT';
end$$;

-- ── Structural: guard trigger present + operational RPCs not anon-executable ──
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'drivers_guard_trg' and tgrelid = 'public.drivers'::regclass)
    then raise exception 'REGRESSION: drivers_guard_trg trigger missing'; end if;
  if has_function_privilege('anon','public.driver_update_location(double precision,double precision)','execute')
     or has_function_privilege('anon','public.driver_set_presence(boolean)','execute')
     or has_function_privilege('anon','public.driver_set_availability(text)','execute')
    then raise exception 'REGRESSION: an operational driver RPC is executable by anon'; end if;
  raise notice 'STRUCTURAL PASS: drivers_guard present; operational RPCs revoked from anon';
end$$;

select 'HARDENING_PASS_3_REGRESSION: RT-1 + RT-2 closed' as result;
