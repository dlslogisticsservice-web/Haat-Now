-- ════════════════════════════════════════════════════════════════════════════
-- PHASE ENTERPRISE-A — CORE OPERATIONS ENGINE
-- Dispatch · Delivery Zones · Vehicles · Shifts · Performance · Payouts
-- Reconciled with the pre-existing enterprise schema (driver_earnings,
-- driver_performance, driver_shifts, shift_breaks, complete_delivery* RPCs).
-- Plain-SQL geo (no PostGIS). Write paths via SECURITY DEFINER RPCs;
-- direct writes on NEW tables are admin-only; reads authenticated. Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.is_ops_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid());
$$;

-- ════════════ 3) VEHICLE MANAGEMENT ════════════
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  type text unique not null check (type in ('motorcycle','car','van','truck')),
  name_en text not null, name_ar text not null,
  capacity int not null, speed_kmh numeric not null,
  pricing_modifier numeric not null default 1.0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.vehicles (type,name_en,name_ar,capacity,speed_kmh,pricing_modifier) values
  ('motorcycle','Motorcycle','دراجة نارية',1,40,1.0),
  ('car','Car','سيارة',3,50,1.2),
  ('van','Van','شاحنة صغيرة',8,45,1.6),
  ('truck','Truck','شاحنة',20,35,2.5)
on conflict (type) do nothing;

-- ── extend DRIVERS (status / vehicle / location / scoring / workload) ────────
alter table public.drivers
  add column if not exists status text not null default 'offline'
     check (status in ('offline','available','busy','on_break')),
  add column if not exists vehicle_id uuid references public.vehicles(id),
  add column if not exists current_lat double precision,
  add column if not exists current_lng double precision,
  add column if not exists last_seen_at timestamptz,
  add column if not exists priority_score numeric not null default 0,
  add column if not exists active_orders int not null default 0,
  add column if not exists max_concurrent_orders int not null default 1,
  add column if not exists rating numeric not null default 5.0;
update public.drivers set vehicle_id = (select id from public.vehicles where type='motorcycle')
  where vehicle_id is null;

-- ════════════ 2) DELIVERY ZONES (extend existing zones) ════════════
alter table public.zones
  add column if not exists polygon jsonb,
  add column if not exists base_fee numeric not null default 10,
  add column if not exists per_km_fee numeric not null default 2,
  add column if not exists min_fee numeric not null default 10,
  add column if not exists eta_minutes int not null default 30,
  add column if not exists is_active boolean not null default true,
  add column if not exists country_code text;
create index if not exists idx_zones_active on public.zones(is_active);

-- ════════════ 4) SHIFTS — tables pre-exist; ensure present (no-op if so) ════════════
create table if not exists public.driver_shifts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  zone_id uuid references public.zones(id),
  scheduled_start timestamptz, scheduled_end timestamptz,
  actual_start timestamptz, actual_end timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','active','closed')),
  created_at timestamptz not null default now()
);
create index if not exists idx_shifts_driver on public.driver_shifts(driver_id, status);
create table if not exists public.shift_breaks (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.driver_shifts(id) on delete cascade,
  started_at timestamptz not null default now(), ended_at timestamptz
);
create index if not exists idx_breaks_shift on public.shift_breaks(shift_id);

-- ════════════ 5) PERFORMANCE — table pre-exists; ensure present ════════════
create table if not exists public.driver_performance (
  driver_id uuid primary key references public.drivers(id) on delete cascade,
  orders_offered int not null default 0, orders_accepted int not null default 0,
  orders_completed int not null default 0, orders_cancelled int not null default 0,
  orders_timeout int not null default 0, total_delivery_minutes numeric not null default 0,
  rating_sum numeric not null default 0, rating_count int not null default 0,
  total_earnings numeric not null default 0, updated_at timestamptz not null default now()
);

-- ════════════ 6) PAYOUTS — extend existing driver_earnings + new payout_requests ════════════
alter table public.driver_earnings
  add column if not exists payout_status text not null default 'available'
     check (payout_status in ('pending','available','paid'));
create index if not exists idx_earnings_payout on public.driver_earnings(driver_id, payout_status);

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  note text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz, processed_by uuid
);
create index if not exists idx_payouts_driver on public.payout_requests(driver_id, status);

