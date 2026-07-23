-- ════════════════════════════════════════════════════════════════════════════
-- SECURE SECURITY DEFINER FUNCTIONS (P0 — verified launch blocker).
--
-- The final verification found that most SECURITY DEFINER functions are already
-- internally guarded (is_ops_admin / auth_has_permission), so the Supabase "anon-
-- executable" advisory is a false positive for them. But a verified subset ships with
-- NO internal authorization and default PUBLIC EXECUTE, so the anon role (which holds
-- the publishable key shipped in the client bundle) can call them. This migration fixes
-- ONLY those verified NEEDS-REVIEW functions.
--
-- It uses the project's EXISTING authorization helpers only — `is_ops_admin()` and
-- `auth.uid()` — and the EXISTING `revoke execute … from public/anon` pattern already
-- used by atomic_refund.sql and rbac_server_enforcement.sql. It invents no new model.
--
-- The guard is chosen per the function's LEGITIMATE caller (verified against the app):
--   • ops-only actions            → `if not is_ops_admin() then raise`
--   • driver self-service         → ownership (`p_driver_id = auth.uid()`) OR ops
--   • customer self-service       → order ownership OR ops
--   • merchant self-service       → product→branch→merchant ownership OR ops
--   • internal-only (cron/trigger)→ conditional (`auth.uid() is not null and not ops`)
--   • internal-only primitives    → EXECUTE revoked from every client role (no app caller)
--
-- Function BODIES are reproduced verbatim; only the guard line is added. Idempotent
-- (`create or replace`). No behaviour changes for legitimate callers.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · Internal-only primitives — no app caller; lock to internal definer calls ──
-- These are invoked only by OTHER security-definer functions (referral credit, ledger
-- posting, commission capture), which run as the definer and are unaffected by the
-- client-role grants. Revoking EXECUTE from every client role closes both the anon AND
-- the authenticated-user hole (incl. the verified `adjust_wallet_balance` money hole).
revoke execute on function public.credit_customer_wallet(uuid, numeric, text)        from anon, public, authenticated;
revoke execute on function public.award_cashback(uuid, uuid, numeric)                from anon, public, authenticated;
revoke execute on function public.post_ledger(uuid, text, jsonb)                     from anon, public, authenticated;
revoke execute on function public.adjust_wallet_balance(varchar, uuid, decimal, varchar) from anon, public, authenticated;

-- ── 2 · App-called functions — add the minimal correct guard, then re-scope EXECUTE ──

-- request_payout: a driver may request only their OWN payout; ops may request any.
create or replace function public.request_payout(p_driver_id uuid, p_amount numeric)
returns public.payout_requests language plpgsql security definer set search_path=public as $$
declare v_avail numeric; v public.payout_requests;
begin
  if p_driver_id <> auth.uid() and not public.is_ops_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select available into v_avail from public.driver_wallet_summary(p_driver_id);
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if p_amount > coalesce(v_avail,0) then raise exception 'insufficient available balance'; end if;
  insert into public.payout_requests(driver_id,amount) values (p_driver_id,p_amount) returning * into v; return v;
end;$$;

