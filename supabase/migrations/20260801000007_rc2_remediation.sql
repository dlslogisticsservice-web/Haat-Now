-- ════════════════════════════════════════════════════════════════════════════
-- RC2 REMEDIATION — eliminate the two website-builder findings from the Final Release
-- Certification (docs/security/FINAL_RELEASE_SECURITY_CERTIFICATE.md):
--   RC2-1 (MEDIUM) website_outbox_append — cross-tenant write (no tenant-membership check)
--   RC2-2 (LOW)    website_refresh_tenant_stats — any authenticated caller (compute/DoS)
-- Scope is strictly these two website-platform RPCs. No certified subsystem, no food-delivery,
-- payments, wallets, dispatch, or auth code touched. Idempotent. Guards use auth.uid()/
-- is_ops_admin() (accurate inside SECURITY DEFINER; current_user is the owner there).
-- ════════════════════════════════════════════════════════════════════════════

-- ── RC2-1 — website_outbox_append: the caller must be a MEMBER of the target tenant (or ops).
-- The client-supplied p_tenant is no longer trusted on its own; a cross-tenant write is rejected.
create or replace function public.website_outbox_append(
  p_tenant uuid, p_type text, p_payload jsonb, p_meta jsonb, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $function$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;
  if not public.is_ops_admin() and not exists (
    select 1 from public.tenant_members tm where tm.tenant_id = p_tenant and tm.user_id = auth.uid()
  ) then
    raise exception 'permission denied: not a member of tenant' using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    select id into v_id from public.website_event_outbox where idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;
  insert into public.website_event_outbox(tenant_id, type, payload, meta, idempotency_key)
    values (p_tenant, p_type, p_payload, p_meta, p_idempotency_key) returning id into v_id;
  return v_id;
end;$function$;

-- ── RC2-2 — website_refresh_tenant_stats: Service Role (auth.uid() is null) or Operations Admin
-- only. The auth check is OUTSIDE the refresh's exception block so it can never be swallowed by
-- the CONCURRENTLY→plain fallback.
create or replace function public.website_refresh_tenant_stats()
returns void language plpgsql security definer set search_path = public as $function$
begin
  if auth.uid() is not null and not public.is_ops_admin() then
    raise exception 'not authorised' using errcode = 'P0001';
  end if;
  begin
    refresh materialized view concurrently public.website_tenant_stats;
  exception when others then
    refresh materialized view public.website_tenant_stats;   -- fallback if CONCURRENTLY unavailable
  end;
end;$function$;

-- Reduce surface: both remain callable by authenticated (member/ops) — revoke anon/public.
revoke execute on function public.website_outbox_append(uuid, text, jsonb, jsonb, text) from anon, public;
revoke execute on function public.website_refresh_tenant_stats()                        from anon, public;