-- ════════════ 1) DISPATCH ════════════
create table if not exists public.dispatch_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  status text not null default 'offered'
     check (status in ('offered','accepted','rejected','timeout','reassigned','lost','cancelled')),
  method text not null default 'auto' check (method in ('auto','manual')),
  attempt int not null default 1, distance_km numeric,
  assigned_at timestamptz not null default now(), responded_at timestamptz, timeout_at timestamptz
);
create index if not exists idx_dispatch_order on public.dispatch_assignments(order_id);
create index if not exists idx_dispatch_driver on public.dispatch_assignments(driver_id, status);

-- ════════════════════════════════════════════════════════════════════════════
-- GEO + ENGINE FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2-lat1)/2),2) +
    cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lng2-lng1)/2),2)));
$$;

create or replace function public.point_in_zone(p_lat double precision, p_lng double precision, poly jsonb)
returns boolean language plpgsql immutable as $$
declare n int; i int; j int; xi double precision; yi double precision; xj double precision; yj double precision; inside boolean := false;
begin
  if poly is null then return false; end if;
  n := jsonb_array_length(poly);
  if n < 3 then return false; end if;
  j := n - 1;
  for i in 0..n-1 loop
    xi := (poly->i->>0)::double precision; yi := (poly->i->>1)::double precision;
    xj := (poly->j->>0)::double precision; yj := (poly->j->>1)::double precision;
    if ((yi > p_lat) <> (yj > p_lat)) and (p_lng < (xj-xi)*(p_lat-yi)/nullif((yj-yi),0)+xi) then
      inside := not inside;
    end if;
    j := i;
  end loop;
  return inside;
end;$$;

create or replace function public.zone_for_point(p_lat double precision, p_lng double precision)
returns uuid language sql stable as $$
  select z.id from public.zones z
  where z.is_active and z.polygon is not null and public.point_in_zone(p_lat,p_lng,z.polygon) limit 1;
$$;

create or replace function public.zone_quote(p_zone_id uuid, p_distance_km numeric, p_vehicle_id uuid default null)
returns table(fee numeric, eta_minutes int) language sql stable as $$
  select greatest(z.min_fee, (z.base_fee + z.per_km_fee * coalesce(p_distance_km,0)) * coalesce(v.pricing_modifier,1.0)),
         (z.eta_minutes + ceil(coalesce(p_distance_km,0) / nullif(coalesce(v.speed_kmh,40),0) * 60))::int
  from public.zones z left join public.vehicles v on v.id = p_vehicle_id where z.id = p_zone_id;
$$;

create or replace function public.find_nearest_drivers(
  p_lat double precision, p_lng double precision, p_limit int default 5, p_exclude_order uuid default null)
returns table(driver_id uuid, distance_km double precision, priority_score numeric, active_orders int, score double precision)
language sql stable as $$
  select d.id,
         public.haversine_km(p_lat,p_lng,d.current_lat,d.current_lng),
         d.priority_score, d.active_orders,
         public.haversine_km(p_lat,p_lng,d.current_lat,d.current_lng) + d.active_orders*2.0 - d.priority_score*0.5
  from public.drivers d join public.vehicles v on v.id = d.vehicle_id
  where d.is_online and d.status='available'
    and d.current_lat is not null and d.current_lng is not null
    and d.active_orders < least(d.max_concurrent_orders, v.capacity)
    and (p_exclude_order is null or not exists (
      select 1 from public.dispatch_assignments da
      where da.order_id=p_exclude_order and da.driver_id=d.id
        and da.status in ('offered','rejected','timeout','lost')))
  order by 5 asc limit greatest(p_limit,1);
$$;

