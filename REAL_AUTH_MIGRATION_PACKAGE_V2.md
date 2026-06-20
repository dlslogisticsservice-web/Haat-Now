# REAL_AUTH_MIGRATION_PACKAGE_V2.md — HAAT NOW

Revised, execution-safe conversion: **Sandbox Auth → Real Supabase Auth**. Supersedes `REAL_AUTH_MIGRATION_PACKAGE.md`. Incorporates every finding from `PRE_MIGRATION_IMPACT_REPORT.md` (idempotent wallets, mandatory pre-checks, PRECHECK→PROVISION→VERIFY workflow, per-operation risk labels). Project `umwbzradvbsirsybfxfb`.

> **Goal:** Sandbox Auth = Removed (production build), Real Supabase Auth = Active for Customer / Merchant / Driver / Egypt Admin / Saudi Admin / Super Admin — **with zero duplicate users / wallets / branches / role rows.**

## Risk legend
- 🟢 **SAFE** — idempotent by a DB constraint or guard; re-runnable; cannot duplicate or corrupt.
- 🟡 **CONDITIONAL** — safe **only if** its pre-check passes (e.g. no pre-existing phone/uid); otherwise it errors or needs a decision.
- 🔴 **HIGH RISK** — would duplicate/corrupt if run as-is; **rewritten here** to be safe. Never run the old form.

## Current state (verified, read-only)
- Production build already **strips sandbox auth** (`IS_SANDBOX = VITE_AUTH_MODE==='sandbox' && import.meta.env.DEV` → `false` in `vite build`; demo logins 0/6 — proven).
- Real auth **inactive**: `POST /auth/v1/otp` → `phone_provider_disabled`.
- Catalog present: `merchants`=5, `merchant_branches`=5 (seed restaurants; the demo merchant/branch are **absent**). Identity/wallet tables are RLS-hidden from anon — their contents are confirmed by the PRECHECK in Step 4.

## Execution order
1. **Step 1 — Dashboard:** enable Phone provider + Test OTP; create 6 `auth.users`; capture UUIDs.
2. **Step 2 — SQL:** apply migration `0019` (authenticated grants).
3. **Step 3 — SQL:** recreate `order_country_code` as `SECURITY DEFINER`.
4. **Step 4 — SQL:** **PRECHECK → PROVISION → VERIFY** (the safety-critical step).
5. **Step 5 — Build/Deploy:** production build (sandbox removed) + `VITE_AUTH_MODE=supabase`.
6. **Step 6 — Verify:** real login for all 6 roles + RBAC/country checks.

### Canonical accounts
| Role | Phone (E.164) | Country | admin scope |
|---|---|---|---|
| Customer | `+201000000001` | EG | — |
| Merchant | `+201000000002` | EG | — |
| Driver | `+201000000003` | EG | — |
| Egypt Admin | `+201000000004` | EG | `country` |
| Saudi Admin | `+966500000004` | SA | `country` |
| Super Admin | `+201000000005` | — | `super` |

---

## STEP 1 — Dashboard: Phone provider + Test OTP + create users — 🟡 CONDITIONAL
**Actions (Authentication):**
1. **Providers → Phone → Enable.** Paid SMS: Twilio/MessageBird. No-cost testing: add each phone above as a **Test OTP** number mapped to `123456`.
2. **Before creating users**, check **Users** for any existing rows with these phones (avoid duplicate auth users — see Step 4 PRECHECK P1).
3. **Users → Add user** ×6 (type = Phone). **Copy each UUID.**

**Success criteria:** `POST /auth/v1/otp {"phone":"+201000000001"}` → **200** (not `phone_provider_disabled`); 6 users listed.
**Rollback:** disable Phone provider; delete the 6 users.

Record UUIDs (used throughout Step 4):
```
CUSTOMER_UID = ____________   MERCHANT_UID = ____________   DRIVER_UID = ____________
EG_ADMIN_UID = ____________   SA_ADMIN_UID = ____________   SUPER_UID  = ____________
```

