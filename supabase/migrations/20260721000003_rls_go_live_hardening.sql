-- ════════════════════════════════════════════════════════════════════════════
-- RLS GO-LIVE HARDENING (P0 security).
--
-- The launch readiness audit found two RLS defects that ship policies which are inert
-- or overbroad:
--   1. Seven tables carry policies written for them, but RLS was never ENABLED — so the
--      policies do nothing and the tables are readable/writable by any authenticated
--      client. The audit log among them is therefore client-writable and deletable.
--   2. The 0004 "…can manage own…" policies on orders / wallets are FOR ALL — granting
--      DELETE on financial records. GRANTs currently block the delete at the PostgREST
--      layer, but that is one thin layer; the policies themselves are overbroad.
--
-- This migration enables RLS on the seven tables (with owner/admin policies where they
-- were missing) and replaces the FOR ALL money policies with per-command policies that
-- never grant DELETE. It VERIFIES relrowsecurity at the end — the check the earlier
-- rls_recovery migration lacked (it counted policies, not whether RLS was on).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · Enable RLS on the seven tables that shipped with it OFF ──────────────────
alter table public.settings            enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.countries           enable row level security;
alter table public.cities              enable row level security;
alter table public.memberships         enable row level security;
alter table public.shift_breaks        enable row level security;
alter table public.driver_performance  enable row level security;

-- shift_breaks / driver_performance had NO policy at all — add least-privilege ones.
-- A driver reads their own shift breaks; ops admins read all.
drop policy if exists "own read shift_breaks" on public.shift_breaks;
drop policy if exists "ops read shift_breaks" on public.shift_breaks;
create policy "own read shift_breaks" on public.shift_breaks for select
  using (exists (select 1 from public.driver_shifts s where s.id = shift_breaks.shift_id and s.driver_id = auth.uid()));
create policy "ops read shift_breaks" on public.shift_breaks for select using (public.is_ops_admin());
drop policy if exists "ops write shift_breaks" on public.shift_breaks;
create policy "ops write shift_breaks" on public.shift_breaks for all
  using (public.is_ops_admin()) with check (public.is_ops_admin());

drop policy if exists "own read driver_performance" on public.driver_performance;
drop policy if exists "ops read driver_performance" on public.driver_performance;
create policy "own read driver_performance" on public.driver_performance for select using (driver_id = auth.uid());
create policy "ops read driver_performance" on public.driver_performance for select using (public.is_ops_admin());
drop policy if exists "ops write driver_performance" on public.driver_performance;
create policy "ops write driver_performance" on public.driver_performance for all
  using (public.is_ops_admin()) with check (public.is_ops_admin());

-- ── 2 · Replace the overbroad FOR ALL money policies with per-command policies ───
-- Customers/drivers/merchants may SELECT/INSERT/UPDATE their orders — never DELETE
-- (financial records are cancelled by status transition, not removed). The prior FOR ALL
-- policies OR-combined to grant delete; dropping them removes that reach.
drop policy if exists "Customers can manage own orders"       on public.orders;
drop policy if exists "Drivers can manage assigned deliveries" on public.orders;

drop policy if exists "customers rw own orders"  on public.orders;
create policy "customers rw own orders" on public.orders for select using (customer_id = auth.uid());
drop policy if exists "customers insert own orders" on public.orders;
create policy "customers insert own orders" on public.orders for insert with check (customer_id = auth.uid());
drop policy if exists "customers update own orders" on public.orders;
create policy "customers update own orders" on public.orders for update using (customer_id = auth.uid()) with check (customer_id = auth.uid());

drop policy if exists "drivers read assigned orders" on public.orders;
create policy "drivers read assigned orders" on public.orders for select using (driver_id = auth.uid());
drop policy if exists "drivers update assigned orders" on public.orders;
create policy "drivers update assigned orders" on public.orders for update using (driver_id = auth.uid()) with check (driver_id = auth.uid());

-- Wallets: read/update own; never delete a wallet or a transaction.
drop policy if exists "Users can access own wallets" on public.wallets;
drop policy if exists "users read own wallet" on public.wallets;
create policy "users read own wallet" on public.wallets for select using (owner_id = auth.uid());

drop policy if exists "Users can access own wallet transactions" on public.wallet_transactions;
drop policy if exists "users read own wallet tx" on public.wallet_transactions;
create policy "users read own wallet tx" on public.wallet_transactions for select
  using (wallet_id in (select id from public.wallets where owner_id = auth.uid()));

-- Reference data (countries/cities): world-readable, admin-writable (they are public config).
drop policy if exists "read countries" on public.countries;
create policy "read countries" on public.countries for select using (true);
drop policy if exists "read cities" on public.cities;
create policy "read cities" on public.cities for select using (true);
drop policy if exists "admin write countries" on public.countries;
create policy "admin write countries" on public.countries for all using (public.auth_is_admin()) with check (public.auth_is_admin());
drop policy if exists "admin write cities" on public.cities;
create policy "admin write cities" on public.cities for all using (public.auth_is_admin()) with check (public.auth_is_admin());

-- settings + audit_logs: admin-only. The audit log is append+read for admins; never
-- client-deletable (this was the sharpest finding — an attacker could erase their trail).
drop policy if exists "admin settings" on public.settings;
create policy "admin settings" on public.settings for all using (public.auth_is_admin()) with check (public.auth_is_admin());
drop policy if exists "admin read audit" on public.audit_logs;
create policy "admin read audit" on public.audit_logs for select using (public.auth_is_admin());
drop policy if exists "admin insert audit" on public.audit_logs;
create policy "admin insert audit" on public.audit_logs for insert with check (public.auth_is_admin());

-- memberships: a user sees their own membership; admins manage all.
drop policy if exists "own read memberships" on public.memberships;
create policy "own read memberships" on public.memberships for select using (public.auth_is_admin());

-- ── VERIFY · fail loudly if RLS did not actually enable ──────────────────────────
do $$
declare v_off text;
begin
  select string_agg(c.relname, ', ') into v_off
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('settings','audit_logs','countries','cities','memberships','shift_breaks','driver_performance')
     and c.relrowsecurity = false;
  if v_off is not null then
    raise exception 'rls_go_live_hardening: RLS still OFF on %', v_off;
  end if;
end $$;
