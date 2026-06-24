-- ════════════════════════════════════════════════════════════════════════════
-- PHASE E2 — FINANCE ENGINE (double-entry)
-- Ledger (balanced debit/credit) is the source of truth. Commission + settlement
-- engines, driver adjustments, compensations, accounting exports — all idempotent.
-- Account convention: assets/expenses are debit-normal; liabilities (merchant/
-- driver payable) and revenue are credit-normal → balance = Σcredit − Σdebit.
-- ════════════════════════════════════════════════════════════════════════════

-- ── DOUBLE-ENTRY JOURNAL ────────────────────────────────────────────────────
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  txn_id uuid not null,                 -- groups one balanced transaction
  txn_type text not null,               -- order_commission | driver_earning | adjustment | merchant_settlement | driver_settlement | compensation | refund
  account_type text not null
     check (account_type in ('platform_cash','platform_revenue','platform_expense','merchant_payable','driver_payable','customer_refund')),
  owner_type text check (owner_type in ('platform','merchant','driver','customer')),
  owner_id uuid,
  debit numeric not null default 0 check (debit >= 0),
  credit numeric not null default 0 check (credit >= 0),
  ref_table text, ref_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid,
  check (not (debit > 0 and credit > 0))   -- each line is debit XOR credit
);
create index if not exists idx_ledger_txn on public.ledger_entries(txn_id);
create index if not exists idx_ledger_owner on public.ledger_entries(account_type, owner_id);

