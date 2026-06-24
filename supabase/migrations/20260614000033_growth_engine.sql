-- ════════════════════════════════════════════════════════════════════════════
-- PHASE E4 — GROWTH ENGINE
-- Referrals · Cashback · Loyalty tiers · Affiliates/Influencers · Marketing.
-- Rewards credit the customer wallet (monetary). Idempotent + audited. RLS.
-- ════════════════════════════════════════════════════════════════════════════

-- safe wallet credit (wallets has no unique on owner; update-then-insert)
create or replace function public.credit_customer_wallet(p_customer uuid, p_amount numeric, p_type text)
returns void language plpgsql security definer set search_path=public as $$
declare v_wallet uuid;
begin
  update public.wallets set balance = balance + p_amount
    where owner_type='customer' and owner_id=p_customer returning id into v_wallet;
  if v_wallet is null then
    insert into public.wallets(owner_type,owner_id,balance) values ('customer',p_customer,p_amount) returning id into v_wallet;
  end if;
  insert into public.wallet_transactions(wallet_id,amount,type) values (v_wallet,p_amount,p_type);
end;$$;

-- ════════════ REFERRALS ════════════
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null default 'customer' check (owner_type in ('customer','affiliate','influencer')),
  owner_id uuid not null,
  code text not null unique,
  reward_referrer numeric not null default 10,
  reward_referee numeric not null default 10,
  max_uses int not null default 0,            -- 0 = unlimited
  used_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.referral_codes(id) on delete cascade,
  referrer_owner_type text not null,
  referrer_id uuid not null,
  referee_id uuid not null unique,            -- a customer can be referred only once
  status text not null default 'pending' check (status in ('pending','qualified','rewarded')),
  order_id uuid,
  reward_referrer numeric, reward_referee numeric,
  created_at timestamptz not null default now(),
  qualified_at timestamptz
);
create index if not exists idx_referrals_referrer on public.referrals(referrer_id, status);

create or replace function public.generate_referral_code(p_owner_type text, p_owner_id uuid, p_reward_referrer numeric default 10, p_reward_referee numeric default 10)
returns public.referral_codes language plpgsql security definer set search_path=public as $$
declare v public.referral_codes; v_code text;
begin
  select * into v from public.referral_codes where owner_type=p_owner_type and owner_id=p_owner_id limit 1;
  if found then return v; end if;
  v_code := upper(substr(md5(p_owner_id::text || clock_timestamp()::text), 1, 8));
  insert into public.referral_codes(owner_type,owner_id,code,reward_referrer,reward_referee)
    values (p_owner_type,p_owner_id,v_code,p_reward_referrer,p_reward_referee) returning * into v;
  return v;
end;$$;

create or replace function public.apply_referral_code(p_code text, p_referee uuid)
returns public.referrals language plpgsql security definer set search_path=public as $$
declare c public.referral_codes; v public.referrals;
begin
  select * into c from public.referral_codes where upper(code)=upper(p_code) and is_active for update;
  if not found then raise exception 'invalid referral code' using errcode='P0001'; end if;
  if c.max_uses <> 0 and c.used_count >= c.max_uses then raise exception 'referral code exhausted' using errcode='P0001'; end if;
  if c.owner_id = p_referee then raise exception 'cannot refer yourself' using errcode='P0001'; end if;
  if exists (select 1 from public.referrals where referee_id=p_referee) then raise exception 'already referred' using errcode='P0001'; end if;
  insert into public.referrals(code_id,referrer_owner_type,referrer_id,referee_id,reward_referrer,reward_referee)
    values (c.id,c.owner_type,c.owner_id,p_referee,c.reward_referrer,c.reward_referee) returning * into v;
  update public.referral_codes set used_count=used_count+1 where id=c.id;
  return v;
end;$$;

