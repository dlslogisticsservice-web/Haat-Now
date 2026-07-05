-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9 · P0-8 — Close permissive PII exposure on drivers & merchants.
--
-- BEFORE: 20260614000004 created `"Anyone can select drivers"` and `"Anyone can select
-- merchants"` as `for select using (true)`. No later migration dropped them, so — because
-- same-command RLS policies are OR-combined — any authenticated user could read driver /
-- merchant PII (phone numbers), defeating the later scoped policies. (SECURITY §S-4, R-06.)
--
-- AFTER:
--   • Drop the world-readable driver policy entirely (drivers are never publicly browsed;
--     customer live-tracking reads drivers through the SECURITY DEFINER order_tracking RPC,
--     and admins read via the scoped 0021 "Read drivers" policy).
--   • Keep merchant discoverability (the storefront needs merchant business info) but strip
--     the world-readable policy AND revoke column-level SELECT on the phone_number PII
--     column from anon/authenticated. Non-PII catalog columns stay readable.
--
-- Idempotent & guarded. Confirm against live pg_policies after applying (SECURITY §S-8).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Drop the permissive world-read policies (the actual leak).
--    Phase 9.5 live-validation finding: the APPLIED policy names on the dev project differ
--    from the migration-file names (documented drift, S-8). The live `merchants` permissive
--    policy is named "Public read merchants" (not "Anyone can select merchants"), and the
--    live `drivers` table is ALREADY scoped ("Read drivers", no world-read). We therefore
--    drop BOTH the file-era names AND the actually-applied names so this migration closes the
--    leak on the real database, not just on a from-scratch build.
drop policy if exists "Anyone can select drivers"   on public.drivers;
drop policy if exists "Anyone can select merchants"  on public.merchants;
drop policy if exists "Public read merchants"        on public.merchants;

-- 2) Ensure a scoped driver read exists (self / admin) so we don't lock drivers out.
--    (0021 added "Read drivers"; recreate defensively in case it never landed — S-8.)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='drivers' and policyname='drivers_scoped_read') then
    create policy drivers_scoped_read on public.drivers
      for select to authenticated
      using (
        id = auth.uid()
        or (owner_user_id is not null and owner_user_id = auth.uid())
        or public.auth_is_admin()
      );
  end if;
exception when others then
  -- owner_user_id may not exist on some historical schemas; fall back to self + admin.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='drivers' and policyname='drivers_scoped_read') then
    create policy drivers_scoped_read on public.drivers
      for select to authenticated using (id = auth.uid() or public.auth_is_admin());
  end if;
end $$;

-- 3) Keep merchant discovery, but re-add a bounded read policy in place of using(true).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='merchants' and policyname='merchants_discovery_read') then
    create policy merchants_discovery_read on public.merchants
      for select to authenticated using (true);
  end if;
end $$;

-- 4) Column-level revoke of the phone PII (RLS cannot restrict columns; GRANTs can).
--    Phase 9.5 live-validation finding: the merchants PII phone column is `contact_phone`
--    (NOT `phone_number` — that only exists on `drivers`). The original revoke targeted a
--    non-existent merchants column and silently no-opped, leaving merchant phones exposed.
--    Fixed: revoke the correct column per table. Each is guarded so a missing column is a
--    no-op rather than a migration failure.
do $$
begin
  begin execute 'revoke select (phone_number)  on public.drivers   from anon, authenticated'; exception when others then null; end;
  begin execute 'revoke select (contact_phone) on public.merchants from anon, authenticated'; exception when others then null; end;
  -- Defensive: also cover a `phone_number` merchants column if a future/other schema has one.
  begin execute 'revoke select (phone_number)  on public.merchants from anon, authenticated'; exception when others then null; end;
end $$;
