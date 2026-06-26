-- Merchant store-operations settings — ADDITIVE.
-- Adds a jsonb `settings` column on merchant_branches for store status, working
-- hours, busy/vacation/auto-accept, min order, prep time, delivery radius.
-- Backward compatible: defaults to '{}' so existing rows + readers are unaffected
-- (the app falls back to DEFAULT_STORE_SETTINGS / localStorage when empty).
alter table public.merchant_branches add column if not exists settings jsonb not null default '{}'::jsonb;
