-- ════════════════════════════════════════════════════════════════════════════
-- FINAL CRITICAL REMEDIATION — permanent regression suite.
--   N-2 (CRITICAL) referral wallet minting — the full exploit chain must fail; the legitimate
--                  server-driven path (paid+delivered ⇒ auto-qualify, server rewards) must work.
--   N-1 (MEDIUM)   driver KYC/PII — customers cannot read KYC on the base table; the public
--                  projection exposes only safe columns.
-- Run against a project with 20260801000004 applied. Impersonated + self-cleaning (zero residue).
-- Any regression RAISEs.
-- ════════════════════════════════════════════════════════════════════════════

-- ── N-2 — the exploit chain is fully blocked (arbitrary owner, client rewards, arbitrary
--         referee, direct client qualify) and mints nothing ──
do $$
declare
  A uuid := gen_random_uuid(); B uuid := gen_random_uuid(); other uuid := gen_random_uuid();
  code text; e_arb boolean:=false; e_apply boolean:=false; e_qualify boolean:=false;
  reward_r numeric; reward_e numeric; wallets_minted int;
begin
  insert into public.customers(id, full_name, email) values (A,'A',A::text||'@regr.local'),(B,'B',B::text||'@regr.local');
  perform set_config('request.jwt.claims', json_build_object('sub', A::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  -- arbitrary owner id -> denied
  begin perform public.generate_referral_code('customer', other, 1000000, 1000000); exception when others then e_arb:=true; end;
  -- own code -> allowed but rewards are server-controlled (client values discarded)
  begin code := (public.generate_referral_code('customer', A, 1000000, 1000000)).code; exception when others then code:=null; end;
  -- apply for a different referee -> denied
  begin perform public.apply_referral_code(code, other); exception when others then e_apply:=true; end;
  -- direct client qualify -> denied (EXECUTE revoked)
  begin perform public.qualify_referral(B, gen_random_uuid()); exception when others then e_qualify:=true; end;
  execute 'reset role';

  select reward_referrer, reward_referee into reward_r, reward_e from public.referral_codes where owner_id=A;
  select count(*) into wallets_minted from public.wallets where owner_id in (A,B,other);

  delete from public.referral_codes where owner_id in (A,other);
  delete from public.customers where id in (A,B);

  if not e_arb    then raise exception 'N-2 REGRESSION: arbitrary owner_id accepted by generate_referral_code'; end if;
  if not e_apply  then raise exception 'N-2 REGRESSION: apply_referral_code accepted a foreign referee'; end if;
  if not e_qualify then raise exception 'N-2 REGRESSION: qualify_referral is client-callable'; end if;
  if reward_r <> 15 or reward_e <> 10 then raise exception 'N-2 REGRESSION: client-supplied reward amounts were honored (%, %)', reward_r, reward_e; end if;
  if wallets_minted <> 0 then raise exception 'N-2 REGRESSION: attacker minted wallet balance'; end if;
  raise notice 'N-2 PASS (attack): arbitrary owner/referee/qualify blocked; rewards server-controlled; nothing minted';
end$$;

-- ── N-2 — the legitimate flow still rewards, server-side, only on a PAID + DELIVERED order ──
do $$
declare A uuid := gen_random_uuid(); B uuid := gen_random_uuid(); ord uuid := gen_random_uuid();
  code text; balA numeric; balB numeric; early_bal int;
begin
  insert into public.customers(id, full_name, email) values (A,'A',A::text||'@regr.local'),(B,'B',B::text||'@regr.local');
  perform set_config('request.jwt.claims', json_build_object('sub', A::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  code := (public.generate_referral_code('customer', A, 999, 999)).code;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', B::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.apply_referral_code(code, B);
  execute 'reset role';

  -- an unpaid/undelivered order must NOT qualify
  insert into public.orders(id, customer_id, status, total_amount, delivery_fee, payment_status) values (ord, B, 'on_the_way', 100, 25, 'unpaid');
  select count(*) into early_bal from public.wallets where owner_id in (A,B);
  -- now PAID + DELIVERED -> trigger auto-qualifies with server rewards (15/10)
  update public.orders set payment_status='paid' where id=ord;
  update public.orders set status='delivered' where id=ord;

  select balance into balA from public.wallets where owner_id=A;
  select balance into balB from public.wallets where owner_id=B;

  delete from public.wallet_transactions where wallet_id in (select id from public.wallets where owner_id in (A,B));
  delete from public.wallets where owner_id in (A,B);
  delete from public.referrals where referee_id=B; delete from public.referral_codes where owner_id=A;
  delete from public.order_status_history where order_id=ord; delete from public.orders where id=ord;
  delete from public.customers where id in (A,B);

  if early_bal <> 0 then raise exception 'N-2 REGRESSION: referral rewarded before paid+delivered'; end if;
  if coalesce(balA,0) <> 15 or coalesce(balB,0) <> 10 then raise exception 'N-2 REGRESSION: legit auto-qualify wrong (A=%, B=%)', balA, balB; end if;
  raise notice 'N-2 PASS (legit): auto-qualify only on paid+delivered; server rewards 15/10 credited';
end$$;

-- ── N-1 — driver KYC hidden from the ordering customer; public projection safe ──
do $$
declare c uuid := gen_random_uuid(); drv uuid := gen_random_uuid(); ord uuid := gen_random_uuid();
  base_rows int; base_natid text; pub_name text;
begin
  insert into public.customers(id, full_name, email) values (c,'c',c::text||'@regr.local');
  insert into public.drivers(id, phone_number, full_name, status, priority_score, active_orders, max_concurrent_orders, rating, is_online, owner_user_id, national_id_number, license_number)
    values (drv,'K-'||substr(drv::text,1,8),'Driver X','busy',0,1,2,4.9,true,drv,'NATID-REGR','LIC-REGR');
  insert into public.orders(id, customer_id, driver_id, status, total_amount, delivery_fee, payment_status) values (ord,c,drv,'on_the_way',100,25,'unpaid');
  perform set_config('request.jwt.claims', json_build_object('sub', c::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into base_rows from public.drivers where id=drv;             -- base: 0 (no customer read)
  select national_id_number into base_natid from public.drivers where id=drv;  -- null
  select full_name into pub_name from public.drivers_public where id=drv;      -- safe name via projection
  execute 'reset role';
  delete from public.orders where id=ord; delete from public.drivers where id=drv; delete from public.customers where id=c;

  if base_rows <> 0 then raise exception 'N-1 REGRESSION: customer can read the base drivers row'; end if;
  if base_natid is not null then raise exception 'N-1 REGRESSION: customer read driver national_id'; end if;
  if pub_name is null then raise exception 'N-1 REGRESSION: drivers_public lost legitimate driver visibility'; end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='drivers_public'
              and column_name in ('national_id_number','license_number','license_expiry','owner_user_id','priority_score'))
    then raise exception 'N-1 REGRESSION: drivers_public exposes a sensitive column'; end if;
  raise notice 'N-1 PASS: KYC hidden on base; drivers_public exposes only safe columns';
end$$;

-- ── Structural: client execute revoked ──
do $$
begin
  if has_function_privilege('anon','public.generate_referral_code(text,uuid,numeric,numeric)','execute')
     or has_function_privilege('anon','public.apply_referral_code(text,uuid)','execute')
    then raise exception 'N-2 REGRESSION: referral RPC anon-executable'; end if;
  if has_function_privilege('authenticated','public.qualify_referral(uuid,uuid)','execute')
     or has_function_privilege('anon','public.qualify_referral(uuid,uuid)','execute')
    then raise exception 'N-2 REGRESSION: qualify_referral is client-executable'; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='drivers' and policyname='Read drivers')
    then raise exception 'N-1 REGRESSION: full-row "Read drivers" policy still present'; end if;
  raise notice 'STRUCTURAL PASS: referral RPC grants locked; Read drivers policy removed';
end$$;

select 'FINAL_CRITICAL_REMEDIATION_REGRESSION: N-2 + N-1 closed' as result;
