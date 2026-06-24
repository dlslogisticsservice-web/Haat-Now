-- ════════════════════════════════════════════════════════════════════════════
-- PHASE E3 — OPERATIONS COMMAND CENTER
-- Real-time publication for live maps, batch dispatch, and ops/zone analytics.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Real-time: publish the live tables + REPLICA IDENTITY FULL so subscriptions
--    can filter on non-PK columns (branch_id / driver_id / customer_id). ──
do $$
declare t text;
begin
  foreach t in array array['orders','drivers','driver_locations','merchant_branches'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end$$;

-- ── BATCH DISPATCH: auto-dispatch up to N unassigned orders in one pass ──
create or replace function public.batch_auto_dispatch(p_limit int default 20, p_timeout_seconds int default 30)
returns int language plpgsql security definer set search_path=public as $$
declare o record; r public.dispatch_assignments; n int := 0;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  for o in select id from public.orders
           where driver_id is null and status in ('accepted','preparing')
           order by created_at asc limit p_limit loop
    begin
      r := public.auto_dispatch_order(o.id, p_timeout_seconds);
      if r.id is not null then n := n + 1; end if;
    exception when others then null;  -- skip orders with no available driver
    end;
  end loop;
  return n;
end;$$;
grant execute on function public.batch_auto_dispatch(int,int) to authenticated;

-- ── OPS SUMMARY: live operational counts (for the command-center header) ──
create or replace function public.ops_summary()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'active_orders',    (select count(*) from public.orders where status in ('pending','accepted','preparing','on_the_way')),
    'unassigned_orders',(select count(*) from public.orders where driver_id is null and status in ('accepted','preparing')),
    'in_transit',       (select count(*) from public.orders where status='on_the_way'),
    'online_drivers',   (select count(*) from public.drivers where is_online),
    'available_drivers',(select count(*) from public.drivers where status='available'),
    'busy_drivers',     (select count(*) from public.drivers where status='busy'),
    'pending_offers',   (select count(*) from public.dispatch_assignments where status='offered'),
    'delivered_today',  (select count(*) from public.orders where status='delivered' and created_at >= date_trunc('day', now())),
    'revenue_today',    (select coalesce(sum(total_amount),0) from public.orders where status='delivered' and created_at >= date_trunc('day', now()))
  );
$$;
grant execute on function public.ops_summary() to authenticated;

-- ── ZONE ANALYTICS: per-zone operational + geographic breakdown ──
create or replace function public.ops_zone_analytics()
returns table(zone_id uuid, zone_name text, is_active boolean,
              active_orders bigint, online_drivers bigint, available_drivers bigint, delivered_today bigint, avg_eta int)
language sql stable security definer set search_path=public as $$
  select z.id, z.name, z.is_active,
    (select count(*) from public.orders o join public.merchant_branches b on b.id=o.branch_id
       where b.zone_id=z.id and o.status in ('pending','accepted','preparing','on_the_way')),
    (select count(*) from public.drivers d where d.zone_id=z.id and d.is_online),
    (select count(*) from public.drivers d where d.zone_id=z.id and d.status='available'),
    (select count(*) from public.orders o join public.merchant_branches b on b.id=o.branch_id
       where b.zone_id=z.id and o.status='delivered' and o.created_at >= date_trunc('day', now())),
    z.eta_minutes
  from public.zones z order by z.name;
$$;
grant execute on function public.ops_zone_analytics() to authenticated;
