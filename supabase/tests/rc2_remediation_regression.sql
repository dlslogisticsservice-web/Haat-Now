-- ════════════════════════════════════════════════════════════════════════════
-- RC2 REMEDIATION — permanent regression suite.
--   RC2-1 website_outbox_append: tenant-membership required (or ops); no cross-tenant write.
--   RC2-2 website_refresh_tenant_stats: service/ops only.
-- Proves: non-member cannot append to another tenant · member can append to own tenant ·
--         admin can append · unauthorized refresh fails · admin refresh succeeds.
-- Run against a project with 20260801000007 applied (superuser — it seeds a throwaway auth.users
-- row for the admin path). Self-cleaning; any regression RAISEs.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  tA uuid := gen_random_uuid(); tB uuid := gen_random_uuid();
  member uuid := gen_random_uuid(); nonmember uuid := gen_random_uuid(); admin uuid := gen_random_uuid();
  nm_blocked boolean:=false; mem_ok boolean:=false; adm_ok boolean:=false;
  ref_nonadmin_blocked boolean:=false; ref_admin_ok boolean:=false; ref_admin_autherr boolean:=false;
  cross_rows int; own_rows int; memx_rows int; adm_rows int;
begin
  insert into public.tenants(id, brand_name) values (tA,'Tenant A'),(tB,'Tenant B');
  insert into public.customers(id, full_name, email) values (member,'m',member::text||'@regr.local'),(nonmember,'n',nonmember::text||'@regr.local');
  insert into public.tenant_members(tenant_id, user_id, role) values (tA, member, 'editor');
  insert into auth.users(id, instance_id, aud, role, email) values
    (admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', admin::text||'@regr.local');
  insert into public.admin_users(user_id, role_template, email, full_name) values (admin, 'super_admin', admin::text||'@regr.local', 'Admin');

  -- non-member: append + refresh must be rejected
  perform set_config('request.jwt.claims', json_build_object('sub', nonmember::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.website_outbox_append(tA, 'nm', '{}'::jsonb, '{}'::jsonb, 'nm-'||nonmember::text); exception when others then nm_blocked:=true; end;
  begin perform public.website_refresh_tenant_stats(); exception when others then ref_nonadmin_blocked:=true; end;
  execute 'reset role';

  -- member: own tenant OK; other tenant rejected
  perform set_config('request.jwt.claims', json_build_object('sub', member::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.website_outbox_append(tA, 'mem', '{}'::jsonb, '{}'::jsonb, 'mem-'||member::text); mem_ok:=true; exception when others then mem_ok:=false; end;
  begin perform public.website_outbox_append(tB, 'memX', '{}'::jsonb, '{}'::jsonb, 'memx-'||member::text); exception when others then null; end;
  execute 'reset role';

  -- admin: append (any tenant) + refresh OK
  perform set_config('request.jwt.claims', json_build_object('sub', admin::text, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.website_outbox_append(tB, 'adm', '{}'::jsonb, '{}'::jsonb, 'adm-'||admin::text); adm_ok:=true; exception when others then adm_ok:=false; end;
  begin perform public.website_refresh_tenant_stats(); ref_admin_ok:=true; exception when others then ref_admin_autherr := (sqlerrm ilike '%not authorised%'); end;
  execute 'reset role';

  select count(*) into cross_rows from public.website_event_outbox where tenant_id=tA and type='nm';
  select count(*) into own_rows   from public.website_event_outbox where tenant_id=tA and type='mem';
  select count(*) into memx_rows  from public.website_event_outbox where tenant_id=tB and type='memX';
  select count(*) into adm_rows   from public.website_event_outbox where tenant_id=tB and type='adm';

  delete from public.website_event_outbox where tenant_id in (tA,tB);
  delete from public.tenant_members where tenant_id=tA;
  delete from public.admin_users where user_id=admin;
  delete from auth.users where id=admin;
  delete from public.customers where id in (member,nonmember);
  delete from public.tenants where id in (tA,tB);

  if not nm_blocked or cross_rows <> 0 then raise exception 'RC2-1 REGRESSION: non-member wrote to another tenant''s outbox'; end if;
  if not mem_ok or own_rows <> 1 then raise exception 'RC2-1 REGRESSION: member cannot append to own tenant'; end if;
  if memx_rows <> 0 then raise exception 'RC2-1 REGRESSION: member wrote to a foreign tenant'; end if;
  if not adm_ok or adm_rows <> 1 then raise exception 'RC2-1 REGRESSION: ops admin cannot append'; end if;
  if not ref_nonadmin_blocked then raise exception 'RC2-2 REGRESSION: non-admin can refresh tenant stats'; end if;
  if not ref_admin_ok or ref_admin_autherr then raise exception 'RC2-2 REGRESSION: ops admin refresh rejected'; end if;
  raise notice 'RC2 PASS: outbox tenant-membership enforced; refresh restricted to service/ops';
end$$;

-- Structural: both RPCs revoked from anon.
do $$
begin
  if has_function_privilege('anon','public.website_outbox_append(uuid,text,jsonb,jsonb,text)','execute')
     or has_function_privilege('anon','public.website_refresh_tenant_stats()','execute')
    then raise exception 'RC2 REGRESSION: a website RPC is anon-executable'; end if;
  raise notice 'RC2 STRUCTURAL PASS: website_outbox_append + website_refresh_tenant_stats revoked from anon';
end$$;

select 'RC2_REMEDIATION_REGRESSION: RC2-1 + RC2-2 closed' as result;
