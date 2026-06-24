-- ════════════════════════════════════════════════════════════════════════════
-- Coupon usage integrity — atomic redemption.
-- validate_coupon (0020) only READS; nothing incremented used_count, so max_uses
-- was unenforceable. redeem_coupon() atomically: locks the coupon row, re-checks
-- active/expiry/limit, increments used_count, and records coupon_usages — once per
-- (coupon, order). Idempotent + race-safe (SELECT … FOR UPDATE + unique index).
-- ════════════════════════════════════════════════════════════════════════════

-- Hard idempotency: one usage row per coupon per order (table is empty → safe to add).
create unique index if not exists uq_coupon_usages_coupon_order
  on public.coupon_usages(coupon_id, order_id);

create or replace function public.redeem_coupon(p_coupon_id uuid, p_order_id uuid)
returns public.coupons
language plpgsql security definer set search_path = public as $$
declare c public.coupons;
begin
  -- lock the coupon row to serialise concurrent redemptions
  select * into c from public.coupons where id = p_coupon_id for update;
  if not found then raise exception 'coupon not found' using errcode = 'P0001'; end if;

  -- idempotent FIRST: if already redeemed for this order, return without error/double-count
  -- (must precede the limit check so a webhook-poll retry on the same order never fails).
  if exists (select 1 from public.coupon_usages where coupon_id = c.id and order_id = p_order_id) then
    return c;
  end if;

  if not c.is_active then raise exception 'coupon inactive' using errcode = 'P0001'; end if;
  if c.end_date is not null and c.end_date < now() then
    raise exception 'coupon expired' using errcode = 'P0001'; end if;
  if c.expires_at is not null and c.expires_at < current_date then
    raise exception 'coupon expired' using errcode = 'P0001'; end if;
  if c.max_uses <> 0 and c.used_count >= c.max_uses then
    raise exception 'coupon usage limit reached' using errcode = 'P0001'; end if;

  update public.coupons set used_count = used_count + 1 where id = c.id returning * into c;
  insert into public.coupon_usages(coupon_id, order_id) values (c.id, p_order_id);
  return c;
end;
$$;

revoke all on function public.redeem_coupon(uuid, uuid) from public;
grant execute on function public.redeem_coupon(uuid, uuid) to authenticated;
