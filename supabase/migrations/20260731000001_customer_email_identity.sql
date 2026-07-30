-- ─────────────────────────────────────────────────────────────────────────────
-- Email-first identity (STEP 3B — auth refactor).
-- Email becomes the primary login identity; a phone number is OPTIONAL and may be
-- attached later (e.g. verified via CEQUENS). So the customers.phone_number NOT NULL
-- constraint from init_schema is relaxed. The UNIQUE index stays (Postgres permits
-- multiple NULLs), so phone remains unique WHEN present.
-- Additive + safe: no data change; customers has no rows in a fresh production DB.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.customers alter column phone_number drop not null;
