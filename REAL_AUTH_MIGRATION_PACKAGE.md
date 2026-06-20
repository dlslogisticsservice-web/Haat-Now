# REAL_AUTH_MIGRATION_PACKAGE.md — HAAT NOW

Executable package to convert **Sandbox Auth → Real Supabase Auth**. Run the steps in order. Every SQL block is schema-verified against the live migrations (no placeholders except the 6 UUIDs you capture in Step 1). Project: `umwbzradvbsirsybfxfb`.

> **Goal:** Sandbox Auth = Removed (production), Real Supabase Auth = Active for Customer / Merchant / Driver / Egypt Admin / Saudi Admin / Super Admin.

---

## 0. Current state (verified)
- `123456` works **only** in dev/sandbox builds; a **production build already strips all sandbox auth** (`IS_SANDBOX = VITE_AUTH_MODE==='sandbox' && import.meta.env.DEV` → `false` in `vite build`; `DEMO_ACCOUNTS`/`SANDBOX_OTP` tree-shaken; demo logins 0/6 — proven).
- Real auth is currently **inactive**: `POST /auth/v1/otp` → `phone_provider_disabled`.
- ⇒ "Remove sandbox" = **deploy a production build** (Step 5). "Activate real auth" = **Steps 1–4**.

## 1. Sandbox dependency inventory (complete)
**Auth core — `src/services/auth.service.ts`:** `IS_SANDBOX` (L14), `SANDBOX_OTP='123456'` (L16), `SANDBOX_SESSION_KEY='haat_sandbox_session'` (L17), `DEMO_ACCOUNTS` (L22), `readSandboxSession`, and 6 `if (IS_SANDBOX)` branches in `sendOtp`/`verifyOtp`/`getCurrentUser`/`getAccessToken`/`subscribeToAuthChanges`/`signOut` (L59,73,103,113,123,133). **The real Supabase path is the `else` of each — already implemented.**

**Shared sandbox backend — `src/services/sandboxStore.ts`:** localStorage keys `haat_sb_orders` / `haat_sb_wallets` / `haat_sb_notifs` / `haat_sb_seq`.

**UI consumers (each gated on `import.meta.env.VITE_AUTH_MODE === 'sandbox'`, real path is the `else`):**
| File | Sandbox lines |
|---|---|
| `features/driver/DriverApp.tsx` | L32, 109–111, 164–165, 180–181 |
| `features/merchant/MerchantApp.tsx` | L86, 183, 232–233 |
| `features/admin/AdminDashboard.tsx` | L68–69 |
| `features/orders/OrdersList.tsx` | L189–190 |
| `features/checkout/CheckoutPage.tsx` | L11, 293 |
| `features/wallet/WalletScreen.tsx` | L90–93 |
| `features/auth/LoginScreen.tsx` | L363 (the `123456` hint, sandbox-only) |

**Disposition:** every one of these is gated so that in a production build (`DEV=false` for auth; `VITE_AUTH_MODE=supabase` for UI) the sandbox branch is statically dead and the **real service path executes**. No code edits are required to "remove" sandbox — Step 5 does it at build time. (Optional hard-removal is in Appendix B.)

## 2. Execution order (overview)
1. **Step 1 — Dashboard:** enable Phone provider + Test OTP, create 6 `auth.users`, capture UUIDs.
2. **Step 2 — SQL:** apply migration `0019` (authenticated grants).
3. **Step 3 — SQL:** recreate `order_country_code` as `SECURITY DEFINER`.
4. **Step 4 — SQL:** provision `user_roles` + `admin_users` + profile + wallet rows.
5. **Step 5 — Build/Deploy:** ship a production build (sandbox removed) with `VITE_AUTH_MODE=supabase`.
6. **Step 6 — Verify:** real login for all 6 roles + RBAC/country checks.

The 6 canonical accounts:
| Role | Phone (E.164) | Country | admin scope |
|---|---|---|---|
| Customer | `+201000000001` | EG | — |
| Merchant | `+201000000002` | EG | — |
| Driver | `+201000000003` | EG | — |
| Egypt Admin | `+201000000004` | EG | `country` |
| Saudi Admin | `+966500000004` | SA | `country` |
| Super Admin | `+201000000005` | — | `super` |

---

## STEP 1 — Dashboard: Phone provider + Test OTP + create users
**Actions (Authentication section):**
1. **Providers → Phone → Enable.** (For paid SMS: configure Twilio/MessageBird. For testing without SMS cost: expand **Test phone numbers / Test OTP** and add each phone above mapped to code `123456`.)
2. **(Optional) Providers → Phone → "Confirm phone" ON** if you require confirmation; Test OTP numbers bypass real SMS.
3. **Users → Add user** ×6 — one per phone above (type = Phone). For each created user, **copy its UUID** (`auth.users.id`).

**Success criteria:** `POST https://umwbzradvbsirsybfxfb.supabase.co/auth/v1/otp` with `{"phone":"+201000000001"}` returns **200** (not `phone_provider_disabled`). 6 users visible under Authentication → Users.

