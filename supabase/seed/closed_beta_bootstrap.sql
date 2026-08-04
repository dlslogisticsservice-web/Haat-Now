-- ════════════════════════════════════════════════════════════════════════════
-- CLOSED BETA — production operational bootstrap (Phase B). ENVIRONMENT DATA, not a migration.
-- Applied to haat-now-prod (ckmqxhjdrfztkunqprax). Idempotent (on conflict do nothing).
-- Seeds the minimum to run a COD closed beta on the certified backend:
--   1 Operations Admin · launch geography (Egypt/Cairo + 2 zones + fees) · launch settings ·
--   1 approved merchant + branch + catalog · 1 driver.
-- Identities use the operator's Gmail with +tag subaddresses (all deliver to one inbox) so a
-- single operator can log in as admin / merchant / driver via email OTP during the beta.
-- Payments/SMS are NOT activated; no customers/orders are seeded (production starts clean).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Operations Admin (super, EG) ─────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('a1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dls.logistics.service@gmail.com', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"HAAT Ops Admin"}'::jsonb, now(), now(), '','','','')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(),'a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001', jsonb_build_object('sub','a1000000-0000-4000-8000-000000000001','email','dls.logistics.service@gmail.com','email_verified',true),'email', now(), now(), now()) on conflict do nothing;
insert into public.admin_users (id, user_id, email, full_name, scope, country_code, role_template)
values (gen_random_uuid(),'a1000000-0000-4000-8000-000000000001','dls.logistics.service@gmail.com','HAAT Ops Admin','super','EG','super_admin') on conflict do nothing;
insert into public.user_roles (user_id, role_id) select 'a1000000-0000-4000-8000-000000000001', id from public.roles where name='admin' on conflict do nothing;

-- ── 2. Launch geography + settings (Egypt → Cairo → 2 zones) ─────────────────────────────────
insert into public.cities(id, country_id, name) values ('c1000000-0000-4000-8000-000000000001','f64fb91a-29d0-5bce-bae2-600601e996f9','Cairo') on conflict (id) do nothing;
insert into public.zones(id, city_id, name, polygon, base_fee, per_km_fee, min_fee, eta_minutes, is_active, country_code) values
  ('21000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','Nasr City','[[31.30,30.02],[31.38,30.02],[31.38,30.10],[31.30,30.10]]'::jsonb,20,3,15,35,true,'EG'),
  ('21000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','Maadi','[[31.21,29.93],[31.29,29.93],[31.29,30.00],[31.21,30.00]]'::jsonb,25,3,18,40,true,'EG')
on conflict (id) do nothing;
insert into public.app_config(key, value, description) values
  ('launch_country','"EG"'::jsonb,'Closed beta launch country'),
  ('currency','"EGP"'::jsonb,'Display/settlement currency'),
  ('cod_only','true'::jsonb,'Cash-on-delivery only at launch'),
  ('min_order_amount','30'::jsonb,'Minimum order subtotal'),
  ('service_fee_cap','25'::jsonb,'Service fee cap (mirrors order_service_fee_cap)')
on conflict (key) do nothing;

-- ── 3. First merchant (approved) + branch + catalog ─────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('a1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dls.logistics.service+merchant1@gmail.com', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Cairo Eats Owner"}'::jsonb, now(), now(), '','','','') on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(),'a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002', jsonb_build_object('sub','a1000000-0000-4000-8000-000000000002','email','dls.logistics.service+merchant1@gmail.com','email_verified',true),'email', now(), now(), now()) on conflict do nothing;
insert into public.user_roles(user_id, role_id) select 'a1000000-0000-4000-8000-000000000002', id from public.roles where name='merchant' on conflict do nothing;
insert into public.merchants(id, business_name, owner_user_id, contact_email, contact_phone, business_type, address)
values ('b1000000-0000-4000-8000-000000000001','Cairo Eats','a1000000-0000-4000-8000-000000000002','dls.logistics.service+merchant1@gmail.com','+201000000001','restaurant','Nasr City, Cairo') on conflict (id) do nothing;
insert into public.account_status(entity_type, entity_id, status, updated_by) values ('merchant','b1000000-0000-4000-8000-000000000001','approved','a1000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.merchant_branches(id, merchant_id, zone_id, name, is_active, latitude, longitude, settings)
values ('b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','Cairo Eats — Nasr City',true,30.0600,31.3400,
  jsonb_build_object('prepTimeMinutes',20,'operating_hours', jsonb_build_object('sat',jsonb_build_array('10:00','23:59'),'sun',jsonb_build_array('10:00','23:59'),'mon',jsonb_build_array('10:00','23:59'),'tue',jsonb_build_array('10:00','23:59'),'wed',jsonb_build_array('10:00','23:59'),'thu',jsonb_build_array('10:00','23:59'),'fri',jsonb_build_array('12:00','23:59')))) on conflict (id) do nothing;
insert into public.products(id, branch_id, category_id, name, price, description, stock, is_active) values
  ('d1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','db2a3beb-6323-4027-8b9b-31d70f5cd060','Koshari',45,'Classic Egyptian koshari',100,true),
  ('d1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','db2a3beb-6323-4027-8b9b-31d70f5cd060','Grilled Chicken Meal',90,'Half grilled chicken with sides',100,true),
  ('d1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000002','db2a3beb-6323-4027-8b9b-31d70f5cd060','Soft Drink',15,'Chilled soft drink',200,true)
on conflict (id) do nothing;
insert into public.product_variants(id, product_id, name, price_modifier) values
  ('e1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','Regular',0),
  ('e1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','Large',15),
  ('e1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000002','Regular',0),
  ('e1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000003','Regular',0)
on conflict (id) do nothing;

-- ── First driver (approved, offline) ────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('a1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dls.logistics.service+driver1@gmail.com', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Captain One"}'::jsonb, now(), now(), '','','','') on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(),'a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003', jsonb_build_object('sub','a1000000-0000-4000-8000-000000000003','email','dls.logistics.service+driver1@gmail.com','email_verified',true),'email', now(), now(), now()) on conflict do nothing;
insert into public.user_roles(user_id, role_id) select 'a1000000-0000-4000-8000-000000000003', id from public.roles where name='driver' on conflict do nothing;
insert into public.drivers(id, phone_number, full_name, status, priority_score, active_orders, max_concurrent_orders, rating, is_online, owner_user_id, zone_id)
values ('a1000000-0000-4000-8000-000000000003','+201000000003','Captain One','offline',0,0,2,5.0,false,'a1000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000001') on conflict (id) do nothing;
insert into public.account_status(entity_type, entity_id, status, updated_by) values ('driver','a1000000-0000-4000-8000-000000000003','approved','a1000000-0000-4000-8000-000000000001') on conflict do nothing;
