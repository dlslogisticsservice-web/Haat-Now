-- ════════════════════════════════════════════════════════════════════════════
-- ORDER TOTAL — server-authoritative service fee + coupon (P0 financial correctness).
--
-- The launch readiness audit found the platform's single most serious bug: the client
-- computed the order total WITH a service fee (+5) and a coupon discount, while
-- create_order computed subtotal + delivery ONLY. Consequences, all Critical:
--   · every card checkout died on payment-initiate's AMOUNT_MISMATCH guard;
--   · a redeemed coupon was never subtracted server-side — the customer paid full price;
--   · the COD ledger recorded the client total while the order recorded a different one.
--
-- FIX: create_order now applies the service fee and the coupon ITSELF, server-side, and
-- remains the single source of truth for the total. The coupon discount is computed from
-- the validated coupon row (never trusted from the client). The service fee is accepted
-- but BOUNDED so a tampered client cannot inflate or negate it. The function returns the
-- applied discount + coupon so the client can display and reconcile.
--
-- Backward compatible: the two new params default to (0, null); existing 6-arg callers
-- and the sandbox path are unaffected. Same idempotency + server-priced items as before.
-- ════════════════════════════════════════════════════════════════════════════

-- The service fee an order may carry is a small fixed platform fee. Bounding it here means
-- a forged client value can never make the customer pay a negative or absurd total.
create or replace function public.order_service_fee_cap() returns numeric
  language sql immutable as $$ select 25::numeric $$;

-- Drop the prior 6-arg signature so the new definition is the ONE create_order (defaults
-- fill in for any 6-arg caller). Guarded so re-running the migration is safe.
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

  -- SERVER-AUTHORITATIVE item pricing (unchanged).
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
  -- Service fee: accepted from the caller but clamped to [0, cap] — never client-authored beyond bounds.
  v_service_fee  := least(greatest(coalesce(p_service_fee, 0), 0), public.order_service_fee_cap());

  -- COUPON: validated and priced SERVER-SIDE. A forged discount is impossible — the
  -- discount comes from the coupon row, not the client. Invalid/expired/inactive coupons
  -- simply yield zero discount (the order still succeeds; redemption is enforced separately).
  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon from public.coupons
     where upper(code) = upper(trim(p_coupon_code))
       and coalesce(is_active, true) = true
       and (expires_at is null or expires_at >= current_date)
     limit 1;
    if found and coalesce(v_coupon.discount_percent, 0) > 0 then
      v_discount := round(v_subtotal * least(v_coupon.discount_percent, 100) / 100.0, 2);
    end if;
  end if;

  -- The ONE total the whole system trusts.
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

  -- Return the row plus the applied money breakdown so the client reconciles against it.
  return to_jsonb(v_order) || jsonb_build_object(
    'subtotal', v_subtotal, 'service_fee', v_service_fee, 'discount', v_discount,
    'coupon_applied', (v_discount > 0)
  );
end;$$;

grant execute on function public.create_order(uuid, uuid, jsonb, numeric, jsonb, text, numeric, text) to authenticated;
