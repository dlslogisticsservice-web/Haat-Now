-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9 · P0-3 — Atomic order creation RPC (idempotent, server-authoritative totals).
--
-- BEFORE: orderService.createOrder did 3 un-transacted writes (order → items → status),
-- with a best-effort compensating delete. A crash between writes left an orphan order;
-- a double-submit created duplicate orders; total_amount + item prices were authored by
-- the client. (BUSINESS_FLOW §1.4, FLOW_RESILIENCE §1, RISK_REGISTER R-04.)
--
-- AFTER: a single SECURITY DEFINER function inserts order + items + status history in ONE
-- transaction, computes the item subtotal from the DB (products.price + variant
-- price_modifier) — NOT the client — and is idempotent on a caller-supplied key.
--
-- Backward compatible: additive column + new RPC. The legacy multi-insert path remains as
-- a fallback in order.service.ts when the RPC is unavailable. Sandbox is unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

-- Idempotency key for order creation (nullable → existing rows unaffected).
alter table public.orders add column if not exists idempotency_key text;
create unique index if not exists uq_orders_idempotency_key
  on public.orders (idempotency_key) where idempotency_key is not null;

-- create_order(customer, branch, items[], delivery_fee, location, idempotency_key)
--   p_items: jsonb array of { variant_id uuid, quantity int }
--   Returns the orders row (as jsonb). Idempotent: a repeat call with the same key
--   returns the original order instead of creating a second one.
create or replace function public.create_order(
  p_customer_id     uuid,
  p_branch_id       uuid,
  p_items           jsonb,
  p_delivery_fee    numeric default null,
  p_location        jsonb   default null,
  p_idempotency_key text    default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order         public.orders;
  v_existing      public.orders;
  v_subtotal      numeric := 0;
  v_delivery_fee  numeric;
  v_line          jsonb;
  v_variant       uuid;
  v_qty           int;
  v_unit_price    numeric;
  v_merchant      uuid;
begin
  -- SECURITY: only the authenticated customer may create their own order.
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;
  if p_customer_id <> auth.uid() then
    raise exception 'Forbidden: customer mismatch' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item' using errcode = 'P0001';
  end if;

  -- IDEMPOTENCY: return the prior order for a repeated key (no second order).
  if p_idempotency_key is not null then
    select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
    if found then
      return to_jsonb(v_existing);
    end if;
  end if;

  -- SERVER-AUTHORITATIVE PRICING: unit price = products.price + variant price_modifier.
  for v_line in select * from jsonb_array_elements(p_items) loop
    v_variant := (v_line->>'variant_id')::uuid;
    v_qty     := coalesce((v_line->>'quantity')::int, 0);
    if v_qty <= 0 then
      raise exception 'Invalid item quantity' using errcode = 'P0001';
    end if;
    select coalesce(p.price, 0) + coalesce(pv.price_modifier, 0)
      into v_unit_price
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
     where pv.id = v_variant;
    if v_unit_price is null then
      raise exception 'Unknown product variant %', v_variant using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + (v_unit_price * v_qty);
  end loop;

  -- Delivery fee: caller-provided (validated non-negative) or the column default.
  v_delivery_fee := greatest(coalesce(p_delivery_fee, 0), 0);

  -- 1) Order row (total computed server-side).
  insert into public.orders (
    customer_id, branch_id, status, total_amount, delivery_fee,
    address_id, delivery_lat, delivery_lng, branch_lat_snapshot, branch_lng_snapshot,
    idempotency_key
  ) values (
    p_customer_id, p_branch_id, 'pending', v_subtotal + v_delivery_fee, v_delivery_fee,
    nullif(p_location->>'address_id','')::uuid,
    nullif(p_location->>'delivery_lat','')::numeric,
    nullif(p_location->>'delivery_lng','')::numeric,
    nullif(p_location->>'branch_lat_snapshot','')::numeric,
    nullif(p_location->>'branch_lng_snapshot','')::numeric,
    p_idempotency_key
  ) returning * into v_order;

  -- 2) Items (priced server-side; ignores any client price).
  for v_line in select * from jsonb_array_elements(p_items) loop
    v_variant := (v_line->>'variant_id')::uuid;
    v_qty     := (v_line->>'quantity')::int;
    select coalesce(p.price, 0) + coalesce(pv.price_modifier, 0)
      into v_unit_price
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
     where pv.id = v_variant;
    insert into public.order_items (order_id, variant_id, quantity, price)
      values (v_order.id, v_variant, v_qty, v_unit_price);
  end loop;

  -- 3) Initial status history (same transaction).
  insert into public.order_status_history (order_id, status, notes)
    values (v_order.id, 'pending', 'تم إنشاء الطلب.');

  return to_jsonb(v_order);
end;$$;

-- Phase 9.5 hardening (live security-advisor finding): do NOT leave SECURITY DEFINER
-- functions executable by the anonymous/PUBLIC role. Revoke the default, grant only
-- authenticated. (Internal auth.uid() guard already blocks anon, but revoke as defense.)
revoke execute on function public.create_order(uuid, uuid, jsonb, numeric, jsonb, text) from public, anon;
grant  execute on function public.create_order(uuid, uuid, jsonb, numeric, jsonb, text) to authenticated;
