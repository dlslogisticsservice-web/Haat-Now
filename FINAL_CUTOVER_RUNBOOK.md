# FINAL_CUTOVER_RUNBOOK.md — HAAT NOW

The single execution package for production cutover. All **source-code blockers (C1, C2, C3, H2, H3) are resolved** (per `PRODUCTION_WIRING_REPORT.md`). This runbook closes the remaining **DB/infra blockers C4, C5, C6, H1**. Project `umwbzradvbsirsybfxfb`. **Estimated total: ~40–55 min.**

Run phases **in order**: 1 Database → 2 Authentication → 3 RBAC → 4 Validation → 5 Certification.

## Pre-flight: readiness validation (already verified — no action)
Static cross-check of the wired services against migration 0020 (Tasks 4–9):
| Subsystem | Service → DB object | Status |
|---|---|---|
| Inventory | `inventory.service` → `adjust_product_stock` RPC + `products.stock/low_stock_threshold/is_active` + `stock_movements` | ✅ names/cols match 0020 |
| Coupons | `coupon.service` → `validate_coupon` RPC + `coupons.{max_uses,used_count,expires_at,country_code,is_active}` | ✅ match |
| Loyalty | `loyalty.service` → `loyalty_balance`/`award_loyalty_points`/`redeem_loyalty_points` + `loyalty_transactions` | ✅ match |
| Notifications | `notification.service` → `notifications.is_read` (markRead/markAllRead/getUnreadCount) | ✅ match |
| Analytics | `analytics.service` → existing `orders`, `driver_earnings` (no 0020 dep) | ✅ existing tables + 0019 grants |
| RBAC | `auth.service.resolveHighestRole` → `user_roles`; `auth_is_admin/scope/country` (0018, DEFINER ✅); `order_country_code` (0018 — **INVOKER**, fixed in Phase 1) | ⚠️ needs C5 fix |
All 5 RPC names called by services match 0020 definitions exactly; all column reads match. **No source change required.**

---

# PHASE 1 — DATABASE  (~8 min)
Apply three SQL units in order. All idempotent. SQL Editor only.

### 1.1 — Migration 0019 (authenticated grants) — blocker **C4**
- **Dependencies:** existing public tables (all present). None on 0020.
- **Action:** paste the full contents of `supabase/migrations/20260614000019_authenticated_grants.sql`, Run.
- **Verification (expect 8 rows, each ≥ SELECT):**
```sql
select table_name, string_agg(privilege_type,',' order by privilege_type) g
from information_schema.role_table_grants
where table_schema='public' and grantee='authenticated'
  and table_name in ('orders','order_items','wallets','notifications','customer_carts','cart_items','favorites','addresses')
group by table_name order by table_name;
```
- **Expected result:** 8 rows; `orders/order_items` include `INSERT,UPDATE`.
- **Rollback:** `revoke all on all tables in schema public from authenticated; revoke usage on schema public from authenticated;` (re-blocks users — full revert only).

### 1.2 — `order_country_code` → SECURITY DEFINER — blocker **C5**
- **Dependencies:** migration 0018 applied (it is). Run **before** Phase 3 admin validation.
- **Action:**
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
- **Verification:** `select proname, prosecdef from pg_proc where proname='order_country_code';`
- **Expected result:** `prosecdef = t` (was `f`). Admin `select * from orders` no longer raises `infinite recursion detected in policy for relation "orders"`.
- **Rollback:** re-run migration 0018's `order_country_code` block (the `language sql stable` invoker form).

