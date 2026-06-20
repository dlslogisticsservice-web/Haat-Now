-- 0006_role_provisioning.sql
-- Enterprise multi-role RBAC: additive grants, priority-based portal routing,
-- permanent customer attachment, and admin-gated assign/revoke RPCs.
--
-- Architecture:
--   Every user holds {customer} permanently (assigned by trigger on first signup).
--   Promotions are additive:
--     customer          → always present
--     customer+merchant → approved merchant
--     customer+driver   → approved driver
--     customer+admin    → platform admin
--   Portal routing selects the highest-priority role (admin>merchant>driver>customer).

-- =====================================================================
-- 1. Add priority column to roles
--    Determines which portal to render when a user holds multiple roles.
--    Higher number = higher privilege = portal shown.
-- =====================================================================
alter table roles add column if not exists priority integer not null default 0;

-- =====================================================================
-- 2. Seed the four platform roles with priorities
--    ON CONFLICT DO UPDATE: idempotent — safe to re-run; updates
--    priorities and descriptions without duplicating rows.
-- =====================================================================
insert into roles (name, description, priority) values
  ('customer', 'Customer — permanent default role, auto-assigned on first login', 1),
  ('driver',   'Driver — approved delivery captains, assigned by admin',          2),
  ('merchant', 'Merchant — approved business operators, assigned by admin',       3),
  ('admin',    'Admin — platform administrators, first bootstrap via direct SQL', 4)
on conflict (name) do update set
  priority    = excluded.priority,
  description = excluded.description;

-- =====================================================================
-- 3. Trigger function: auto-assign customer role on every new auth.users row
--    ON CONFLICT DO NOTHING: safe re-run; never downgrades a promoted user
--    (a user with {customer+merchant} remains merchant after re-signup attempt)
-- =====================================================================
create or replace function public.assign_default_customer_role()
returns trigger as $$
begin
  insert into public.user_roles (user_id, role_id)
  select new.id, r.id
  from public.roles r
  where r.name = 'customer'
  on conflict (user_id, role_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.assign_default_customer_role();

-- =====================================================================
-- 4. Backfill: assign customer to any existing auth.users with no role entry
--    Wrapped in DO block — silent no-op if auth.users is inaccessible
--    from the migration execution context.
-- =====================================================================
do $$
begin
  insert into public.user_roles (user_id, role_id)
  select u.id, r.id
  from auth.users u
  cross join public.roles r
  where r.name = 'customer'
    and not exists (
      select 1 from public.user_roles ur where ur.user_id = u.id
    );
exception when others then
  null;
end;
$$;

-- =====================================================================
-- 5. assign_user_role — ADDITIVE ONLY
--    Adds a role to a user. Never removes any existing roles.
--    Idempotent: calling twice with the same role is a no-op.
--    Only callable by authenticated users holding the admin role.
--
--    Usage:
--      supabase.rpc('assign_user_role', {
--        p_user_id: 'target-uuid',
--        p_role_name: 'merchant'     -- 'driver' | 'admin' | 'customer'
--      })
--
--    First admin bootstrap (Supabase Dashboard > SQL Editor — bypasses RPC auth):
--      INSERT INTO user_roles (user_id, role_id)
--      SELECT '<auth-uid>', r.id FROM roles r WHERE r.name = 'admin';
-- =====================================================================
create or replace function public.assign_user_role(
  p_user_id   uuid,
  p_role_name varchar
) returns void as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = 'admin'
  ) then
    raise exception 'Unauthorized: caller must hold the admin role';
  end if;

  if not exists (select 1 from public.roles where name = p_role_name) then
    raise exception 'Unknown role: %', p_role_name;
  end if;

  -- Additive grant: insert if not already present; existing roles are untouched
  insert into public.user_roles (user_id, role_id)
  select p_user_id, r.id
  from public.roles r
  where r.name = p_role_name
  on conflict (user_id, role_id) do nothing;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- =====================================================================
-- 6. revoke_user_role — explicit role removal
--    Removes one specific role from a user.
--    The 'customer' role is PERMANENTLY IRREVOCABLE — this function
--    rejects any attempt to remove it to preserve base-level access.
--    Only callable by authenticated users holding the admin role.
--
--    Usage:
--      supabase.rpc('revoke_user_role', {
--        p_user_id: 'target-uuid',
--        p_role_name: 'merchant'     -- cannot be 'customer'
--      })
-- =====================================================================
create or replace function public.revoke_user_role(
  p_user_id   uuid,
  p_role_name varchar
) returns void as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = 'admin'
  ) then
    raise exception 'Unauthorized: caller must hold the admin role';
  end if;

  if p_role_name = 'customer' then
    raise exception 'The customer role is permanent and cannot be revoked';
  end if;

  if not exists (select 1 from public.roles where name = p_role_name) then
    raise exception 'Unknown role: %', p_role_name;
  end if;

  delete from public.user_roles
  where user_id = p_user_id
    and role_id = (select id from public.roles where name = p_role_name);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
