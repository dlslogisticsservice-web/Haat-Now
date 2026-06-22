# EXECUTION_RUNBOOK.md — HAAT NOW Production Recovery Cutover

Certified package (`FINAL_EXECUTION_CERTIFICATION.md` → all H1–H6 PASS). Execute steps **in order**. SQL steps = Supabase SQL Editor (project `umwbzradvbsirsybfxfb` / haat-now-dev); Step 4 = dashboard. **Est. ~45–60 min.** Each step has verification queries, expected PASS, and rollback.

> Apply order rationale: `0022` (DEFINER) → `0021` (RLS) → `0020` (features) → Auth → RBAC → Validate. `0021` self-asserts the DEFINER fix, so 0022/0021 order is also safe under `db push`. Do not run admin order queries between steps until both `0022` and `0021` are applied.

---

## STEP 1 — Apply `20260614000022_order_country_code_fix.sql`
Converts `order_country_code` to `SECURITY DEFINER` (fixes `prosecdef=false` + RLS recursion).
**Action:** paste the full file, Run.
**Verification:**
```sql
select proname, prosecdef from pg_proc where proname = 'order_country_code';
```
**Expected PASS:** one row, `prosecdef = t`.
**Secondary (no recursion — run after Step 2 + a provisioned admin exists):** an admin `select * from orders limit 1;` returns without `infinite recursion detected in policy for relation "orders"`.
**Rollback:** re-apply migration 0018's invoker form:
```sql
create or replace function public.order_country_code(p_order_id uuid) returns varchar
  language sql stable set search_path = public as $$
  select co.code from orders o join merchant_branches mb on mb.id=o.branch_id
  join zones z on z.id=mb.zone_id join cities ci on ci.id=z.city_id
  join countries co on co.id=ci.country_id where o.id=p_order_id; $$;
```

---

