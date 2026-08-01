-- ════════════════════════════════════════════════════════════════════════════
-- HARDENING PASS #2 — eliminate the Critical/High business-logic exploits B1–B8 from
-- the Business Logic Penetration Audit (docs/security/). READ-ONLY for legitimate flows:
-- it closes the direct-table-write bypass and the SECURITY DEFINER RPCs the prior pass
-- (20260722000001) missed. No new features; no API signature changes. Idempotent.
--
-- Detection model: SECURITY DEFINER RPCs execute as their owner role (not `authenticated`),
-- and edge functions use `service_role`; only direct PostgREST client writes run as
-- `authenticated`/`anon`. The orders guard is SECURITY INVOKER so `current_user` reflects
-- the real writer, letting validated RPCs pass through while client writes are constrained.
-- ════════════════════════════════════════════════════════════════════════════

-- ── B1 — Orders: money/identity columns are not client-writable; illegal status
--         transitions are rejected inside PostgreSQL. `delivered` is RPC-only. ──────────
create or replace function public.orders_guard()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_admin boolean;
begin
  -- Guard ONLY direct client writes. DEFINER RPCs (owner role) + service_role pass through.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  v_admin := public.is_ops_admin();

  -- Money + identity columns are immutable to clients — mutations go through validated RPCs
  -- (create_order / payment webhook / complete_delivery / dispatch), which run as owner/service.
  if new.payment_status  is distinct from old.payment_status
     or new.total_amount   is distinct from old.total_amount
     or new.delivery_fee   is distinct from old.delivery_fee
     or new.branch_id      is distinct from old.branch_id
     or new.customer_id    is distinct from old.customer_id
     or new.payment_method is distinct from old.payment_method
     or new.tenant_id      is distinct from old.tenant_id
     or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'orders: protected column is not client-writable' using errcode = '42501';
  end if;

  -- Driver assignment: a client may only self-claim an UNASSIGNED order; no hijack, no clear.
  if new.driver_id is distinct from old.driver_id and not v_admin then
    if old.driver_id is not null then
      raise exception 'orders: driver reassignment must go through dispatch' using errcode = '42501';
    end if;
    if new.driver_id is not null and not exists (
      select 1 from public.drivers d
       where d.id = new.driver_id and (d.id = auth.uid() or d.owner_user_id = auth.uid())
    ) then
      raise exception 'orders: a client may only self-assign as the driver' using errcode = '42501';
    end if;
  end if;

  -- Status: enforce the legal lifecycle for clients. `delivered` is intentionally excluded —
  -- it is reached only via complete_delivery() (which runs as owner), so a client can never
  -- mark an order delivered directly, and cannot skip or reverse states.
  if new.status is distinct from old.status and not v_admin then
    if not (
         (old.status = 'pending'    and new.status in ('accepted', 'cancelled'))
      or (old.status = 'accepted'   and new.status in ('preparing', 'cancelled'))
      or (old.status = 'preparing'  and new.status in ('on_the_way', 'cancelled'))
      or (old.status = 'on_the_way' and new.status = 'cancelled')
    ) then
      raise exception 'orders: illegal status transition % -> %', old.status, new.status using errcode = '42501';
    end if;
  end if;

  return new;
end;$$;

drop trigger if exists orders_guard_trg on public.orders;
create trigger orders_guard_trg before update on public.orders
  for each row execute function public.orders_guard();

-- ── B2 — Retire the un-hardened legacy payout RPC (client-supplied fee, no owner check).
--         complete_delivery() supersedes it (server-derived fee, ownership, idempotent). ──
revoke execute on function public.complete_delivery_payout(uuid, uuid, numeric) from anon, public, authenticated;

-- ── B6 — driver_earnings are not client-writable (fabrication). Earnings only via
--         complete_delivery(). Keep the read policy so drivers still see their earnings. ──
drop policy if exists "Drivers can insert own earnings" on public.driver_earnings;
revoke insert, update on public.driver_earnings from anon, authenticated;

-- ── B3 — Loyalty economy is gated to server/admin authority (mirrors the wallet-primitive
--         revoke in 20260722000001). Closes point minting: replay awards, negative-amount
--         mints, and points → wallet cash-out. Re-expose via guarded server-side event
--         wiring later (out of B1–B8 scope). ──────────────────────────────────────────────
revoke execute on function public.award_loyalty_points(uuid, integer, character varying) from anon, public, authenticated;
revoke execute on function public.award_points_for_event(uuid, text, numeric, uuid)      from anon, public, authenticated;
revoke execute on function public.redeem_loyalty_points(uuid, integer, character varying) from anon, public, authenticated;
revoke execute on function public.redeem_loyalty_reward(uuid, uuid)                        from anon, public, authenticated;