-- On the referee's first order: qualify + credit both parties; track affiliate/influencer earnings.
create or replace function public.qualify_referral(p_referee uuid, p_order_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r public.referrals;
begin
  select * into r from public.referrals where referee_id=p_referee and status='pending' for update;
  if not found then return; end if;
  update public.referrals set status='rewarded', order_id=p_order_id, qualified_at=now() where id=r.id;
  -- referee reward (wallet credit)
  perform public.credit_customer_wallet(p_referee, r.reward_referee, 'referral_bonus');
  -- referrer reward: customer → wallet; affiliate/influencer → earnings tally
  if r.referrer_owner_type='customer' then
    perform public.credit_customer_wallet(r.referrer_id, r.reward_referrer, 'referral_reward');
  elsif r.referrer_owner_type='affiliate' then
    update public.affiliates set total_referred=total_referred+1, total_earned=total_earned+r.reward_referrer where code_id=r.code_id;
  elsif r.referrer_owner_type='influencer' then
    update public.influencers set total_referred=total_referred+1, total_earned=total_earned+r.reward_referrer where code_id=r.code_id;
  end if;
end;$$;

-- ════════════ CASHBACK ════════════
create table if not exists public.cashback_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'percent' check (type in ('percent','flat')),
  rate numeric not null,
  min_order numeric not null default 0,
  max_cashback numeric,
  country_code text,
  start_date date, end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.cashback (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  campaign_id uuid references public.cashback_campaigns(id),
  order_id uuid not null,
  amount numeric not null,
  status text not null default 'credited' check (status in ('pending','credited')),
  created_at timestamptz not null default now(),
  unique (customer_id, order_id)
);
create index if not exists idx_cashback_customer on public.cashback(customer_id);

create or replace function public.award_cashback(p_customer uuid, p_order_id uuid, p_order_amount numeric)
returns public.cashback language plpgsql security definer set search_path=public as $$
declare camp public.cashback_campaigns; v_amt numeric; v public.cashback;
begin
  select c.* into v from public.cashback c where customer_id=p_customer and order_id=p_order_id;
  if found then return v; end if;                          -- idempotent
  select * into camp from public.cashback_campaigns
    where is_active and p_order_amount >= min_order
      and (start_date is null or start_date <= current_date)
      and (end_date is null or end_date >= current_date)
    order by created_at desc limit 1;
  if not found then return null; end if;
  if camp.type='flat' then v_amt := camp.rate; else v_amt := round(p_order_amount * camp.rate / 100.0, 2); end if;
  if camp.max_cashback is not null then v_amt := least(v_amt, camp.max_cashback); end if;
  insert into public.cashback(customer_id,campaign_id,order_id,amount) values (p_customer,camp.id,p_order_id,v_amt) returning * into v;
  perform public.credit_customer_wallet(p_customer, v_amt, 'cashback');
  return v;
end;$$;

create or replace function public.cashback_balance(p_customer uuid)
returns numeric language sql stable as $$
  select coalesce(sum(amount),0) from public.cashback where customer_id=p_customer and status='credited';
$$;

-- ════════════ LOYALTY TIERS ════════════
create table if not exists public.loyalty_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null, level int not null,
  min_points int not null, points_multiplier numeric not null default 1.0,
  perks jsonb, is_active boolean not null default true
);
insert into public.loyalty_tiers(name,level,min_points,points_multiplier,perks)
  select * from (values
    ('Bronze',1,0,1.0,'{"free_delivery_threshold":100}'::jsonb),
    ('Silver',2,500,1.25,'{"free_delivery_threshold":75}'::jsonb),
    ('Gold',3,2000,1.5,'{"free_delivery_threshold":50,"priority_support":true}'::jsonb),
    ('Platinum',4,5000,2.0,'{"free_delivery_threshold":0,"priority_support":true,"exclusive_offers":true}'::jsonb)
  ) v where not exists (select 1 from public.loyalty_tiers);

create or replace function public.resolve_loyalty_tier(p_customer uuid)
returns public.loyalty_tiers language sql stable security definer set search_path=public as $$
  select t.* from public.loyalty_tiers t
  where t.is_active and t.min_points <= public.loyalty_balance(p_customer)
  order by t.min_points desc limit 1;
$$;

-- ════════════ AFFILIATES / INFLUENCERS ════════════
create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, name text not null, code_id uuid references public.referral_codes(id),
  commission_rate numeric not null default 0,
  total_referred int not null default 0, total_earned numeric not null default 0,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);
create table if not exists public.influencers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, name text not null, handle text, platform text,
  code_id uuid references public.referral_codes(id),
  reach int default 0, commission_rate numeric not null default 0,
  total_referred int not null default 0, total_earned numeric not null default 0,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

create or replace function public.create_affiliate(p_name text, p_user uuid, p_commission numeric, p_reward numeric default 10)
returns public.affiliates language plpgsql security definer set search_path=public as $$
declare v_code public.referral_codes; v public.affiliates; v_id uuid := gen_random_uuid();
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  v_code := public.generate_referral_code('affiliate', v_id, p_reward, p_reward);
  insert into public.affiliates(id,user_id,name,code_id,commission_rate) values (v_id,p_user,p_name,v_code.id,p_commission) returning * into v;
  return v;
end;$$;