**Rollback:** Providers → Phone → Disable; delete the 6 users.

Record the UUIDs here before continuing:
```
CUSTOMER_UID   = ____________________________________
MERCHANT_UID   = ____________________________________
DRIVER_UID     = ____________________________________
EG_ADMIN_UID   = ____________________________________
SA_ADMIN_UID   = ____________________________________
SUPER_UID      = ____________________________________
```

## STEP 2 — SQL: apply migration 0019 (authenticated grants)
PostgREST checks table GRANTs **before** RLS; without these, every logged-in user gets `42501`.

**Action:** open `supabase/migrations/20260614000019_authenticated_grants.sql`, paste its **entire contents** into the SQL Editor, Run. (Idempotent.)

**Verification (expect 8 rows, each ≥ `SELECT`):**
```sql
select table_name, string_agg(privilege_type,',' order by privilege_type) grants
from information_schema.role_table_grants
where table_schema='public' and grantee='authenticated'
  and table_name in ('orders','order_items','wallets','notifications','customer_carts','cart_items','favorites','addresses')
group by table_name order by table_name;
```
**Success criteria:** 8 rows returned; `orders`/`order_items` include `INSERT,UPDATE`; `wallets`/`notifications` present.
**Rollback:** `revoke all on all tables in schema public from authenticated; revoke usage on schema public from authenticated;` (returns to pre-0019; note this re-blocks real users).

## STEP 3 — SQL: fix `order_country_code` (SECURITY DEFINER)
Currently `SECURITY INVOKER` → `42501` + infinite recursion in the admin `orders` policy. Only change is `security definer` (join chain already correct: branch→zone→city→country).
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
**Verification:**
```sql
select proname, prosecdef from pg_proc where proname='order_country_code';  -- prosecdef must be TRUE
```
**Success criteria:** `prosecdef = true`; an admin `select * from orders` no longer errors with `infinite recursion detected in policy for relation "orders"`.
**Rollback:** re-run migration 0018's `order_country_code` block (the `security invoker` version).

## STEP 4 — SQL: provision roles, admins, profiles, wallets
Replace the 6 `PASTE_*` UUIDs from Step 1, then run as one script. Profile PK = `auth.users.id` (required for RLS ownership). Idempotent.
```sql
-- 4a. Role assignments (user_roles) — resolveHighestRole() reads these
with ids(role_key, uid) as (values
  ('customer','PASTE_CUSTOMER_UID'::uuid),
  ('driver',  'PASTE_DRIVER_UID'::uuid),
  ('merchant','PASTE_MERCHANT_UID'::uuid),
  ('admin',   'PASTE_SUPER_UID'::uuid),
  ('admin',   'PASTE_EG_ADMIN_UID'::uuid),
  ('admin',   'PASTE_SA_ADMIN_UID'::uuid))
insert into user_roles (user_id, role_id)
select i.uid, r.id from ids i join roles r on r.name = i.role_key
on conflict do nothing;

-- 4b. Admin scoping (admin_users)
insert into admin_users (user_id, email, full_name, scope, country_code) values
  ('PASTE_SUPER_UID'::uuid,    'super@haatnow.com',    'Super Admin', 'super',   null),
  ('PASTE_EG_ADMIN_UID'::uuid, 'eg-admin@haatnow.com', 'Egypt Admin', 'country', 'EG'),
  ('PASTE_SA_ADMIN_UID'::uuid, 'sa-admin@haatnow.com', 'Saudi Admin', 'country', 'SA')
on conflict (user_id) do update
  set scope=excluded.scope, country_code=excluded.country_code,
      email=excluded.email, full_name=excluded.full_name;

-- 4c. Customer profile (id = auth uid)
insert into customers (id, phone_number, full_name, email)
values ('PASTE_CUSTOMER_UID'::uuid, '+201000000001', 'عميل تجريبي', null)
on conflict (id) do nothing;

-- 4d. Driver profile
insert into drivers (id, phone_number, full_name, is_online)
values ('PASTE_DRIVER_UID'::uuid, '+201000000003', 'كابتن تجريبي', true)
on conflict (id) do nothing;

-- 4e. Merchant + an EG branch (zone must chain to country code 'EG' so Egypt Admin sees its orders)
insert into merchants (id, business_name)
values ('PASTE_MERCHANT_UID'::uuid, 'متجر تجريبي')
on conflict (id) do nothing;

insert into merchant_branches (id, merchant_id, zone_id, name, is_active)
select gen_random_uuid(), 'PASTE_MERCHANT_UID'::uuid,
       (select z.id from zones z
          join cities ci on ci.id = z.city_id
          join countries co on co.id = ci.country_id
          where co.code = 'EG' limit 1),
       'الفرع التجريبي', true
where not exists (select 1 from merchant_branches where merchant_id='PASTE_MERCHANT_UID'::uuid);

-- 4f. Wallets (so wallet screens have data)
insert into wallets (owner_type, owner_id, balance) values
  ('customer','PASTE_CUSTOMER_UID'::uuid, 250.00),
  ('driver',  'PASTE_DRIVER_UID'::uuid,    80.00)
on conflict do nothing;
```
**Success criteria:** all verification queries in §6 return the expected rows.
**Rollback:** `delete from user_roles where user_id in (<6 uids>); delete from admin_users where user_id in (<3 admin uids>); delete from wallets where owner_id in (<customer,driver>); delete from merchant_branches where merchant_id='<merchant>'; delete from merchants/drivers/customers where id='<uid>';`

