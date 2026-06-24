-- ════════════════════════════════════════════════════════════════════════════
-- PHASE E5A — CUSTOMER EXPERIENCE PARITY
-- M1 Favorites/Reorder · M2 Addresses · M3 Reviews · M4 Tracking · M5 Support · M6 Search
-- Builds on existing tables (favorites, addresses, reviews, support_*, order_status_history).
-- Idempotent. RLS on new tables. SECURITY DEFINER RPCs.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════ M1 — FAVORITES (merchants) + REORDER ════════════
create table if not exists public.favorite_branches (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  branch_id uuid not null references public.merchant_branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, branch_id)
);
create index if not exists idx_fav_branches on public.favorite_branches(customer_id);

-- Reorder: return a previous order's line items (current variant/product/price) for the cart.
create or replace function public.reorder_items(p_order_id uuid)
returns table(variant_id uuid, product_id uuid, product_name text, quantity int, price numeric)
language sql stable security definer set search_path=public as $$
  select oi.variant_id, p.id, p.name, oi.quantity, p.price
  from public.order_items oi
  join public.product_variants pv on pv.id = oi.variant_id
  join public.products p on p.id = pv.product_id
  where oi.order_id = p_order_id;
$$;

-- ════════════ M2 — SAVED ADDRESSES (extend) ════════════
alter table public.addresses
  add column if not exists notes text,
  add column if not exists label_type text not null default 'custom' check (label_type in ('home','work','custom'));

create or replace function public.set_default_address(p_address_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_cust uuid;
begin
  select customer_id into v_cust from public.addresses where id = p_address_id;
  if v_cust is null then raise exception 'address not found'; end if;
  update public.addresses set is_default = (id = p_address_id) where customer_id = v_cust;
end;$$;

-- ════════════ M3 — RATINGS & REVIEWS (extend + moderation) ════════════
alter table public.reviews
  add column if not exists target_type text not null default 'merchant' check (target_type in ('merchant','driver','product')),
  add column if not exists target_id uuid,
  add column if not exists status text not null default 'approved' check (status in ('pending','approved','hidden')),
  add column if not exists is_reported boolean not null default false,
  add column if not exists created_at timestamptz not null default now();
create index if not exists idx_reviews_target on public.reviews(target_type, target_id, status);

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid,
  reason text,
  created_at timestamptz not null default now()
);

create or replace function public.submit_review(p_order_id uuid, p_target_type text, p_target_id uuid, p_rating int, p_comment text default null)
returns public.reviews language plpgsql security definer set search_path=public as $$
declare v public.reviews;
begin
  if p_rating < 1 or p_rating > 5 then raise exception 'rating must be 1-5' using errcode='P0001'; end if;
  insert into public.reviews(order_id, customer_id, target_type, target_id, rating, comment, status)
    values (p_order_id, auth.uid(), p_target_type, p_target_id, p_rating, p_comment, 'approved') returning * into v;
  -- maintain drivers.rating average when rating a driver
  if p_target_type = 'driver' and p_target_id is not null then
    update public.drivers set rating = (
      select round(avg(rating)::numeric, 2) from public.reviews where target_type='driver' and target_id=p_target_id and status='approved')
    where id = p_target_id;
  end if;
  return v;
end;$$;

