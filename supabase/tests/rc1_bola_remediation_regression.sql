-- ════════════════════════════════════════════════════════════════════════════
-- RC-1 REMEDIATION — permanent regression suite for Broken Object Level Authorization on
-- SECURITY DEFINER read RPCs. An unrelated attacker must not read another account's data;
-- the owner (and ops) must still read their own; order_tracking must not expose driver phone.
-- Run against a project with 20260801000006 applied. Impersonated + self-cleaning; any regression RAISEs.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  atk uuid := gen_random_uuid(); vic uuid := gen_random_uuid();
  vdrv uuid := gen_random_uuid(); mo uuid := gen_random_uuid(); merch uuid := gen_random_uuid(); branch uuid := gen_random_uuid();
  prod uuid := gen_random_uuid(); pv uuid := gen_random_uuid();
  vord uuid := gen_random_uuid(); aord uuid := gen_random_uuid();
  e_loy boolean:=false; e_tier boolean:=false; e_recent boolean:=false; e_reorder boolean:=false; e_track boolean:=false; e_mstats boolean:=false;
  e_growth boolean:=false; e_ops boolean:=false; e_ret boolean:=false; e_sla boolean:=false; e_exp boolean:=false; e_seg boolean:=false;
  own_loy int; own_reorder int; own_track jsonb; track_has_phone boolean;
begin
  insert into public.customers(id, full_name, email) values (atk,'a',atk::text||'@regr.local'),(vic,'v',vic::text||'@regr.local');
  insert into public.loyalty_transactions(customer_id, points, reason) values (vic, 500, 'seed'),(atk, 30, 'seed');
  insert into public.drivers(id, phone_number, full_name, status, priority_score, active_orders, max_concurrent_orders, rating, is_online, owner_user_id, current_lat, current_lng)
    values (vdrv,'D-'||substr(vdrv::text,1,8),'Drv','busy',0,1,2,5,true,vdrv, 24.7, 46.7);
  insert into public.merchants(id, owner_user_id, business_name) values (merch, mo, 'M');
  insert into public.merchant_branches(id, merchant_id, name) values (branch, merch, 'B');
  insert into public.products(id, branch_id, name, price, is_active) values (prod, branch, 'Item', 20, true);
  insert into public.product_variants(id, product_id, price_modifier) values (pv, prod, 0);
  insert into public.orders(id, customer_id, driver_id, branch_id, status, total_amount, delivery_fee, payment_status, delivery_lat, delivery_lng)
    values (vord, vic, vdrv, branch, 'on_the_way', 40, 5, 'unpaid', 24.8, 46.8),
           (aord, atk, vdrv, branch, 'on_the_way', 40, 5, 'unpaid', 24.9, 46.9);
  insert into public.order_items(order_id, variant_id, quantity, price) values (vord, pv, 2, 20),(aord, pv, 1, 20);

  perform set_config('request.jwt.claims', json_build_object('sub', atk::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  -- attacker → victim data: every call must raise
  begin perform public.loyalty_balance(vic);        exception when others then e_loy:=true; end;
  begin perform public.resolve_loyalty_tier(vic);   exception when others then e_tier:=true; end;
  begin perform public.recently_ordered(vic, 10);   exception when others then e_recent:=true; end;
  begin perform public.reorder_items(vord);         exception when others then e_reorder:=true; end;
  begin perform public.order_tracking(vord);        exception when others then e_track:=true; end;
  begin perform public.merchant_growth_stats(merch);exception when others then e_mstats:=true; end;
  -- ops-only analytics: non-admin must raise
  begin perform public.growth_analytics();          exception when others then e_growth:=true; end;
  begin perform public.ops_summary();               exception when others then e_ops:=true; end;
  begin perform public.retention_targets();         exception when others then e_ret:=true; end;
  begin perform public.support_sla_stats();         exception when others then e_sla:=true; end;
  begin perform public.expiring_documents(30);      exception when others then e_exp:=true; end;
  begin perform public.estimate_segment('{}'::jsonb); exception when others then e_seg:=true; end;
  -- owner → own data: must work
  own_loy := public.loyalty_balance(atk);
  select count(*) into own_reorder from public.reorder_items(aord);
  own_track := public.order_tracking(aord);
  track_has_phone := (own_track->'driver' ? 'phone');
  execute 'reset role';

  delete from public.order_items where order_id in (vord,aord);
  delete from public.order_status_history where order_id in (vord,aord);
  delete from public.orders where id in (vord,aord);
  delete from public.product_variants where id=pv; delete from public.products where id=prod;
  delete from public.merchant_branches where id=branch; delete from public.merchants where id=merch;
  delete from public.loyalty_transactions where customer_id in (atk,vic);
  delete from public.drivers where id=vdrv; delete from public.customers where id in (atk,vic);

  if not (e_loy and e_tier and e_recent and e_reorder and e_track and e_mstats)
    then raise exception 'RC-1 REGRESSION: an owner-scoped read RPC leaked another account''s data'; end if;
  if not (e_growth and e_ops and e_ret and e_sla and e_exp and e_seg)
    then raise exception 'RC-1 REGRESSION: an ops-only analytics RPC is callable by a non-admin'; end if;
  if own_loy <> 30 then raise exception 'RC-1 REGRESSION: owner can no longer read own loyalty_balance'; end if;
  if own_reorder <> 1 then raise exception 'RC-1 REGRESSION: owner can no longer reorder own order'; end if;
  if not (own_track ? 'status') then raise exception 'RC-1 REGRESSION: owner order_tracking broken'; end if;
  if track_has_phone then raise exception 'RC-1 REGRESSION: order_tracking still exposes driver phone'; end if;
  raise notice 'RC-1 PASS: read RPCs enforce ownership/ops; owner access intact; driver phone not exposed';
end$$;

-- Structural: the fixed read RPCs are not anon-executable.
do $$
begin
  if has_function_privilege('anon','public.loyalty_balance(uuid)','execute')
     or has_function_privilege('anon','public.order_tracking(uuid)','execute')
     or has_function_privilege('anon','public.reorder_items(uuid)','execute')
     or has_function_privilege('anon','public.recently_ordered(uuid,integer)','execute')
     or has_function_privilege('anon','public.merchant_growth_stats(uuid)','execute')
     or has_function_privilege('anon','public.growth_analytics()','execute')
     or has_function_privilege('anon','public.expiring_documents(integer)','execute')
    then raise exception 'RC-1 REGRESSION: a fixed read RPC is still anon-executable'; end if;
  raise notice 'RC-1 STRUCTURAL PASS: fixed read RPCs revoked from anon';
end$$;

select 'RC1_BOLA_REGRESSION: RC-1 closed' as result;
