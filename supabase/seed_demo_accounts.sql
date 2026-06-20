-- ─────────────────────────────────────────────────────────────────────────────
-- seed_demo_accounts.sql  —  Demo account provisioning (run AFTER auth users exist)
--
-- STEP 0 (dashboard / admin API — cannot be done in pure SQL):
--   Create 6 Supabase Auth users and note each auth.users.id (uuid):
--     Customer     phone +966500000001
--     Driver       phone +966500000007
--     Merchant     phone +966500000008
--     Super Admin  phone +966500000009   (or email super@haatnow.com)
--     Egypt Admin  phone +201000000009   (or email eg-admin@haatnow.com)
--     Saudi Admin  phone +966500000019   (or email sa-admin@haatnow.com)
--   Enable Auth → Providers → Phone, and add these as Test OTP numbers
--   (fixed code, no real SMS) so they can log in.
--
-- Then replace the placeholders below with the real uuids and run this file.
-- Roles ('customer','driver','merchant','admin') are already seeded by 0006.
-- ─────────────────────────────────────────────────────────────────────────────

-- Convenience: set the uuids once.
\set customer_uid  '00000000-0000-0000-0000-0000000c0001'
\set driver_uid    '00000000-0000-0000-0000-0000000d0007'
\set merchant_uid  '00000000-0000-0000-0000-0000000e0008'
\set super_uid     '00000000-0000-0000-0000-0000000a0009'
\set eg_admin_uid  '00000000-0000-0000-0000-0000000a0029'
\set sa_admin_uid  '00000000-0000-0000-0000-0000000a0019'

-- ── 1. Role assignments (user_roles) ─────────────────────────────────────────
insert into user_roles (user_id, role_id)
select :'customer_uid'::uuid, id from roles where name = 'customer'
union all select :'driver_uid'::uuid,   id from roles where name = 'driver'
union all select :'merchant_uid'::uuid, id from roles where name = 'merchant'
union all select :'super_uid'::uuid,     id from roles where name = 'admin'
union all select :'eg_admin_uid'::uuid,  id from roles where name = 'admin'
union all select :'sa_admin_uid'::uuid,  id from roles where name = 'admin'
on conflict do nothing;

-- ── 2. Admin scoping (admin_users) ───────────────────────────────────────────
insert into admin_users (user_id, email, full_name, scope, country_code) values
  (:'super_uid'::uuid,    'super@haatnow.com',    'Super Admin', 'super',   null),
  (:'eg_admin_uid'::uuid, 'eg-admin@haatnow.com', 'Egypt Admin', 'country', 'EG'),
  (:'sa_admin_uid'::uuid, 'sa-admin@haatnow.com', 'Saudi Admin', 'country', 'SA')
on conflict (user_id) do update
  set scope = excluded.scope, country_code = excluded.country_code, email = excluded.email, full_name = excluded.full_name;

-- ── 3. Customer profile (keyed to auth.uid()) ────────────────────────────────
insert into customers (id, phone_number, full_name, email)
values (:'customer_uid'::uuid, '+966500000001', 'عميل تجريبي', null)
on conflict (id) do nothing;

-- ── 4. Driver profile ────────────────────────────────────────────────────────
insert into drivers (id, phone_number, full_name, is_online)
values (:'driver_uid'::uuid, '+966500000007', 'كابتن تجريبي', true)
on conflict (id) do nothing;

-- ── 5. Merchant + a branch owned by the merchant auth.uid() ──────────────────
insert into merchants (id, business_name)
values (:'merchant_uid'::uuid, 'متجر تجريبي')
on conflict (id) do nothing;

insert into merchant_branches (id, merchant_id, zone_id, name, is_active)
select '00000000-0000-0000-0000-0000000eb008'::uuid, :'merchant_uid'::uuid,
       (select id from zones limit 1), 'الفرع التجريبي', true
on conflict (id) do nothing;

-- ── 6. Wallets for customer + driver (so wallet screens have data) ───────────
insert into wallets (owner_type, owner_id, balance) values
  ('customer', :'customer_uid'::uuid, 250.00),
  ('driver',   :'driver_uid'::uuid,    80.00)
on conflict do nothing;
