# FINAL_PRODUCTION_EXECUTION_REPORT.md — HAAT NOW

Exact final SQL/execution package for production cutover, derived from **repository reality** on `feat/auth-recovery-frontend-sprint` and the verified live database state. Cutover is the only objective. All SQL below is copy-paste executable in the Supabase SQL Editor; idempotent unless noted.

---

## SECTION A — Current Database State (verified)
| Object | State | Source of truth |
|---|---|---|
| Migrations 0000–0017 | applied | given |
| Migration 0018 (admin country scoping) | **functionally applied** (functions + `admin_users` cols exist) but **not recorded** in `schema_migrations` | given |
| `auth_is_admin` / `auth_admin_scope` / `auth_admin_country` | exist (SECURITY DEFINER per 0018) | given |
| `admin_users` + `user_id/scope/country_code` | exist | given |
| `order_country_code(uuid)` | exists, **`prosecdef = false`** (SECURITY INVOKER) | repo `0018:41` (`language sql stable`, no `security definer`) |
| Migration 0019 (authenticated grants) | **applied** (core-table grants exist) | given |
| Migration 0020 (feature persistence) | **NOT applied** | given |

**Service → RPC dependency matrix (from `src/services/*.ts` `.rpc()` calls):**
| RPC | Called by | Defined in | Live now? |
|---|---|---|---|
| `complete_delivery(uuid,uuid)` | `order.service`, `wallet.service` | ≤0017 (delivery/atomicity) | ✅ exists (0019 granted execute) |
| `complete_delivery_payout(uuid,uuid,decimal)` | delivery path | ≤0017 | ✅ (0019 granted) |
| `adjust_wallet_balance(varchar,uuid,decimal,varchar)` | wallet path | 0003 | ✅ (0019 granted) |
| `adjust_product_stock(uuid,integer,varchar)` | `inventory.service` | **0020** | ❌ pending 0020 |
| `validate_coupon(varchar,varchar)` | `coupon.service` | **0020** | ❌ pending 0020 |
| `loyalty_balance(uuid)` | `loyalty.service` | **0020** | ❌ pending 0020 |
| `award_loyalty_points(uuid,integer,varchar)` | `loyalty.service` (+ delivery award) | **0020** | ❌ pending 0020 |
| `redeem_loyalty_points(uuid,integer,varchar)` | `loyalty.service` | **0020** | ❌ pending 0020 |

⇒ **Wallet + delivery RPCs are live.** Loyalty/inventory/coupon RPCs require **0020**. Only **two** schema corrections remain before provisioning: the `order_country_code` DEFINER patch (Section D) and applying 0020 (Section E).