-- Post a balanced transaction (idempotent on txn_id). p_lines = jsonb array of
-- {account_type, owner_type, owner_id, debit, credit, ref_table, ref_id}.
create or replace function public.post_ledger(p_txn_id uuid, p_txn_type text, p_lines jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_debit numeric; v_credit numeric;
begin
  if exists (select 1 from public.ledger_entries where txn_id = p_txn_id) then return; end if;  -- idempotent
  select coalesce(sum(coalesce((l->>'debit')::numeric,0)),0),
         coalesce(sum(coalesce((l->>'credit')::numeric,0)),0)
    into v_debit, v_credit from jsonb_array_elements(p_lines) l;
  if round(v_debit,2) <> round(v_credit,2) then
    raise exception 'unbalanced ledger txn: debit % <> credit %', v_debit, v_credit using errcode='P0001';
  end if;
  insert into public.ledger_entries(txn_id,txn_type,account_type,owner_type,owner_id,debit,credit,ref_table,ref_id,created_by)
  select p_txn_id, p_txn_type, l->>'account_type', l->>'owner_type', nullif(l->>'owner_id','')::uuid,
         coalesce((l->>'debit')::numeric,0), coalesce((l->>'credit')::numeric,0),
         l->>'ref_table', nullif(l->>'ref_id','')::uuid, auth.uid()
  from jsonb_array_elements(p_lines) l;
end;$$;

-- Account balance (credit − debit). For payables: amount owed to the entity.
create or replace function public.fin_balance(p_account_type text, p_owner_id uuid default null)
returns numeric language sql stable as $$
  select coalesce(sum(credit) - sum(debit),0) from public.ledger_entries
  where account_type = p_account_type and (p_owner_id is null or owner_id = p_owner_id);
$$;

-- ── COMMISSION ──────────────────────────────────────────────────────────────
create table if not exists public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global' check (scope in ('global','merchant','category')),
  merchant_id uuid references public.merchants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  commission_type text not null default 'percent' check (commission_type in ('percent','flat')),
  rate numeric not null,                 -- percent (0–100) or flat amount
  country_code text,
  priority int not null default 0,       -- higher wins
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.commission_rules(scope, commission_type, rate, priority)
  select 'global','percent',15,0 where not exists (select 1 from public.commission_rules where scope='global');

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  merchant_id uuid not null,
  rule_id uuid references public.commission_rules(id),
  gross_amount numeric not null,
  commission_type text not null,
  rate numeric not null,
  commission_amount numeric not null,
  net_to_merchant numeric not null,
  settled boolean not null default false,
  merchant_settlement_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_commissions_merchant on public.commissions(merchant_id, settled);

create or replace function public.resolve_commission_rule(p_merchant uuid, p_category uuid, p_country text)
returns public.commission_rules language sql stable as $$
  select * from public.commission_rules r
  where r.is_active
    and (r.scope='global'
      or (r.scope='merchant' and r.merchant_id = p_merchant)
      or (r.scope='category' and r.category_id = p_category))
    and (r.country_code is null or r.country_code = p_country)
  order by (case r.scope when 'merchant' then 2 when 'category' then 1 else 0 end) desc, r.priority desc
  limit 1;
$$;

-- Capture commission for a delivered order (idempotent on order_id) + post ledger.
create or replace function public.capture_order_commission(p_order_id uuid)
returns public.commissions language plpgsql security definer set search_path=public as $$
declare o record; v_merchant uuid; v_rule public.commission_rules; v_comm numeric; v_net numeric; v_row public.commissions; v_cat uuid;
begin
  select id, branch_id, total_amount into o from public.orders where id = p_order_id;
  if not found then raise exception 'order not found'; end if;
  select c.* into v_row from public.commissions c where c.order_id = p_order_id;
  if found then return v_row; end if;   -- idempotent
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

-- ── DRIVER ADJUSTMENTS (incentive / bonus / penalty) ────────────────────────
create table if not exists public.driver_adjustments (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  type text not null check (type in ('incentive','bonus','penalty')),
  amount numeric not null,               -- always positive; penalty is debited from payable
  reason text,
  order_id uuid,
  settled boolean not null default false,
  driver_settlement_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_driver_adj on public.driver_adjustments(driver_id, settled);

create or replace function public.add_driver_adjustment(p_driver uuid, p_type text, p_amount numeric, p_reason text, p_order uuid default null)
returns public.driver_adjustments language plpgsql security definer set search_path=public as $$
declare v public.driver_adjustments;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  insert into public.driver_adjustments(driver_id,type,amount,reason,order_id,created_by)
  values (p_driver,p_type,p_amount,p_reason,p_order,auth.uid()) returning * into v;
  if p_type = 'penalty' then
    perform public.post_ledger(gen_random_uuid(),'adjustment', jsonb_build_array(
      jsonb_build_object('account_type','driver_payable','owner_type','driver','owner_id',p_driver,'debit',p_amount,'credit',0,'ref_table','driver_adjustments','ref_id',v.id),
      jsonb_build_object('account_type','platform_revenue','owner_type','platform','debit',0,'credit',p_amount,'ref_table','driver_adjustments','ref_id',v.id)));
  else
    perform public.post_ledger(gen_random_uuid(),'adjustment', jsonb_build_array(
      jsonb_build_object('account_type','platform_expense','owner_type','platform','debit',p_amount,'credit',0,'ref_table','driver_adjustments','ref_id',v.id),
      jsonb_build_object('account_type','driver_payable','owner_type','driver','owner_id',p_driver,'debit',0,'credit',p_amount,'ref_table','driver_adjustments','ref_id',v.id)));
  end if;
  return v;
end;$$;

-- ── SETTLEMENTS ─────────────────────────────────────────────────────────────
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('merchant','driver')),
  period_start date not null, period_end date not null,
  status text not null default 'finalized' check (status in ('draft','finalized','paid')),
  entity_count int not null default 0,
  total_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid
);
create table if not exists public.merchant_settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id),
  gross_sales numeric not null, total_commission numeric not null, net_payable numeric not null,
  status text not null default 'pending' check (status in ('pending','paid')),
  paid_at timestamptz, paid_by uuid
);
create index if not exists idx_msettle_merchant on public.merchant_settlements(merchant_id, status);
create table if not exists public.driver_settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  driver_id uuid not null references public.drivers(id),
  total_earnings numeric not null, total_incentives numeric not null default 0,
  total_bonuses numeric not null default 0, total_penalties numeric not null default 0,
  net_payable numeric not null,
  status text not null default 'pending' check (status in ('pending','paid')),
  paid_at timestamptz, paid_by uuid
);
create index if not exists idx_dsettle_driver on public.driver_settlements(driver_id, status);

