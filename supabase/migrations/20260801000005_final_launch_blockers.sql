-- ════════════════════════════════════════════════════════════════════════════
-- FINAL LAUNCH BLOCKERS — eliminates the remaining findings from the Final Independent
-- Security Certification (docs/security/FINAL_SECURITY_CERTIFICATION_REPORT.md):
--   C-1 (MEDIUM) driver shift / presence manipulation
--   C-2 (MEDIUM) review / rating manipulation
--   C-3 (LOW)    set_default_address missing ownership check
--   C-4 (LOW)    unauthenticated maintenance compute
-- Scope is strictly these four. No features, no unrelated/ certified modules touched. Idempotent.
-- Guards use auth.uid()/is_ops_admin() (NOT current_user, which inside a SECURITY DEFINER
-- function is the owner and cannot identify the caller).
-- ════════════════════════════════════════════════════════════════════════════

-- ══ C-1 — driver shift & presence RPCs: caller must own the driver / shift (or be ops) ══════

-- start_shift: reject an arbitrary driver_id; only the driver themselves (or ops) may start it.
create or replace function public.start_shift(p_driver_id uuid, p_zone_id uuid default null::uuid)
returns driver_shifts language plpgsql security definer set search_path = public, pg_temp as $function$
declare v public.driver_shifts;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = 'P0001'; end if;
  if not public.is_ops_admin() and not exists (
    select 1 from public.drivers d where d.id = p_driver_id and (d.id = auth.uid() or d.owner_user_id = auth.uid())
  ) then
    raise exception 'permission denied' using errcode = '42501';   -- ownership is binding; a driver row carries its own tenant/country
  end if;
  insert into public.driver_shifts(driver_id, zone_id, actual_start, status)
    values (p_driver_id, p_zone_id, now(), 'active') returning * into v;
  update public.drivers set status = 'available', is_online = true where id = p_driver_id;
  return v;
end;$function$;

