-- ════════════════════════════════════════════════════════════════════════════
-- OPERATIONS READINESS — go-live operational capability.
--
-- Adds ONLY what the operations audit found genuinely missing. It deliberately
-- does NOT touch KYC/onboarding (20260614000030), dispatch (20260614000028),
-- payouts, support tickets (20260614000034) or the ops command RPCs
-- (20260614000032) — all of those are complete and are reused as-is.
--
-- What this adds:
--   1. Incident management        — no incident entity existed anywhere.
--   2. SLA targets                — the only SLA was a hardcoded 45 in a .tsx file.
--   3. Merchant operational health — driver_performance had a counterpart; merchants did not.
--   4. Support ticket ops columns — assignment / escalation / reopen were absent.
--   5. Document expiry            — expiry dates existed as display-only text.
--   6. Two schema-drift repairs   — columns the shipped UI already reads but that
--                                   were never created (orders.failure_reason et al).
--
-- Idempotent. RLS on every table (the audit found seven tables shipped with RLS
-- never enabled — that class of mistake is not repeated here).
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════ 1 · INCIDENT MANAGEMENT ════════════
-- An incident is an operational event a human must own: an outage, a dispatch
-- failure, a merchant going dark, a payment provider degradation. Distinct from a
-- support ticket (one customer's problem) and from a cancelled order (a data row).
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  title text not null,
  description text,
  -- sev1 pages someone now; sev4 is a tracked annoyance.
  severity text not null default 'sev3'
     check (severity in ('sev1','sev2','sev3','sev4')),
  status text not null default 'open'
     check (status in ('open','investigating','identified','monitoring','resolved','closed')),
  category text not null default 'other'
     check (category in ('dispatch','payments','merchant','driver','customer','platform','data','third_party','other')),
  -- Optional link to whatever the incident is about, so an operator can jump to it.
  entity_type text check (entity_type in ('order','merchant','driver','customer','zone','provider')),
  entity_id text,
  zone_id uuid,
  -- Ownership. Unassigned sev1/sev2 incidents are what the command centre alerts on.
  assigned_to uuid,
  reported_by uuid,
  -- Post-incident. Only meaningful once status reaches resolved.
  root_cause text,
  resolution text,
  impact_summary text,
  orders_affected integer not null default 0,
  detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_incidents_status on public.incidents(status, severity, detected_at desc);
create index if not exists idx_incidents_open on public.incidents(severity, detected_at desc) where status <> 'closed';
create index if not exists idx_incidents_assignee on public.incidents(assigned_to) where status <> 'closed';

-- The operational timeline. Append-only: an incident's history is evidence, so
-- there is no update or delete path for operators (RLS below enforces it).
create table if not exists public.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  kind text not null default 'note'
     check (kind in ('note','status_change','severity_change','assignment','escalation','mitigation','root_cause','resolution','created')),
  body text,
  from_value text,
  to_value text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_incident_events_incident on public.incident_events(incident_id, created_at);

-- Human-readable reference (INC-000123) so incidents can be cited in chat and calls.
create sequence if not exists public.incident_reference_seq start 1;

create or replace function public.set_incident_reference()
returns trigger language plpgsql as $$
begin
  if new.reference is null then
    new.reference := 'INC-' || lpad(nextval('public.incident_reference_seq')::text, 6, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_incident_reference on public.incidents;
create trigger trg_incident_reference before insert on public.incidents
  for each row execute function public.set_incident_reference();

-- Keep updated_at honest and stamp the lifecycle timestamps exactly once, so
-- "time to acknowledge" and "time to resolve" are computed from data the operator
-- cannot accidentally backdate.
create or replace function public.touch_incident()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status <> old.status then
    if new.status <> 'open'      and old.acknowledged_at is null then new.acknowledged_at := now(); end if;
    if new.status = 'resolved'   and new.resolved_at is null     then new.resolved_at := now();     end if;
    if new.status = 'closed'     and new.closed_at is null       then new.closed_at := now();       end if;
    -- Reopening clears the terminal stamps; the timeline keeps the original record.
    if new.status in ('open','investigating','identified','monitoring') then
      new.resolved_at := null; new.closed_at := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_incident_touch on public.incidents;
create trigger trg_incident_touch before update on public.incidents
  for each row execute function public.touch_incident();

-- ════════════ 2 · SLA TARGETS ════════════
-- Before this, the platform's entire SLA model was `const SLA_MINUTES = 45` in a
-- component file: not configurable, not per-zone, and with no breach history.
create table if not exists public.sla_targets (
  id uuid primary key default gen_random_uuid(),
  metric text not null
     check (metric in ('order_delivery','order_acceptance','merchant_prep','dispatch_assignment','support_first_response','support_resolution')),
  -- Null scope = the platform default. A zone-scoped row overrides it.
  zone_id uuid,
  priority text check (priority in ('low','normal','high','critical')),
  target_minutes integer not null check (target_minutes > 0),
  -- Breach at target; warn earlier so an operator can still act.
  warn_minutes integer check (warn_minutes > 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (metric, zone_id, priority)
);
create index if not exists idx_sla_targets_metric on public.sla_targets(metric) where is_active;

-- Shipped defaults. These encode the thresholds that were previously hardcoded,
-- so behaviour does not change on deploy — it just becomes editable.
insert into public.sla_targets (metric, target_minutes, warn_minutes)
values
  ('order_delivery',          45, 35),
  ('order_acceptance',         5,  3),
  ('merchant_prep',           20, 15),
  ('dispatch_assignment',      3,  2),
  ('support_first_response', 240, 180),
  ('support_resolution',    1440, 1080)
on conflict (metric, zone_id, priority) do nothing;

-- Breach history. Without this, SLA is only ever answerable for "right now" —
-- you can never ask what last week looked like.
create table if not exists public.sla_breaches (
  id uuid primary key default gen_random_uuid(),
  metric text not null,
  entity_type text not null check (entity_type in ('order','ticket','dispatch','merchant')),
  entity_id text not null,
  zone_id uuid,
  target_minutes integer not null,
  actual_minutes integer not null,
  breached_at timestamptz not null default now(),
  incident_id uuid references public.incidents(id) on delete set null,
  unique (metric, entity_type, entity_id)
);
create index if not exists idx_sla_breaches_recent on public.sla_breaches(breached_at desc);

-- ════════════ 3 · MERCHANT OPERATIONAL HEALTH ════════════
-- driver_performance has existed since 20260614000028; merchants had no counterpart,
-- so nothing measured a merchant's ACTUAL behaviour against what they declare in
-- merchant_branches.settings (prep time, opening hours).
create table if not exists public.merchant_performance (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  branch_id uuid,
  orders_total integer not null default 0,
  orders_accepted integer not null default 0,
  orders_rejected integer not null default 0,
  orders_cancelled integer not null default 0,
  orders_delivered integer not null default 0,
  -- Measured, not declared. The gap between these is the point of the table.
  avg_accept_seconds integer,
  avg_prep_minutes integer,
  declared_prep_minutes integer,
  acceptance_rate numeric(5,2),
  cancellation_rate numeric(5,2),
  -- 0-100, derived below. One number an operator can sort by.
  health_score numeric(5,2),
  last_order_at timestamptz,
  computed_at timestamptz not null default now(),
  unique (merchant_id, branch_id)
);
create index if not exists idx_merchant_perf_health on public.merchant_performance(health_score);

-- Recompute a merchant's operational health from real orders.
-- Mirrors recalc_driver_performance (20260614000028:178) in shape and intent.
create or replace function public.recalc_merchant_performance(p_merchant_id uuid, p_branch_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_total int; v_accepted int; v_rejected int; v_cancelled int; v_delivered int;
  v_accept_secs int; v_prep_mins int; v_declared int;
  v_acc numeric; v_can numeric; v_score numeric; v_last timestamptz;
begin
  select count(*),
         count(*) filter (where status <> 'pending' and status <> 'rejected'),
         count(*) filter (where status = 'rejected'),
         count(*) filter (where status = 'cancelled'),
         count(*) filter (where status = 'delivered'),
         max(created_at)
    into v_total, v_accepted, v_rejected, v_cancelled, v_delivered, v_last
    from public.orders o
   where o.branch_id = coalesce(p_branch_id, o.branch_id)
     and o.branch_id in (select id from public.merchant_branches where merchant_id = p_merchant_id)
     and o.created_at > now() - interval '30 days';

  -- Acceptance and prep timings come from the status history that already exists.
  select avg(extract(epoch from (h.created_at - o.created_at)))::int
    into v_accept_secs
    from public.order_status_history h
    join public.orders o on o.id = h.order_id
   where h.status = 'accepted'
     and o.branch_id in (select id from public.merchant_branches where merchant_id = p_merchant_id)
     and o.created_at > now() - interval '30 days';

  select avg(extract(epoch from (r.created_at - a.created_at)) / 60)::int
    into v_prep_mins
    from public.order_status_history a
    join public.order_status_history r on r.order_id = a.order_id and r.status = 'on_the_way'
    join public.orders o on o.id = a.order_id
   where a.status = 'preparing'
     and o.branch_id in (select id from public.merchant_branches where merchant_id = p_merchant_id)
     and o.created_at > now() - interval '30 days';

  select coalesce((settings->>'prepTimeMinutes')::int, null) into v_declared
    from public.merchant_branches
   where merchant_id = p_merchant_id
   limit 1;   -- merchant_branches has no created_at; any branch supplies the declared baseline

  v_acc := case when v_total > 0 then round(100.0 * v_accepted / v_total, 2) else null end;
  v_can := case when v_total > 0 then round(100.0 * v_cancelled / v_total, 2) else null end;

  -- Health = acceptance, minus cancellation, minus overrun against declared prep.
  -- Null-safe: a merchant with no orders scores null, not zero — no data is not bad data.
  v_score := case when v_total = 0 then null else greatest(0, least(100,
      coalesce(v_acc, 100)
      - coalesce(v_can, 0) * 1.5
      - case when v_declared is not null and v_prep_mins is not null and v_prep_mins > v_declared
             then least(30, (v_prep_mins - v_declared)) else 0 end
    )) end;

  insert into public.merchant_performance as mp (
    merchant_id, branch_id, orders_total, orders_accepted, orders_rejected, orders_cancelled,
    orders_delivered, avg_accept_seconds, avg_prep_minutes, declared_prep_minutes,
    acceptance_rate, cancellation_rate, health_score, last_order_at, computed_at)
  values (p_merchant_id, p_branch_id, coalesce(v_total,0), coalesce(v_accepted,0), coalesce(v_rejected,0),
          coalesce(v_cancelled,0), coalesce(v_delivered,0), v_accept_secs, v_prep_mins, v_declared,
          v_acc, v_can, v_score, v_last, now())
  on conflict (merchant_id, branch_id) do update set
    orders_total = excluded.orders_total, orders_accepted = excluded.orders_accepted,
    orders_rejected = excluded.orders_rejected, orders_cancelled = excluded.orders_cancelled,
    orders_delivered = excluded.orders_delivered, avg_accept_seconds = excluded.avg_accept_seconds,
    avg_prep_minutes = excluded.avg_prep_minutes, declared_prep_minutes = excluded.declared_prep_minutes,
    acceptance_rate = excluded.acceptance_rate, cancellation_rate = excluded.cancellation_rate,
    health_score = excluded.health_score, last_order_at = excluded.last_order_at, computed_at = now();
end $$;

-- Refresh every merchant. Cheap enough to run from the ops screen or a cron tick.
create or replace function public.recalc_all_merchant_performance()
returns integer language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int := 0;
begin
  if not public.is_ops_admin() then raise exception 'permission denied'; end if;
  for v_id in select id from public.merchants loop
    perform public.recalc_merchant_performance(v_id, null);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ════════════ 4 · SUPPORT TICKET OPERATIONS ════════════
-- The ticket table (20260614000001) and its SLA columns (20260614000034) exist.
-- Assignment, escalation and reopen did not.
alter table public.support_tickets
  add column if not exists assigned_to uuid,
  add column if not exists escalation_tier smallint not null default 0,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalated_by uuid,
  add column if not exists reopened_count integer not null default 0,
  add column if not exists incident_id uuid references public.incidents(id) on delete set null;
create index if not exists idx_tickets_assignee on public.support_tickets(assigned_to) where status <> 'closed';
create index if not exists idx_tickets_escalated on public.support_tickets(escalation_tier desc) where escalation_tier > 0;

-- The documented priority domain was never enforced, and the creation RPC writes
-- 'normal' — which is outside it. Normalise to the value actually in use, then
-- constrain, so the column stops being free text.
update public.support_tickets set priority = 'normal'
 where priority is null or priority not in ('low','normal','high','critical');

do $$ begin
  alter table public.support_tickets
    add constraint support_tickets_priority_check
    check (priority in ('low','normal','high','critical'));
exception when duplicate_object then null; end $$;

-- ════════════ 5 · DOCUMENT EXPIRY ════════════
-- Expiry dates existed only as display-only text on drivers/vehicles. Nothing
-- could answer "what lapses this month", so nothing ever did.
alter table public.driver_documents   add column if not exists expires_at date;
alter table public.merchant_documents add column if not exists expires_at date;
create index if not exists idx_driver_docs_expiry   on public.driver_documents(expires_at)   where expires_at is not null;
create index if not exists idx_merchant_docs_expiry on public.merchant_documents(expires_at) where expires_at is not null;

-- One queue across both entity types, ordered by urgency.
create or replace function public.expiring_documents(p_within_days integer default 30)
returns table (
  entity_type text, entity_id uuid, entity_name text, document_id uuid,
  doc_type text, expires_at date, days_remaining integer, status text
) language sql stable security definer set search_path = public as $$
  select 'driver'::text, d.driver_id, dr.full_name, d.id, d.doc_type, d.expires_at,
         (d.expires_at - current_date)::int,
         case when d.expires_at < current_date then 'expired' else 'expiring' end
    from public.driver_documents d
    join public.drivers dr on dr.id = d.driver_id
   where d.expires_at is not null
     and d.expires_at <= current_date + p_within_days
  union all
  select 'merchant'::text, m.merchant_id, mr.business_name, m.id, m.doc_type, m.expires_at,
         (m.expires_at - current_date)::int,
         case when m.expires_at < current_date then 'expired' else 'expiring' end
    from public.merchant_documents m
    join public.merchants mr on mr.id = m.merchant_id
   where m.expires_at is not null
     and m.expires_at <= current_date + p_within_days
  order by 6;
$$;

-- ════════════ 5b · GO-LIVE CHECKLIST STATE ════════════
-- The checklist ITEMS live in code (they are the runbook, and belong with the code
-- they describe). Only the tick state is data — so a checklist survives a reload and
-- is shared across the whole ops team rather than living in one operator's browser.
create table if not exists public.ops_checklist_state (
  id uuid primary key default gen_random_uuid(),
  checklist text not null check (checklist in ('launch','rollback')),
  item_key text not null,
  checked boolean not null default false,
  note text,
  checked_by uuid,
  checked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (checklist, item_key)
);
create index if not exists idx_checklist_state on public.ops_checklist_state(checklist);

-- ════════════ 6 · SCHEMA-DRIFT REPAIRS ════════════
-- OpsIncidentLog.tsx has shipped reading orders.failure_reason / failed_by since
-- it was written, but no migration ever created those columns — so every row
-- rendered blank in a live build. Create what the UI already expects.
alter table public.orders
  add column if not exists failure_reason text,
  add column if not exists failed_by text check (failed_by in ('merchant','driver','customer','system'));
create index if not exists idx_orders_failure on public.orders(failure_reason) where failure_reason is not null;

-- ════════════ RLS ════════════
-- Every table above gets RLS ENABLED, not merely policied. The audit found seven
-- existing tables carrying policies while RLS was off, which silently makes the
-- policies inert — this migration does not repeat that mistake.
alter table public.incidents            enable row level security;
alter table public.incident_events      enable row level security;
alter table public.sla_targets          enable row level security;
alter table public.sla_breaches         enable row level security;
alter table public.merchant_performance enable row level security;
alter table public.ops_checklist_state  enable row level security;

drop policy if exists "ops read incidents"   on public.incidents;
drop policy if exists "ops write incidents"  on public.incidents;
create policy "ops read incidents"  on public.incidents for select using (public.is_ops_admin());
create policy "ops write incidents" on public.incidents for all    using (public.is_ops_admin()) with check (public.is_ops_admin());

-- Timeline is append-only: insert and select for ops, no update, no delete.
drop policy if exists "ops read incident events"   on public.incident_events;
drop policy if exists "ops append incident events" on public.incident_events;
create policy "ops read incident events"   on public.incident_events for select using (public.is_ops_admin());
create policy "ops append incident events" on public.incident_events for insert with check (public.is_ops_admin());

drop policy if exists "ops read sla"  on public.sla_targets;
drop policy if exists "ops write sla" on public.sla_targets;
create policy "ops read sla"  on public.sla_targets for select using (public.is_ops_admin());
create policy "ops write sla" on public.sla_targets for all    using (public.is_ops_admin()) with check (public.is_ops_admin());

drop policy if exists "ops read breaches"  on public.sla_breaches;
drop policy if exists "ops write breaches" on public.sla_breaches;
create policy "ops read breaches"  on public.sla_breaches for select using (public.is_ops_admin());
create policy "ops write breaches" on public.sla_breaches for all    using (public.is_ops_admin()) with check (public.is_ops_admin());

-- A merchant may read their own scorecard; only ops sees everyone's.
drop policy if exists "ops read merchant perf"  on public.merchant_performance;
drop policy if exists "own read merchant perf"  on public.merchant_performance;
drop policy if exists "ops write merchant perf" on public.merchant_performance;
create policy "ops read merchant perf"  on public.merchant_performance for select using (public.is_ops_admin());
create policy "own read merchant perf"  on public.merchant_performance for select
  using (merchant_id in (select id from public.merchants where owner_user_id = auth.uid()));
create policy "ops write merchant perf" on public.merchant_performance for all
  using (public.is_ops_admin()) with check (public.is_ops_admin());

drop policy if exists "ops read checklist"  on public.ops_checklist_state;
drop policy if exists "ops write checklist" on public.ops_checklist_state;
create policy "ops read checklist"  on public.ops_checklist_state for select using (public.is_ops_admin());
create policy "ops write checklist" on public.ops_checklist_state for all    using (public.is_ops_admin()) with check (public.is_ops_admin());

-- ════════════ GRANTS ════════════
-- Match 20260614000019: PostgREST needs the table grant as well as the policy.
grant select, insert, update         on public.incidents            to authenticated;
grant select, insert                 on public.incident_events      to authenticated;
grant select, insert, update, delete on public.sla_targets          to authenticated;
grant select, insert                 on public.sla_breaches         to authenticated;
grant select                         on public.merchant_performance to authenticated;
grant select, insert, update, delete on public.ops_checklist_state  to authenticated;
grant usage                          on sequence public.incident_reference_seq to authenticated;

grant execute on function public.recalc_merchant_performance(uuid, uuid) to authenticated;
grant execute on function public.recalc_all_merchant_performance()       to authenticated;
grant execute on function public.expiring_documents(integer)             to authenticated;

-- ════════════ VERIFY ════════════
-- Fails loudly if RLS did not actually get enabled — the check the earlier
-- rls_recovery migration was missing (it counted policies, not relrowsecurity).
do $$
declare v_off text;
begin
  select string_agg(c.relname, ', ') into v_off
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('incidents','incident_events','sla_targets','sla_breaches','merchant_performance','ops_checklist_state')
     and c.relrowsecurity = false;
  if v_off is not null then
    raise exception 'operations_readiness: RLS not enabled on %', v_off;
  end if;
end $$;