## SECTION B — Migration 0018 Status → **SKIP re-execution; formally RECORD + apply the D patch**
- 0018's objects (`auth_is_admin/scope/country`, `admin_users` columns, RLS policies) are already live ⇒ **do not re-execute** (re-running is harmless `create or replace`/`add column if not exists`, but unnecessary).
- The **only** functional defect from 0018 is `order_country_code` being SECURITY INVOKER → fixed by **Section D** (not by re-running 0018).
- 0018 is **not recorded** in `supabase_migrations.schema_migrations`. To keep future `supabase db push`/CLI consistent (so it won't try to re-apply 0018), record it:
```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('20260614000018','admin_country_scoping')
on conflict (version) do nothing;
```
*(If you apply migrations only via the SQL Editor and never the CLI, this record step is optional but recommended.)*
- **Verdict:** skip body re-exec · apply Section D · record version.

## SECTION C — Migration 0019 Status → **fully satisfied**
0019 grants are applied. Verify completeness (expect 8 rows, each ≥ `SELECT`; orders include `INSERT,UPDATE`):
```sql
select table_name, string_agg(privilege_type,',' order by privilege_type) g
from information_schema.role_table_grants
where table_schema='public' and grantee='authenticated'
  and table_name in ('orders','order_items','wallets','notifications','customer_carts','cart_items','favorites','addresses')
group by table_name order by table_name;
```
Confirm the wallet/delivery RPC execute grants 0019 added (expect 3 rows):
```sql
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('complete_delivery','complete_delivery_payout','adjust_wallet_balance')
  and has_function_privilege('authenticated', p.oid, 'execute');
```
- **Verdict:** no action; optionally record version `20260614000019` (`name='authenticated_grants'`) via the same `schema_migrations` insert pattern.

## SECTION D — `order_country_code` Fix SQL (prosecdef false → true)
Exact repo signature `order_country_code(p_order_id uuid) returns varchar`; body unchanged from 0018, only `security definer` added (breaks the admin-`orders` RLS recursion):
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
**Verify:** `select prosecdef from pg_proc where proname='order_country_code';` → **`t`**. Then an admin `select * from orders limit 1;` must not raise `infinite recursion detected in policy for relation "orders"`.

## SECTION E — Migration 0020 Readiness
- **Tables (new):** `stock_movements` (FK `product_id → products(id) on delete cascade`), `loyalty_transactions` (FK `customer_id → customers(id) on delete cascade`).
- **Columns:** `products.{stock,low_stock_threshold,is_active}` (NOT NULL defaults 0/5/true) · `coupons.{max_uses,used_count,expires_at,country_code,is_active,created_at}` · `notifications.{is_read,created_at}`.
- **Indexes:** `idx_stock_movements_product(product_id, created_at desc)` · `idx_loyalty_customer(customer_id, created_at desc)`.
- **Constraints:** additive NOT NULL with defaults (no rewrite risk on existing rows); FKs as above; RLS enabled on both new tables + read policies.
- **RPC dependencies (all SECURITY DEFINER):** `adjust_product_stock`, `validate_coupon`, `loyalty_balance`, `award_loyalty_points`, `redeem_loyalty_points`. **Names/signatures match the service `.rpc()` calls 1:1** (validated).
- **Service-layer assumptions confirmed:** `inventory.service` selects `stock/low_stock_threshold/is_active` + reads `stock_movements`; `coupon.service` inserts the 6 coupon columns; `loyalty.service` reads `loyalty_transactions`; `notification.service` filters `is_read`. All satisfied by 0020.
- **Apply:** paste full `supabase/migrations/20260614000020_feature_persistence.sql`, Run.
- **Verify:**
```sql
select proname, prosecdef from pg_proc
where proname in ('adjust_product_stock','validate_coupon','loyalty_balance','award_loyalty_points','redeem_loyalty_points'); -- 5 rows, prosecdef=t
select table_name from information_schema.tables where table_schema='public' and table_name in ('stock_movements','loyalty_transactions'); -- 2
select count(*) from information_schema.columns where table_schema='public'
  and ((table_name='products' and column_name in ('stock','low_stock_threshold','is_active'))
   or  (table_name='coupons' and column_name in ('max_uses','used_count','expires_at','country_code','is_active','created_at'))
   or  (table_name='notifications' and column_name in ('is_read','created_at'))); -- 11
```
- **Readiness verdict:** **READY** — no conflicts; depends only on existing `products/coupons/notifications/customers`.

## SECTION F — Authentication Provisioning Plan
Dashboard only (no SQL). Prereq for Section G.
1. **Auth → Providers → Phone → Enable**; add Test OTP numbers (no SMS cost): each phone → `123456`.
2. **Auth → Users → Add user** ×6 (Phone). Capture UIDs:
   `CUSTOMER_UID +201000000001 · MERCHANT_UID +201000000002 · DRIVER_UID +201000000003 · EG_ADMIN_UID +201000000004 · SA_ADMIN_UID +966500000004 · SUPER_UID +201000000005`
3. **Verify:** `POST /auth/v1/otp {"phone":"+201000000001"}` → **200** (not `phone_provider_disabled`).

## SECTION G — RBAC Provisioning Plan
PRECHECK → PROVISION → VERIFY (idempotent). Replace the 6 UIDs from Section F.
**PRECHECK (read-only; proceed if all match):**
```sql
select phone,count(*) from auth.users where id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID') group by phone; -- 6×1
select name from roles where name in ('customer','driver','merchant','admin'); -- 4
select id from customers where phone_number='+201000000001'; -- 0
select id from drivers   where phone_number='+201000000003'; -- 0
select owner_type,owner_id,count(*) from wallets where owner_id in ('CUSTOMER_UID','DRIVER_UID') group by 1,2; -- 0
```
**PROVISION:**
```sql
with ids(role_key,uid) as (values ('customer','CUSTOMER_UID'::uuid),('driver','DRIVER_UID'::uuid),('merchant','MERCHANT_UID'::uuid),('admin','SUPER_UID'::uuid),('admin','EG_ADMIN_UID'::uuid),('admin','SA_ADMIN_UID'::uuid))
insert into user_roles (user_id, role_id) select i.uid, r.id from ids i join roles r on r.name=i.role_key on conflict (user_id, role_id) do nothing;

insert into admin_users (user_id,email,full_name,scope,country_code) values
 ('SUPER_UID'::uuid,'super@haatnow.com','Super Admin','super',null),
 ('EG_ADMIN_UID'::uuid,'eg-admin@haatnow.com','Egypt Admin','country','EG'),
 ('SA_ADMIN_UID'::uuid,'sa-admin@haatnow.com','Saudi Admin','country','SA')
on conflict (user_id) do update set scope=excluded.scope, country_code=excluded.country_code, email=excluded.email, full_name=excluded.full_name;

insert into customers (id,phone_number,full_name,email) select 'CUSTOMER_UID'::uuid,'+201000000001','عميل تجريبي',null
 where not exists (select 1 from customers where id='CUSTOMER_UID'::uuid) and not exists (select 1 from customers where phone_number='+201000000001');
insert into drivers (id,phone_number,full_name,is_online) select 'DRIVER_UID'::uuid,'+201000000003','كابتن تجريبي',true
 where not exists (select 1 from drivers where id='DRIVER_UID'::uuid) and not exists (select 1 from drivers where phone_number='+201000000003');
insert into merchants (id,business_name) select 'MERCHANT_UID'::uuid,'متجر تجريبي' where not exists (select 1 from merchants where id='MERCHANT_UID'::uuid);
insert into merchant_branches (id,merchant_id,zone_id,name,is_active)
 select gen_random_uuid(),'MERCHANT_UID'::uuid,(select z.id from zones z join cities ci on ci.id=z.city_id join countries co on co.id=ci.country_id where co.code='EG' limit 1),'الفرع التجريبي',true
 where not exists (select 1 from merchant_branches where merchant_id='MERCHANT_UID'::uuid);
insert into wallets (owner_type,owner_id,balance) select 'customer','CUSTOMER_UID'::uuid,250.00 where not exists (select 1 from wallets where owner_type='customer' and owner_id='CUSTOMER_UID'::uuid);
insert into wallets (owner_type,owner_id,balance) select 'driver','DRIVER_UID'::uuid,80.00 where not exists (select 1 from wallets where owner_type='driver' and owner_id='DRIVER_UID'::uuid);
```
**VERIFY:**
```sql
select ur.user_id,(array_agg(r.name order by r.priority desc))[1] role from user_roles ur join roles r on r.id=ur.role_id
 where ur.user_id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID') group by ur.user_id; -- customer/merchant/driver/admin×3
select user_id,scope,country_code from admin_users where user_id in ('SUPER_UID','EG_ADMIN_UID','SA_ADMIN_UID'); -- super/null, country/EG, country/SA
select count(*) dup from (select 1 from wallets group by owner_type,owner_id having count(*)>1) d; -- 0
```

## SECTION H — Exact Remaining Commands (execution order)
Run top to bottom. SQL steps are SQL Editor; auth step is dashboard.

**H1 — `order_country_code` DEFINER patch (Section D)** → verify `prosecdef=t`.

**H2 — Record 0018 (and optionally 0019) in `schema_migrations`:**
```sql
insert into supabase_migrations.schema_migrations (version, name) values
 ('20260614000018','admin_country_scoping'),
 ('20260614000019','authenticated_grants')
on conflict (version) do nothing;
```

**H3 — Apply Migration 0020** (paste full `20260614000020_feature_persistence.sql`) → run Section E verify (5 RPCs `prosecdef=t`, 2 tables, 11 cols). Then record it:
```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('20260614000020','feature_persistence') on conflict (version) do nothing;
```

**H4 — Authentication provisioning** (Section F): enable Phone provider + Test OTP, create 6 users, capture UIDs; verify `/auth/v1/otp` → 200.

**H5 — RBAC provisioning** (Section G): PRECHECK → PROVISION → VERIFY with the captured UIDs.

**H6 — Validation:** build & deploy production (`npm run build`, serve `dist/`, `VITE_AUTH_MODE=supabase`), then:
- all 6 roles log in via Test OTP → correct portal, real JWT, no `haat_sandbox_session`;
- Egypt/Saudi/Super admins see correctly-scoped orders, no `42501`/recursion;
- inventory adjust persists to `products.stock`/`stock_movements`; coupon `validate_coupon('HAAT20','EG')` returns a row; `loyalty_balance(CUSTOMER_UID)` increments after a delivered order then drops after redeem; notification drawer clears `is_read`;
- end-to-end: customer order → merchant accept → driver accept/complete → driver wallet credit + customer points + delivered notification, all in Supabase rows.

### Order-of-operations summary
| Step | Action | Type | Gate |
|---|---|---|---|
| H1 | order_country_code → DEFINER | SQL | `prosecdef=t` |
| H2 | record 0018/0019 | SQL | rows present |
| H3 | apply + record 0020 | SQL | 5 RPCs/2 tables/11 cols |
| H4 | phone provider + 6 users | Dashboard | OTP 200 |
| H5 | RBAC provision | SQL | roles/scopes verified |
| H6 | build/deploy + validate | App+SQL | all checks pass → **GO** |

> Repository reality is the source of truth: function signatures, RPC names, and the 0018/0020 DDL are taken verbatim from the branch. No feature/UI/design work; SQL is executable as written. Dashboard + SQL Editor access required (absent from the dev environment), so this is the owner's execution package.
