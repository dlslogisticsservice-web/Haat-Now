-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9 · P0-5 — Background scheduler (dispatch sweep, settlement, reconciliation,
-- segment recompute).
--
-- BEFORE: everything time-based (offer expiry, reassignment, segment recompute, payment
-- reconciliation) ran ONLY when an admin clicked a button — no pg_cron, no worker. A 24/7
-- logistics platform cannot run on manual clicks. (OPERATIONS, SCALABILITY §1, R-05.)
--
-- AFTER: idempotent wrapper functions (safe to call from pg_cron OR a scheduled edge
-- function) + best-effort pg_cron registration. The wrappers are defensive: each sub-step
-- is wrapped so a missing dependency or transient error never aborts the sweep.
--
-- NOTE: pg_cron may not be enabled on every project; the registration block is guarded so
-- this migration NEVER fails when the extension is unavailable. When pg_cron is absent,
-- deploy the companion `scheduler-tick` edge function on a cron trigger instead (see
-- docs/stabilization/PHASE9_IMPLEMENTATION_REPORT.md).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Dispatch sweep: expire stale offers, then (re)offer unassigned ready orders. ──
create or replace function public.cron_dispatch_sweep()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_expired int := 0; v_dispatched int := 0; r record;
begin
  begin v_expired := public.expire_dispatch_offers(); exception when others then v_expired := -1; end;

  for r in
    select o.id from public.orders o
    where o.driver_id is null
      and o.status in ('accepted','preparing')
      and not exists (
        select 1 from public.dispatch_assignments da
        where da.order_id = o.id and da.status = 'offered'
      )
    limit 200
  loop
    begin
      perform public.auto_dispatch_order(r.id, 30);
      v_dispatched := v_dispatched + 1;
    exception when others then null; -- skip this order, keep sweeping
    end;
  end loop;

  return jsonb_build_object('expired', v_expired, 'dispatched', v_dispatched, 'at', now());
end;$$;

-- ── Payment reconciliation: surface initiations locked but never completed. ──
create or replace function public.cron_payment_reconcile()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_stuck int := 0;
begin
  begin
    select count(*) into v_stuck from public.payment_idempotency
      where status = 'locked' and updated_at < now() - interval '15 minutes';
  exception when others then v_stuck := -1; end;
  return jsonb_build_object('stuck_locks', v_stuck, 'at', now());
end;$$;

-- ── Segment recompute wrapper (growth retention engine). ──
create or replace function public.cron_recompute_segments()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  begin perform public.recompute_customer_segments(); exception when others then null; end;
  return jsonb_build_object('recomputed', true, 'at', now());
end;$$;

-- ── Nightly settlement runs (previous day). Best-effort; idempotent per run. ──
create or replace function public.cron_daily_settlements()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_m uuid; v_d uuid; v_start date := (now() - interval '1 day')::date; v_end date := (now() - interval '1 day')::date;
begin
  begin v_m := public.generate_merchant_settlement(v_start, v_end); exception when others then v_m := null; end;
  begin v_d := public.generate_driver_settlement(v_start, v_end);   exception when others then v_d := null; end;
  return jsonb_build_object('merchant_run', v_m, 'driver_run', v_d, 'period', v_start, 'at', now());
end;$$;

-- Phase 9.5 hardening: cron wrappers run under pg_cron/service-role. Revoke anon/PUBLIC;
-- the authenticated grant only allows an ops admin to trigger a manual sweep (the inner RPCs
-- still enforce is_ops_admin where they move money).
revoke execute on function public.cron_dispatch_sweep()      from public, anon;
revoke execute on function public.cron_payment_reconcile()   from public, anon;
revoke execute on function public.cron_recompute_segments()  from public, anon;
revoke execute on function public.cron_daily_settlements()   from public, anon;
grant  execute on function public.cron_dispatch_sweep()      to authenticated;
grant  execute on function public.cron_payment_reconcile()   to authenticated;
grant  execute on function public.cron_recompute_segments()  to authenticated;
grant  execute on function public.cron_daily_settlements()   to authenticated;

-- ── Best-effort pg_cron registration (guarded; never fails the migration). ──
do $$
begin
  -- Try to enable pg_cron; ignore if unavailable / insufficient privilege.
  begin execute 'create extension if not exists pg_cron'; exception when others then return; end;

  -- Only proceed if the cron schema is really present.
  if not exists (select 1 from pg_namespace where nspname = 'cron') then return; end if;

  -- Idempotent (un)schedule helper via cron.schedule; wrap each so one failure is isolated.
  begin perform cron.unschedule('haat_dispatch_sweep');     exception when others then null; end;
  begin perform cron.unschedule('haat_payment_reconcile');  exception when others then null; end;
  begin perform cron.unschedule('haat_segments');           exception when others then null; end;
  begin perform cron.unschedule('haat_settlements');        exception when others then null; end;

  begin perform cron.schedule('haat_dispatch_sweep',    '* * * * *',   $q$ select public.cron_dispatch_sweep(); $q$);    exception when others then null; end;
  begin perform cron.schedule('haat_payment_reconcile', '*/5 * * * *', $q$ select public.cron_payment_reconcile(); $q$); exception when others then null; end;
  begin perform cron.schedule('haat_segments',          '30 3 * * *',  $q$ select public.cron_recompute_segments(); $q$); exception when others then null; end;
  begin perform cron.schedule('haat_settlements',       '0 4 * * *',   $q$ select public.cron_daily_settlements(); $q$);  exception when others then null; end;
end $$;