-- Settlement ENGINE: aggregate unsettled commissions into a merchant settlement run.
create or replace function public.generate_merchant_settlement(p_start date, p_end date)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_run uuid; r record; v_total numeric := 0; v_count int := 0; v_ms uuid;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  insert into public.settlements(run_type,period_start,period_end,created_by) values ('merchant',p_start,p_end,auth.uid()) returning id into v_run;
  for r in
    select merchant_id, sum(gross_amount) gross, sum(commission_amount) comm, sum(net_to_merchant) net
    from public.commissions
    where not settled and created_at >= p_start and created_at < (p_end + 1)
    group by merchant_id
  loop
    insert into public.merchant_settlements(settlement_id,merchant_id,gross_sales,total_commission,net_payable)
      values (v_run, r.merchant_id, r.gross, r.comm, r.net) returning id into v_ms;
    update public.commissions set settled=true, merchant_settlement_id=v_ms
      where merchant_id=r.merchant_id and not settled and created_at >= p_start and created_at < (p_end + 1);
    v_total := v_total + r.net; v_count := v_count + 1;
  end loop;
  update public.settlements set total_amount=v_total, entity_count=v_count where id=v_run;
  return v_run;
end;$$;

create or replace function public.pay_merchant_settlement(p_ms_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r record;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  select * into r from public.merchant_settlements where id=p_ms_id for update;
  if not found then raise exception 'settlement not found'; end if;
  if r.status='paid' then return; end if;   -- idempotent
  update public.merchant_settlements set status='paid', paid_at=now(), paid_by=auth.uid() where id=p_ms_id;
  perform public.post_ledger(gen_random_uuid(),'merchant_settlement', jsonb_build_array(
    jsonb_build_object('account_type','merchant_payable','owner_type','merchant','owner_id',r.merchant_id,'debit',r.net_payable,'credit',0,'ref_table','merchant_settlements','ref_id',p_ms_id),
    jsonb_build_object('account_type','platform_cash','owner_type','platform','debit',0,'credit',r.net_payable,'ref_table','merchant_settlements','ref_id',p_ms_id)));
end;$$;

-- Driver settlement: earnings (unsettled, not already ad-hoc-paid) + adjustments.
create or replace function public.generate_driver_settlement(p_start date, p_end date)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_run uuid; r record; v_total numeric := 0; v_count int := 0; v_ds uuid;
  v_earn numeric; v_inc numeric; v_bon numeric; v_pen numeric; v_net numeric;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  insert into public.settlements(run_type,period_start,period_end,created_by) values ('driver',p_start,p_end,auth.uid()) returning id into v_run;
  for r in select distinct driver_id from public.drivers loop
    select coalesce(sum(delivery_fee_earned+coalesce(tip_earned,0)+coalesce(bonus_earned,0)),0) into v_earn
      from public.driver_earnings where driver_id=r.driver_id and payout_status<>'paid' and settlement_id is null
        and created_at >= p_start and created_at < (p_end+1);
    select coalesce(sum(amount) filter (where type='incentive'),0), coalesce(sum(amount) filter (where type='bonus'),0), coalesce(sum(amount) filter (where type='penalty'),0)
      into v_inc, v_bon, v_pen from public.driver_adjustments
      where driver_id=r.driver_id and not settled and created_at >= p_start and created_at < (p_end+1);
    v_net := v_earn + v_inc + v_bon - v_pen;
    continue when v_earn = 0 and v_inc = 0 and v_bon = 0 and v_pen = 0;
    insert into public.driver_settlements(settlement_id,driver_id,total_earnings,total_incentives,total_bonuses,total_penalties,net_payable)
      values (v_run, r.driver_id, v_earn, v_inc, v_bon, v_pen, v_net) returning id into v_ds;
    update public.driver_earnings set settlement_id=v_ds where driver_id=r.driver_id and payout_status<>'paid' and settlement_id is null and created_at >= p_start and created_at < (p_end+1);
    update public.driver_adjustments set settled=true, driver_settlement_id=v_ds where driver_id=r.driver_id and not settled and created_at >= p_start and created_at < (p_end+1);
    v_total := v_total + v_net; v_count := v_count + 1;
  end loop;
  update public.settlements set total_amount=v_total, entity_count=v_count where id=v_run;
  return v_run;
end;$$;

create or replace function public.pay_driver_settlement(p_ds_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r record;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  select * into r from public.driver_settlements where id=p_ds_id for update;
  if not found then raise exception 'settlement not found'; end if;
  if r.status='paid' then return; end if;
  update public.driver_settlements set status='paid', paid_at=now(), paid_by=auth.uid() where id=p_ds_id;
  perform public.post_ledger(gen_random_uuid(),'driver_settlement', jsonb_build_array(
    jsonb_build_object('account_type','driver_payable','owner_type','driver','owner_id',r.driver_id,'debit',r.net_payable,'credit',0,'ref_table','driver_settlements','ref_id',p_ds_id),
    jsonb_build_object('account_type','platform_cash','owner_type','platform','debit',0,'credit',r.net_payable,'ref_table','driver_settlements','ref_id',p_ds_id)));
end;$$;

-- needed column for driver settlement linkage
alter table public.driver_earnings add column if not exists settlement_id uuid;

-- ── COMPENSATIONS ───────────────────────────────────────────────────────────
create table if not exists public.compensations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('merchant','driver','customer')),
  entity_id uuid not null,
  order_id uuid,
  amount numeric not null check (amount > 0),
  reason text,
  status text not null default 'issued' check (status in ('issued','reversed')),
  created_by uuid,
  created_at timestamptz not null default now()
);
create or replace function public.issue_compensation(p_entity_type text, p_entity_id uuid, p_amount numeric, p_reason text, p_order uuid default null)
returns public.compensations language plpgsql security definer set search_path=public as $$
declare v public.compensations; v_acct text;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  insert into public.compensations(entity_type,entity_id,order_id,amount,reason,created_by)
    values (p_entity_type,p_entity_id,p_order,p_amount,p_reason,auth.uid()) returning * into v;
  v_acct := case p_entity_type when 'merchant' then 'merchant_payable' when 'driver' then 'driver_payable' else 'customer_refund' end;
  perform public.post_ledger(gen_random_uuid(),'compensation', jsonb_build_array(
    jsonb_build_object('account_type','platform_expense','owner_type','platform','debit',p_amount,'credit',0,'ref_table','compensations','ref_id',v.id),
    jsonb_build_object('account_type',v_acct,'owner_type',p_entity_type,'owner_id',p_entity_id,'debit',0,'credit',p_amount,'ref_table','compensations','ref_id',v.id)));
  return v;
