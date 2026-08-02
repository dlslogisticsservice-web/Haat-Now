-- ════════════════════════════════════════════════════════════════════════════
-- RC-1 REMEDIATION — eliminate Broken Object Level Authorization (OWASP API1) on
-- SECURITY DEFINER read RPCs. Every read RPC that accepts an owner/object id now verifies
-- ownership (customer = auth.uid() / order belongs to caller / merchant owned by caller) or
-- Operations Admin; platform-analytics reads are gated to ops. order_tracking no longer
-- exposes the driver phone and only serves the order's own customer/driver/ops.
--
-- Audit basis: every SECURITY DEFINER function in `public` with NO auth check in its body was
-- reviewed. Safe/left unchanged: money mutators (already client-revoked), cron/maintenance
-- (revoked or gated), pure public catalog/aggregates (active_promotions, rating_summary,
-- recommended_merchants, trending_products, validate_coupon, search_catalog), and
-- cashback_balance / driver_wallet_summary (SECURITY INVOKER ⇒ RLS-scoped to the owner).
-- Guards use auth.uid()/is_ops_admin() (accurate inside SECURITY DEFINER; current_user is not).
-- Scope is strictly RC-1; no certified subsystem, no unrelated code touched. Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Owner-scoped (customer) reads ───────────────────────────────────────────────────────────
create or replace function public.loyalty_balance(p_customer_id uuid)
returns integer language plpgsql stable security definer set search_path = public, pg_temp as $function$
begin
  if not public.is_ops_admin() and p_customer_id is distinct from auth.uid() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return (select coalesce(sum(points), 0)::integer from public.loyalty_transactions where customer_id = p_customer_id);
end;$function$;

create or replace function public.resolve_loyalty_tier(p_customer uuid)
returns loyalty_tiers language plpgsql stable security definer set search_path = public, pg_temp as $function$
declare r public.loyalty_tiers;
begin
  if not public.is_ops_admin() and p_customer is distinct from auth.uid() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select t.* into r from public.loyalty_tiers t
   where t.is_active and t.min_points <= public.loyalty_balance(p_customer)
   order by t.min_points desc limit 1;
  return r;
end;$function$;