## STEP 2 — SQL: migration 0019 (authenticated grants) — 🟢 SAFE (idempotent)
Paste the **entire** `supabase/migrations/20260614000019_authenticated_grants.sql` into SQL Editor → Run.
**VERIFY (expect 8 rows, each ≥ SELECT):**
```sql
select table_name, string_agg(privilege_type,',' order by privilege_type) grants
from information_schema.role_table_grants
where table_schema='public' and grantee='authenticated'
  and table_name in ('orders','order_items','wallets','notifications','customer_carts','cart_items','favorites','addresses')
group by table_name order by table_name;
```
**Rollback:** `revoke all on all tables in schema public from authenticated; revoke usage on schema public from authenticated;` (re-blocks real users — only for full revert).

## STEP 3 — SQL: order_country_code → SECURITY DEFINER — 🟢 SAFE (create-or-replace)
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
**VERIFY:** `select proname, prosecdef from pg_proc where proname='order_country_code';` → `prosecdef = true`.
**Rollback:** re-run migration 0018's `order_country_code` block (the invoker version).

---

## STEP 4 — PRECHECK → PROVISION → VERIFY (safety-critical)
Run the three phases **in order**. Do **not** start PROVISION until every PRECHECK abort-condition is clear. Replace the 6 `*_UID` placeholders first.

### ── PHASE 4A · PRECHECK (read-only — changes nothing) ──
Run all queries. **Abort and resolve** if any "ABORT-IF" condition is met.
```sql
-- P1 auth.users: the 6 users exist (from Step 1) and no phone is duplicated. 🟡
select phone, count(*) from auth.users
  where id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID')
  group by phone;
--   EXPECT: 6 distinct phones, count=1 each.  ABORT-IF: any count>1, or fewer than 6 rows.

-- P2 roles seeded. 🟢
select name from roles where name in ('customer','driver','merchant','admin');
--   EXPECT: 4 rows.  ABORT-IF: any missing (run migration 0006 first).

-- P3 customers phone free. 🟡
select id, phone_number from customers where phone_number = '+201000000001';
--   EXPECT: 0 rows.  ABORT-IF: 1 row whose id <> CUSTOMER_UID (phone-unique collision → see Note C).

-- P4 drivers phone free. 🟡
select id, phone_number from drivers where phone_number = '+201000000003';
--   EXPECT: 0 rows.  ABORT-IF: 1 row whose id <> DRIVER_UID (phone-unique collision → see Note C).

-- P5 wallets: no existing or duplicate wallet for the demo owners. 🔴 (table has NO unique(owner_type,owner_id))
select owner_type, owner_id, count(*) from wallets
  where owner_id in ('CUSTOMER_UID','DRIVER_UID')
  group by owner_type, owner_id;
--   EXPECT: 0 rows.  ABORT-IF: any row (a wallet already exists; the PROVISION guard will skip it — confirm balance is acceptable).
select owner_type, owner_id, count(*) from wallets group by owner_type, owner_id having count(*) > 1;
--   EXPECT: 0 rows (no pre-existing duplicate wallets anywhere).  ABORT-IF: any row → de-dup separately before adding a unique index.

-- P6 user_roles: mappings not already present. 🟢
select user_id, count(*) from user_roles
  where user_id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID')
  group by user_id;
--   EXPECT: 0 rows (fresh). If present, PROVISION is a safe no-op (composite PK).

-- P7 admin_users: scoping not already present. 🟢
select user_id, scope, country_code from admin_users
  where user_id in ('SUPER_UID','EG_ADMIN_UID','SA_ADMIN_UID');
--   EXPECT: 0 rows. If present, PROVISION upserts to the values below.

-- P8 demo merchant/branch absent (confirmed via anon; reconfirm). 🟢
select id, business_name from merchants where id = 'MERCHANT_UID';
--   EXPECT: 0 rows. If present, PROVISION is a safe no-op.

-- P9 countries reference (order_country_code depends on EG/SA codes). 🟢
select code from countries where code in ('EG','SA');
--   EXPECT: EG and SA.  ABORT-IF: missing (country scoping/branch placement will fail).

-- P10 an EG zone exists for the demo branch. 🟡
select z.id from zones z join cities ci on ci.id=z.city_id join countries co on co.id=ci.country_id
  where co.code='EG' limit 1;
--   EXPECT: 1 row.  ABORT-IF: 0 rows (no EG zone → branch insert would be NULL zone_id; pick another country or seed zones).
```
**Proceed to 4B only when:** P1=6×count1, P2=4, P3=0, P4=0, P5 both=0, P9=EG+SA, P10≥1. (P6/P7/P8 non-zero are tolerated — provisioning is a no-op/upsert there.)

