-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9 · P0-7 — Server-side granular RBAC enforcement (money operations).
--
-- BEFORE: the 35-permission RBAC matrix lived only in the browser/localStorage and merely
-- hid UI. Server-side, RLS collapsed all admin authority to a single boolean
-- (is_ops_admin/auth_is_admin) → any admin could pay settlements, issue compensations,
-- approve KYC. (SECURITY §S-1, ROLE_CAPABILITY, R-07.)
--
-- AFTER: a real server-side permission model —
--   • role_permissions           (role_template → permission_key)
--   • admin_users.role_template   (which template an admin holds; backfilled to super_admin
--                                  so EXISTING admins keep full authority — no breakage)
--   • auth_has_permission(perm)   SECURITY DEFINER resolver (super_admin ⇒ all)
-- and it is ENFORCED at the acute money-movement RPCs (cash-out + compensation) by
-- re-creating them verbatim with one added permission guard. Coarse is_ops_admin() is
-- kept as defense-in-depth.
--
-- Backward compatible: additive tables/columns; existing admins backfilled to super_admin;
-- generate_* / other admin RPCs unchanged (they compute, they don't move cash).
-- ─────────────────────────────────────────────────────────────────────────────

-- 0) Conflict guard: earlier production carried a legacy, EMPTY role_permissions(role_id,
--    permission_id) join table whose name collides with the role_template/permission_key
--    catalog created below. `create table if not exists` would silently keep the legacy shape
--    and the seed INSERT would fail (column "role_template" does not exist). Rename the legacy
--    shape aside — idempotent, guarded, no data loss (legacy table is empty; kept as _legacy).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='role_permissions' and column_name='role_id')
     and not exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='role_permissions' and column_name='role_template') then
    alter table public.role_permissions rename to role_permissions_legacy;
  end if;
end $$;

-- 1) Which role template each admin holds (nullable; backfilled below).
alter table public.admin_users add column if not exists role_template text;
update public.admin_users
  set role_template = case when scope = 'super' then 'super_admin' else 'country_manager' end
  where role_template is null;

-- 2) role_permissions catalog (role_template → permission_key).
create table if not exists public.role_permissions (
  role_template  text not null,
  permission_key text not null,
  primary key (role_template, permission_key)
);
alter table public.role_permissions enable row level security;
drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions
  for select to authenticated using (true);
drop policy if exists role_permissions_admin on public.role_permissions;
create policy role_permissions_admin on public.role_permissions
  for all to authenticated using (public.auth_is_admin()) with check (public.auth_is_admin());

-- Seed the permission catalog to mirror src/services/rbac.service.ts ROLE_TEMPLATES.
-- super_admin is intentionally NOT enumerated here — auth_has_permission() short-circuits it.
insert into public.role_permissions (role_template, permission_key) values
  ('finance_manager','finance.view'), ('finance_manager','finance.settle'),
  ('finance_manager','finance.pay'),  ('finance_manager','finance.refund'),
  ('finance_manager','records.merchants.manage'), ('finance_manager','fleet.drivers.view'),
  ('finance_manager','orders.view'),
  ('operations_manager','ops.command.view'), ('operations_manager','ops.dispatch.manage'),
  ('operations_manager','ops.zones.manage'), ('operations_manager','fleet.drivers.view'),
  ('operations_manager','fleet.vehicles.manage'), ('operations_manager','fleet.performance.view'),
  ('operations_manager','orders.view'), ('operations_manager','orders.manage'),
  ('operations_manager','orders.cancel'), ('operations_manager','finance.view'),
  ('operations_manager','support.view'),
  ('support_agent','support.view'), ('support_agent','support.reply'),
  ('support_agent','support.close'), ('support_agent','orders.view'),
  ('support_agent','records.customers.manage'),
  ('compliance_officer','compliance.kyc.view'), ('compliance_officer','compliance.kyc.approve'),
  ('compliance_officer','compliance.kyc.suspend'), ('compliance_officer','security.logs.view'),
  ('compliance_officer','fleet.drivers.view'), ('compliance_officer','records.merchants.manage'),
  ('marketing_manager','marketing.coupons.manage'), ('marketing_manager','marketing.campaigns.manage'),
  ('marketing_manager','marketing.growth.view'), ('marketing_manager','orders.view'),
  ('country_manager','ops.command.view'), ('country_manager','ops.dispatch.manage'),
  ('country_manager','orders.view'), ('country_manager','orders.manage'),
  ('country_manager','fleet.drivers.view'), ('country_manager','finance.view'),
  ('country_manager','support.view'), ('country_manager','marketing.growth.view'),
  ('country_manager','compliance.kyc.view')
on conflict (role_template, permission_key) do nothing;

