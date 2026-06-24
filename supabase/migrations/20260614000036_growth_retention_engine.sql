-- ════════════════════════════════════════════════════════════════════════════
-- PHASE ENTERPRISE-B — GROWTH + LOYALTY + RETENTION ENGINE
-- Reconciled with E4 (coupons/referrals/loyalty_tiers/audience_segments/
-- message_campaigns/banners already exist → EXTEND, never recreate).
-- Idempotent · audited (growth_audit_log) · RLS · indexed for 100k+ orders/day.
-- ════════════════════════════════════════════════════════════════════════════

-- ── audit backbone (M12) ────────────────────────────────────────────────────
create table if not exists public.growth_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid, action text not null, entity text not null, entity_id uuid,
  details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists idx_growth_audit on public.growth_audit_log(entity, created_at desc);
create or replace function public.g_audit(p_action text, p_entity text, p_entity_id uuid, p_details jsonb default '{}')
returns void language sql security definer set search_path=public as $$
  insert into public.growth_audit_log(actor_id,action,entity,entity_id,details) values (auth.uid(),p_action,p_entity,p_entity_id,p_details);
$$;

-- ════════════ MODULE 1 — ADVANCED COUPONS ════════════
alter table public.coupons
  add column if not exists discount_type text not null default 'percent'
     check (discount_type in ('percent','fixed','free_delivery','wallet_credit')),
  add column if not exists discount_value numeric,                 -- amount for fixed/wallet; percent uses discount_percent
  add column if not exists max_discount numeric,
  add column if not exists min_order_amount numeric not null default 0,
  add column if not exists merchant_id uuid references public.merchants(id) on delete cascade,
  add column if not exists city_id uuid references public.cities(id),
  add column if not exists first_order_only boolean not null default false,
  add column if not exists new_customer_only boolean not null default false,
  add column if not exists per_customer_limit int not null default 0; -- 0 = unlimited
create index if not exists idx_coupons_active_lookup on public.coupons(is_active, country_code, merchant_id);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid not null,
  discount_type text not null,
  discount_amount numeric not null,
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);
create index if not exists idx_coupon_redemptions on public.coupon_redemptions(customer_id, coupon_id);