end;$$;

-- ── ACCOUNTING EXPORTS ──────────────────────────────────────────────────────
create table if not exists public.accounting_exports (
  id uuid primary key default gen_random_uuid(),
  export_type text not null check (export_type in ('revenue','commission','settlement','ledger')),
  period_start date not null, period_end date not null,
  row_count int not null default 0, total_amount numeric not null default 0,
  generated_by uuid, generated_at timestamptz not null default now()
);
create or replace function public.generate_accounting_export(p_type text, p_start date, p_end date)
returns public.accounting_exports language plpgsql security definer set search_path=public as $$
declare v public.accounting_exports; v_rows int; v_total numeric;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  if p_type='commission' then
    select count(*), coalesce(sum(commission_amount),0) into v_rows,v_total from public.commissions where created_at>=p_start and created_at<(p_end+1);
  elsif p_type='revenue' then
    select count(*), coalesce(sum(credit-debit),0) into v_rows,v_total from public.ledger_entries where account_type='platform_revenue' and created_at>=p_start and created_at<(p_end+1);
  elsif p_type='settlement' then
    select count(*), coalesce(sum(total_amount),0) into v_rows,v_total from public.settlements where created_at>=p_start and created_at<(p_end+1);
  else
    select count(*), coalesce(sum(debit),0) into v_rows,v_total from public.ledger_entries where created_at>=p_start and created_at<(p_end+1);
  end if;
  insert into public.accounting_exports(export_type,period_start,period_end,row_count,total_amount,generated_by)
    values (p_type,p_start,p_end,v_rows,v_total,auth.uid()) returning * into v;
  return v;
