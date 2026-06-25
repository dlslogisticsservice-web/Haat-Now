-- Enterprise notification + audit center: grants, realtime streaming, classification columns.
-- Additive & idempotent. The audit_logs admin SELECT policy already exists (migration 0021);
-- this migration adds the missing table GRANT so admins can actually read it.

-- ── Notifications ────────────────────────────────────────────────────────────
grant delete on public.notifications to authenticated;
alter table public.notifications add column if not exists created_at timestamptz default timezone('utc', now());
alter table public.notifications add column if not exists is_read boolean default false;
alter table public.notifications add column if not exists severity varchar(20) default 'info';
alter table public.notifications add column if not exists category varchar(40) default 'system';

-- ── Audit logs ───────────────────────────────────────────────────────────────
grant select on public.audit_logs to authenticated;
alter table public.audit_logs add column if not exists actor_id uuid;
alter table public.audit_logs add column if not exists severity varchar(20) default 'info';

-- ── Realtime publication ─────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['notifications','audit_logs'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_notifications_target_read on public.notifications(target_user_id, is_read);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);
