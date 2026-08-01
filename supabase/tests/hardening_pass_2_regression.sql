-- ════════════════════════════════════════════════════════════════════════════
-- HARDENING PASS #2 — permanent regression suite for B1–B8.
-- Each previously-exploitable path is asserted CLOSED. Run against a project that has
-- the 20260801000001_hardening_pass_2 migration applied:
--     psql "$DATABASE_URL" -f supabase/tests/hardening_pass_2_regression.sql
-- Any regression RAISES an exception (non-zero exit); a clean run prints the pass lines.
-- Functional checks impersonate `authenticated` and self-clean.
-- ════════════════════════════════════════════════════════════════════════════

-- ── B1 — orders money/identity columns immutable + illegal status transitions rejected ──
do $$
declare v_cust uuid := gen_random_uuid(); v_order uuid := gen_random_uuid(); v_raised boolean;
begin
  insert into public.customers(id, full_name, email) values (v_cust, 'regr', v_cust::text||'@regr.local');
  insert into public.orders(id, customer_id, status, total_amount, delivery_fee, payment_status)
    values (v_order, v_cust, 'pending', 100, 10, 'unpaid');
  perform set_config('request.jwt.claims', json_build_object('sub', v_cust::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';

  v_raised := false; begin update public.orders set payment_status='paid' where id=v_order; exception when others then v_raised := true; end;
  if not v_raised then execute 'reset role'; raise exception 'B1 REGRESSION: payment_status=paid accepted'; end if;

  v_raised := false; begin update public.orders set total_amount=1 where id=v_order; exception when others then v_raised := true; end;
  if not v_raised then execute 'reset role'; raise exception 'B1 REGRESSION: total_amount lowered'; end if;

  v_raised := false; begin update public.orders set delivery_fee=0 where id=v_order; exception when others then v_raised := true; end;
  if not v_raised then execute 'reset role'; raise exception 'B1 REGRESSION: delivery_fee changed'; end if;

  v_raised := false; begin update public.orders set status='delivered' where id=v_order; exception when others then v_raised := true; end;
  if not v_raised then execute 'reset role'; raise exception 'B1 REGRESSION: pending->delivered accepted'; end if;

  update public.orders set status='accepted' where id=v_order; -- legal transition must succeed
  execute 'reset role';
  delete from public.order_status_history where order_id=v_order;
  delete from public.orders where id=v_order;
  delete from public.customers where id=v_cust;
  raise notice 'B1 PASS: order money/identity locked; illegal status rejected; legal transition allowed';
end$$;

-- ── B2 / B3 / B4 / B7 — privileged RPCs not client-executable ──
do $$
begin
  if has_function_privilege('authenticated','public.complete_delivery_payout(uuid,uuid,numeric)','execute')
    then raise exception 'B2 REGRESSION: complete_delivery_payout executable by authenticated'; end if;
  if has_function_privilege('authenticated','public.award_loyalty_points(uuid,integer,character varying)','execute')
    or has_function_privilege('authenticated','public.award_points_for_event(uuid,text,numeric,uuid)','execute')
    or has_function_privilege('authenticated','public.redeem_loyalty_points(uuid,integer,character varying)','execute')
    or has_function_privilege('authenticated','public.redeem_loyalty_reward(uuid,uuid)','execute')
    then raise exception 'B3 REGRESSION: a loyalty RPC is executable by authenticated'; end if;
  if has_function_privilege('authenticated','public.redeem_advanced_coupon(text,uuid,uuid,numeric,text,uuid,uuid)','execute')
    then raise exception 'B4 REGRESSION: redeem_advanced_coupon executable by authenticated'; end if;
  if has_function_privilege('authenticated','public.set_driver_status(uuid,text,double precision,double precision)','execute')
    then raise exception 'B7 REGRESSION: set_driver_status executable by authenticated'; end if;
  raise notice 'B2/B3/B4/B7 PASS: privileged RPC EXECUTE revoked from authenticated';
end$$;

-- ── B6 — driver_earnings not client-writable ──
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='driver_earnings' and policyname='Drivers can insert own earnings')
    then raise exception 'B6 REGRESSION: driver_earnings self-insert policy still present'; end if;
  if has_table_privilege('authenticated','public.driver_earnings','insert')
    then raise exception 'B6 REGRESSION: authenticated can INSERT driver_earnings'; end if;
  raise notice 'B6 PASS: driver_earnings fabrication closed';
end$$;

-- ── B8 — respond_dispatch has ownership + timeout guards ──
do $$
declare v_def text := pg_get_functiondef('public.respond_dispatch(uuid,boolean)'::regprocedure);
begin
  if v_def not like '%timeout_at < now()%' then raise exception 'B8 REGRESSION: no timeout guard in respond_dispatch'; end if;
  if v_def not like '%permission denied%'   then raise exception 'B8 REGRESSION: no ownership guard in respond_dispatch'; end if;
  if has_function_privilege('anon','public.respond_dispatch(uuid,boolean)','execute')
    then raise exception 'B8 REGRESSION: respond_dispatch executable by anon'; end if;
  raise notice 'B8 PASS: respond_dispatch ownership + timeout enforced';
end$$;

-- ── B5 — coupon eligibility + redemption enforced inside create_order ──
do $$
declare v_def text := pg_get_functiondef('public.create_order(uuid,uuid,jsonb,numeric,jsonb,text,numeric,text)'::regprocedure);
begin
  if v_def not like '%per_customer_limit%' or v_def not like '%first_order_only%'
     or v_def not like '%min_order_amount%' or v_def not like '%coupon_usages%'
    then raise exception 'B5 REGRESSION: coupon limits/redemption not enforced in create_order'; end if;
  raise notice 'B5 PASS: coupon eligibility + redemption server-authoritative in create_order';
end$$;

select 'HARDENING_PASS_2_REGRESSION: B1-B8 all closed' as result;