create or replace function public.recalc_driver_performance(p_driver_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_off int; v_acc int; v_rej int; v_to int; v_comp int; v_canc int; v_mins numeric; v_earn numeric; v_rate numeric;
begin
  select count(*) filter (where status in ('offered','accepted','rejected','timeout','lost')),
         count(*) filter (where status='accepted'),
         count(*) filter (where status='rejected'),
         count(*) filter (where status='timeout')
    into v_off, v_acc, v_rej, v_to
  from public.dispatch_assignments where driver_id = p_driver_id;

  select count(*) filter (where o.status='delivered'),
         count(*) filter (where o.status='cancelled'),
         coalesce(sum(extract(epoch from (osh.t - o.created_at))/60) filter (where o.status='delivered'),0)
    into v_comp, v_canc, v_mins
  from public.orders o
  left join lateral (select max(created_at) t from public.order_status_history h where h.order_id=o.id and h.status='delivered') osh on true
  where o.driver_id = p_driver_id;

  select coalesce(sum(delivery_fee_earned+coalesce(tip_earned,0)+coalesce(bonus_earned,0)),0)
    into v_earn from public.driver_earnings where driver_id = p_driver_id;
  v_rate := case when v_off>0 then v_acc::numeric/v_off else 1 end;

  insert into public.driver_performance as dp (driver_id,orders_offered,orders_accepted,orders_completed,orders_cancelled,orders_timeout,total_delivery_minutes,total_earnings,updated_at)
  values (p_driver_id,v_off,v_acc,v_comp,v_canc,v_to,v_mins,v_earn,now())
  on conflict (driver_id) do update set
    orders_offered=excluded.orders_offered, orders_accepted=excluded.orders_accepted,
    orders_completed=excluded.orders_completed, orders_cancelled=excluded.orders_cancelled,
    orders_timeout=excluded.orders_timeout, total_delivery_minutes=excluded.total_delivery_minutes,
    total_earnings=excluded.total_earnings, updated_at=now();

  update public.drivers set priority_score = round((v_rate*50 + least(v_comp,100)*0.5 - v_canc*1.0)::numeric,2)
    where id = p_driver_id;
end;$$;

create or replace function public.auto_dispatch_order(p_order_id uuid, p_timeout_seconds int default 30)
returns public.dispatch_assignments language plpgsql security definer set search_path=public as $$
declare o record; cand record; v_attempt int; v_row public.dispatch_assignments;
begin
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

create or replace function public.manual_dispatch_order(p_order_id uuid, p_driver_id uuid)
returns public.dispatch_assignments language plpgsql security definer set search_path=public as $$
declare v_attempt int; v_row public.dispatch_assignments; v_updated int;
begin
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

create or replace function public.respond_dispatch(p_assignment_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path=public as $$
declare a record; v_updated int;
begin
  select * into a from public.dispatch_assignments where id=p_assignment_id for update;
  if not found then raise exception 'assignment not found'; end if;
  if a.status <> 'offered' then return a.status; end if;
  if not p_accept then
    update public.dispatch_assignments set status='rejected', responded_at=now() where id=p_assignment_id;
    perform public.recalc_driver_performance(a.driver_id); return 'rejected';
  end if;
  update public.orders set driver_id=a.driver_id, status='preparing'
    where id=a.order_id and driver_id is null and status in ('accepted','pending');
  get diagnostics v_updated = row_count;
  if v_updated=0 then
    update public.dispatch_assignments set status='lost', responded_at=now() where id=p_assignment_id; return 'lost';
  end if;
  update public.dispatch_assignments set status='accepted', responded_at=now() where id=p_assignment_id;
  update public.drivers set active_orders=active_orders+1, status='busy' where id=a.driver_id;
  perform public.recalc_driver_performance(a.driver_id); return 'accepted';
end;$$;

create or replace function public.expire_dispatch_offers()
returns int language plpgsql security definer set search_path=public as $$
declare r record; n int := 0;
begin
  for r in select id, driver_id from public.dispatch_assignments where status='offered' and timeout_at < now() loop
    update public.dispatch_assignments set status='timeout', responded_at=now() where id=r.id;
    perform public.recalc_driver_performance(r.driver_id); n := n+1;
  end loop; return n;
end;$$;

create or replace function public.reassign_order(p_order_id uuid, p_timeout_seconds int default 30)
returns public.dispatch_assignments language plpgsql security definer set search_path=public as $$
begin
  update public.dispatch_assignments set status='reassigned' where order_id=p_order_id and status='offered';
  return public.auto_dispatch_order(p_order_id, p_timeout_seconds);
end;$$;

-- free workload + refresh performance after the existing complete_delivery* RPC runs
create or replace function public.finalize_driver_delivery(p_order_id uuid, p_driver_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.drivers set active_orders=greatest(active_orders-1,0),
    status = case when active_orders-1 <= 0 then 'available' else 'busy' end
    where id = p_driver_id;
  perform public.recalc_driver_performance(p_driver_id);
end;$$;

-- ── SHIFTS ──
create or replace function public.start_shift(p_driver_id uuid, p_zone_id uuid default null)
returns public.driver_shifts language plpgsql security definer set search_path=public as $$
declare v public.driver_shifts;
begin
  insert into public.driver_shifts(driver_id,zone_id,actual_start,status) values (p_driver_id,p_zone_id,now(),'active') returning * into v;
  update public.drivers set status='available', is_online=true where id=p_driver_id; return v;
end;$$;
create or replace function public.end_shift(p_shift_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v record;
begin
  select * into v from public.driver_shifts where id=p_shift_id;
  update public.shift_breaks set ended_at=now() where shift_id=p_shift_id and ended_at is null;
  update public.driver_shifts set status='closed', actual_end=now() where id=p_shift_id;
  update public.drivers set status='offline', is_online=false where id=v.driver_id;
end;$$;
create or replace function public.start_break(p_shift_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v record;
begin
  select * into v from public.driver_shifts where id=p_shift_id;
  insert into public.shift_breaks(shift_id) values (p_shift_id);
  update public.drivers set status='on_break' where id=v.driver_id;
end;$$;
create or replace function public.end_break(p_shift_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v record;
begin
  select * into v from public.driver_shifts where id=p_shift_id;
  update public.shift_breaks set ended_at=now() where shift_id=p_shift_id and ended_at is null;
  update public.drivers set status='available' where id=v.driver_id;
end;$$;

-- ── PAYOUTS ──
create or replace function public.driver_wallet_summary(p_driver_id uuid)
returns table(available numeric, pending numeric, paid numeric, lifetime numeric) language sql stable as $$
  select
    coalesce(sum(t) filter (where payout_status='available'),0),
    coalesce(sum(t) filter (where payout_status='pending'),0),
    coalesce(sum(t) filter (where payout_status='paid'),0),
    coalesce(sum(t),0)
  from (select payout_status, (delivery_fee_earned+coalesce(tip_earned,0)+coalesce(bonus_earned,0)) t
        from public.driver_earnings where driver_id=p_driver_id) s;
$$;

create or replace function public.request_payout(p_driver_id uuid, p_amount numeric)
returns public.payout_requests language plpgsql security definer set search_path=public as $$
declare v_avail numeric; v public.payout_requests;
begin
  select available into v_avail from public.driver_wallet_summary(p_driver_id);
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if p_amount > coalesce(v_avail,0) then raise exception 'insufficient available balance'; end if;
  insert into public.payout_requests(driver_id,amount) values (p_driver_id,p_amount) returning * into v; return v;
end;$$;

create or replace function public.approve_payout(p_request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r record; remaining numeric; e record; etot numeric;
begin
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
      -- partial: shrink this row to the remainder paid; leave the rest available
      update public.driver_earnings set delivery_fee_earned=etot-remaining, tip_earned=0, bonus_earned=0 where id=e.id;
      insert into public.driver_earnings(driver_id,order_id,delivery_fee_earned,tip_earned,bonus_earned,payout_status)
        values (r.driver_id,null,remaining,0,0,'paid');
      remaining := 0;
    end if;
  end loop;
  update public.payout_requests set status='paid', processed_at=now(), processed_by=auth.uid() where id=p_request_id;
end;$$;

create or replace function public.reject_payout(p_request_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.payout_requests set status='rejected', note=p_note, processed_at=now(), processed_by=auth.uid()
    where id=p_request_id and status='pending';
end;$$;

create or replace function public.set_driver_status(p_driver_id uuid, p_status text, p_lat double precision default null, p_lng double precision default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.drivers set status=p_status, is_online=(p_status<>'offline'),
    current_lat=coalesce(p_lat,current_lat), current_lng=coalesce(p_lng,current_lng), last_seen_at=now()
  where id=p_driver_id;
end;$$;

-- ════════════ RLS for NEW tables (existing tables keep their own policies) ════════════
alter table public.vehicles enable row level security;
alter table public.payout_requests enable row level security;
alter table public.dispatch_assignments enable row level security;
do $$
declare t text;
begin
  foreach t in array array['vehicles','payout_requests','dispatch_assignments'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I', t, t);
    execute format('create policy %I_admin_write on public.%I for all to authenticated using (public.is_ops_admin()) with check (public.is_ops_admin())', t, t);
  end loop;
end$$;

insert into public.driver_performance(driver_id) select id from public.drivers on conflict (driver_id) do nothing;