create or replace function public.recently_ordered(p_customer uuid, p_limit integer default 10)
returns table(product_id uuid, name text, price numeric, branch_id uuid, last_ordered timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $function$
begin
  if not public.is_ops_admin() and p_customer is distinct from auth.uid() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return query
    select p.id, p.name::text, p.price, p.branch_id, max(o.created_at)
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.product_variants pv on pv.id = oi.variant_id
    join public.products p on p.id = pv.product_id
    where o.customer_id = p_customer and p.is_active
    group by p.id, p.name, p.price, p.branch_id
    order by max(o.created_at) desc limit p_limit;
end;$function$;

-- ── Owner-scoped (order) reads ──────────────────────────────────────────────────────────────
create or replace function public.reorder_items(p_order_id uuid)
returns table(variant_id uuid, product_id uuid, product_name text, quantity integer, price numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $function$
begin
  if not public.is_ops_admin() and not exists (
    select 1 from public.orders where id = p_order_id and customer_id = auth.uid()
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return query
    select oi.variant_id, p.id, p.name::text, oi.quantity, p.price
    from public.order_items oi
    join public.product_variants pv on pv.id = oi.variant_id
    join public.products p on p.id = pv.product_id
    where oi.order_id = p_order_id;
end;$function$;

-- order_tracking: only the order's own customer, its assigned driver, or ops. Driver PHONE is
-- no longer exposed; destination/driver-location are served only to the authorized caller.
create or replace function public.order_tracking(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $function$
declare o record; v_dist numeric; v_eta int;
begin
  if not public.is_ops_admin() and not exists (
    select 1 from public.orders ord
     where ord.id = p_order_id and (
       ord.customer_id = auth.uid()
       or exists (select 1 from public.drivers d where d.id = ord.driver_id and (d.id = auth.uid() or d.owner_user_id = auth.uid()))
     )
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select ord.id, ord.status, ord.driver_id, ord.delivery_lat, ord.delivery_lng,
         d.current_lat, d.current_lng, d.full_name driver_name, z.eta_minutes
    into o
  from public.orders ord
  left join public.drivers d on d.id = ord.driver_id
  left join public.merchant_branches b on b.id = ord.branch_id
  left join public.zones z on z.id = b.zone_id
  where ord.id = p_order_id;
  if not found then return null; end if;
  if o.current_lat is not null and o.delivery_lat is not null then
    v_dist := round(public.haversine_km(o.current_lat,o.current_lng,o.delivery_lat::double precision,o.delivery_lng::double precision)::numeric, 2);
    v_eta := greatest(1, ceil(v_dist / 30.0 * 60))::int;
  end if;
  return jsonb_build_object(
    'order_id', o.id, 'status', o.status,
    -- driver phone intentionally omitted (RC-1); name + live location only.
    'driver', case when o.driver_id is null then null else jsonb_build_object(
      'name', o.driver_name, 'lat', o.current_lat, 'lng', o.current_lng) end,
    'destination', jsonb_build_object('lat', o.delivery_lat, 'lng', o.delivery_lng),
    'remaining_km', v_dist, 'eta_minutes', coalesce(v_eta, o.eta_minutes),
    'timeline', (select coalesce(jsonb_agg(jsonb_build_object('status', h.status, 'at', h.created_at) order by h.created_at), '[]'::jsonb)
                 from public.order_status_history h where h.order_id = p_order_id)
  );
end;$function$;

-- ── Owner-scoped (merchant) read ────────────────────────────────────────────────────────────
create or replace function public.merchant_growth_stats(p_merchant uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $function$
declare j jsonb;
begin
  if not public.is_ops_admin() and not exists (
    select 1 from public.merchants where id = p_merchant and owner_user_id = auth.uid()
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'orders', count(*), 'sales', coalesce(sum(o.total_amount),0),
    'avg_basket', round(coalesce(avg(o.total_amount),0)::numeric,2),
    'unique_customers', count(distinct o.customer_id),
    'repeat_customers', count(*) filter (where rc.cnt > 1),
    'top_products', (select coalesce(jsonb_agg(t),'[]') from (
        select p.name, count(oi.id) qty from public.order_items oi
        join public.product_variants pv on pv.id=oi.variant_id join public.products p on p.id=pv.product_id
        join public.orders o2 on o2.id=oi.order_id join public.merchant_branches b2 on b2.id=o2.branch_id
        where b2.merchant_id=p_merchant group by p.name order by count(oi.id) desc limit 5) t)
  ) into j
  from public.orders o join public.merchant_branches b on b.id=o.branch_id
  left join (select customer_id, count(*) cnt from public.orders group by customer_id) rc on rc.customer_id=o.customer_id
  where b.merchant_id=p_merchant and o.status='delivered';
  return j;
end;$function$;

-- ── Ops-admin-only platform analytics / compliance reads ────────────────────────────────────
create or replace function public.growth_analytics()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $function$
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode = 'P0001'; end if;
  return (select jsonb_build_object(
    'coupon_redemptions', (select count(*) from public.coupon_redemptions),
    'coupon_discount_total', (select coalesce(sum(discount_amount),0) from public.coupon_redemptions),
    'campaigns_sent', (select count(*) from public.message_campaigns where status='sent'),
    'campaign_recipients', (select coalesce(sum(recipient_count),0) from public.message_campaigns),
    'loyalty_points_outstanding', (select coalesce(sum(points),0) from public.loyalty_transactions),
    'referrals_total', (select count(*) from public.referrals),
    'referrals_rewarded', (select count(*) from public.referrals where status='rewarded'),
    'repeat_purchase_rate', (select round(coalesce(count(*) filter (where cnt>1)::numeric / nullif(count(*),0),0),3)
        from (select customer_id, count(*) cnt from public.orders where status='delivered' group by customer_id) s),
    'avg_ltv', (select round(coalesce(avg(spent),0)::numeric,2) from (
        select customer_id, sum(total_amount) spent from public.orders where status='delivered' group by customer_id) s),
    'segments', (select coalesce(jsonb_object_agg(segment,n),'{}') from (select segment,count(*) n from public.customer_segments group by segment) g),
    'cac_placeholder', null));
end;$function$;

create or replace function public.ops_summary()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $function$
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode = 'P0001'; end if;
  return (select jsonb_build_object(
    'active_orders',    (select count(*) from public.orders where status in ('pending','accepted','preparing','on_the_way')),
    'unassigned_orders',(select count(*) from public.orders where driver_id is null and status in ('accepted','preparing')),
    'in_transit',       (select count(*) from public.orders where status='on_the_way'),
    'online_drivers',   (select count(*) from public.drivers where is_online),
    'available_drivers',(select count(*) from public.drivers where status='available'),
    'busy_drivers',     (select count(*) from public.drivers where status='busy'),
    'pending_offers',   (select count(*) from public.dispatch_assignments where status='offered'),
    'delivered_today',  (select count(*) from public.orders where status='delivered' and created_at >= date_trunc('day', now())),
    'revenue_today',    (select coalesce(sum(total_amount),0) from public.orders where status='delivered' and created_at >= date_trunc('day', now()))));
end;$function$;

create or replace function public.ops_zone_analytics()
returns table(zone_id uuid, zone_name text, is_active boolean, active_orders bigint, online_drivers bigint, available_drivers bigint, delivered_today bigint, avg_eta integer)
language plpgsql stable security definer set search_path = public, pg_temp as $function$
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode = 'P0001'; end if;
  return query
    select z.id, z.name::text, z.is_active,
      (select count(*) from public.orders o join public.merchant_branches b on b.id=o.branch_id
         where b.zone_id=z.id and o.status in ('pending','accepted','preparing','on_the_way')),
      (select count(*) from public.drivers d where d.zone_id=z.id and d.is_online),
      (select count(*) from public.drivers d where d.zone_id=z.id and d.status='available'),
      (select count(*) from public.orders o join public.merchant_branches b on b.id=o.branch_id
         where b.zone_id=z.id and o.status='delivered' and o.created_at >= date_trunc('day', now())),
      z.eta_minutes
    from public.zones z order by z.name;
end;$function$;

create or replace function public.retention_targets()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $function$
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode = 'P0001'; end if;
  return (select jsonb_build_object(
    'inactive', (select count(*) from public.customer_segments where segment='inactive'),
    'at_risk',  (select count(*) from public.customer_segments where segment='at_risk'),
    'lost',     (select count(*) from public.customer_segments where segment='lost'),
    'recommendations', jsonb_build_array(
      jsonb_build_object('segment','inactive','offer','free_delivery','reason','30-60d no order'),
      jsonb_build_object('segment','at_risk','offer','20% coupon','reason','60-90d no order'),
      jsonb_build_object('segment','lost','offer','wallet_credit 15','reason','90d+ no order — win-back'))));
end;$function$;

create or replace function public.search_term_stats()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $function$
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode = 'P0001'; end if;
  return (select jsonb_build_object(
    'top_terms', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
       select lower(term) term, count(*) searches from public.search_analytics group by lower(term) order by count(*) desc limit 10) t),
    'zero_result', (select coalesce(jsonb_agg(z), '[]'::jsonb) from (
       select lower(term) term, count(*) searches from public.search_analytics where result_count=0 group by lower(term) order by count(*) desc limit 10) z)));
end;$function$;

create or replace function public.support_sla_stats()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $function$
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode = 'P0001'; end if;
  return (select jsonb_build_object(
    'open', (select count(*) from public.support_tickets where status='open'),
    'in_progress', (select count(*) from public.support_tickets where status='in_progress'),
    'resolved', (select count(*) from public.support_tickets where status in ('resolved','closed')),
    'sla_breached', (select count(*) from public.support_tickets where status not in ('resolved','closed') and sla_due_at < now()),
    'avg_resolution_hours', (select round(coalesce(avg(extract(epoch from (resolved_at - created_at))/3600),0)::numeric,1)
                             from public.support_tickets where resolved_at is not null)));
end;$function$;

create or replace function public.expiring_documents(p_within_days integer default 30)
returns table(entity_type text, entity_id uuid, entity_name text, document_id uuid, doc_type text, expires_at date, days_remaining integer, status text)
language plpgsql stable security definer set search_path = public, pg_temp as $function$
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode = 'P0001'; end if;
  return query
    select 'driver'::text, d.driver_id, dr.full_name::text, d.id, d.doc_type::text, d.expires_at,
           (d.expires_at - current_date)::int,
           (case when d.expires_at < current_date then 'expired' else 'expiring' end)::text
      from public.driver_documents d join public.drivers dr on dr.id = d.driver_id
     where d.expires_at is not null and d.expires_at <= current_date + p_within_days
    union all
    select 'merchant'::text, m.merchant_id, mr.business_name::text, m.id, m.doc_type::text, m.expires_at,
           (m.expires_at - current_date)::int,
           (case when m.expires_at < current_date then 'expired' else 'expiring' end)::text
      from public.merchant_documents m join public.merchants mr on mr.id = m.merchant_id
     where m.expires_at is not null and m.expires_at <= current_date + p_within_days
    order by 6;
end;$function$;

create or replace function public.estimate_segment(p_definition jsonb)
returns integer language plpgsql stable security definer set search_path = public, pg_temp as $function$
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode = 'P0001'; end if;
  return (select count(*)::int from public.customers c
    where (p_definition->>'registered_after' is null or c.created_at >= (p_definition->>'registered_after')::timestamptz)
      and (p_definition->>'registered_before' is null or c.created_at <= (p_definition->>'registered_before')::timestamptz)
      and (coalesce((p_definition->>'min_orders')::int,0) = 0 or (select count(*) from public.orders o where o.customer_id=c.id) >= (p_definition->>'min_orders')::int)
      and (p_definition->>'max_orders' is null or (select count(*) from public.orders o where o.customer_id=c.id) <= (p_definition->>'max_orders')::int));
end;$function$;

-- ── Reduce surface: these all require auth.uid()/ops now; remove the anon/public grant. ──────
revoke execute on function public.loyalty_balance(uuid)                       from anon, public;
revoke execute on function public.resolve_loyalty_tier(uuid)                  from anon, public;
revoke execute on function public.recently_ordered(uuid, integer)            from anon, public;
revoke execute on function public.reorder_items(uuid)                        from anon, public;
revoke execute on function public.order_tracking(uuid)                       from anon, public;
revoke execute on function public.merchant_growth_stats(uuid)                from anon, public;
revoke execute on function public.growth_analytics()                         from anon, public;
revoke execute on function public.ops_summary()                              from anon, public;
revoke execute on function public.ops_zone_analytics()                       from anon, public;
revoke execute on function public.retention_targets()                        from anon, public;
revoke execute on function public.search_term_stats()                        from anon, public;
revoke execute on function public.support_sla_stats()                        from anon, public;
revoke execute on function public.expiring_documents(integer)                from anon, public;
revoke execute on function public.estimate_segment(jsonb)                    from anon, public;
