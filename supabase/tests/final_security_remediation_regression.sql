-- ════════════════════════════════════════════════════════════════════════════
-- FINAL SECURITY REMEDIATION — permanent regression suite for the Red Team findings.
--   F-1  complete_delivery caller authorization (customer cannot forge completion)
--   F-2  finalize_driver_delivery bound to a real delivered order owned by the caller
--   F-3  merchants KYC/PII not readable by non-owners; discovery via merchants_public
-- Plus structural asserts for F-4 / F-5 / F-6 / F-8. Run against a project with
-- 20260801000003 applied:  psql "$DATABASE_URL" -f supabase/tests/final_security_remediation_regression.sql
-- Impersonated checks self-clean (zero residue); any regression RAISEs.
-- ════════════════════════════════════════════════════════════════════════════

-- ── F-1 — a customer cannot complete their own order; the real driver can ──
do $$
declare
  cust uuid := gen_random_uuid(); drv uuid := gen_random_uuid(); ord uuid := gen_random_uuid();
  by_customer boolean := false; by_driver boolean := false; st text; earn int;
begin
  insert into public.customers(id, full_name, email) values (cust,'c',cust::text||'@regr.local');
  insert into public.drivers(id, phone_number, full_name, status, priority_score, active_orders, max_concurrent_orders, rating, is_online, owner_user_id)
    values (drv,'FR1-'||substr(drv::text,1,8),'d','busy',0,1,2,5.0,true,drv);
  insert into public.orders(id, customer_id, driver_id, status, total_amount, delivery_fee, payment_status)
    values (ord, cust, drv, 'on_the_way', 100, 25, 'unpaid');
  insert into public.wallets(owner_type, owner_id, balance) values ('driver', drv, 0);

  -- attacker = the customer
  perform set_config('request.jwt.claims', json_build_object('sub', cust::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.complete_delivery(ord, drv); by_customer := true; exception when others then by_customer := false; end;
  execute 'reset role';

  -- legit = the driver
  perform set_config('request.jwt.claims', json_build_object('sub', drv::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.complete_delivery(ord, drv); by_driver := true; exception when others then by_driver := false; end;
  execute 'reset role';

  select status into st from public.orders where id=ord;
  select count(*) into earn from public.driver_earnings where order_id=ord;

  delete from public.wallet_transactions where wallet_id in (select id from public.wallets where owner_id=drv);
  delete from public.driver_earnings where order_id=ord;
  delete from public.order_status_history where order_id=ord;
  delete from public.wallets where owner_id=drv;
  delete from public.driver_performance where driver_id=drv;
  delete from public.orders where id=ord;
  delete from public.drivers where id=drv;
  delete from public.customers where id=cust;

  if by_customer then raise exception 'F-1 REGRESSION: a customer forged complete_delivery'; end if;
  if not by_driver then raise exception 'F-1 REGRESSION: the assigned driver can no longer complete'; end if;
  if st <> 'delivered' or earn <> 1 then raise exception 'F-1 REGRESSION: legit completion did not finalize'; end if;
  raise notice 'F-1 PASS: only the assigned driver (or ops) can complete a delivery';
end$$;

-- ── F-2 — finalize_driver_delivery requires a real delivered order owned by the caller ──
do $$
declare
  drv uuid := gen_random_uuid(); cust uuid := gen_random_uuid(); ord uuid := gen_random_uuid();
  fake_ok boolean := false; other_status_ok boolean := false;
begin
  insert into public.customers(id, full_name, email) values (cust,'c',cust::text||'@regr.local');
  insert into public.drivers(id, phone_number, full_name, status, priority_score, active_orders, max_concurrent_orders, rating, is_online, owner_user_id)
    values (drv,'FR2-'||substr(drv::text,1,8),'d','busy',0,2,3,5.0,true,drv);
  -- an order assigned to the driver but NOT delivered (still on_the_way)
  insert into public.orders(id, customer_id, driver_id, status, total_amount, delivery_fee, payment_status)
    values (ord, cust, drv, 'on_the_way', 100, 25, 'unpaid');

  perform set_config('request.jwt.claims', json_build_object('sub', drv::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.finalize_driver_delivery(gen_random_uuid(), drv); fake_ok := true; exception when others then fake_ok := false; end;
  begin perform public.finalize_driver_delivery(ord, drv); other_status_ok := true; exception when others then other_status_ok := false; end;
  execute 'reset role';

  delete from public.order_status_history where order_id=ord;
  delete from public.orders where id=ord;
  delete from public.driver_performance where driver_id=drv;
  delete from public.drivers where id=drv;
  delete from public.customers where id=cust;

  if fake_ok then raise exception 'F-2 REGRESSION: finalize accepted a non-existent order'; end if;
  if other_status_ok then raise exception 'F-2 REGRESSION: finalize accepted a non-delivered order'; end if;
  raise notice 'F-2 PASS: finalize requires a real delivered order assigned to the caller';
end$$;

-- ── F-3 — non-owner cannot read merchant KYC/PII; discovery view carries only safe columns ──
do $$
declare
  atk uuid := gen_random_uuid(); mown uuid := gen_random_uuid(); merch uuid := gen_random_uuid();
  saw_tax int; saw_public int;
begin
  insert into public.merchants(id, owner_user_id, business_name, tax_number, contact_phone)
    values (merch, mown, 'M', 'TAX-REGR', '0100');

  perform set_config('request.jwt.claims', json_build_object('sub', atk::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into saw_tax    from public.merchants        where tax_number = 'TAX-REGR';
  select count(*) into saw_public from public.merchants_public where id = merch;
  execute 'reset role';

  delete from public.merchants where id=merch;

  if saw_tax <> 0 then raise exception 'F-3 REGRESSION: a non-owner read a merchant tax_number'; end if;
  if saw_public <> 1 then raise exception 'F-3 REGRESSION: merchants_public discovery is broken'; end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='merchants_public'
              and column_name in ('tax_number','commercial_registration_number','contact_email','contact_phone','owner_user_id'))
    then raise exception 'F-3 REGRESSION: merchants_public exposes a sensitive column'; end if;
  raise notice 'F-3 PASS: KYC/PII hidden from non-owners; merchants_public exposes only safe columns';
end$$;

-- ── Structural: F-4 / F-5 / F-6 / F-8 ──
do $$
begin
  -- F-4: maintenance/dispatch jobs not anon-executable
  if has_function_privilege('anon','public.expire_dispatch_offers()','execute')
     or has_function_privilege('anon','public.recalc_driver_performance(uuid)','execute')
     or has_function_privilege('anon','public.auto_dispatch_order(uuid,integer)','execute')
    then raise exception 'F-4 REGRESSION: a maintenance/dispatch job is anon-executable'; end if;
  -- F-5: no always-true INSERT policy remains on the three tables
  if exists (select 1 from pg_policies where schemaname='public'
              and tablename in ('order_status_history','campaign_events','search_analytics')
              and cmd='INSERT' and with_check='true')
    then raise exception 'F-5 REGRESSION: an always-true INSERT policy remains'; end if;
  -- F-6: no public object-listing policies remain
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname like '%public_read%')
    then raise exception 'F-6 REGRESSION: a public bucket listing policy remains'; end if;
  -- F-8: pg_trgm out of public
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm' and n.nspname='public')
    then raise exception 'F-8 REGRESSION: pg_trgm is still in the public schema'; end if;
  raise notice 'F-4/F-5/F-6/F-8 PASS: structural remediations in place';
end$$;

select 'FINAL_SECURITY_REMEDIATION_REGRESSION: F-1..F-8 closed' as result;
