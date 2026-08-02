-- ════════════════════════════════════════════════════════════════════════════
-- FINAL LAUNCH BLOCKERS — permanent regression suite for C-1..C-4.
--   C-1 driver shift/presence manipulation · C-2 review/rating manipulation
--   C-3 set_default_address ownership · C-4 maintenance RPC authorization
-- Run against a project with 20260801000005 applied. Impersonated + self-cleaning; any regression RAISEs.
-- ════════════════════════════════════════════════════════════════════════════

-- ── C-1 — a caller cannot operate on another driver's shift/presence; the owner can ──
do $$
declare atk uuid := gen_random_uuid(); victim uuid := gen_random_uuid(); own uuid := gen_random_uuid();
  vshift uuid; e_start boolean:=false; e_end boolean:=false; e_break boolean:=false; own_ok boolean:=false; v_online boolean;
begin
  insert into public.customers(id, full_name, email) values (atk,'a',atk::text||'@regr.local');
  insert into public.drivers(id, phone_number, full_name, status, priority_score, active_orders, max_concurrent_orders, rating, is_online, owner_user_id)
    values (victim,'V-'||substr(victim::text,1,8),'V','offline',0,0,1,5,false,victim),
           (own,'O-'||substr(own::text,1,8),'O','offline',0,0,1,5,false,atk);
  insert into public.driver_shifts(id, driver_id, actual_start, status) values (gen_random_uuid(), victim, now(), 'active') returning id into vshift;

  perform set_config('request.jwt.claims', json_build_object('sub', atk::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.start_shift(victim, null); exception when others then e_start:=true; end;
  begin perform public.end_shift(vshift);          exception when others then e_end:=true; end;
  begin perform public.start_break(vshift);        exception when others then e_break:=true; end;
  begin perform public.start_shift(own, null); own_ok:=true; exception when others then own_ok:=false; end;  -- own driver ok
  execute 'reset role';
  select is_online into v_online from public.drivers where id=victim;

  delete from public.shift_breaks where shift_id in (select id from public.driver_shifts where driver_id in (victim,own));
  delete from public.driver_shifts where driver_id in (victim,own);
  delete from public.driver_performance where driver_id in (victim,own);
  delete from public.drivers where id in (victim,own); delete from public.customers where id=atk;

  if not e_start then raise exception 'C-1 REGRESSION: start_shift on an arbitrary driver accepted'; end if;
  if not e_end   then raise exception 'C-1 REGRESSION: end_shift on a foreign shift accepted'; end if;
  if not e_break then raise exception 'C-1 REGRESSION: start_break on a foreign shift accepted'; end if;
  if v_online is true then raise exception 'C-1 REGRESSION: victim driver was forced online'; end if;
  if not own_ok then raise exception 'C-1 REGRESSION: a driver can no longer start their own shift'; end if;
  raise notice 'C-1 PASS: shift/presence RPCs enforce driver/shift ownership';
end$$;

-- ── C-2 — reviews require own delivered order + real target; legit review works ──
do $$
declare cust uuid := gen_random_uuid(); atk uuid := gen_random_uuid();
  drv uuid := gen_random_uuid(); other_drv uuid := gen_random_uuid();
  mo uuid := gen_random_uuid(); merch uuid := gen_random_uuid(); branch uuid := gen_random_uuid();
  od uuid := gen_random_uuid(); op uuid := gen_random_uuid(); oc uuid := gen_random_uuid();
  e_foreign boolean:=false; e_forged boolean:=false; e_early boolean:=false; e_canc boolean:=false;
  legit_d boolean:=false; legit_m boolean:=false; drv_rating numeric; other_rating numeric;
begin
  insert into public.customers(id, full_name, email) values (cust,'c',cust::text||'@regr.local'),(atk,'a',atk::text||'@regr.local');
  insert into public.drivers(id, phone_number, full_name, status, priority_score, active_orders, max_concurrent_orders, rating, is_online, owner_user_id)
    values (drv,'D-'||substr(drv::text,1,8),'D','offline',0,0,1,5,false,drv),
           (other_drv,'X-'||substr(other_drv::text,1,8),'X','offline',0,0,1,5,false,other_drv);
  insert into public.merchants(id, owner_user_id, business_name) values (merch, mo, 'M');
  insert into public.merchant_branches(id, merchant_id, name) values (branch, merch, 'B');
  insert into public.orders(id, customer_id, driver_id, branch_id, status, total_amount, delivery_fee, payment_status) values
    (od, cust, drv, branch, 'delivered', 100, 10, 'paid'),
    (op, cust, drv, branch, 'on_the_way', 100, 10, 'unpaid'),
    (oc, cust, drv, branch, 'cancelled', 100, 10, 'unpaid');

  -- attacker cannot review another customer's order
  perform set_config('request.jwt.claims', json_build_object('sub', atk::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.submit_review(od, 'driver', drv, 1, 'x'); exception when others then e_foreign:=true; end;
  execute 'reset role';

  -- the real customer: forged target / before-delivery / cancelled blocked; legit works
  perform set_config('request.jwt.claims', json_build_object('sub', cust::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.submit_review(od, 'driver', other_drv, 1, 'forge'); exception when others then e_forged:=true; end;
  begin perform public.submit_review(op, 'driver', drv, 5, 'early'); exception when others then e_early:=true; end;
  begin perform public.submit_review(oc, 'driver', drv, 5, 'canc'); exception when others then e_canc:=true; end;
  begin perform public.submit_review(od, 'driver', drv, 5, 'great'); legit_d:=true; exception when others then legit_d:=false; end;
  begin perform public.submit_review(od, 'merchant', merch, 4, 'good'); legit_m:=true; exception when others then legit_m:=false; end;
  execute 'reset role';
  select rating into drv_rating from public.drivers where id=drv;
  select rating into other_rating from public.drivers where id=other_drv;

  delete from public.reviews where order_id in (od,op,oc);
  delete from public.order_status_history where order_id in (od,op,oc);
  delete from public.orders where id in (od,op,oc);
  delete from public.merchant_branches where id=branch; delete from public.merchants where id=merch;
  delete from public.driver_performance where driver_id in (drv,other_drv);
  delete from public.drivers where id in (drv,other_drv); delete from public.customers where id in (cust,atk);

  if not e_foreign then raise exception 'C-2 REGRESSION: reviewed a foreign order'; end if;
  if not e_forged  then raise exception 'C-2 REGRESSION: reviewed a target not on the order'; end if;
  if not e_early   then raise exception 'C-2 REGRESSION: reviewed before delivery'; end if;
  if not e_canc    then raise exception 'C-2 REGRESSION: reviewed a cancelled order'; end if;
  if not legit_d or not legit_m then raise exception 'C-2 REGRESSION: legitimate review was rejected'; end if;
  if coalesce(drv_rating,0) <> 5 then raise exception 'C-2 REGRESSION: legit rating not applied'; end if;
  if other_rating <> 5 then raise exception 'C-2 REGRESSION: forged review altered another driver rating'; end if;
  raise notice 'C-2 PASS: reviews bound to own delivered order + real target; no rating manipulation';
end$$;

-- ── C-3 — set_default_address requires ownership ──
do $$
declare atk uuid := gen_random_uuid(); victim uuid := gen_random_uuid(); vaddr uuid := gen_random_uuid(); blocked boolean:=false; still_def boolean;
begin
  insert into public.customers(id, full_name, email) values (atk,'a',atk::text||'@regr.local'),(victim,'v',victim::text||'@regr.local');
  insert into public.addresses(id, customer_id, label, address_line, is_default) values
    (vaddr, victim, 'home','A', true),(gen_random_uuid(), victim,'work','B', false);
  perform set_config('request.jwt.claims', json_build_object('sub', atk::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.set_default_address((select id from public.addresses where customer_id=victim and is_default=false limit 1)); exception when others then blocked:=true; end;
  execute 'reset role';
  select is_default into still_def from public.addresses where id=vaddr;
  delete from public.addresses where customer_id=victim; delete from public.customers where id in (atk,victim);
  if not blocked then raise exception 'C-3 REGRESSION: set_default_address accepted a foreign address'; end if;
  if still_def is not true then raise exception 'C-3 REGRESSION: victim default address was changed'; end if;
  raise notice 'C-3 PASS: set_default_address enforces ownership';
end$$;

-- ── C-4 — maintenance RPCs reject non-admin authenticated + anon; structural revokes ──
do $$
declare u uuid := gen_random_uuid(); e_recalc boolean:=false; e_recompute boolean:=false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.recalc_merchant_performance(gen_random_uuid(), null); exception when others then e_recalc:=true; end;
  begin perform public.recompute_customer_segments(); exception when others then e_recompute:=true; end;
  execute 'reset role';
  if not e_recalc then raise exception 'C-4 REGRESSION: recalc_merchant_performance callable by non-admin'; end if;
  if not e_recompute then raise exception 'C-4 REGRESSION: recompute_customer_segments callable by non-admin'; end if;
  if has_function_privilege('anon','public.recalc_merchant_performance(uuid,uuid)','execute')
     or has_function_privilege('anon','public.recompute_customer_segments()','execute')
     or has_function_privilege('anon','public.recalc_all_merchant_performance()','execute')
    then raise exception 'C-4 REGRESSION: a maintenance RPC is anon-executable'; end if;
  raise notice 'C-4 PASS: maintenance RPCs restricted to service/ops';
end$$;

select 'FINAL_LAUNCH_BLOCKERS_REGRESSION: C-1..C-4 closed' as result;