-- 3) Resolver: does the calling admin hold a permission? super_admin ⇒ everything.
create or replace function public.auth_has_permission(p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid()
      and ( a.role_template = 'super_admin'
            or exists (
              select 1 from public.role_permissions rp
              where rp.role_template = a.role_template
                and rp.permission_key = p_perm ) )
  );
$$;
revoke execute on function public.auth_has_permission(text) from public, anon;
grant  execute on function public.auth_has_permission(text) to authenticated;

-- 4) ENFORCE at the money-movement RPCs (re-created verbatim + one permission guard).
--    (Bodies copied exactly from 20260614000031_finance_engine.sql; only the guard added.)

create or replace function public.pay_merchant_settlement(p_ms_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r record;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  if not public.auth_has_permission('finance.pay') then raise exception 'permission denied: finance.pay' using errcode='P0001'; end if;
  select * into r from public.merchant_settlements where id=p_ms_id for update;
  if not found then raise exception 'settlement not found'; end if;
  if r.status='paid' then return; end if;   -- idempotent
  update public.merchant_settlements set status='paid', paid_at=now(), paid_by=auth.uid() where id=p_ms_id;
  perform public.post_ledger(gen_random_uuid(),'merchant_settlement', jsonb_build_array(
    jsonb_build_object('account_type','merchant_payable','owner_type','merchant','owner_id',r.merchant_id,'debit',r.net_payable,'credit',0,'ref_table','merchant_settlements','ref_id',p_ms_id),
    jsonb_build_object('account_type','platform_cash','owner_type','platform','debit',0,'credit',r.net_payable,'ref_table','merchant_settlements','ref_id',p_ms_id)));
end;$$;

create or replace function public.pay_driver_settlement(p_ds_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r record;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  if not public.auth_has_permission('finance.pay') then raise exception 'permission denied: finance.pay' using errcode='P0001'; end if;
  select * into r from public.driver_settlements where id=p_ds_id for update;
  if not found then raise exception 'settlement not found'; end if;
  if r.status='paid' then return; end if;
  update public.driver_settlements set status='paid', paid_at=now(), paid_by=auth.uid() where id=p_ds_id;
  perform public.post_ledger(gen_random_uuid(),'driver_settlement', jsonb_build_array(
    jsonb_build_object('account_type','driver_payable','owner_type','driver','owner_id',r.driver_id,'debit',r.net_payable,'credit',0,'ref_table','driver_settlements','ref_id',p_ds_id),
    jsonb_build_object('account_type','platform_cash','owner_type','platform','debit',0,'credit',r.net_payable,'ref_table','driver_settlements','ref_id',p_ds_id)));
end;$$;

create or replace function public.issue_compensation(p_entity_type text, p_entity_id uuid, p_amount numeric, p_reason text, p_order uuid default null)
returns public.compensations language plpgsql security definer set search_path=public as $$
declare v public.compensations; v_acct text;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  if not public.auth_has_permission('finance.refund') then raise exception 'permission denied: finance.refund' using errcode='P0001'; end if;
  insert into public.compensations(entity_type,entity_id,order_id,amount,reason,created_by)
    values (p_entity_type,p_entity_id,p_order,p_amount,p_reason,auth.uid()) returning * into v;
  v_acct := case p_entity_type when 'merchant' then 'merchant_payable' when 'driver' then 'driver_payable' else 'customer_refund' end;
  perform public.post_ledger(gen_random_uuid(),'compensation', jsonb_build_array(
    jsonb_build_object('account_type','platform_expense','owner_type','platform','debit',p_amount,'credit',0,'ref_table','compensations','ref_id',v.id),
    jsonb_build_object('account_type',v_acct,'owner_type',p_entity_type,'owner_id',p_entity_id,'debit',0,'credit',p_amount,'ref_table','compensations','ref_id',v.id)));
  return v;
end;$$;

-- Phase 9.5 hardening (live security-advisor finding): these cash-moving SECURITY DEFINER
-- functions were flagged as executable by the anonymous role. Revoke anon/PUBLIC execute;
-- keep the existing authenticated grant (internal guards still enforce is_ops_admin +
-- auth_has_permission). Defense-in-depth.
revoke execute on function public.pay_merchant_settlement(uuid) from public, anon;
revoke execute on function public.pay_driver_settlement(uuid)   from public, anon;
revoke execute on function public.issue_compensation(text, uuid, numeric, text, uuid) from public, anon;
grant  execute on function public.pay_merchant_settlement(uuid) to authenticated;
grant  execute on function public.pay_driver_settlement(uuid)   to authenticated;
grant  execute on function public.issue_compensation(text, uuid, numeric, text, uuid) to authenticated;