create or replace function public.moderate_review(p_review_id uuid, p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  if p_status not in ('approved','hidden','pending') then raise exception 'invalid status'; end if;
  update public.reviews set status = p_status where id = p_review_id;
end;$$;

create or replace function public.report_review(p_review_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.review_reports(review_id, reporter_id, reason) values (p_review_id, auth.uid(), p_reason);
  update public.reviews set is_reported = true where id = p_review_id;
end;$$;

create or replace function public.rating_summary(p_target_type text, p_target_id uuid)
returns table(avg_rating numeric, rating_count bigint, five int, four int, three int, two int, one int)
language sql stable security definer set search_path=public as $$
  select round(avg(rating)::numeric,2), count(*),
    count(*) filter (where rating=5)::int, count(*) filter (where rating=4)::int,
    count(*) filter (where rating=3)::int, count(*) filter (where rating=2)::int, count(*) filter (where rating=1)::int
  from public.reviews where target_type=p_target_type and target_id=p_target_id and status='approved';
$$;

-- ════════════ M4 — LIVE ORDER TRACKING + ETA ════════════
create or replace function public.order_tracking(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare o record; v_dist numeric; v_eta int;
begin
  select ord.id, ord.status, ord.driver_id, ord.delivery_lat, ord.delivery_lng,
         d.current_lat, d.current_lng, d.full_name driver_name, d.phone_number driver_phone,
         z.eta_minutes
    into o
  from public.orders ord
  left join public.drivers d on d.id = ord.driver_id
  left join public.merchant_branches b on b.id = ord.branch_id
  left join public.zones z on z.id = b.zone_id
  where ord.id = p_order_id;
  if not found then return null; end if;
  if o.current_lat is not null and o.delivery_lat is not null then
    v_dist := round(public.haversine_km(o.current_lat,o.current_lng,o.delivery_lat::double precision,o.delivery_lng::double precision)::numeric, 2);
    v_eta := greatest(1, ceil(v_dist / 30.0 * 60))::int;   -- 30 km/h avg
  end if;
  return jsonb_build_object(
    'order_id', o.id, 'status', o.status,
    'driver', case when o.driver_id is null then null else jsonb_build_object(
      'name', o.driver_name, 'phone', o.driver_phone, 'lat', o.current_lat, 'lng', o.current_lng) end,
    'destination', jsonb_build_object('lat', o.delivery_lat, 'lng', o.delivery_lng),
    'remaining_km', v_dist, 'eta_minutes', coalesce(v_eta, o.eta_minutes),
    'timeline', (select coalesce(jsonb_agg(jsonb_build_object('status', h.status, 'at', h.created_at) order by h.created_at), '[]'::jsonb)
                 from public.order_status_history h where h.order_id = p_order_id)
  );
end;$$;

-- ════════════ M5 — SUPPORT CENTER (extend) ════════════
alter table public.support_tickets
  add column if not exists type text not null default 'general' check (type in ('dispute','refund','inquiry','general')),
  add column if not exists order_id uuid,
  add column if not exists first_response_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists sla_due_at timestamptz;
alter table public.support_messages
  add column if not exists is_internal boolean not null default false;

create or replace function public.create_support_ticket(p_subject text, p_type text, p_message text, p_order_id uuid default null)
returns public.support_tickets language plpgsql security definer set search_path=public as $$
declare v public.support_tickets;
begin
  insert into public.support_tickets(customer_id, subject, status, priority, type, order_id, sla_due_at)
    values (auth.uid(), p_subject, 'open', 'normal', p_type, p_order_id, now() + interval '24 hours') returning * into v;
  insert into public.support_messages(ticket_id, sender_type, sender_id, message_text)
    values (v.id, 'customer', auth.uid(), p_message);
  return v;
end;$$;

create or replace function public.add_ticket_message(p_ticket_id uuid, p_message text, p_is_internal boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare v_admin boolean := public.is_ops_admin();
begin
  insert into public.support_messages(ticket_id, sender_type, sender_id, message_text, is_internal)
    values (p_ticket_id, case when v_admin then 'agent' else 'customer' end, auth.uid(), p_message, p_is_internal and v_admin);
  if v_admin then
    update public.support_tickets set first_response_at = coalesce(first_response_at, now()), updated_at = now() where id = p_ticket_id;
  end if;
end;$$;

create or replace function public.update_ticket_status(p_ticket_id uuid, p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  update public.support_tickets set status = p_status, updated_at = now(),
    resolved_at = case when p_status in ('resolved','closed') then coalesce(resolved_at, now()) else resolved_at end
  where id = p_ticket_id;
end;$$;

create or replace function public.support_sla_stats()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'open', (select count(*) from public.support_tickets where status='open'),
    'in_progress', (select count(*) from public.support_tickets where status='in_progress'),
    'resolved', (select count(*) from public.support_tickets where status in ('resolved','closed')),
    'sla_breached', (select count(*) from public.support_tickets where status not in ('resolved','closed') and sla_due_at < now()),
    'avg_resolution_hours', (select round(coalesce(avg(extract(epoch from (resolved_at - created_at))/3600),0)::numeric,1)
                             from public.support_tickets where resolved_at is not null)
  );
$$;

-- ════════════ M6 — SEARCH & DISCOVERY ════════════
create table if not exists public.search_analytics (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  result_count int not null default 0,
  customer_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_search_term on public.search_analytics(lower(term));

create or replace function public.search_catalog(p_term text, p_limit int default 20)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_products jsonb; v_merchants jsonb; v_total int;
begin
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_products from (
    select p.id, p.name, p.price, p.branch_id, b.name branch_name
    from public.products p join public.merchant_branches b on b.id = p.branch_id
    where p.is_active and p.name ilike '%'||p_term||'%'
    order by similarity(p.name, p_term) desc limit p_limit) x;
  select coalesce(jsonb_agg(y), '[]'::jsonb) into v_merchants from (
    select b.id, b.name, b.zone_id from public.merchant_branches b
    where b.is_active and b.name ilike '%'||p_term||'%' limit p_limit) y;
  v_total := jsonb_array_length(v_products) + jsonb_array_length(v_merchants);
  insert into public.search_analytics(term, result_count, customer_id) values (p_term, v_total, auth.uid());
  return jsonb_build_object('products', v_products, 'merchants', v_merchants, 'total', v_total);
end;$$;

create or replace function public.trending_products(p_limit int default 10)
returns table(product_id uuid, name text, price numeric, branch_id uuid, order_count bigint)
language sql stable security definer set search_path=public as $$
  select p.id, p.name, p.price, p.branch_id, count(oi.id)
  from public.order_items oi
  join public.product_variants pv on pv.id = oi.variant_id
  join public.products p on p.id = pv.product_id
  where p.is_active
  group by p.id, p.name, p.price, p.branch_id
  order by count(oi.id) desc limit p_limit;
$$;

create or replace function public.recently_ordered(p_customer uuid, p_limit int default 10)
returns table(product_id uuid, name text, price numeric, branch_id uuid, last_ordered timestamptz)
language sql stable security definer set search_path=public as $$
  select p.id, p.name, p.price, p.branch_id, max(o.created_at)
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  join public.product_variants pv on pv.id = oi.variant_id
  join public.products p on p.id = pv.product_id
  where o.customer_id = p_customer and p.is_active
  group by p.id, p.name, p.price, p.branch_id
  order by max(o.created_at) desc limit p_limit;
$$;

create or replace function public.recommended_merchants(p_limit int default 10)
returns table(branch_id uuid, name text, zone_id uuid, order_count bigint)
language sql stable security definer set search_path=public as $$
  select b.id, b.name, b.zone_id, count(o.id)
  from public.merchant_branches b
  left join public.orders o on o.branch_id = b.id
  where b.is_active
  group by b.id, b.name, b.zone_id
  order by count(o.id) desc limit p_limit;
$$;

create or replace function public.search_term_stats()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'top_terms', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
       select lower(term) term, count(*) searches from public.search_analytics group by lower(term) order by count(*) desc limit 10) t),
    'zero_result', (select coalesce(jsonb_agg(z), '[]'::jsonb) from (
       select lower(term) term, count(*) searches from public.search_analytics where result_count=0 group by lower(term) order by count(*) desc limit 10) z));
$$;

-- ════════════ grants + RLS ════════════
do $$ declare f text; begin
  foreach f in array array['reorder_items(uuid)','set_default_address(uuid)','submit_review(uuid,text,uuid,int,text)',
    'moderate_review(uuid,text)','report_review(uuid,text)','rating_summary(text,uuid)','order_tracking(uuid)',
    'create_support_ticket(text,text,text,uuid)','add_ticket_message(uuid,text,boolean)','update_ticket_status(uuid,text)',
    'support_sla_stats()','search_catalog(text,int)','trending_products(int)','recently_ordered(uuid,int)',
    'recommended_merchants(int)','search_term_stats()']
  loop execute format('grant execute on function public.%s to authenticated', f); end loop;
end$$;

alter table public.favorite_branches enable row level security;
alter table public.review_reports enable row level security;
alter table public.search_analytics enable row level security;
grant select, insert, update, delete on public.favorite_branches to authenticated;
grant select, insert on public.review_reports to authenticated;
grant select, insert on public.search_analytics to authenticated;

create policy fav_branches_own on public.favorite_branches for all to authenticated
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy review_reports_rw on public.review_reports for all to authenticated
  using (public.is_ops_admin() or reporter_id = auth.uid()) with check (reporter_id = auth.uid());
create policy search_analytics_ins on public.search_analytics for insert to authenticated with check (true);
create policy search_analytics_read on public.search_analytics for select to authenticated using (public.is_ops_admin());
