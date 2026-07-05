-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9 · P0-6 — Auto-dispatch on order acceptance + unified driver workload
-- accounting (replaces the dead finalize_driver_delivery).
--
-- BEFORE: dispatch was admin-manual only; the DriverApp "grab" path and the dispatch
-- engine kept SEPARATE bookkeeping; drivers.active_orders was never decremented after
-- delivery (finalize_driver_delivery had zero callers) → workload leaked and corrupted
-- find_nearest_drivers scoring. (BUSINESS_FLOW §1.8, FLOW_RESILIENCE §5, R-05/R-15.)
--
-- AFTER: two AFTER-UPDATE triggers on orders, so BOTH assignment paths share one source
-- of truth (they both mutate orders.driver_id/status):
--   1. auto-dispatch when a merchant accepts an unassigned order;
--   2. increment active_orders on assignment; decrement + free the driver on terminal
--      status (delivered/cancelled). This makes the leak structurally impossible.
--
-- Every trigger body is EXCEPTION-guarded so it can NEVER roll back the underlying order
-- update — dispatch/workload are best-effort side effects, not blocking constraints.
-- Backward compatible & additive.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Auto-dispatch on acceptance.
create or replace function public.trg_auto_dispatch_on_accept()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'accepted' and new.driver_id is null
     and old.status is distinct from 'accepted' then
    begin
      perform public.auto_dispatch_order(new.id, 30);
    exception when others then
      null; -- never block the status transition on a dispatch hiccup
    end;
  end if;
  return new;
end;$$;

drop trigger if exists order_auto_dispatch on public.orders;
create trigger order_auto_dispatch
  after update of status on public.orders
  for each row execute function public.trg_auto_dispatch_on_accept();

-- 2) Unified driver workload accounting (assignment + release).
create or replace function public.trg_driver_workload()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_active int;
begin
  -- Assignment: driver_id transitions null → set  ⇒ increment workload.
  if old.driver_id is null and new.driver_id is not null then
    begin
      update public.drivers
        set active_orders = coalesce(active_orders, 0) + 1,
            status = case when status = 'available' then 'busy' else status end
        where id = new.driver_id;
    exception when others then null; end;
  end if;

  -- Release: order reaches a terminal state ⇒ decrement + free the driver at zero.
  if new.status in ('delivered','cancelled')
     and old.status is distinct from new.status
     and new.driver_id is not null then
    begin
      update public.drivers
        set active_orders = greatest(coalesce(active_orders, 0) - 1, 0)
        where id = new.driver_id
        returning active_orders into v_active;
      if v_active is not null and v_active <= 0 then
        update public.drivers set status = 'available'
          where id = new.driver_id and is_online = true;
      end if;
    exception when others then null; end;
  end if;

  return new;
end;$$;

drop trigger if exists order_driver_workload on public.orders;
create trigger order_driver_workload
  after update of driver_id, status on public.orders
  for each row execute function public.trg_driver_workload();