### ── PHASE 4B · PROVISION (idempotent inserts) ──
Every statement is re-runnable. Run as one script after 4A clears.
```sql
-- 4B.1 user_roles — 🟢 SAFE (composite PK (user_id,role_id) + on conflict do nothing)
with ids(role_key, uid) as (values
  ('customer','CUSTOMER_UID'::uuid), ('driver','DRIVER_UID'::uuid), ('merchant','MERCHANT_UID'::uuid),
  ('admin','SUPER_UID'::uuid), ('admin','EG_ADMIN_UID'::uuid), ('admin','SA_ADMIN_UID'::uuid))
insert into user_roles (user_id, role_id)
select i.uid, r.id from ids i join roles r on r.name = i.role_key
on conflict (user_id, role_id) do nothing;

-- 4B.2 admin_users — 🟢 SAFE (unique(user_id) + upsert)
insert into admin_users (user_id, email, full_name, scope, country_code) values
  ('SUPER_UID'::uuid,    'super@haatnow.com',    'Super Admin', 'super',   null),
  ('EG_ADMIN_UID'::uuid, 'eg-admin@haatnow.com', 'Egypt Admin', 'country', 'EG'),
  ('SA_ADMIN_UID'::uuid, 'sa-admin@haatnow.com', 'Saudi Admin', 'country', 'SA')
on conflict (user_id) do update
  set scope=excluded.scope, country_code=excluded.country_code,
      email=excluded.email, full_name=excluded.full_name;

-- 4B.3 customer profile (id = auth uid) — 🟡 CONDITIONAL (needs P3=0; phone is UNIQUE)
insert into customers (id, phone_number, full_name, email)
select 'CUSTOMER_UID'::uuid, '+201000000001', 'عميل تجريبي', null
where not exists (select 1 from customers where id='CUSTOMER_UID'::uuid)
  and not exists (select 1 from customers where phone_number='+201000000001');

-- 4B.4 driver profile — 🟡 CONDITIONAL (needs P4=0; phone is UNIQUE)
insert into drivers (id, phone_number, full_name, is_online)
select 'DRIVER_UID'::uuid, '+201000000003', 'كابتن تجريبي', true
where not exists (select 1 from drivers where id='DRIVER_UID'::uuid)
  and not exists (select 1 from drivers where phone_number='+201000000003');

-- 4B.5 merchant + EG branch — 🟢 SAFE (id PK no-op + where-not-exists branch guard)
insert into merchants (id, business_name)
select 'MERCHANT_UID'::uuid, 'متجر تجريبي'
where not exists (select 1 from merchants where id='MERCHANT_UID'::uuid);

insert into merchant_branches (id, merchant_id, zone_id, name, is_active)
select gen_random_uuid(), 'MERCHANT_UID'::uuid,
       (select z.id from zones z join cities ci on ci.id=z.city_id join countries co on co.id=ci.country_id
          where co.code='EG' limit 1),
       'الفرع التجريبي', true
where not exists (select 1 from merchant_branches where merchant_id='MERCHANT_UID'::uuid);

-- 4B.6 wallets — 🔴→🟢 FIXED idempotent (table has NO unique(owner_type,owner_id);
--      the old `on conflict do nothing` was a NO-OP guard → duplicates. Use where-not-exists.)
insert into wallets (owner_type, owner_id, balance)
select 'customer', 'CUSTOMER_UID'::uuid, 250.00
where not exists (select 1 from wallets where owner_type='customer' and owner_id='CUSTOMER_UID'::uuid);
insert into wallets (owner_type, owner_id, balance)
select 'driver', 'DRIVER_UID'::uuid, 80.00
where not exists (select 1 from wallets where owner_type='driver' and owner_id='DRIVER_UID'::uuid);
```
*(Optional hardening — only after P5 confirms zero existing duplicates: `create unique index if not exists idx_wallets_owner on wallets(owner_type, owner_id);` makes future duplicate wallets impossible at the DB level.)*