### 1.3 — Migration 0020 (feature persistence) — blocker **H1**
- **Dependencies:** existing `products`, `coupons`, `notifications`, `customers` tables. Independent of 0019/1.2.
- **Action:** paste the full contents of `supabase/migrations/20260614000020_feature_persistence.sql`, Run.
- **Verification:**
```sql
-- columns
select table_name, column_name from information_schema.columns
where table_schema='public' and
 ((table_name='products' and column_name in ('stock','low_stock_threshold','is_active'))
  or (table_name='coupons' and column_name in ('max_uses','used_count','expires_at','country_code','is_active'))
  or (table_name='notifications' and column_name in ('is_read','created_at')));
-- new tables
select table_name from information_schema.tables where table_schema='public' and table_name in ('stock_movements','loyalty_transactions');
-- RPCs present + DEFINER
select proname, prosecdef from pg_proc
where proname in ('adjust_product_stock','validate_coupon','loyalty_balance','award_loyalty_points','redeem_loyalty_points');
```
- **Expected result:** 3 product cols + 5 coupon cols + 2 notification cols; 2 new tables; 5 RPCs all `prosecdef=t`.
- **Rollback:**
```sql
drop function if exists public.adjust_product_stock(uuid,integer,varchar), public.validate_coupon(varchar,varchar),
  public.loyalty_balance(uuid), public.award_loyalty_points(uuid,integer,varchar), public.redeem_loyalty_points(uuid,integer,varchar);
drop table if exists public.stock_movements, public.loyalty_transactions;
alter table public.products add nothing; -- columns are additive; leave or drop per policy:
-- alter table public.products drop column if exists stock, drop column if exists low_stock_threshold, drop column if exists is_active;
-- alter table public.coupons drop column if exists max_uses, drop column if exists used_count, drop column if exists expires_at, drop column if exists country_code, drop column if exists is_active, drop column if exists created_at;
-- alter table public.notifications drop column if exists is_read, drop column if exists created_at;
```

**Phase 1 done when:** 1.1 (8 grants) + 1.2 (`prosecdef=t`) + 1.3 (cols/tables/RPCs) verifications all pass.

---

# PHASE 2 — AUTHENTICATION  (~12 min) — blocker **C6**
- **Dependencies:** none (dashboard). Independent of Phase 1.
1. **Auth → Providers → Phone → Enable.** Add Test OTP numbers (no SMS cost): each of the 6 phones → code `123456`.
2. **Auth → Users → Add user** ×6 (Phone). Capture each `User UID`:
```
CUSTOMER_UID  (+201000000001)   MERCHANT_UID  (+201000000002)   DRIVER_UID    (+201000000003)
EG_ADMIN_UID  (+201000000004)   SA_ADMIN_UID  (+966500000004)   SUPER_UID     (+201000000005)
```
- **Verification:** `curl -s -X POST "$URL/auth/v1/otp" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"phone":"+201000000001"}'` → **200** (not `phone_provider_disabled`).
- **Expected result:** provider Enabled; 6 users listed.
- **Rollback:** delete the 6 users; disable Phone provider.

---

# PHASE 3 — RBAC PROVISIONING  (~6 min)
Uses the duplicate-safe **PRECHECK → PROVISION → VERIFY** flow (from `REAL_AUTH_MIGRATION_PACKAGE_V2.md`). Replace the 6 UIDs from Phase 2.
- **Dependencies:** Phase 1 (0019 grants, order_country_code DEFINER), Phase 2 (auth.users exist). Roles seeded by 0006.

### 3.1 PRECHECK (read-only — proceed only if clear)
```sql
select phone,count(*) from auth.users where id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID') group by phone; -- EXPECT 6×1
select name from roles where name in ('customer','driver','merchant','admin');                        -- EXPECT 4
select id from customers where phone_number='+201000000001';                                          -- EXPECT 0
select id from drivers   where phone_number='+201000000003';                                          -- EXPECT 0
select owner_type,owner_id,count(*) from wallets where owner_id in ('CUSTOMER_UID','DRIVER_UID') group by 1,2; -- EXPECT 0
select z.id from zones z join cities ci on ci.id=z.city_id join countries co on co.id=ci.country_id where co.code='EG' limit 1; -- EXPECT 1
```

### 3.2 PROVISION (idempotent — wallets use `where not exists`)
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

