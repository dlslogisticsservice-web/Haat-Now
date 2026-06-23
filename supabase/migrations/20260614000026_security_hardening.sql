-- ─────────────────────────────────────────────────────────────────────────────
-- Production security hardening — tighten over-permissive RLS write policies.
-- Edge functions use the service_role key (bypass RLS) and are unaffected.
-- The legitimate client flows still pass (a user acts on their own data).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── CRITICAL: app_config was writable by ANY authenticated user (config tampering).
--    No client writes app_config; restrict writes to super-admins, keep public read.
drop policy if exists "Authenticated users can write config" on public.app_config;
drop policy if exists app_config_read on public.app_config;
drop policy if exists app_config_super_write on public.app_config;

create policy app_config_read on public.app_config
  for select using (true);

create policy app_config_super_write on public.app_config
  for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.scope = 'super'))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.scope = 'super'));

-- ── HIGH (IDOR/forgery): payment_transactions INSERT was open to any authenticated
--    user for ANY order. Scope client inserts to the user's OWN order. Edge functions
--    (service_role) bypass RLS and remain the authoritative writer.
drop policy if exists "Authenticated users can insert payment transactions" on public.payment_transactions;
drop policy if exists payment_tx_own_order_insert on public.payment_transactions;

create policy payment_tx_own_order_insert on public.payment_transactions
  for insert
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_id = auth.uid()
  ));

-- ── HIGH (impersonation): support_messages INSERT was open to any authenticated user
--    with any sender_id. Require the message sender to BE the authenticated user.
drop policy if exists "Authenticated users can insert support messages" on public.support_messages;
drop policy if exists support_messages_sender_insert on public.support_messages;

create policy support_messages_sender_insert on public.support_messages
  for insert
  with check (sender_id = auth.uid());