### ── PHASE 4C · VERIFY (read-only confirmation) ──
```sql
-- V1 role mappings (effective highest-priority role) — expect customer/merchant/driver/admin×3
select ur.user_id, (array_agg(r.name order by r.priority desc))[1] effective_role
from user_roles ur join roles r on r.id=ur.role_id
where ur.user_id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID')
group by ur.user_id;

-- V2 auth.users present — expect 6
select count(*) from auth.users where id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID');

-- V3 admin_users scoping — expect super/null, country/EG, country/SA
select user_id, scope, country_code from admin_users where user_id in ('SUPER_UID','EG_ADMIN_UID','SA_ADMIN_UID');

-- V4 profiles — expect 1,1,1,1
select 'customer' t, count(*) from customers where id='CUSTOMER_UID'
union all select 'driver',  count(*) from drivers   where id='DRIVER_UID'
union all select 'merchant',count(*) from merchants where id='MERCHANT_UID'
union all select 'branch',  count(*) from merchant_branches where merchant_id='MERCHANT_UID';

-- V5 NO duplicate wallets (the critical check) — expect EXACTLY 1 each, and 0 dup rows globally
select owner_type, owner_id, count(*) from wallets where owner_id in ('CUSTOMER_UID','DRIVER_UID') group by 1,2;
select count(*) dup_groups from (select 1 from wallets group by owner_type, owner_id having count(*)>1) d;  -- expect 0
```
**Step 4 success criteria:** V1 = correct roles; V2 = 6; V3 = correct scopes; V4 = 1/1/1/1; **V5 = exactly one wallet per owner and `dup_groups = 0`.**
**Step 4 rollback (reverse order):**
```sql
delete from wallets where owner_id in ('CUSTOMER_UID','DRIVER_UID') and owner_type in ('customer','driver');
delete from merchant_branches where merchant_id='MERCHANT_UID';
delete from merchants where id='MERCHANT_UID';
delete from drivers   where id='DRIVER_UID';
delete from customers where id='CUSTOMER_UID';
delete from admin_users where user_id in ('SUPER_UID','EG_ADMIN_UID','SA_ADMIN_UID');
delete from user_roles  where user_id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID');
```

---

## STEP 5 — Build & deploy (removes sandbox) — 🟢 SAFE
```bash
npm run build      # DEV=false → sandbox auth tree-shaken; loads .env.production (VITE_AUTH_MODE=supabase)
```
Serve `dist/` (static host / `vite preview`); **never `npm run dev`** in production. Set `VITE_AUTH_MODE=supabase` in the deploy platform env (defense-in-depth).
**Success criteria:** demo `123456` login BLOCKED for all 6; real Test-OTP login succeeds.
**Rollback:** redeploy the previous artifact.

## STEP 6 — Final success criteria (conversion complete)
- [ ] `POST /auth/v1/otp` → 200.
- [ ] All 6 roles log in on the production build via real OTP → correct portal; `localStorage` has a real `sb-…-auth-token` (JWT) and **no** `haat_sandbox_session`.
- [ ] Step 4 VERIFY (V1–V5) all pass; **V5 dup_groups = 0**.
- [ ] Egypt Admin reads only EG orders; Saudi Admin only SA; Super Admin all; no `42501`, no recursion.
- [ ] Demo `123456` rejected on the deployed build.
- ⇒ **Sandbox Auth = Removed, Real Supabase Auth = Active, zero duplicates.**

## Notes
- **Note C (phone collision, P3/P4):** if a demo phone already exists under a different id, do **not** insert a second row. Either reuse that row's id as the auth uid in Step 1, or assign a different test phone. The 4B.3/4B.4 guards prevent a duplicate but will silently skip — VERIFY V4 catching `0` tells you the profile wasn't created and needs this decision.
- **Operation risk index:** Step 2 🟢 · Step 3 🟢 · 4B.1 🟢 · 4B.2 🟢 · 4B.3 🟡 · 4B.4 🟡 · 4B.5 🟢 · 4B.6 🟢 (fixed from 🔴) · Step 5 🟢. The only items requiring a passing pre-check are the two phone-unique profiles (4B.3/4B.4) and the auth-user creation (Step 1).
- This package changes **no** application source. Sandbox removal is achieved entirely by the Step 5 production build.

> **Nothing in this document has been executed.** It is the prepared, duplicate-safe execution plan.