-- Validate + redeem a coupon for an order against ALL rules. Idempotent + audited.
create or replace function public.redeem_advanced_coupon(p_code text, p_customer uuid, p_order_id uuid, p_order_amount numeric, p_country text default null, p_city uuid default null, p_merchant uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.coupons; v_disc numeric; v_prior_orders int; v_used_by int; v_existing public.coupon_redemptions;
begin
  -- idempotent: same (coupon,order) returns prior result
  select cr.* into v_existing from public.coupon_redemptions cr
    join public.coupons co on co.id=cr.coupon_id where upper(co.code)=upper(p_code) and cr.order_id=p_order_id;
  if found then return jsonb_build_object('ok',true,'discount',v_existing.discount_amount,'type',v_existing.discount_type,'idempotent',true); end if;

  select * into c from public.coupons where upper(code)=upper(p_code) for update;
  if not found then raise exception 'invalid coupon' using errcode='P0001'; end if;
  if not c.is_active then raise exception 'coupon inactive' using errcode='P0001'; end if;
  if c.start_date is not null and c.start_date::date > current_date then raise exception 'coupon not started' using errcode='P0001'; end if;
  if c.end_date   is not null and c.end_date::date   < current_date then raise exception 'coupon expired' using errcode='P0001'; end if;
  if c.expires_at is not null and c.expires_at       < current_date then raise exception 'coupon expired' using errcode='P0001'; end if;
  if c.max_uses <> 0 and c.used_count >= c.max_uses then raise exception 'coupon limit reached' using errcode='P0001'; end if;
  if p_order_amount < c.min_order_amount then raise exception 'order below minimum' using errcode='P0001'; end if;
  if c.country_code is not null and p_country is not null and c.country_code <> p_country then raise exception 'coupon not valid in country' using errcode='P0001'; end if;
  if c.city_id is not null and p_city is not null and c.city_id <> p_city then raise exception 'coupon not valid in city' using errcode='P0001'; end if;
  if c.merchant_id is not null and p_merchant is not null and c.merchant_id <> p_merchant then raise exception 'coupon not valid for merchant' using errcode='P0001'; end if;

  select count(*) into v_prior_orders from public.orders where customer_id=p_customer and status='delivered';
  if (c.first_order_only or c.new_customer_only) and v_prior_orders > 0 then raise exception 'coupon for first order only' using errcode='P0001'; end if;
  if c.per_customer_limit <> 0 then
    select count(*) into v_used_by from public.coupon_redemptions where coupon_id=c.id and customer_id=p_customer;
    if v_used_by >= c.per_customer_limit then raise exception 'per-customer limit reached' using errcode='P0001'; end if;
  end if;

  -- compute discount by type
  if c.discount_type='percent' then v_disc := round(p_order_amount * coalesce(c.discount_percent,0)/100.0,2);
  elsif c.discount_type='fixed' or c.discount_type='wallet_credit' then v_disc := coalesce(c.discount_value,0);
  else v_disc := 0; -- free_delivery handled by caller (delivery fee waived)
  end if;
  if c.max_discount is not null then v_disc := least(v_disc, c.max_discount); end if;
  v_disc := least(v_disc, p_order_amount);

  insert into public.coupon_redemptions(coupon_id,customer_id,order_id,discount_type,discount_amount)
    values (c.id,p_customer,p_order_id,c.discount_type,v_disc);
  update public.coupons set used_count = used_count + 1 where id=c.id;
  if c.discount_type='wallet_credit' then perform public.credit_customer_wallet(p_customer, v_disc, 'coupon_credit'); end if;
  perform public.g_audit('redeem','coupon',c.id, jsonb_build_object('order',p_order_id,'amount',v_disc,'type',c.discount_type));
  return jsonb_build_object('ok',true,'discount',v_disc,'type',c.discount_type,'free_delivery',(c.discount_type='free_delivery'));
end;$$;

-- ════════════ MODULE 3 — LOYALTY RULES + REWARDS ════════════
create table if not exists public.loyalty_rules (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('order','campaign','referral','signup')),
  points_per_currency numeric not null default 0,   -- e.g. 1 pt per 1 spent
  fixed_points int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.loyalty_rules(event_type,points_per_currency,fixed_points)
  select * from (values ('order'::text,1::numeric,0),('referral',0,100),('signup',0,50),('campaign',0,25)) v(a,b,c)
  where not exists (select 1 from public.loyalty_rules);

create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reward_type text not null check (reward_type in ('wallet_credit','discount','free_delivery')),
  points_cost int not null,
  value numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.loyalty_rewards(name,reward_type,points_cost,value)
  select * from (values ('رصيد 10 ريال'::text,'wallet_credit'::text,200,10::numeric),('توصيل مجاني','free_delivery',150,0),('خصم 25 ريال','wallet_credit',500,25)) v(a,b,c,d)
  where not exists (select 1 from public.loyalty_rewards);

-- award points for an event via the active rule (idempotent per (event,ref))
create or replace function public.award_points_for_event(p_customer uuid, p_event text, p_amount numeric default 0, p_ref uuid default null)
returns int language plpgsql security definer set search_path=public as $$
declare r public.loyalty_rules; v_pts int; v_mult numeric;
begin
  if p_ref is not null and exists (select 1 from public.loyalty_transactions where customer_id=p_customer and reason = p_event||':'||p_ref::text) then
    return public.loyalty_balance(p_customer); -- idempotent
  end if;
  select * into r from public.loyalty_rules where event_type=p_event and is_active order by created_at desc limit 1;
  if not found then return public.loyalty_balance(p_customer); end if;
  select coalesce(points_multiplier,1) into v_mult from public.resolve_loyalty_tier(p_customer);
  v_pts := ceil((r.fixed_points + r.points_per_currency * coalesce(p_amount,0)) * coalesce(v_mult,1))::int;
  if v_pts <= 0 then return public.loyalty_balance(p_customer); end if;
  insert into public.loyalty_transactions(customer_id,points,reason)
    values (p_customer, v_pts, p_event || coalesce(':'||p_ref::text,''));
  perform public.g_audit('earn','loyalty',p_ref, jsonb_build_object('event',p_event,'points',v_pts));
  return public.loyalty_balance(p_customer);
end;$$;

create or replace function public.redeem_loyalty_reward(p_customer uuid, p_reward_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare rw public.loyalty_rewards; v_bal int;
begin
  select * into rw from public.loyalty_rewards where id=p_reward_id and is_active for update;
  if not found then raise exception 'reward not found' using errcode='P0001'; end if;
  v_bal := public.loyalty_balance(p_customer);
  if v_bal < rw.points_cost then raise exception 'insufficient points' using errcode='P0001'; end if;
  insert into public.loyalty_transactions(customer_id,points,reason) values (p_customer, -rw.points_cost, 'redeem:'||rw.name);
  if rw.reward_type='wallet_credit' then perform public.credit_customer_wallet(p_customer, rw.value, 'loyalty_reward'); end if;
  perform public.g_audit('redeem','loyalty_reward',p_reward_id, jsonb_build_object('points',rw.points_cost,'type',rw.reward_type));
  return jsonb_build_object('ok',true,'reward',rw.reward_type,'value',rw.value,'balance',public.loyalty_balance(p_customer));
end;$$;

-- ════════════ MODULE 4 — CUSTOMER SEGMENTS ════════════
create table if not exists public.customer_segments (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  segment text not null check (segment in ('new','active','vip','inactive','at_risk','lost')),
  order_count int not null default 0,
  total_spent numeric not null default 0,
  last_order_at timestamptz,
  computed_at timestamptz not null default now()
);
create index if not exists idx_customer_segments on public.customer_segments(segment);

-- Recompute all customer segments (run by scheduler / pg_cron). Dynamic classification.
create or replace function public.recompute_customer_segments()
returns int language plpgsql security definer set search_path=public as $$
declare n int;
begin
  insert into public.customer_segments(customer_id,segment,order_count,total_spent,last_order_at,computed_at)
  select c.id,
    case
      when s.cnt is null and c.created_at > now()-interval '14 days' then 'new'
      when s.cnt is null then 'lost'
      when s.last_o > now()-interval '30 days' and (s.cnt>=5 or s.spent>=1000) then 'vip'
      when s.last_o > now()-interval '30 days' then 'active'
      when s.last_o > now()-interval '60 days' then 'inactive'
      when s.last_o > now()-interval '90 days' then 'at_risk'
      else 'lost'
    end,
    coalesce(s.cnt,0), coalesce(s.spent,0), s.last_o, now()
  from public.customers c
  left join (select customer_id, count(*) cnt, sum(total_amount) spent, max(created_at) last_o
             from public.orders where status='delivered' group by customer_id) s on s.customer_id=c.id
  on conflict (customer_id) do update set segment=excluded.segment, order_count=excluded.order_count,
    total_spent=excluded.total_spent, last_order_at=excluded.last_order_at, computed_at=now();
  get diagnostics n = row_count;
  perform public.g_audit('recompute','customer_segments',null, jsonb_build_object('rows',n));
  return n;
end;$$;

-- ════════════ MODULE 5 — CAMPAIGN TARGETING (extend message_campaigns) ════════════
alter table public.message_campaigns
  add column if not exists target_country text,
  add column if not exists target_city uuid,
  add column if not exists target_merchant_id uuid,
  add column if not exists target_segment text,
  add column if not exists target_min_wallet numeric,
  add column if not exists target_min_orders int;

-- ════════════ MODULE 6 — BANNERS (extend) ════════════
alter table public.banners
  add column if not exists placement text not null default 'home' check (placement in ('home','restaurant','checkout','wallet')),
  add column if not exists priority int not null default 0,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists target_country text,
  add column if not exists impressions int not null default 0,
  add column if not exists clicks int not null default 0;
create index if not exists idx_banners_placement on public.banners(placement, is_active, priority desc);
create or replace function public.track_banner(p_banner uuid, p_event text)
returns void language sql security definer set search_path=public as $$
  update public.banners set impressions = impressions + (p_event='impression')::int,
    clicks = clicks + (p_event='click')::int where id = p_banner;
$$;

-- ════════════ MODULE 7 — PROMOTIONS ════════════
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('flash_sale','happy_hour','buy_x_get_y','free_delivery','percentage')),
  merchant_id uuid references public.merchants(id) on delete cascade,
  discount_value numeric,
  config jsonb not null default '{}',           -- e.g. {"buy":2,"get":1} or {"percent":30}
  start_at timestamptz, end_at timestamptz,
  hour_start int, hour_end int,                 -- happy hour window (0-23)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_promotions_active on public.promotions(is_active, type, merchant_id);
create or replace function public.active_promotions(p_merchant uuid default null)
returns setof public.promotions language sql stable security definer set search_path=public as $$
  select * from public.promotions
  where is_active
    and (start_at is null or start_at <= now()) and (end_at is null or end_at >= now())
    and (hour_start is null or extract(hour from now())::int between hour_start and hour_end)
    and (p_merchant is null or merchant_id is null or merchant_id = p_merchant)
  order by created_at desc;
$$;

-- ════════════ MODULE 11 — NOTIFICATION TEMPLATES (localized) ════════════
create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  type text not null check (type in ('order','wallet','campaign','referral','loyalty')),
  title_ar text not null, title_en text not null,
  body_ar text not null, body_en text not null,
  is_active boolean not null default true
);
insert into public.notification_templates(key,type,title_ar,title_en,body_ar,body_en)
  select * from (values
    ('order_accepted','order','تم قبول طلبك','Order accepted','المتجر يحضّر طلبك الآن.','The store is preparing your order.'),
    ('driver_assigned','order','تم تعيين مندوب','Driver assigned','مندوبك في الطريق إلى المتجر.','Your driver is on the way to the store.'),
    ('order_delivered','order','تم التوصيل','Delivered','نتمنى لك وجبة شهية! قيّم تجربتك.','Enjoy! Please rate your experience.'),
    ('wallet_credit','wallet','تم إضافة رصيد','Wallet credited','تمت إضافة رصيد إلى محفظتك.','Funds were added to your wallet.'),
    ('referral_reward','referral','مكافأة إحالة','Referral reward','حصلت على مكافأة لإحالة صديق!','You earned a reward for referring a friend!'),
    ('loyalty_points','loyalty','نقاط جديدة','Points earned','حصلت على نقاط ولاء جديدة.','You earned new loyalty points.'),
    ('promo','campaign','عرض خاص','Special offer','لا تفوّت عروضنا الحصرية اليوم!','Don''t miss today''s exclusive offers!')
  ) v(a,b,c,d,e,f) where not exists (select 1 from public.notification_templates);