-- ── B4 — redeem_advanced_coupon (caller-trusted identity/amount + wallet_credit self-credit)
--         is gated to server/admin. Checkout coupons use create_order/redeem_coupon (below). ──
revoke execute on function public.redeem_advanced_coupon(text, uuid, uuid, numeric, text, uuid, uuid) from anon, public, authenticated;

-- ── B7 — set_driver_status let any caller forge ANY driver's presence/GPS (dispatch theft
--         + sabotage). No app caller exists (presence uses driver_locations); revoke it. ──
revoke execute on function public.set_driver_status(uuid, text, double precision, double precision) from anon, public, authenticated;

-- ── B8 — respond_dispatch: bind the caller to the offered driver (IDOR) and reject
--         acceptance of an offer past its timeout. ─────────────────────────────────────────
create or replace function public.respond_dispatch(p_assignment_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare a record; v_updated int;
begin
  select * into a from public.dispatch_assignments where id = p_assignment_id for update;
  if not found then raise exception 'assignment not found'; end if;

  -- Ownership: only the offered driver (or ops) may respond.
  if not public.is_ops_admin() and not exists (
    select 1 from public.drivers d
     where d.id = a.driver_id and (d.id = auth.uid() or d.owner_user_id = auth.uid())
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if a.status <> 'offered' then return a.status; end if;

  -- Reject accepting an expired offer (do not wait for the sweeper).
  if a.timeout_at is not null and a.timeout_at < now() then
    update public.dispatch_assignments set status = 'timeout', responded_at = now() where id = p_assignment_id;
    perform public.recalc_driver_performance(a.driver_id);
    return 'timeout';
  end if;

  if not p_accept then
    update public.dispatch_assignments set status = 'rejected', responded_at = now() where id = p_assignment_id;
    perform public.recalc_driver_performance(a.driver_id);
    return 'rejected';
  end if;
  update public.orders set driver_id = a.driver_id, status = 'preparing'
    where id = a.order_id and driver_id is null and status in ('accepted', 'pending');
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    update public.dispatch_assignments set status = 'lost', responded_at = now() where id = p_assignment_id;
    return 'lost';
  end if;
  update public.dispatch_assignments set status = 'accepted', responded_at = now() where id = p_assignment_id;
  update public.drivers set active_orders = active_orders + 1, status = 'busy' where id = a.driver_id;
  perform public.recalc_driver_performance(a.driver_id);
  return 'accepted';
end;$$;
revoke execute on function public.respond_dispatch(uuid, boolean) from anon, public;

-- ── B5 — Coupon eligibility + redemption limits are enforced ENTIRELY inside create_order,
--         race-safe, in the same transaction as the discount. Client-side validation can no
--         longer authorize a discount, and capped/one-time/per-customer/min-order/date rules
--         are honored + recorded (used_count + coupon_usages). redeem_coupon() stays as an
--         idempotent no-op for the existing client call (returns early if usage exists). ──
drop function if exists public.create_order(uuid, uuid, jsonb, numeric, jsonb, text);
create or replace function public.create_order(
  p_customer_id     uuid,
  p_branch_id       uuid,
  p_items           jsonb,
  p_delivery_fee    numeric default null,
  p_location        jsonb   default null,
  p_idempotency_key text    default null,
  p_service_fee     numeric default 0,
  p_coupon_code     text    default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order         public.orders;
  v_existing      public.orders;
  v_subtotal      numeric := 0;
  v_delivery_fee  numeric;
  v_service_fee   numeric;
  v_discount      numeric := 0;
  v_total         numeric;
  v_line          jsonb;
  v_variant       uuid;
  v_qty           int;
  v_unit_price    numeric;
  v_coupon        public.coupons;
  v_eligible      boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;
  if p_customer_id <> auth.uid() then
    raise exception 'Forbidden: customer mismatch' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item' using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
    if found then
      return to_jsonb(v_existing) || jsonb_build_object('reused', true);
    end if;
  end if;

  -- SERVER-AUTHORITATIVE item pricing.
  for v_line in select * from jsonb_array_elements(p_items) loop
    v_variant := (v_line->>'variant_id')::uuid;
    v_qty     := coalesce((v_line->>'quantity')::int, 0);
    if v_qty <= 0 then raise exception 'Invalid item quantity' using errcode = 'P0001'; end if;
    select coalesce(p.price, 0) + coalesce(pv.price_modifier, 0)
      into v_unit_price
      from public.product_variants pv join public.products p on p.id = pv.product_id
     where pv.id = v_variant;
    if v_unit_price is null then raise exception 'Unknown product variant %', v_variant using errcode = 'P0001'; end if;
    v_subtotal := v_subtotal + (v_unit_price * v_qty);
  end loop;

  v_delivery_fee := greatest(coalesce(p_delivery_fee, 0), 0);
  v_service_fee  := least(greatest(coalesce(p_service_fee, 0), 0), public.order_service_fee_cap());

  -- COUPON (B5): every eligibility rule enforced server-side, coupon row locked FOR UPDATE
  -- so max_uses / per-customer counts are race-safe. Ineligible ⇒ zero discount (order still
  -- succeeds). Recording happens after the order row exists (needs order_id).
  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon from public.coupons
     where upper(code) = upper(trim(p_coupon_code)) limit 1 for update;
    if found
       and coalesce(v_coupon.is_active, true) = true
       and (v_coupon.expires_at is null or v_coupon.expires_at >= current_date)
       and (v_coupon.start_date is null or v_coupon.start_date <= current_date)
       and (v_coupon.end_date   is null or v_coupon.end_date   >= current_date)
       and coalesce(v_coupon.min_order_amount, 0) <= v_subtotal
       and (v_coupon.max_uses is null or v_coupon.max_uses = 0 or coalesce(v_coupon.used_count, 0) < v_coupon.max_uses)
       and (not coalesce(v_coupon.first_order_only,  false) or not exists (select 1 from public.orders where customer_id = p_customer_id))
       and (not coalesce(v_coupon.new_customer_only, false) or not exists (select 1 from public.orders where customer_id = p_customer_id))
       and (v_coupon.per_customer_limit is null or v_coupon.per_customer_limit = 0 or (
             select count(*) from public.coupon_usages cu join public.orders o on o.id = cu.order_id
              where cu.coupon_id = v_coupon.id and o.customer_id = p_customer_id) < v_coupon.per_customer_limit)
       and coalesce(v_coupon.discount_percent, 0) > 0
    then
      v_eligible := true;
      v_discount := round(v_subtotal * least(v_coupon.discount_percent, 100) / 100.0, 2);
    end if;
  end if;

  v_total := greatest(0, v_subtotal + v_delivery_fee + v_service_fee - v_discount);

  insert into public.orders (
    customer_id, branch_id, status, total_amount, delivery_fee,
    address_id, delivery_lat, delivery_lng, branch_lat_snapshot, branch_lng_snapshot,
    idempotency_key
  ) values (
    p_customer_id, p_branch_id, 'pending', v_total, v_delivery_fee,
    nullif(p_location->>'address_id','')::uuid,
    nullif(p_location->>'delivery_lat','')::numeric,
    nullif(p_location->>'delivery_lng','')::numeric,
    nullif(p_location->>'branch_lat_snapshot','')::numeric,
    nullif(p_location->>'branch_lng_snapshot','')::numeric,
    p_idempotency_key
  ) returning * into v_order;

  for v_line in select * from jsonb_array_elements(p_items) loop
    v_variant := (v_line->>'variant_id')::uuid;
    v_qty     := (v_line->>'quantity')::int;
    select coalesce(p.price, 0) + coalesce(pv.price_modifier, 0)
      into v_unit_price
      from public.product_variants pv join public.products p on p.id = pv.product_id
     where pv.id = v_variant;
    insert into public.order_items (order_id, variant_id, quantity, price)
      values (v_order.id, v_variant, v_qty, v_unit_price);
  end loop;

  insert into public.order_status_history (order_id, status, notes)
    values (v_order.id, 'pending', 'تم إنشاء الطلب.');

  -- Record the redemption atomically so limits are enforced and used_count reflects reality.
  if v_eligible and v_discount > 0 then
    insert into public.coupon_usages (coupon_id, order_id) values (v_coupon.id, v_order.id)
      on conflict do nothing;
    update public.coupons set used_count = coalesce(used_count, 0) + 1 where id = v_coupon.id;
  end if;

  return to_jsonb(v_order) || jsonb_build_object(
    'subtotal', v_subtotal, 'service_fee', v_service_fee, 'discount', v_discount,
    'coupon_applied', (v_discount > 0)
  );
end;$$;
grant execute on function public.create_order(uuid, uuid, jsonb, numeric, jsonb, text, numeric, text) to authenticated;
