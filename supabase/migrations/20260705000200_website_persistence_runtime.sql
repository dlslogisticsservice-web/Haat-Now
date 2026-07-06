-- ═══════════════════════════════════════════════════════════════════════════════
-- Website Platform · Wave 1 — Persistence Runtime
--
-- Adds the runtime tables + database procedures the Persistence Engine uses: the
-- transactional outbox, the audit log, snapshot storage, and the background job queue,
-- plus atomic RPCs, read-model views, a materialized view, and performance indexes.
--
-- STRICTLY ADDITIVE + IDEMPOTENT. No existing table is altered. Nothing reads these
-- until the website.db_backend flag is enabled per tenant — zero behavior change.
-- Depends on: public.tenants, public.auth_tenant(), public.auth_has_permission()
-- (Wave 0 migration 20260705000100 + Phase 9 20260705000006). Applies after them.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── PART 5 · Transactional outbox ────────────────────────────────────────────────
create table if not exists public.website_event_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  meta jsonb not null default '{}',
  idempotency_key text,
  status text not null default 'pending' check (status in ('pending','processed','failed','dead')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (idempotency_key)
);
create index if not exists idx_website_outbox_status on public.website_event_outbox(status, created_at);
create index if not exists idx_website_outbox_tenant on public.website_event_outbox(tenant_id);

-- ── PART 6 · Audit log ─────────────────────────────────────────────────────────
create table if not exists public.website_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before jsonb,
  after jsonb,
  correlation_id text not null,
  environment text not null default 'production',
  created_at timestamptz not null default now()
);
create index if not exists idx_website_audit_entity on public.website_audit_log(entity_type, entity_id, created_at desc);
create index if not exists idx_website_audit_tenant on public.website_audit_log(tenant_id, created_at desc);
create index if not exists idx_website_audit_corr on public.website_audit_log(correlation_id);

-- ── PART 7 · Snapshot storage (persistence only) ──────────────────────────────────
create table if not exists public.website_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.website_sites(id) on delete cascade,
  kind text not null check (kind in ('draft','published')),
  version int not null,
  hash text not null,
  checksum text not null,
  storage_ref text,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (site_id, kind, version)
);
create index if not exists idx_website_snapshots_lookup on public.website_snapshots(site_id, kind, version desc);

-- ── PART 10 · Background job queue (infrastructure only) ──────────────────────────
create table if not exists public.website_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('publishing','seo','media','notifications','cleanup')),
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','running','done','failed','dead')),
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_website_jobs_claim on public.website_jobs(kind, status, run_after);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 4 · Database runtime — RPCs, views, materialized view.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Monotonic next publish version for a site (used by the snapshot/publish stores).
create or replace function public.website_next_publish_version(p_site uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(version), 0) + 1 from public.website_snapshots where site_id = p_site and kind = 'published';
$$;

-- Atomic page reorder: set position = array index for each id, in one transaction.
-- Race-safe + tenant-scoped. Returns the number of rows updated.
create or replace function public.website_reorder_pages(p_tenant uuid, p_site uuid, p_ids uuid[])
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare i int; v_count int := 0;
begin
  if auth.uid() is not null and not public.auth_has_permission('website.edit') then
    raise exception 'permission denied: website.edit' using errcode = 'P0001';
  end if;
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    update public.website_pages
      set position = i - 1, updated_at = now(), version = version + 1
      where id = p_ids[i] and tenant_id = p_tenant and site_id = p_site and deleted_at is null;
    if found then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;$$;

-- Append an outbox event idempotently (server-side helper for the durable path).
create or replace function public.website_outbox_append(
  p_tenant uuid, p_type text, p_payload jsonb, p_meta jsonb, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if p_idempotency_key is not null then
    select id into v_id from public.website_event_outbox where idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;
  insert into public.website_event_outbox(tenant_id, type, payload, meta, idempotency_key)
    values (p_tenant, p_type, p_payload, p_meta, p_idempotency_key) returning id into v_id;
  return v_id;
end;$$;

-- Read model: latest published snapshot per site.
create or replace view public.website_published_current as
  select distinct on (site_id) site_id, tenant_id, version, hash, checksum, snapshot, created_at
  from public.website_snapshots
  where kind = 'published'
  order by site_id, version desc;

-- Read model: per-site content summary (page/section/block counts) — a live view.
create or replace view public.website_site_summary as
  select s.id as site_id, s.tenant_id, s.slug, s.status,
    (select count(*) from public.website_pages p where p.site_id = s.id and p.deleted_at is null) as page_count,
    (select count(*) from public.website_sections se where se.site_id = s.id and se.deleted_at is null) as section_count,
    (select count(*) from public.website_blocks b where b.site_id = s.id and b.deleted_at is null) as block_count
  from public.website_sites s
  where s.deleted_at is null;

-- Materialized view: heavier per-tenant rollup for dashboards (refresh on a schedule).
create materialized view if not exists public.website_tenant_stats as
  select tenant_id,
    count(*) filter (where kind_site) as sites,
    sum(pages) as pages
  from (
    select s.tenant_id, true as kind_site,
      (select count(*) from public.website_pages p where p.site_id = s.id and p.deleted_at is null) as pages
    from public.website_sites s where s.deleted_at is null
  ) t
  group by tenant_id;
create unique index if not exists idx_website_tenant_stats on public.website_tenant_stats(tenant_id);

create or replace function public.website_refresh_tenant_stats()
returns void language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view concurrently public.website_tenant_stats;
exception when others then
  refresh materialized view public.website_tenant_stats;   -- fallback if concurrently unavailable
end;$$;

grant execute on function public.website_next_publish_version(uuid) to authenticated;
grant execute on function public.website_reorder_pages(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.website_outbox_append(uuid, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.website_refresh_tenant_stats() to authenticated;
revoke execute on function public.website_next_publish_version(uuid) from public, anon;
revoke execute on function public.website_reorder_pages(uuid, uuid, uuid[]) from public, anon;
revoke execute on function public.website_outbox_append(uuid, text, jsonb, jsonb, text) from public, anon;
revoke execute on function public.website_refresh_tenant_stats() from public, anon;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS — tenant-scoped, no anon, no using(true). (Audit/outbox are typically written by
-- the service role; the tenant policies allow an in-app ops session to read its own.)
-- ═══════════════════════════════════════════════════════════════════════════════
do $$
declare t text;
  runtime_tables text[] := array['website_event_outbox','website_audit_log','website_snapshots','website_jobs'];
begin
  foreach t in array runtime_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (tenant_id = public.auth_tenant())$p$, t || '_tenant_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_write', t);
    execute format($p$create policy %I on public.%I for all to authenticated using (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit')) with check (tenant_id = public.auth_tenant() and public.auth_has_permission('website.edit'))$p$, t || '_tenant_write', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