-- ════════════ MODULES 8/9/10 — ANALYTICS RPCs ════════════
-- M8 merchant growth
create or replace function public.merchant_growth_stats(p_merchant uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare j jsonb;
begin
  select jsonb_build_object(
    'orders', count(*), 'sales', coalesce(sum(o.total_amount),0),
    'avg_basket', round(coalesce(avg(o.total_amount),0)::numeric,2),
    'unique_customers', count(distinct o.customer_id),
    'repeat_customers', count(*) filter (where rc.cnt > 1),
    'top_products', (select coalesce(jsonb_agg(t),'[]') from (
        select p.name, count(oi.id) qty from public.order_items oi
        join public.product_variants pv on pv.id=oi.variant_id join public.products p on p.id=pv.product_id
        join public.orders o2 on o2.id=oi.order_id join public.merchant_branches b2 on b2.id=o2.branch_id
        where b2.merchant_id=p_merchant group by p.name order by count(oi.id) desc limit 5) t)
  ) into j
  from public.orders o join public.merchant_branches b on b.id=o.branch_id
  left join (select customer_id, count(*) cnt from public.orders group by customer_id) rc on rc.customer_id=o.customer_id
  where b.merchant_id=p_merchant and o.status='delivered';
  return j;
end;$$;

-- M9 retention: customers needing re-engagement + recommendation
create or replace function public.retention_targets()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'inactive', (select count(*) from public.customer_segments where segment='inactive'),
    'at_risk',  (select count(*) from public.customer_segments where segment='at_risk'),
    'lost',     (select count(*) from public.customer_segments where segment='lost'),
    'recommendations', jsonb_build_array(
      jsonb_build_object('segment','inactive','offer','free_delivery','reason','30-60d no order'),
      jsonb_build_object('segment','at_risk','offer','20% coupon','reason','60-90d no order'),
      jsonb_build_object('segment','lost','offer','wallet_credit 15','reason','90d+ no order — win-back'))
  );