### 3.3 VERIFY
```sql
select ur.user_id,(array_agg(r.name order by r.priority desc))[1] role from user_roles ur join roles r on r.id=ur.role_id
 where ur.user_id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID') group by ur.user_id; -- customer/merchant/driver/admin×3
select user_id,scope,country_code from admin_users where user_id in ('SUPER_UID','EG_ADMIN_UID','SA_ADMIN_UID'); -- super/null, country/EG, country/SA
select count(*) dup from (select 1 from wallets group by owner_type,owner_id having count(*)>1) d; -- 0
```
- **Rollback:** delete in reverse (wallets → branches → merchants → drivers → customers → admin_users → user_roles) for the 6 UIDs.

---

# PHASE 4 — VALIDATION  (~12 min)
Build & deploy production, then validate real auth + every wired feature against the real backend.
- **Build:** `npm run build` (DEV=false → sandbox stripped; loads `.env.production` `VITE_AUTH_MODE=supabase`). Serve `dist/` (never `npm run dev`).

### 4.1 Auth + RBAC
- [ ] All 6 roles log in via Test OTP → correct portal; `localStorage` has `sb-…-auth-token` (JWT), **no** `haat_sandbox_session`.
- [ ] Egypt Admin sees **EG** orders only; Saudi Admin **SA** only; Super Admin **all**; **no `42501`, no recursion**.

### 4.2 Feature validation (real services — the C1/C2/C3/H2/H3 paths)
- [ ] **Inventory** (Merchant → المخزون): products load from `products`; `+/−` adjust persists (`select stock from products where id=…`); history row appears in `stock_movements`; stock 0 → `is_active=false`.
- [ ] **Coupons** (Admin → الكوبونات): create → row in `coupons`; deactivate toggles `is_active`; `select * from validate_coupon('HAAT20','EG')` returns the row.
- [ ] **Loyalty** (Wallet): after a delivered order, `select loyalty_balance('CUSTOMER_UID')` > 0; redeem 500 → balance drops; row in `loyalty_transactions`.
- [ ] **Notifications**: open drawer → `select count(*) from notifications where target_user_id='CUSTOMER_UID' and is_read=false` → 0; badge clears.
- [ ] **Analytics**: Admin KPI revenue/avg, Merchant net revenue, Driver avg-per-trip reflect real `orders`/`driver_earnings` (not localStorage).

### 4.3 End-to-end workflow
- [ ] Customer place order → Merchant accept → Driver accept → Driver complete → wallet credited (driver) + points awarded (customer) + delivered notification — all visible in Supabase rows.

---

# PHASE 5 — PRODUCTION CERTIFICATION
Mark GO only when every box is checked.

| Blocker | Closed by | Check |
|---|---|---|
| C4 grants | Phase 1.1 | ☐ 8 grant rows |
| C5 recursion | Phase 1.2 | ☐ `prosecdef=t`, no recursion |
| C6 auth | Phase 2 | ☐ provider on, 6 users, OTP 200 |
| H1 schema | Phase 1.3 | ☐ cols/tables/5 RPCs |
| RBAC | Phase 3 | ☐ roles+scopes verified |
| Inventory/Coupons/Loyalty/Notif/Analytics | Phase 4.2 | ☐ all persist to real DB |
| Workflow | Phase 4.3 | ☐ full lifecycle on real data |
| Sandbox absent in prod | Phase 4 build | ☐ demo `123456` rejected; bundle has no `DEMO_ACCOUNTS` |

**Decision:** all checked ⇒ **PRODUCTION READY = YES → GO.** Any unchecked ⇒ NO-GO; fix and re-run that phase.

## Execution summary
| Phase | Action | Time |
|---|---|---|
| 1 | DB: 0019 + order_country_code DEFINER + 0020 | ~8 min |
| 2 | Auth: provider + Test OTP + 6 users | ~12 min |
| 3 | RBAC: precheck → provision → verify | ~6 min |
| 4 | Build/deploy + auth/feature/workflow validation | ~12 min |
| 5 | Certification sign-off | ~5 min |
| **Total** | | **~40–55 min** |

> No implementation, no audit, no source change in this sprint — execution package only. Dependencies, order, rollback, verification, and expected results are specified per migration. Requires Supabase dashboard + SQL Editor (absent from the dev environment), so it is handed to the project owner to run.