## STEP 2 — Apply `20260614000021_rls_recovery.sql`
Creates the 39 missing RLS policies (owner/role/admin/reference) + recovers 0018 admin scoping. Self-asserts the DEFINER fix at its top.
**Action:** paste the full file, Run.
**Verification A — every locked table now has ≥1 policy:**
```sql
select tablename, count(*) n from pg_policies where schemaname='public'
 and tablename in ('orders','order_items','wallets','wallet_transactions','notifications',
 'reviews','favorites','drivers','driver_locations','subscriptions','coupons','coupon_usages',
 'countries','cities','memberships','permissions','role_permissions','settings','admin_users',
 'audit_logs','webhook_events')
group by tablename order by tablename;
```
**Expected PASS:** 21 rows, every `n ≥ 1` (orders = 8; admin_users = 1; coupons = 2).
**Verification B — admin scoping + count present:**
```sql
select policyname from pg_policies where schemaname='public' and tablename='orders' order by 1;          -- includes 'Admins read orders by scope'
select count(*) total from pg_policies where schemaname='public';                                        -- expect 41 + 39 ≈ 80 (was 41)
```
**Expected PASS:** `Admins read orders by scope` present; total policies increased by 39.
**Verification C — owner isolation (post-RBAC, behavioral):** a logged-in customer sees only `customer_id = auth.uid()` orders; driver only assigned; wallet/notifications/reviews owner-only.
**Rollback (removes only this migration's policies):**
```sql
-- drop each policy created by 0021 (names are unique); example:
drop policy if exists "Customers read own orders" on public.orders;
-- …repeat the `drop policy if exists "<name>" on public.<table>;` for all 39 names in the file…
-- (the file's own `drop policy if exists` lines enumerate every name to drop.)
```
*Note:* dropping returns those tables to RLS-on/0-policy (locked) — only roll back if Step 3+ fails and you are aborting the whole cutover.

---

## STEP 3 — Apply `20260614000020_feature_persistence.sql`
Adds inventory/coupon/loyalty/notification persistence (tables, columns, 5 RPCs).
**Action:** paste the full file, Run.
**Verification:**
```sql
select proname, prosecdef from pg_proc
 where proname in ('adjust_product_stock','validate_coupon','loyalty_balance','award_loyalty_points','redeem_loyalty_points'); -- 5 rows, prosecdef=t
select table_name from information_schema.tables where table_schema='public'
 and table_name in ('stock_movements','loyalty_transactions');                                            -- 2 rows
select count(*) cols from information_schema.columns where table_schema='public'
 and ((table_name='products' and column_name in ('stock','low_stock_threshold','is_active'))
   or (table_name='coupons' and column_name in ('max_uses','used_count','expires_at','country_code'))
   or (table_name='notifications' and column_name in ('is_read','created_at')));                          -- expect 9
```
**Expected PASS:** 5 RPCs `prosecdef=t`; 2 new tables; 9 columns (products 3 + coupons 4 new + notifications 2; `coupons.is_active`/`created_at` may pre-exist).
**Rollback:**
```sql
drop function if exists public.adjust_product_stock(uuid,integer,varchar), public.validate_coupon(varchar,varchar),
  public.loyalty_balance(uuid), public.award_loyalty_points(uuid,integer,varchar), public.redeem_loyalty_points(uuid,integer,varchar);
drop table if exists public.stock_movements, public.loyalty_transactions;
-- columns are additive (safe to leave); to fully revert:
-- alter table public.products drop column if exists stock, drop column if exists low_stock_threshold, drop column if exists is_active;
-- alter table public.coupons drop column if exists max_uses, drop column if exists used_count, drop column if exists expires_at, drop column if exists country_code;
-- alter table public.notifications drop column if exists is_read;
```

### Record the migration ledger (after Steps 1–3)
```sql
insert into supabase_migrations.schema_migrations (version, name) values
 ('20260614000018','admin_country_scoping'),('20260614000019','authenticated_grants'),
 ('20260614000020','feature_persistence'),('20260614000021','rls_recovery'),
 ('20260614000022','order_country_code_fix')
on conflict (version) do nothing;
```
**Verify:** `select version from supabase_migrations.schema_migrations where version >= '20260614000018' order by 1;` → 5 rows.

---

## STEP 4 — Enable Real Authentication (dashboard)
**Action:** Auth → Providers → **Phone → Enable**; add Test OTP for the 6 demo phones (`+201000000001/2/3/4`, `+966500000004`, `+201000000005`) → code `123456`.
**Verification checklist:**
- [ ] `GET /v1/projects/umwbzradvbsirsybfxfb/config/auth` → `external_phone_enabled: true`.
- [ ] `curl -X POST .../auth/v1/otp -d '{"phone":"+201000000001"}'` → **HTTP 200** (not `phone_provider_disabled`).
**Rollback:** Auth → Providers → Phone → Disable; remove Test OTP numbers.

---

## STEP 5 — Provision RBAC (SQL Editor)
Create the 6 `auth.users` (Auth → Users → Add user, Phone), capture UIDs, then run the idempotent provisioning.
**PRECHECK (read-only; proceed only if clear):**
```sql
select phone,count(*) from auth.users where id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID') group by phone; -- 6×1
select name from roles where name in ('customer','driver','merchant','admin');  -- 4
select id from customers where phone_number='+201000000001';                    -- 0
select id from drivers   where phone_number='+201000000003';                    -- 0
select owner_type,owner_id,count(*) from wallets where owner_id in ('CUSTOMER_UID','DRIVER_UID') group by 1,2; -- 0
```
**PROVISION** (from `PRODUCTION_RECOVERY_EXECUTION_PLAN.md` H6 / `FINAL_CUTOVER_RUNBOOK.md` Phase 3 — `user_roles` `on conflict (user_id,role_id) do nothing`; `admin_users` upsert; customer/driver/merchant/branch + wallets via `where not exists`). Replace the 6 `*_UID` tokens.
**Verification checklist:**
```sql
select ur.user_id,(array_agg(r.name order by r.priority desc))[1] role from user_roles ur join roles r on r.id=ur.role_id
 where ur.user_id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID') group by ur.user_id; -- customer/merchant/driver/admin×3
select user_id,scope,country_code from admin_users where user_id in ('SUPER_UID','EG_ADMIN_UID','SA_ADMIN_UID'); -- super/null, country/EG, country/SA
select count(*) dup from (select 1 from wallets group by owner_type,owner_id having count(*)>1) d; -- 0
```
**Expected PASS:** roles correct; scopes super/null, country/EG, country/SA; `dup=0`.
**Rollback (reverse order, for the 6 UIDs):**
```sql
delete from wallets where owner_id in ('CUSTOMER_UID','DRIVER_UID') and owner_type in ('customer','driver');
delete from merchant_branches where merchant_id='MERCHANT_UID';
delete from merchants where id='MERCHANT_UID';
delete from drivers   where id='DRIVER_UID';
delete from customers where id='CUSTOMER_UID';
delete from admin_users where user_id in ('SUPER_UID','EG_ADMIN_UID','SA_ADMIN_UID');
delete from user_roles  where user_id in ('CUSTOMER_UID','MERCHANT_UID','DRIVER_UID','EG_ADMIN_UID','SA_ADMIN_UID','SUPER_UID');
-- then delete the 6 users in Auth → Users.
```

---

## STEP 6 — Production Validation
Build & deploy production: `npm run build` (DEV=false → sandbox stripped; `.env.production` `VITE_AUTH_MODE=supabase`); serve `dist/` (never `npm run dev`).
**Verification checklist:**
- **Auth/RBAC**
  - [ ] All 6 roles log in via Test OTP → correct portal; `localStorage` has `sb-…-auth-token` (JWT), **no** `haat_sandbox_session`.
  - [ ] Egypt Admin sees only EG orders; Saudi Admin only SA; Super Admin all; **no `42501`, no recursion**.
- **RLS owner isolation (SQL spot-check as a role's JWT, or behavioral in UI)**
  - [ ] Customer reads only own orders/wallet/notifications; cannot read another customer's.
  - [ ] Driver sees only assigned orders; merchant only branch orders.
- **Feature paths (real services on real tables)**
  - [ ] Inventory: merchant stock `+/−` persists to `products.stock`; row appears in `stock_movements`; stock 0 → `is_active=false`.
  - [ ] Coupons: admin create → row in `coupons`; `select * from validate_coupon('HAAT20','EG')` returns it; deactivate toggles `is_active`.
  - [ ] Loyalty: after a delivered order `select loyalty_balance('CUSTOMER_UID')` > 0; redeem 500 → drops; row in `loyalty_transactions`.
  - [ ] Notifications: open drawer → `select count(*) from notifications where target_user_id='CUSTOMER_UID' and is_read=false` → 0.
  - [ ] Analytics: Admin KPI / Merchant revenue / Driver avg reflect real `orders`/`driver_earnings`.
- **End-to-end:** customer order → merchant accept → driver accept/complete → driver wallet credited + customer points awarded + delivered notification — all visible in Supabase rows.
- **Sandbox absent in prod:** a non-provisioned phone + `123456` is **rejected**; built bundle contains no `DEMO_ACCOUNTS`.
**Rollback (whole cutover):** redeploy the previous build artifact; run Steps 5→1 rollbacks in reverse only if fully aborting.

---

## Go / No-Go
| Step | PASS gate |
|---|---|
| 1 order_country_code | `prosecdef=t` |
| 2 RLS recovery | 21 tables ≥1 policy; admin-orders policy present |
| 3 migration 0020 | 5 RPCs + 2 tables + 9 cols |
| 4 real auth | OTP → 200 |
| 5 RBAC | roles + scopes verified; `dup=0` |
| 6 validation | all auth/RLS/feature/workflow checks pass; sandbox absent |

**Production Ready = YES** only when Steps 1–6 all PASS. This runbook executes **no** SQL and modifies **no** Supabase — it is the execution package for the project owner.