end;$$;

-- ════════════ grants + RLS ════════════
grant execute on function public.capture_order_commission(uuid) to authenticated;
grant execute on function public.add_driver_adjustment(uuid,text,numeric,text,uuid) to authenticated;
grant execute on function public.generate_merchant_settlement(date,date) to authenticated;
grant execute on function public.pay_merchant_settlement(uuid) to authenticated;
grant execute on function public.generate_driver_settlement(date,date) to authenticated;
grant execute on function public.pay_driver_settlement(uuid) to authenticated;
grant execute on function public.issue_compensation(text,uuid,numeric,text,uuid) to authenticated;
grant execute on function public.generate_accounting_export(text,date,date) to authenticated;
grant execute on function public.post_ledger(uuid,text,jsonb) to authenticated;

alter table public.ledger_entries enable row level security;
alter table public.commission_rules enable row level security;
alter table public.commissions enable row level security;
alter table public.driver_adjustments enable row level security;
alter table public.settlements enable row level security;
alter table public.merchant_settlements enable row level security;
alter table public.driver_settlements enable row level security;
alter table public.compensations enable row level security;
alter table public.accounting_exports enable row level security;

-- ledger + rules + settlements runs + exports: admin-only read; writes via DEFINER RPCs
do $$ declare t text; begin
  foreach t in array array['ledger_entries','commission_rules','settlements','accounting_exports','compensations'] loop
    execute format('drop policy if exists %1$s_admin on public.%1$s', t);
    execute format('create policy %1$s_admin on public.%1$s for all to authenticated using (public.is_ops_admin()) with check (public.is_ops_admin())', t);
    execute format('grant select, insert, update on public.%1$s to authenticated', t);
  end loop;
end$$;

-- per-entity finance: owner reads own, admin all
drop policy if exists commissions_read on public.commissions;
create policy commissions_read on public.commissions for select to authenticated using (
  public.is_ops_admin() or exists (select 1 from public.merchants m where m.id=merchant_id and m.owner_user_id=auth.uid()));
drop policy if exists msettle_read on public.merchant_settlements;
create policy msettle_read on public.merchant_settlements for select to authenticated using (
  public.is_ops_admin() or exists (select 1 from public.merchants m where m.id=merchant_id and m.owner_user_id=auth.uid()));
drop policy if exists dsettle_read on public.driver_settlements;
create policy dsettle_read on public.driver_settlements for select to authenticated using (
  public.is_ops_admin() or exists (select 1 from public.drivers d where d.id=driver_id and d.owner_user_id=auth.uid()));
drop policy if exists dadj_read on public.driver_adjustments;
create policy dadj_read on public.driver_adjustments for select to authenticated using (
  public.is_ops_admin() or exists (select 1 from public.drivers d where d.id=driver_id and d.owner_user_id=auth.uid()));
grant select on public.commissions, public.merchant_settlements, public.driver_settlements, public.driver_adjustments to authenticated;
