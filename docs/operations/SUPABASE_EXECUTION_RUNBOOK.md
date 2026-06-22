# SUPABASE_EXECUTION_RUNBOOK.md — HAAT NOW

**Final, ready-to-execute runbook.** Converts: Sandbox Auth + sandbox identities + `sandboxStore` → **Real Supabase Auth + real DB identities + real RBAC + real country scoping.** Execute parts in order. Project ref: `umwbzradvbsirsybfxfb`.

- **Total estimated time:** **30–45 min** (Dashboard ~12, SQL ~8, build/deploy ~10, validation ~10).
- **You need:** Supabase **dashboard** access (Owner/Admin) for this project. Everything else is in this file.
- **Confirmed going in:** all 6 accounts are CREATE NEW (no reusable DB identities). Catalog (5 merchants/branches) already seeded and untouched.

---

## PART 0 — Pre-flight (2 min)
1. Open the Supabase dashboard → project `umwbzradvbsirsybfxfb`.
2. Have ready: this file + the repo (you'll run `npm run build` in PART 7).
3. Do parts **in order**. Do not start PART 5 until PART 4 returns all-clear.

---

## PART 1 — Dashboard: Phone provider + Test OTP + 6 users (≈12 min) 🟡
**1.1 Enable phone auth** — Authentication → Providers → **Phone → Enable**.
- No-cost testing path: in the Phone provider panel, find **Test OTP / Test phone numbers** and add these 6 rows (phone → code):
  ```
  +201000000001 → 123456     +201000000002 → 123456     +201000000003 → 123456
  +201000000004 → 123456     +966500000004 → 123456     +201000000005 → 123456
  ```
- Production SMS path (optional, later): configure Twilio/MessageBird instead of Test OTP.

**1.2 Create 6 auth users** — Authentication → Users → **Add user** (×6, "Phone" type). Create one per phone above.
- After each, click the user and **copy its `User UID`**.

**1.3 Record the UUIDs** (you paste these in PART 5):
```
CUSTOMER_UID = ______________________________   (+201000000001)
MERCHANT_UID = ______________________________   (+201000000002)
DRIVER_UID   = ______________________________   (+201000000003)
EG_ADMIN_UID = ______________________________   (+201000000004)
SA_ADMIN_UID = ______________________________   (+966500000004)
SUPER_UID    = ______________________________   (+201000000005)
```
**Expected result:** Phone provider shows **Enabled**; 6 users listed under Authentication → Users.
**Validate:** in browser/terminal:
```
curl -s -X POST "https://umwbzradvbsirsybfxfb.supabase.co/auth/v1/otp" \
  -H "apikey: sb_publishable_R8uXSgCyxFK-TpZsFMnIrg_Mkm-MGOD" \
  -H "Content-Type: application/json" -d '{"phone":"+201000000001"}'
```
→ must return **`{}` / 200** (NOT `phone_provider_disabled`).

---

## PART 2 — SQL: authenticated grants (migration 0019) (≈1 min) 🟢
Open **SQL Editor → New query**, paste, **Run**. Idempotent.
```sql
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.customer_carts, public.cart_items, public.favorites, public.reviews, public.addresses,
  public.payment_methods, public.support_tickets, public.support_messages,
  public.push_tokens, public.subscriptions
to authenticated;
grant select, insert, update on public.orders, public.order_items, public.coupon_usages to authenticated;
grant select, update on public.notifications to authenticated;
grant select on
  public.wallets, public.wallet_transactions, public.payment_transactions, public.payment_attempts,
  public.refunds, public.driver_earnings, public.order_status_history
to authenticated;
grant select on
  public.merchants, public.merchant_branches, public.products, public.product_variants,
  public.product_images, public.offers, public.banners, public.zones, public.categories,
  public.countries, public.cities, public.coupons, public.app_config,
  public.roles, public.user_roles, public.admin_users, public.drivers
to authenticated;
grant insert, update, delete on
  public.products, public.product_variants, public.product_images, public.merchants, public.merchant_branches
to authenticated;
grant insert, update on public.drivers, public.driver_locations, public.driver_earnings to authenticated;
grant execute on function public.complete_delivery(uuid, uuid) to authenticated;
grant execute on function public.complete_delivery_payout(uuid, uuid, decimal) to authenticated;
grant execute on function public.adjust_wallet_balance(varchar, uuid, decimal, varchar) to authenticated;
```
**Expected result:** "Success. No rows returned."
**Validate (expect 8 rows):**
```sql
select table_name, string_agg(privilege_type,',' order by privilege_type) grants
from information_schema.role_table_grants
where table_schema='public' and grantee='authenticated'
  and table_name in ('orders','order_items','wallets','notifications','customer_carts','cart_items','favorites','addresses')
group by table_name order by table_name;
```

---

## PART 3 — SQL: order_country_code → SECURITY DEFINER (≈1 min) 🟢
Fixes `42501` + RLS recursion in admin order reads.
```sql
create or replace function public.order_country_code(p_order_id uuid) returns varchar
  language sql stable security definer set search_path = public as $$
  select co.code
  from orders o
  join merchant_branches mb on mb.id = o.branch_id
  join zones z              on z.id  = mb.zone_id
  join cities ci            on ci.id = z.city_id
  join countries co         on co.id = ci.country_id
  where o.id = p_order_id;
$$;
revoke all on function public.order_country_code(uuid) from public;
grant execute on function public.order_country_code(uuid) to authenticated;
```
**Expected result:** "Success."
**Validate (expect `prosecdef = t`):**
```sql
select proname, prosecdef from pg_proc where proname = 'order_country_code';
```

---

## PART 4 — SQL: PRECHECK (read-only, ≈2 min) 🟡
Paste your 6 UUIDs into the IN-list once, Run. **Proceed only if results match "EXPECT".**
```sql
-- A) auth.users — the 6 exist, phones unique  (EXPECT 6 rows, count=1 each)
select phone, count(*) from auth.users
  where id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID')
  group by phone;
-- B) roles seeded  (EXPECT 4: customer/driver/merchant/admin)
select name from roles where name in ('customer','driver','merchant','admin');
-- C) customer phone free  (EXPECT 0 rows)
select id from customers where phone_number='+201000000001';
-- D) driver phone free  (EXPECT 0 rows)
select id from drivers where phone_number='+201000000003';
-- E) no existing/duplicate wallets for demo owners  (EXPECT 0 rows BOTH)
select owner_type,owner_id from wallets where owner_id in ('CUSTOMER_UID','DRIVER_UID');
select owner_type,owner_id,count(*) from wallets group by 1,2 having count(*)>1;
-- F) countries EG+SA exist  (EXPECT EG and SA)
select code from countries where code in ('EG','SA');
-- G) an EG zone exists for the demo branch  (EXPECT 1 row)
select z.id from zones z join cities ci on ci.id=z.city_id join countries co on co.id=ci.country_id
  where co.code='EG' limit 1;
```
**Abort conditions:** A≠6 rows or any count>1 → fix PART 1. B<4 → run migration 0006. C/D return a row → that phone already used (reuse that id or pick another). E returns rows → a wallet already exists (PART 5 will skip it; confirm acceptable). F missing → seed countries. G empty → no EG zone (seed zones or use a different country for the branch).

---

## PART 5 — SQL: PROVISION (idempotent, ≈2 min) 🟢/🟡
**Before running:** in the SQL Editor press **Ctrl/Cmd+H** (Find & Replace) and replace each token with your UUID from PART 1: `CUSTOMER_UID`, `MERCHANT_UID`, `DRIVER_UID`, `EG_ADMIN_UID`, `SA_ADMIN_UID`, `SUPER_UID`. Then Run the whole block. Every statement is re-runnable.
```sql
-- 5.1 user_roles (composite PK → idempotent)
with ids(role_key, uid) as (values
  ('customer','CUSTOMER_UID'::uuid), ('driver','DRIVER_UID'::uuid), ('merchant','MERCHANT_UID'::uuid),
  ('admin','SUPER_UID'::uuid), ('admin','EG_ADMIN_UID'::uuid), ('admin','SA_ADMIN_UID'::uuid))
insert into user_roles (user_id, role_id)
select i.uid, r.id from ids i join roles r on r.name = i.role_key
on conflict (user_id, role_id) do nothing;

-- 5.2 admin_users (unique(user_id) → upsert)
insert into admin_users (user_id, email, full_name, scope, country_code) values
  ('SUPER_UID'::uuid,    'super@haatnow.com',    'Super Admin', 'super',   null),
  ('EG_ADMIN_UID'::uuid, 'eg-admin@haatnow.com', 'Egypt Admin', 'country', 'EG'),
  ('SA_ADMIN_UID'::uuid, 'sa-admin@haatnow.com', 'Saudi Admin', 'country', 'SA')
on conflict (user_id) do update
  set scope=excluded.scope, country_code=excluded.country_code, email=excluded.email, full_name=excluded.full_name;

-- 5.3 customer profile (id = auth uid; phone is UNIQUE → double-guarded)
insert into customers (id, phone_number, full_name, email)
select 'CUSTOMER_UID'::uuid, '+201000000001', 'عميل تجريبي', null
where not exists (select 1 from customers where id='CUSTOMER_UID'::uuid)
  and not exists (select 1 from customers where phone_number='+201000000001');

-- 5.4 driver profile
insert into drivers (id, phone_number, full_name, is_online)
select 'DRIVER_UID'::uuid, '+201000000003', 'كابتن تجريبي', true
where not exists (select 1 from drivers where id='DRIVER_UID'::uuid)
  and not exists (select 1 from drivers where phone_number='+201000000003');

-- 5.5 merchant + EG branch
insert into merchants (id, business_name)
select 'MERCHANT_UID'::uuid, 'متجر تجريبي'
where not exists (select 1 from merchants where id='MERCHANT_UID'::uuid);
insert into merchant_branches (id, merchant_id, zone_id, name, is_active)
select gen_random_uuid(), 'MERCHANT_UID'::uuid,
       (select z.id from zones z join cities ci on ci.id=z.city_id join countries co on co.id=ci.country_id
          where co.code='EG' limit 1),
       'الفرع التجريبي', true
where not exists (select 1 from merchant_branches where merchant_id='MERCHANT_UID'::uuid);

-- 5.6 wallets (FIXED idempotent — table has NO unique(owner_type,owner_id))
insert into wallets (owner_type, owner_id, balance)
select 'customer','CUSTOMER_UID'::uuid,250.00
where not exists (select 1 from wallets where owner_type='customer' and owner_id='CUSTOMER_UID'::uuid);
insert into wallets (owner_type, owner_id, balance)
select 'driver','DRIVER_UID'::uuid,80.00
where not exists (select 1 from wallets where owner_type='driver' and owner_id='DRIVER_UID'::uuid);
```
**Expected result:** "Success." (Re-running changes nothing.)

---

## PART 6 — SQL: VERIFY provisioning (≈2 min) 🟢
```sql
-- V1 effective roles  (EXPECT customer/merchant/driver/admin×3)
select ur.user_id, (array_agg(r.name order by r.priority desc))[1] role
from user_roles ur join roles r on r.id=ur.role_id
where ur.user_id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID')
group by ur.user_id;
-- V2 auth.users present  (EXPECT 6)
select count(*) from auth.users where id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID');
-- V3 admin scoping  (EXPECT super/null, country/EG, country/SA)
select user_id, scope, country_code from admin_users where user_id in ('SUPER_UID','EG_ADMIN_UID','SA_ADMIN_UID');
-- V4 profiles  (EXPECT 1,1,1,1)
select 'customer' t,count(*) from customers where id='CUSTOMER_UID'
union all select 'driver',count(*) from drivers where id='DRIVER_UID'
union all select 'merchant',count(*) from merchants where id='MERCHANT_UID'
union all select 'branch',count(*) from merchant_branches where merchant_id='MERCHANT_UID';
-- V5 NO duplicate wallets (critical)  (EXPECT one per owner; dup_groups=0)
select owner_type,owner_id,count(*) from wallets where owner_id in ('CUSTOMER_UID','DRIVER_UID') group by 1,2;
select count(*) dup_groups from (select 1 from wallets group by owner_type,owner_id having count(*)>1) d;
```
**Expected:** V1 correct roles · V2 = 6 · V3 correct scopes · V4 = 1/1/1/1 · **V5 = 1 wallet each AND dup_groups = 0**.

---

## PART 7 — Build & deploy (removes sandbox, ≈10 min) 🟢
In the repo:
```bash
npm run build      # DEV=false → sandbox auth tree-shaken; loads .env.production (VITE_AUTH_MODE=supabase)
```
Deploy the `dist/` folder to your static host. On the host, set env **`VITE_AUTH_MODE=supabase`** (defense-in-depth). **Never serve `npm run dev` in production.**
**Expected result:** build exits 0; deployed app loads.

---

## PART 8 — Final validation checklist (≈10 min)
On the **deployed production build**:
- [ ] Customer `+201000000001` + OTP `123456` (Test OTP) → logs in → customer home. `localStorage` has `sb-…-auth-token` (a JWT) and **no** `haat_sandbox_session`.
- [ ] Merchant `+201000000002` → merchant portal loads (real orders/products).
- [ ] Driver `+201000000003` → driver portal loads.
- [ ] Egypt Admin `+201000000004` → admin portal; sees **EG** orders only.
- [ ] Saudi Admin `+966500000004` → admin portal; sees **SA** orders only.
- [ ] Super Admin `+201000000005` → admin portal; sees **all** countries.
- [ ] No `42501` / no "infinite recursion" errors in any admin view.
- [ ] On the deployed build, a **non-provisioned** phone + `123456` is **rejected** (sandbox gone).
- ✅ All checked ⇒ **Real Supabase Auth + Real Identities + Real RBAC + Real Country Scoping = ACTIVE.**

---

## PART 9 — Rollback (reverse order)
- **PART 7:** redeploy the previous artifact (sandbox returns only in a `npm run dev` build).
- **PART 5 (DB rows):**
```sql
delete from wallets where owner_id in ('CUSTOMER_UID','DRIVER_UID') and owner_type in ('customer','driver');
delete from merchant_branches where merchant_id='MERCHANT_UID';
delete from merchants where id='MERCHANT_UID';
delete from drivers   where id='DRIVER_UID';
delete from customers where id='CUSTOMER_UID';
delete from admin_users where user_id in ('SUPER_UID','EG_ADMIN_UID','SA_ADMIN_UID');
delete from user_roles  where user_id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID');
```
- **PART 3:** re-run migration 0018's `order_country_code` block (invoker version).
- **PART 2:** `revoke all on all tables in schema public from authenticated; revoke usage on schema public from authenticated;` (re-blocks real users — full revert only).
- **PART 1:** Authentication → delete the 6 users; disable Phone provider.

## Execution time summary
| Part | Action | Time |
|---|---|---|
| 1 | Dashboard: provider + Test OTP + 6 users | ~12 min |
| 2 | SQL grants (0019) | ~1 min |
| 3 | SQL order_country_code DEFINER | ~1 min |
| 4 | SQL PRECHECK | ~2 min |
| 5 | SQL PROVISION | ~2 min |
| 6 | SQL VERIFY | ~2 min |
| 7 | Build & deploy | ~10 min |
| 8 | Final validation (6 logins) | ~10 min |
| **Total** | | **~30–45 min** |

> Ready for immediate execution by the project owner. No application source changes are required; sandbox removal happens at PART 7 build time.