-- end_shift / start_break / end_break: reject an arbitrary shift_id; caller must own the shift's
-- driver (or be ops). No caller can force another driver's break/shift/presence state.
create or replace function public.end_shift(p_shift_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $function$
declare v record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = 'P0001'; end if;
  select ds.driver_id, d.owner_user_id into v
    from public.driver_shifts ds join public.drivers d on d.id = ds.driver_id where ds.id = p_shift_id;
  if not found then raise exception 'shift not found' using errcode = 'P0001'; end if;
  if not public.is_ops_admin() and not (v.driver_id = auth.uid() or v.owner_user_id = auth.uid()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  update public.shift_breaks set ended_at = now() where shift_id = p_shift_id and ended_at is null;
  update public.driver_shifts set status = 'closed', actual_end = now() where id = p_shift_id;
  update public.drivers set status = 'offline', is_online = false where id = v.driver_id;
end;$function$;

create or replace function public.start_break(p_shift_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $function$
declare v record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = 'P0001'; end if;
  select ds.driver_id, d.owner_user_id into v
    from public.driver_shifts ds join public.drivers d on d.id = ds.driver_id where ds.id = p_shift_id;
  if not found then raise exception 'shift not found' using errcode = 'P0001'; end if;
  if not public.is_ops_admin() and not (v.driver_id = auth.uid() or v.owner_user_id = auth.uid()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  insert into public.shift_breaks(shift_id) values (p_shift_id);
  update public.drivers set status = 'on_break' where id = v.driver_id;
end;$function$;

create or replace function public.end_break(p_shift_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $function$
declare v record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = 'P0001'; end if;
  select ds.driver_id, d.owner_user_id into v
    from public.driver_shifts ds join public.drivers d on d.id = ds.driver_id where ds.id = p_shift_id;
  if not found then raise exception 'shift not found' using errcode = 'P0001'; end if;
  if not public.is_ops_admin() and not (v.driver_id = auth.uid() or v.owner_user_id = auth.uid()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  update public.shift_breaks set ended_at = now() where shift_id = p_shift_id and ended_at is null;
  update public.drivers set status = 'available' where id = v.driver_id;
end;$function$;

-- ══ C-2 — submit_review: only the order's own customer may review the order's actual driver /
--         merchant, only after delivery, once (idempotent). No rating manipulation possible. ══
create or replace function public.submit_review(
  p_order_id uuid, p_target_type text, p_target_id uuid, p_rating integer, p_comment text default null::text)
returns reviews language plpgsql security definer set search_path = public, pg_temp as $function$
declare v public.reviews; o record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = 'P0001'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'rating must be 1-5' using errcode = 'P0001'; end if;
  if p_target_type not in ('driver','merchant') then raise exception 'invalid target type' using errcode = 'P0001'; end if;

  select id, customer_id, status, driver_id, branch_id into o from public.orders where id = p_order_id;
  if not found then raise exception 'order not found' using errcode = 'P0001'; end if;
  if o.customer_id is distinct from auth.uid() then raise exception 'order does not belong to caller' using errcode = '42501'; end if;
  if o.status = 'cancelled' then raise exception 'cannot review a cancelled order' using errcode = 'P0001'; end if;
  if o.status <> 'delivered' then raise exception 'can only review a delivered order' using errcode = 'P0001'; end if;

  -- The reviewed target must actually belong to this order (no forged target ids).
  if p_target_type = 'driver' then
    if o.driver_id is null or o.driver_id is distinct from p_target_id then
      raise exception 'target driver is not the order driver' using errcode = '42501';
    end if;
  else
    if not exists (select 1 from public.merchant_branches b where b.id = o.branch_id and b.merchant_id = p_target_id) then
      raise exception 'target merchant is not the order merchant' using errcode = '42501';
    end if;
  end if;

  -- Idempotent: one review per (order,target); only the original author may update it.
  insert into public.reviews(order_id, customer_id, target_type, target_id, rating, comment, status)
    values (p_order_id, auth.uid(), p_target_type, p_target_id, p_rating, p_comment, 'approved')
  on conflict (order_id, target_type, target_id) do update
    set rating = excluded.rating, comment = excluded.comment, status = 'approved'
    where public.reviews.customer_id = auth.uid()
  returning * into v;
  if not found then raise exception 'review already exists for this order/target' using errcode = '42501'; end if;

  -- Live driver rating = average of APPROVED reviews for that driver (unchanged behaviour).
  if p_target_type = 'driver' then
    update public.drivers set rating = (
      select round(avg(rating)::numeric, 2) from public.reviews
       where target_type = 'driver' and target_id = p_target_id and status = 'approved')
     where id = p_target_id;
  end if;
  return v;
end;$function$;

-- ══ C-3 — set_default_address: explicit auth.uid() ownership (or ops) ════════════════════════
create or replace function public.set_default_address(p_address_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $function$
declare v_cust uuid;
begin
  select customer_id into v_cust from public.addresses where id = p_address_id;
  if v_cust is null then raise exception 'address not found' using errcode = 'P0001'; end if;
  if v_cust is distinct from auth.uid() and not public.is_ops_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  update public.addresses set is_default = (id = p_address_id) where customer_id = v_cust;
end;$function$;

-- ══ C-4 — maintenance compute RPCs: Service Role or Operations Admin only ════════════════════
-- Body gate allows: service/cron context (auth.uid() is null) and ops admins; blocks ordinary
-- authenticated users. EXECUTE revoked from anon/public. (Only internal caller is
-- cron_recompute_segments, which runs in a cron/owner context with a null auth.uid().)
create or replace function public.recompute_customer_segments()
returns integer language plpgsql security definer set search_path = public, pg_temp as $function$
declare n int;
begin
  if auth.uid() is not null and not public.is_ops_admin() then raise exception 'not authorised' using errcode = 'P0001'; end if;
  insert into public.customer_segments(customer_id,segment,order_count,total_spent,last_order_at,computed_at)
  select c.id,
    case
      when s.cnt is null and c.created_at > now()-interval '14 days' then 'new'
      when s.cnt is null then 'lost'
      when s.last_o > now()-interval '30 days' and (s.cnt>=5 or s.spent>=1000) then 'vip'
      when s.last_o > now()-interval '30 days' then 'active'
      when s.last_o > now()-interval '60 days' then 'inactive'
      when s.last_o > now()-interval '90 days' then 'at_risk'
      else 'lost'
    end,
    coalesce(s.cnt,0), coalesce(s.spent,0), s.last_o, now()
  from public.customers c
  left join (select customer_id, count(*) cnt, sum(total_amount) spent, max(created_at) last_o
             from public.orders where status='delivered' group by customer_id) s on s.customer_id=c.id
  on conflict (customer_id) do update set segment=excluded.segment, order_count=excluded.order_count,
    total_spent=excluded.total_spent, last_order_at=excluded.last_order_at, computed_at=now();
  get diagnostics n = row_count;
  perform public.g_audit('recompute','customer_segments',null, jsonb_build_object('rows',n));
  return n;
end;$function$;

-- recalc_merchant_performance: same gate prepended (was ungated). Ops dashboards call the
-- ops-gated recalc_all_merchant_performance (which calls this as owner and passes); direct
-- authenticated non-admin callers are now rejected. recalc_all_merchant_performance already
-- carries its own is_ops_admin() guard, so only its client surface is tightened via REVOKE.
create or replace function public.recalc_merchant_performance(p_merchant_id uuid, p_branch_id uuid default null::uuid)
returns void language plpgsql security definer set search_path = public as $function$
declare
  v_total int; v_accepted int; v_rejected int; v_cancelled int; v_delivered int;
  v_accept_secs int; v_prep_mins int; v_declared int;
  v_acc numeric; v_can numeric; v_score numeric; v_last timestamptz;
begin
  if auth.uid() is not null and not public.is_ops_admin() then raise exception 'not authorised' using errcode = 'P0001'; end if;
  select count(*),
         count(*) filter (where status <> 'pending' and status <> 'rejected'),
         count(*) filter (where status = 'rejected'),
         count(*) filter (where status = 'cancelled'),
         count(*) filter (where status = 'delivered'),
         max(created_at)
    into v_total, v_accepted, v_rejected, v_cancelled, v_delivered, v_last
    from public.orders o
   where o.branch_id = coalesce(p_branch_id, o.branch_id)
     and o.branch_id in (select id from public.merchant_branches where merchant_id = p_merchant_id)
     and o.created_at > now() - interval '30 days';
  select avg(extract(epoch from (h.created_at - o.created_at)))::int
    into v_accept_secs
    from public.order_status_history h
    join public.orders o on o.id = h.order_id
   where h.status = 'accepted'
     and o.branch_id in (select id from public.merchant_branches where merchant_id = p_merchant_id)
     and o.created_at > now() - interval '30 days';
  select avg(extract(epoch from (r.created_at - a.created_at)) / 60)::int
    into v_prep_mins
    from public.order_status_history a
    join public.order_status_history r on r.order_id = a.order_id and r.status = 'on_the_way'
    join public.orders o on o.id = a.order_id
   where a.status = 'preparing'
     and o.branch_id in (select id from public.merchant_branches where merchant_id = p_merchant_id)
     and o.created_at > now() - interval '30 days';
  select coalesce((settings->>'prepTimeMinutes')::int, null) into v_declared
    from public.merchant_branches where merchant_id = p_merchant_id limit 1;
  v_acc := case when v_total > 0 then round(100.0 * v_accepted / v_total, 2) else null end;
  v_can := case when v_total > 0 then round(100.0 * v_cancelled / v_total, 2) else null end;
  v_score := case when v_total = 0 then null else greatest(0, least(100,
      coalesce(v_acc, 100)
      - coalesce(v_can, 0) * 1.5
      - case when v_declared is not null and v_prep_mins is not null and v_prep_mins > v_declared
             then least(30, (v_prep_mins - v_declared)) else 0 end
    )) end;
  insert into public.merchant_performance as mp (
    merchant_id, branch_id, orders_total, orders_accepted, orders_rejected, orders_cancelled,
    orders_delivered, avg_accept_seconds, avg_prep_minutes, declared_prep_minutes,
    acceptance_rate, cancellation_rate, health_score, last_order_at, computed_at)
  values (p_merchant_id, p_branch_id, coalesce(v_total,0), coalesce(v_accepted,0), coalesce(v_rejected,0),
          coalesce(v_cancelled,0), coalesce(v_delivered,0), v_accept_secs, v_prep_mins, v_declared,
          v_acc, v_can, v_score, v_last, now())
  on conflict (merchant_id, branch_id) do update set
    orders_total = excluded.orders_total, orders_accepted = excluded.orders_accepted,
    orders_rejected = excluded.orders_rejected, orders_cancelled = excluded.orders_cancelled,
    orders_delivered = excluded.orders_delivered, avg_accept_seconds = excluded.avg_accept_seconds,
    avg_prep_minutes = excluded.avg_prep_minutes, declared_prep_minutes = excluded.declared_prep_minutes,
    acceptance_rate = excluded.acceptance_rate, cancellation_rate = excluded.cancellation_rate,
    health_score = excluded.health_score, last_order_at = excluded.last_order_at, computed_at = now();
end;$function$;

revoke execute on function public.recompute_customer_segments()           from anon, public;
revoke execute on function public.recalc_merchant_performance(uuid, uuid) from anon, public;
revoke execute on function public.recalc_all_merchant_performance()       from anon, public;