-- approve_payout: ops only (moves driver earnings to 'paid').
create or replace function public.approve_payout(p_request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r record; remaining numeric; e record; etot numeric;
begin
  if not public.is_ops_admin() then raise exception 'permission denied' using errcode = '42501'; end if;
  select * into r from public.payout_requests where id=p_request_id for update;
  if not found then raise exception 'payout not found'; end if;
  if r.status <> 'pending' then raise exception 'payout not pending'; end if;
  remaining := r.amount;
  for e in select id, (delivery_fee_earned+coalesce(tip_earned,0)+coalesce(bonus_earned,0)) tot
           from public.driver_earnings where driver_id=r.driver_id and payout_status='available' order by created_at asc loop
    exit when remaining <= 0;
    etot := e.tot;
    if etot <= remaining then
      update public.driver_earnings set payout_status='paid' where id=e.id;
      remaining := remaining - etot;
    else
      update public.driver_earnings set delivery_fee_earned=etot-remaining, tip_earned=0, bonus_earned=0 where id=e.id;
      insert into public.driver_earnings(driver_id,order_id,delivery_fee_earned,tip_earned,bonus_earned,payout_status)
        values (r.driver_id,null,remaining,0,0,'paid');
      remaining := 0;
    end if;
  end loop;
  update public.payout_requests set status='paid', processed_at=now(), processed_by=auth.uid() where id=p_request_id;
end;$$;

-- reject_payout: ops only.
create or replace function public.reject_payout(p_request_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_ops_admin() then raise exception 'permission denied' using errcode = '42501'; end if;
  update public.payout_requests set status='rejected', note=p_note, processed_at=now(), processed_by=auth.uid()
    where id=p_request_id and status='pending';
end;$$;

-- auto_dispatch_order: called by cron/reassign (auth.uid() is null — allowed) and by ops.
-- A direct anon or authenticated-non-ops caller is rejected.
create or replace function public.auto_dispatch_order(p_order_id uuid, p_timeout_seconds int default 30)
returns public.dispatch_assignments language plpgsql security definer set search_path=public as $$
declare o record; cand record; v_attempt int; v_row public.dispatch_assignments;
begin
  if auth.uid() is not null and not public.is_ops_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select id, delivery_lat, delivery_lng, branch_lat_snapshot, branch_lng_snapshot, driver_id into o from public.orders where id=p_order_id;
  if not found then raise exception 'order not found'; end if;
  if o.driver_id is not null then raise exception 'order already has a driver'; end if;
  select * into cand from public.find_nearest_drivers(
    coalesce(o.delivery_lat,o.branch_lat_snapshot)::double precision,
    coalesce(o.delivery_lng,o.branch_lng_snapshot)::double precision, 1, p_order_id);
  if cand.driver_id is null then return null; end if;
  select coalesce(max(attempt),0)+1 into v_attempt from public.dispatch_assignments where order_id=p_order_id;
  insert into public.dispatch_assignments(order_id,driver_id,status,method,attempt,distance_km,timeout_at)
  values (p_order_id,cand.driver_id,'offered','auto',v_attempt,round(cand.distance_km::numeric,2),now()+make_interval(secs=>p_timeout_seconds))
  returning * into v_row;
  perform public.recalc_driver_performance(cand.driver_id);
  return v_row;
end;$$;

-- manual_dispatch_order: ops only.
create or replace function public.manual_dispatch_order(p_order_id uuid, p_driver_id uuid)
returns public.dispatch_assignments language plpgsql security definer set search_path=public as $$
declare v_attempt int; v_row public.dispatch_assignments; v_updated int;
begin
  if not public.is_ops_admin() then raise exception 'permission denied' using errcode = '42501'; end if;
  update public.orders set driver_id=p_driver_id, status='preparing' where id=p_order_id and driver_id is null;
  get diagnostics v_updated = row_count;
  if v_updated=0 then raise exception 'order already assigned'; end if;
  select coalesce(max(attempt),0)+1 into v_attempt from public.dispatch_assignments where order_id=p_order_id;
  insert into public.dispatch_assignments(order_id,driver_id,status,method,attempt,responded_at)
  values (p_order_id,p_driver_id,'accepted','manual',v_attempt,now()) returning * into v_row;
  update public.drivers set active_orders=active_orders+1, status='busy' where id=p_driver_id;
  perform public.recalc_driver_performance(p_driver_id);
  return v_row;
end;$$;

-- reassign_order: ops only (calls auto_dispatch_order internally, which is now guarded too).
create or replace function public.reassign_order(p_order_id uuid, p_timeout_seconds int default 30)
returns public.dispatch_assignments language plpgsql security definer set search_path=public as $$
begin
  if not public.is_ops_admin() then raise exception 'permission denied' using errcode = '42501'; end if;
  update public.dispatch_assignments set status='reassigned' where order_id=p_order_id and status='offered';
  return public.auto_dispatch_order(p_order_id, p_timeout_seconds);
end;$$;

-- finalize_driver_delivery: the driver themselves (on completion) or ops.
create or replace function public.finalize_driver_delivery(p_order_id uuid, p_driver_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_driver_id <> auth.uid() and not public.is_ops_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  update public.drivers set active_orders=greatest(active_orders-1,0),
    status = case when active_orders-1 <= 0 then 'available' else 'busy' end
    where id = p_driver_id;
  perform public.recalc_driver_performance(p_driver_id);
end;$$;

-- capture_order_commission: ops only (finance).
create or replace function public.capture_order_commission(p_order_id uuid)
returns public.commissions language plpgsql security definer set search_path=public as $$
declare o record; v_merchant uuid; v_rule public.commission_rules; v_comm numeric; v_net numeric; v_row public.commissions; v_cat uuid;
begin
  if not public.is_ops_admin() then raise exception 'permission denied' using errcode = '42501'; end if;
  select id, branch_id, total_amount into o from public.orders where id = p_order_id;
  if not found then raise exception 'order not found'; end if;
  select c.* into v_row from public.commissions c where c.order_id = p_order_id;
  if found then return v_row; end if;
  select merchant_id into v_merchant from public.merchant_branches where id = o.branch_id;
  select category_id into v_cat from public.products p
    join public.order_items oi on oi.variant_id in (select id from public.product_variants where product_id=p.id)
    where oi.order_id = p_order_id limit 1;
  select * into v_rule from public.resolve_commission_rule(v_merchant, v_cat, null);
  if v_rule.commission_type = 'flat' then v_comm := least(v_rule.rate, o.total_amount);
  else v_comm := round(o.total_amount * v_rule.rate / 100.0, 2); end if;
  v_net := o.total_amount - v_comm;
  insert into public.commissions(order_id,merchant_id,rule_id,gross_amount,commission_type,rate,commission_amount,net_to_merchant)
  values (p_order_id, v_merchant, v_rule.id, o.total_amount, v_rule.commission_type, v_rule.rate, v_comm, v_net)
  returning * into v_row;
  perform public.post_ledger(gen_random_uuid(), 'order_commission', jsonb_build_array(
    jsonb_build_object('account_type','platform_cash','owner_type','platform','debit',o.total_amount,'credit',0,'ref_table','orders','ref_id',p_order_id),
    jsonb_build_object('account_type','merchant_payable','owner_type','merchant','owner_id',v_merchant,'debit',0,'credit',v_net,'ref_table','orders','ref_id',p_order_id),
    jsonb_build_object('account_type','platform_revenue','owner_type','platform','debit',0,'credit',v_comm,'ref_table','commissions','ref_id',v_row.id)));
  return v_row;
end;$$;

-- adjust_product_stock: the OWNING merchant (product → branch → merchant) or ops.
create or replace function public.adjust_product_stock(p_product_id uuid, p_delta integer, p_reason varchar default 'تعديل يدوي')
returns integer language plpgsql security definer set search_path = public as $$
declare v_new integer;
begin
  if not public.is_ops_admin() and not exists (
    select 1 from public.products p
    join public.merchant_branches b on b.id = p.branch_id
    join public.merchants m on m.id = b.merchant_id
    where p.id = p_product_id and m.owner_user_id = auth.uid()
  ) then raise exception 'permission denied' using errcode = '42501'; end if;
  update public.products
     set stock = greatest(0, stock + p_delta),
         is_active = (greatest(0, stock + p_delta) > 0)
   where id = p_product_id
   returning stock into v_new;
  if v_new is null then raise exception 'product not found'; end if;
  insert into public.stock_movements(product_id, delta, reason) values (p_product_id, p_delta, p_reason);
  return v_new;
end; $$;

-- redeem_coupon: the customer who OWNS the order, or ops. Guard precedes the lock.
create or replace function public.redeem_coupon(p_coupon_id uuid, p_order_id uuid)
returns public.coupons
language plpgsql security definer set search_path = public as $$
declare c public.coupons;
begin
  if not public.is_ops_admin() and not exists (
    select 1 from public.orders where id = p_order_id and customer_id = auth.uid()
  ) then raise exception 'permission denied' using errcode = '42501'; end if;
  select * into c from public.coupons where id = p_coupon_id for update;
  if not found then raise exception 'coupon not found' using errcode = 'P0001'; end if;
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

-- ── 3 · Re-scope EXECUTE on the app-called functions: block anon, keep authenticated ──
-- The internal guard above rejects authenticated-non-ops callers; revoking anon closes
-- the unauthenticated surface entirely (defense-in-depth). Legitimate app callers use
-- the authenticated role and keep access.
revoke execute on function public.request_payout(uuid, numeric)          from anon, public;
grant  execute on function public.request_payout(uuid, numeric)          to authenticated;
revoke execute on function public.approve_payout(uuid)                   from anon, public;
grant  execute on function public.approve_payout(uuid)                   to authenticated;
revoke execute on function public.reject_payout(uuid, text)              from anon, public;
grant  execute on function public.reject_payout(uuid, text)              to authenticated;
revoke execute on function public.auto_dispatch_order(uuid, integer)     from anon, public;
grant  execute on function public.auto_dispatch_order(uuid, integer)     to authenticated;
revoke execute on function public.manual_dispatch_order(uuid, uuid)      from anon, public;
grant  execute on function public.manual_dispatch_order(uuid, uuid)      to authenticated;
revoke execute on function public.reassign_order(uuid, integer)          from anon, public;
grant  execute on function public.reassign_order(uuid, integer)          to authenticated;
revoke execute on function public.finalize_driver_delivery(uuid, uuid)   from anon, public;
grant  execute on function public.finalize_driver_delivery(uuid, uuid)   to authenticated;
revoke execute on function public.capture_order_commission(uuid)         from anon, public;
grant  execute on function public.capture_order_commission(uuid)         to authenticated;
revoke execute on function public.adjust_product_stock(uuid, integer, varchar) from anon, public;
grant  execute on function public.adjust_product_stock(uuid, integer, varchar) to authenticated;
revoke execute on function public.redeem_coupon(uuid, uuid)              from anon, public;
grant  execute on function public.redeem_coupon(uuid, uuid)              to authenticated;