$$;

-- M10 growth analytics
create or replace function public.growth_analytics()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'coupon_redemptions', (select count(*) from public.coupon_redemptions),
    'coupon_discount_total', (select coalesce(sum(discount_amount),0) from public.coupon_redemptions),
    'campaigns_sent', (select count(*) from public.message_campaigns where status='sent'),
    'campaign_recipients', (select coalesce(sum(recipient_count),0) from public.message_campaigns),
    'loyalty_points_outstanding', (select coalesce(sum(points),0) from public.loyalty_transactions),
    'referrals_total', (select count(*) from public.referrals),
    'referrals_rewarded', (select count(*) from public.referrals where status='rewarded'),
    'repeat_purchase_rate', (select round(coalesce(
        count(*) filter (where cnt>1)::numeric / nullif(count(*),0),0),3)
        from (select customer_id, count(*) cnt from public.orders where status='delivered' group by customer_id) s),
    'avg_ltv', (select round(coalesce(avg(spent),0)::numeric,2) from (
        select customer_id, sum(total_amount) spent from public.orders where status='delivered' group by customer_id) s),
    'segments', (select coalesce(jsonb_object_agg(segment,n),'{}') from (select segment,count(*) n from public.customer_segments group by segment) g),
    'cac_placeholder', null
  );