create or replace function public.create_influencer(p_name text, p_handle text, p_platform text, p_reach int, p_commission numeric, p_reward numeric default 10)
returns public.influencers language plpgsql security definer set search_path=public as $$
declare v_code public.referral_codes; v public.influencers; v_id uuid := gen_random_uuid();
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  v_code := public.generate_referral_code('influencer', v_id, p_reward, p_reward);
  insert into public.influencers(id,name,handle,platform,reach,code_id,commission_rate) values (v_id,p_name,p_handle,p_platform,p_reach,v_code.id,p_commission) returning * into v;
  return v;
end;$$;

-- ════════════ AUDIENCE SEGMENTS + MARKETING ════════════
create table if not exists public.audience_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  definition jsonb not null,                  -- {min_orders, max_orders, registered_after, registered_before}
  estimated_size int not null default 0,
  created_by uuid, created_at timestamptz not null default now()
);
create table if not exists public.message_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('push','sms','email')),
  segment_id uuid references public.audience_segments(id),
  body text,
  status text not null default 'draft' check (status in ('draft','scheduled','sent')),
  scheduled_at timestamptz, recipient_count int not null default 0, sent_at timestamptz,
  created_by uuid, created_at timestamptz not null default now()
);

create or replace function public.estimate_segment(p_definition jsonb)
returns int language sql stable security definer set search_path=public as $$
  select count(*)::int from public.customers c
  where (p_definition->>'registered_after' is null or c.created_at >= (p_definition->>'registered_after')::timestamptz)
    and (p_definition->>'registered_before' is null or c.created_at <= (p_definition->>'registered_before')::timestamptz)
    and (coalesce((p_definition->>'min_orders')::int,0) = 0 or (select count(*) from public.orders o where o.customer_id=c.id) >= (p_definition->>'min_orders')::int)
    and (p_definition->>'max_orders' is null or (select count(*) from public.orders o where o.customer_id=c.id) <= (p_definition->>'max_orders')::int);
$$;

create or replace function public.create_audience_segment(p_name text, p_definition jsonb)
returns public.audience_segments language plpgsql security definer set search_path=public as $$
declare v public.audience_segments;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  insert into public.audience_segments(name,definition,estimated_size,created_by)
    values (p_name,p_definition,public.estimate_segment(p_definition),auth.uid()) returning * into v;
  return v;
end;$$;

create or replace function public.send_message_campaign(p_id uuid)
returns int language plpgsql security definer set search_path=public as $$
declare v record; v_size int;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  select mc.*, s.definition def into v from public.message_campaigns mc left join public.audience_segments s on s.id=mc.segment_id where mc.id=p_id;
  if not found then raise exception 'campaign not found'; end if;
  v_size := case when v.def is null then (select count(*) from public.customers) else public.estimate_segment(v.def) end;
  update public.message_campaigns set status='sent', recipient_count=v_size, sent_at=now() where id=p_id;
  return v_size;   -- NOTE: actual push/SMS/email delivery requires provider integration (not present)
end;$$;

-- ════════════ grants + RLS ════════════
do $$ declare f text; begin
  foreach f in array array[
    'generate_referral_code(text,uuid,numeric,numeric)','apply_referral_code(text,uuid)','qualify_referral(uuid,uuid)',
    'award_cashback(uuid,uuid,numeric)','cashback_balance(uuid)','resolve_loyalty_tier(uuid)',
    'create_affiliate(text,uuid,numeric,numeric)','create_influencer(text,text,text,int,numeric,numeric)',
    'estimate_segment(jsonb)','create_audience_segment(text,jsonb)','send_message_campaign(uuid)','credit_customer_wallet(uuid,numeric,text)']
  loop execute format('grant execute on function public.%s to authenticated', f); end loop;
end$$;

do $$ declare t text; begin
  foreach t in array array['referral_codes','referrals','cashback','cashback_campaigns','loyalty_tiers','affiliates','influencers','audience_segments','message_campaigns'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end$$;

-- public-readable catalogs
create policy loyalty_tiers_read on public.loyalty_tiers for select to authenticated using (true);
create policy cashback_campaigns_read on public.cashback_campaigns for select to authenticated using (true);
-- customer/owner-scoped
create policy referral_codes_own on public.referral_codes for select to authenticated using (public.is_ops_admin() or owner_id = auth.uid());
create policy referrals_own on public.referrals for select to authenticated using (public.is_ops_admin() or referrer_id = auth.uid() or referee_id = auth.uid());
create policy cashback_own on public.cashback for select to authenticated using (public.is_ops_admin() or customer_id = auth.uid());
-- admin-managed
do $$ declare t text; begin
  foreach t in array array['cashback_campaigns','loyalty_tiers','affiliates','influencers','audience_segments','message_campaigns','referral_codes'] loop
    execute format('create policy %1$s_admin on public.%1$s for all to authenticated using (public.is_ops_admin()) with check (public.is_ops_admin())', t);
  end loop;
end$$;
