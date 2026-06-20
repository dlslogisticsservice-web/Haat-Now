-- 0017_webhook_events.sql
-- Persists raw inbound webhook payloads from payment providers.
-- idempotency_key stores the provider's own event ID (e.g. Moyasar transaction ID).
-- The UNIQUE constraint on idempotency_key is the primary replay-attack defence:
-- a duplicate webhook delivery raises a unique_violation rather than double-processing.
-- Fully idempotent: CREATE TABLE IF NOT EXISTS + DO-guarded unique constraint + CREATE INDEX IF NOT EXISTS.

create table if not exists webhook_events (
  id              uuid         primary key default gen_random_uuid(),
  provider        varchar(50)  not null,
  event_type      varchar(100) not null,
  idempotency_key varchar(255) not null,
  payload         jsonb        not null,
  processed       boolean      not null default false,
  processed_at    timestamptz,
  error           text,
  received_at     timestamptz  not null default now()
);

-- UNIQUE on idempotency_key — primary replay-attack / duplicate-webhook protection
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname  = 'webhook_events_idempotency_key_key'
      and conrelid = 'webhook_events'::regclass
  ) then
    alter table webhook_events
      add constraint webhook_events_idempotency_key_key unique (idempotency_key);
  end if;
end $$;

-- Indexes
create index if not exists idx_webhook_events_idempotency_key on webhook_events(idempotency_key);
create index if not exists idx_webhook_events_provider        on webhook_events(provider);
create index if not exists idx_webhook_events_processed       on webhook_events(processed);
create index if not exists idx_webhook_events_received_at     on webhook_events(received_at desc);

-- RLS: webhook_events are written and read exclusively by Edge Functions using the
-- service_role key, which bypasses RLS entirely. No client-facing policies are needed.
-- RLS is still enabled as a safety net to block any accidental anon/authenticated reads.
alter table webhook_events enable row level security;
-- Zero client policies — intentional. Anon and authenticated roles have no access.
