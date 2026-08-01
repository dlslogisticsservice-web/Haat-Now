-- ════════════════════════════════════════════════════════════════════════════
-- FINAL SECURITY REMEDIATION — fixes the confirmed findings from the Final Independent
-- Red Team Re-Validation (docs/security/FINAL_RED_TEAM_REPORT.md). Scope is strictly those
-- findings: F-1, F-2, F-3 (High/Medium) + F-4…F-8 (Low). No features, no unrelated refactors.
-- Idempotent. Detection model matches Pass #2/#3 (SECURITY INVOKER guards see the real writer;
-- DEFINER RPCs run as owner).
-- ════════════════════════════════════════════════════════════════════════════

-- ── F-1 (HIGH) — complete_delivery: enforce CALLER authorization ───────────────────────────
-- Previously it verified only orders.driver_id = p_driver_id, so any authenticated user who
-- could see an on-the-way order could force it 'delivered' + trigger the driver payout.
-- Now: caller must BE the assigned driver (id or owner_user_id = auth.uid()); only ops bypass.
create or replace function public.complete_delivery(p_order_id uuid, p_driver_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
declare
  v_status varchar; v_driver uuid; v_customer uuid; v_fee decimal;
  v_earning_id uuid; v_wallet_id uuid; v_current_bal decimal; v_new_bal decimal; v_tx_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  -- F-1 AUTHORIZATION: only the assigned driver themselves (or ops) may complete a delivery.
  if not public.is_ops_admin() and not exists (
    select 1 from public.drivers d
     where d.id = p_driver_id and (d.id = auth.uid() or d.owner_user_id = auth.uid())
  ) then
    raise exception 'permission denied: caller is not the assigned driver' using errcode = '42501';
  end if;

  select status, driver_id, customer_id, delivery_fee
    into v_status, v_driver, v_customer, v_fee
    from orders where id = p_order_id for update;
  if v_status is null then raise exception 'Order not found: %', p_order_id; end if;

  -- The driver argument must match the order's assigned driver (unchanged).
  if v_driver is distinct from p_driver_id then
    raise exception 'Driver mismatch for order %', p_order_id;
  end if;

  if v_status = 'delivered' then
    perform 1 from driver_earnings where order_id = p_order_id;
    if found then
      return jsonb_build_object('success', true, 'already_processed', true, 'customer_id', v_customer);
    end if;
  elsif v_status != 'on_the_way' then
    raise exception 'Order % cannot be completed from status "%"', p_order_id, v_status;
  end if;

  if v_status = 'on_the_way' then
    update orders set status = 'delivered' where id = p_order_id;
    insert into order_status_history (order_id, status, notes)
      values (p_order_id, 'delivered', 'تم التسليم بنجاح.');
  end if;

  v_fee := coalesce(v_fee, 10.00);

  insert into driver_earnings (driver_id, order_id, delivery_fee_earned, tip_earned, bonus_earned)
    values (p_driver_id, p_order_id, v_fee, 0.00, 0.00) returning id into v_earning_id;

  select id, balance into v_wallet_id, v_current_bal
    from wallets where owner_type = 'driver' and owner_id = p_driver_id for update;
  if v_wallet_id is null then
    insert into wallets (owner_type, owner_id, balance) values ('driver', p_driver_id, 0.00)
      returning id, balance into v_wallet_id, v_current_bal;
  end if;

  v_new_bal := coalesce(v_current_bal, 0) + v_fee;
  update wallets set balance = v_new_bal where id = v_wallet_id;
  insert into wallet_transactions (wallet_id, amount, type) values (v_wallet_id, v_fee, 'payout')
    returning id into v_tx_id;

  return jsonb_build_object('success', true, 'already_processed', false, 'customer_id', v_customer,
    'earning_id', v_earning_id, 'wallet_id', v_wallet_id, 'new_balance', v_new_bal, 'transaction_id', v_tx_id);
end;$function$;

-- ── F-2 (MEDIUM) — finalize_driver_delivery: bind to a REAL delivered order owned by caller ──
-- Previously a driver could pass any p_order_id and reset their own active_orders/status,
-- bypassing drivers_guard. Now the order must be delivered AND assigned to that driver.
create or replace function public.finalize_driver_delivery(p_order_id uuid, p_driver_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $function$
begin
  -- caller must own the driver record (or be ops)
  if not public.is_ops_admin() and not exists (
    select 1 from public.drivers d
     where d.id = p_driver_id and (d.id = auth.uid() or d.owner_user_id = auth.uid())
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  -- the assignment must be a real, delivered order that belongs to this driver
  if not exists (
    select 1 from public.orders o
     where o.id = p_order_id and o.driver_id = p_driver_id and o.status = 'delivered'
  ) then
    raise exception 'order is not a delivered order assigned to this driver' using errcode = '42501';
  end if;

  update public.drivers set active_orders = greatest(active_orders - 1, 0),
    status = case when active_orders - 1 <= 0 then 'available' else 'busy' end
    where id = p_driver_id;
  perform public.recalc_driver_performance(p_driver_id);
end;$function$;

-- ── F-3 (MEDIUM) — merchants: stop exposing KYC/PII to every authenticated user ─────────────
-- The `USING(true)` discovery policy returned the whole merchants row (tax_number, CR number,
-- contacts, owner) to any signed-in user. Restrict the base table to OWNER + OPS-ADMIN, and
-- serve discovery through a public-safe projection that carries only storefront columns.
drop policy if exists "merchants_discovery_read" on public.merchants;
create policy merchants_owner_admin_read on public.merchants
  for select to authenticated
  using (public.auth_is_admin() or owner_user_id = auth.uid() or id = auth.uid());

drop view if exists public.merchants_public;
create view public.merchants_public with (security_invoker = false) as
  select id, business_name, logo_url, business_type, tenant_id from public.merchants;
grant select on public.merchants_public to anon, authenticated;

-- ── F-4 (LOW) — no unauthenticated / client execution of maintenance & dispatch jobs ────────
-- anon could execute expire_dispatch_offers()/recalc_driver_performance(), and auto_dispatch_order
-- bypassed its own guard when auth.uid() is null. Cron jobs run as the scheduler (owner), and
-- ops maintenance keeps `authenticated`; revoke the client/anon surface.
revoke execute on function public.expire_dispatch_offers()               from anon, public;
revoke execute on function public.recalc_driver_performance(uuid)        from anon, public;
revoke execute on function public.auto_dispatch_order(uuid, integer)     from anon, public;
revoke execute on function public.batch_auto_dispatch(integer, integer)  from anon, public;
revoke execute on function public.reassign_order(uuid, integer)          from anon, public;
revoke execute on function public.generate_driver_settlement(date, date) from anon, public;
revoke execute on function public.generate_merchant_settlement(date, date) from anon, public;
revoke execute on function public.submit_driver_application(text, text, text, text, date, text, uuid, uuid) from anon, public;
revoke execute on function public.cron_dispatch_sweep()      from anon, public, authenticated;
revoke execute on function public.cron_daily_settlements()   from anon, public, authenticated;
revoke execute on function public.cron_payment_reconcile()   from anon, public, authenticated;

-- ── F-5 (LOW) — replace always-true INSERT policies with scoped ones ────────────────────────
-- order_status_history: only the order's customer, its assigned driver, its branch merchant, or ops.
drop policy if exists "Authenticated users can insert order status" on public.order_status_history;
create policy order_status_history_scoped_insert on public.order_status_history
  for insert to authenticated
  with check (
    public.is_ops_admin() or exists (
      select 1 from public.orders o
       where o.id = order_status_history.order_id and (
         o.customer_id = auth.uid()
         or exists (select 1 from public.drivers d where d.id = o.driver_id and (d.id = auth.uid() or d.owner_user_id = auth.uid()))
         or exists (select 1 from public.merchant_branches b join public.merchants m on m.id = b.merchant_id
                     where b.id = o.branch_id and m.owner_user_id = auth.uid())
       )
    )
  );

-- campaign_events: a client may log non-order events, or events for its OWN order only.
drop policy if exists "Anyone logs campaign events" on public.campaign_events;
create policy campaign_events_scoped_insert on public.campaign_events
  for insert to anon, authenticated
  with check (
    order_id is null
    or exists (select 1 from public.orders o where o.id = campaign_events.order_id and o.customer_id = auth.uid())
  );

-- search_analytics: a client may only attribute a search to itself (or leave it anonymous).
drop policy if exists "search_analytics_ins" on public.search_analytics;
create policy search_analytics_scoped_insert on public.search_analytics
  for insert to authenticated
  with check (customer_id is null or customer_id = auth.uid());

-- ── F-6 (LOW) — public buckets must not be listable. Public URL downloads (public=true) are
--         unaffected; only the object-listing SELECT policies are removed. Best-effort in case
--         storage.objects is not owned by the migration role. ─────────────────────────────────
do $$
begin
  drop policy if exists "avatars_public_read"        on storage.objects;
  drop policy if exists "banners_public_read"        on storage.objects;
  drop policy if exists "experience_assets_read"     on storage.objects;
  drop policy if exists "merchant_logos_public_read" on storage.objects;
  drop policy if exists "offer_images_public_read"   on storage.objects;
  drop policy if exists "product_images_public_read" on storage.objects;
exception when insufficient_privilege then
  raise notice 'F-6: storage.objects not owned by migration role — drop the *_public_read listing policies via the dashboard';
end$$;

-- ── F-7 (LOW) — pin search_path on the 13 flagged functions ─────────────────────────────────
alter function public.cashback_balance(p_customer uuid) set search_path = public, pg_temp;
alter function public.driver_wallet_summary(p_driver_id uuid) set search_path = public, pg_temp;
alter function public.fin_balance(p_account_type text, p_owner_id uuid) set search_path = public, pg_temp;
alter function public.find_nearest_drivers(p_lat double precision, p_lng double precision, p_limit integer, p_exclude_order uuid) set search_path = public, pg_temp;
alter function public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) set search_path = public, pg_temp;
alter function public.order_service_fee_cap() set search_path = public, pg_temp;
alter function public.point_in_zone(p_lat double precision, p_lng double precision, poly jsonb) set search_path = public, pg_temp;
alter function public.resolve_commission_rule(p_merchant uuid, p_category uuid, p_country text) set search_path = public, pg_temp;
alter function public.set_incident_reference() set search_path = public, pg_temp;
alter function public.touch_incident() set search_path = public, pg_temp;
alter function public.touch_screen_experiences() set search_path = public, pg_temp;
alter function public.zone_for_point(p_lat double precision, p_lng double precision) set search_path = public, pg_temp;
alter function public.zone_quote(p_zone_id uuid, p_distance_km numeric, p_vehicle_id uuid) set search_path = public, pg_temp;

-- ── F-8 (LOW) — move pg_trgm out of the public schema (best-effort). `ilike` acceleration via
--         existing GIN indexes is unaffected; the extensions schema is on the search_path. ────
do $$
begin
  perform 1 from pg_namespace where nspname = 'extensions';
  if found then alter extension pg_trgm set schema extensions; end if;
exception when others then
  raise notice 'F-8: could not relocate pg_trgm (%). Leave in public or move via dashboard.', sqlerrm;
end$$;