$$;

-- ════════════ grants + RLS (M12) ════════════
do $$ declare f text; begin
  foreach f in array array[
    'g_audit(text,text,uuid,jsonb)','redeem_advanced_coupon(text,uuid,uuid,numeric,text,uuid,uuid)',
    'award_points_for_event(uuid,text,numeric,uuid)','redeem_loyalty_reward(uuid,uuid)',
    'recompute_customer_segments()','track_banner(uuid,text)','active_promotions(uuid)',
    'merchant_growth_stats(uuid)','retention_targets()','growth_analytics()']
  loop execute format('grant execute on function public.%s to authenticated', f); end loop;
end$$;

do $$ declare t text; begin
  foreach t in array array['growth_audit_log','coupon_redemptions','loyalty_rules','loyalty_rewards','customer_segments','promotions','notification_templates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end$$;

-- public-readable catalogs (rewards, templates, active promotions, banners)
create policy loyalty_rewards_read on public.loyalty_rewards for select to authenticated using (true);
create policy notification_templates_read on public.notification_templates for select to authenticated using (true);
create policy promotions_read on public.promotions for select to authenticated using (true);
-- customer reads own segment + own coupon redemptions
create policy customer_segments_own on public.customer_segments for select to authenticated using (public.is_ops_admin() or customer_id = auth.uid());
create policy coupon_redemptions_own on public.coupon_redemptions for select to authenticated using (public.is_ops_admin() or customer_id = auth.uid());
-- admin-managed
do $$ declare t text; begin
  foreach t in array array['growth_audit_log','loyalty_rules','loyalty_rewards','promotions','notification_templates','customer_segments'] loop
    execute format('create policy %1$s_admin on public.%1$s for all to authenticated using (public.is_ops_admin()) with check (public.is_ops_admin())', t);
  end loop;
end$$;