## STEP 5 — Build & deploy (removes sandbox)
```bash
npm run build        # vite build → DEV=false → sandbox auth tree-shaken; loads .env.production (VITE_AUTH_MODE=supabase)
```
Serve `dist/` (a static host / `vite preview`) — **never `npm run dev`** in production. On your deploy platform (Vercel/Netlify/etc.) set env **`VITE_AUTH_MODE=supabase`** as defense-in-depth.
**Success criteria:** on the deployed build, demo `123456` login = **BLOCKED** for all 6 (sandbox removed); real Test-OTP login = **succeeds**.
**Rollback:** redeploy the previous artifact (sandbox returns only in a dev build).

---

## 6. Verification queries (role mappings, auth.users, user_roles, admin_users, profiles)
Run after Step 4. Replace UIDs.
```sql
-- (7) Role mappings — each user → highest-priority role name
select ur.user_id, max(r.priority) pr,
       (array_agg(r.name order by r.priority desc))[1] effective_role
from user_roles ur join roles r on r.id = ur.role_id
where ur.user_id in ('PASTE_CUSTOMER_UID','PASTE_MERCHANT_UID','PASTE_DRIVER_UID','PASTE_EG_ADMIN_UID','PASTE_SA_ADMIN_UID','PASTE_SUPER_UID')
group by ur.user_id;
-- expect: customer→customer, merchant→merchant, driver→driver, the 3 admins→admin

-- (8) auth.users present (provider created them)
select id, phone, created_at from auth.users
where id in ('PASTE_CUSTOMER_UID','PASTE_MERCHANT_UID','PASTE_DRIVER_UID','PASTE_EG_ADMIN_UID','PASTE_SA_ADMIN_UID','PASTE_SUPER_UID');
-- expect: 6 rows

-- (9) user_roles present
select count(*) from user_roles where user_id in (<6 uids>);   -- expect ≥ 6

-- (10) admin_users scoping
select user_id, scope, country_code from admin_users
where user_id in ('PASTE_SUPER_UID','PASTE_EG_ADMIN_UID','PASTE_SA_ADMIN_UID');
-- expect: super/null, country/EG, country/SA

-- (11) profile tables
select 'customer' t, count(*) from customers where id='PASTE_CUSTOMER_UID'
union all select 'driver',  count(*) from drivers   where id='PASTE_DRIVER_UID'
union all select 'merchant',count(*) from merchants where id='PASTE_MERCHANT_UID'
union all select 'branch',  count(*) from merchant_branches where merchant_id='PASTE_MERCHANT_UID';
-- expect: 1,1,1,≥1

-- countries sanity (order_country_code depends on EG/SA codes existing)
select code, count(*) from countries where code in ('EG','SA') group by code;  -- expect EG, SA
```

## 7. Final success criteria (conversion complete)
- [ ] `POST /auth/v1/otp` → 200 (phone provider live).
- [ ] All 6 roles log in on the **production build** using real OTP (Test OTP `123456` if configured) → land in the correct portal; `localStorage` has a real `sb-…-auth-token` (JWT), **no** `haat_sandbox_session`.
- [ ] §6 queries (7)–(11) all pass.
- [ ] Egypt Admin reads only EG orders; Saudi Admin only SA; Super Admin all; no `42501`, no recursion.
- [ ] Demo `123456` is **rejected** on the deployed build (sandbox removed).
- ⇒ **Sandbox Auth = Removed, Real Supabase Auth = Active.**

## Appendix A — full rollback (revert to sandbox for local dev)
No DB rollback needed for local dev: run `npm run dev` (DEV=true) → `IS_SANDBOX` true → `123456` works again. The DB rows added above are harmless to sandbox (which ignores Supabase). To fully revert the DB, run each step's Rollback in reverse order (4→3→2→1).

## Appendix B — optional hard-removal of sandbox source (not required)
Step 5 already removes sandbox from production bundles. Only if you want it gone from source entirely (this **breaks local demos**): delete `src/services/sandboxStore.ts`; delete `DEMO_ACCOUNTS`/`SANDBOX_OTP`/`readSandboxSession`/the 6 `if (IS_SANDBOX)` branches in `auth.service.ts`; remove the `import.meta.env.VITE_AUTH_MODE === 'sandbox'` branches in the 7 UI files listed in §1; delete the `LoginScreen.tsx` L363 hint. Then `npm run build` must still pass. **Recommended: keep the gated code** — it is inert in production and preserves the dev demo workflow.
