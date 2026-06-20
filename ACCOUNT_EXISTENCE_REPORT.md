# ACCOUNT_EXISTENCE_REPORT.md — HAAT NOW

Read-only existence check for the 6 canonical accounts before running `REAL_AUTH_MIGRATION_PACKAGE_V2.md`. **No database changes.** Project `umwbzradvbsirsybfxfb`.

## What is verifiable from this environment (anon key only)
| Table | Anon access | Existence verifiable here? |
|---|---|---|
| `auth.users` | `/auth/v1/admin/users` → **401**; not REST-exposed (**404**) | ❌ No (needs service-role / dashboard) |
| `customers` (by phone) | **401** (RLS) | ❌ No |
| `drivers` (by phone) | **401** (RLS) | ❌ No |
| `admin_users` | **401** (RLS) | ❌ No |
| `user_roles` | **401** (RLS) | ❌ No |
| `merchants` | **200** (anon-readable) | ✅ **Yes** |

⇒ For 5 of the 6 tables, existence is **UNVERIFIABLE here** and is marked `NO*` — **strong inference, not proof** (see basis below). Only the merchant profile is confirmable. The read-only SQL in §3 returns the definitive YES/NO from the SQL Editor.

**Basis for the `NO*` inference (high confidence):** (a) Phone provider is **disabled** → no phone signup has ever succeeded → `auth.users` cannot contain rows for these phones → nothing can be keyed to them in `user_roles`/`admin_users`/`customers`/`drivers`. (b) `seed_demo_accounts.sql` requires pre-existing `auth.users` and was therefore never run. (c) The demo merchant `متجر تجريبي` is **confirmed absent** (0 rows among the 5 anon-readable merchants), consistent with no demo provisioning having occurred.

## 1. Per-account result
Legend: `YES` confirmed present · `NO` confirmed absent · `NO*` absent by inference (RLS-hidden, confirm via §3) · `n/a` not applicable to this role.

### Account 1 — Customer · `+201000000001` · country EG
- **EXISTS = NO\***
- Auth User: `NO*` (auth.users unreadable; provider disabled) · Profile Record (`customers`): `NO*` · Role Mapping (`user_roles`→customer): `NO*` · Admin Mapping: `n/a` · Country Mapping: EG (assigned at provisioning)
- **Final Result: CREATE NEW ACCOUNT** *(confirm via §3 Q-CUST/Q-AUTH)*

### Account 2 — Merchant · `+201000000002` · country EG
- **EXISTS = NO** (merchant profile confirmed absent)
- Auth User: `NO*` · Profile Record (`merchants` `متجر تجريبي`): **`NO` (confirmed, 0 rows)** · Role Mapping (→merchant): `NO*` · Admin Mapping: `n/a` · Country Mapping: EG (via branch zone)
- **Final Result: CREATE NEW ACCOUNT**

### Account 3 — Driver · `+201000000003` · country EG
- **EXISTS = NO\***
- Auth User: `NO*` · Profile Record (`drivers`): `NO*` · Role Mapping (→driver): `NO*` · Admin Mapping: `n/a` · Country Mapping: EG
- **Final Result: CREATE NEW ACCOUNT** *(confirm via §3 Q-DRV/Q-AUTH)*

### Account 4 — Egypt Admin · `+201000000004` · country EG
- **EXISTS = NO\***
- Auth User: `NO*` · Profile Record: `n/a` (admins have no customer/driver/merchant profile) · Role Mapping (→admin): `NO*` · Admin Mapping (`admin_users` scope=country, EG): `NO*` · Country Mapping: EG
- **Final Result: CREATE NEW ACCOUNT** *(confirm via §3 Q-ADMIN/Q-AUTH)*

### Account 5 — Saudi Admin · `+966500000004` · country SA
- **EXISTS = NO\***
- Auth User: `NO*` · Profile Record: `n/a` · Role Mapping (→admin): `NO*` · Admin Mapping (scope=country, SA): `NO*` · Country Mapping: SA
- **Final Result: CREATE NEW ACCOUNT** *(confirm via §3 Q-ADMIN/Q-AUTH)*

### Account 6 — Super Admin · `+201000000005` · scope super
- **EXISTS = NO\***
- Auth User: `NO*` · Profile Record: `n/a` · Role Mapping (→admin): `NO*` · Admin Mapping (scope=super, country null): `NO*` · Country Mapping: none (global)
- **Final Result: CREATE NEW ACCOUNT** *(confirm via §3 Q-ADMIN/Q-AUTH)*

## 2. Summary
| # | Phone | Role | Auth | Profile | Role Map | Admin Map | Country | EXISTS | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | +201000000001 | Customer | NO* | NO* | NO* | n/a | EG | NO* | CREATE NEW |
| 2 | +201000000002 | Merchant | NO* | **NO** | NO* | n/a | EG | **NO** | CREATE NEW |
| 3 | +201000000003 | Driver | NO* | NO* | NO* | n/a | EG | NO* | CREATE NEW |
| 4 | +201000000004 | Egypt Admin | NO* | n/a | NO* | NO* | EG | NO* | CREATE NEW |
| 5 | +966500000004 | Saudi Admin | NO* | n/a | NO* | NO* | SA | NO* | CREATE NEW |
| 6 | +201000000005 | Super Admin | NO* | n/a | NO* | NO* | — | NO* | CREATE NEW |

**Provisional determination: CREATE NEW for all 6.** No `REUSE EXISTING` indicated. One item is confirmed (merchant profile absent); the other five tables are RLS-hidden and the `NO*` must be confirmed with the queries below before provisioning.

## 3. Definitive confirmation (run read-only in SQL Editor — changes nothing)
If every query returns **0 rows**, all six are `CREATE NEW` (confirmed). Any non-zero row → that account is `REUSE EXISTING` for that table; reuse its id/uid instead of inserting.
```sql
-- Q-AUTH: do these phones already exist as auth users?
select id, phone from auth.users
where phone in ('+201000000001','+201000000002','+201000000003','+201000000004','+966500000004','+201000000005');

-- Q-CUST: customer profile by phone
select id, phone_number from customers where phone_number = '+201000000001';

-- Q-DRV: driver profile by phone
select id, phone_number from drivers where phone_number = '+201000000003';

-- Q-MERCH: demo merchant profile (already confirmed absent via anon; reconfirm)
select id, business_name from merchants where business_name = 'متجر تجريبي';

-- Q-ROLE: any role mappings for these auth uids (substitute the uids from Q-AUTH if any returned)
select ur.user_id, r.name from user_roles ur join roles r on r.id = ur.role_id
where ur.user_id in (select id from auth.users where phone in
  ('+201000000001','+201000000002','+201000000003','+201000000004','+966500000004','+201000000005'));

-- Q-ADMIN: any admin scoping for the 3 admin phones
select au.user_id, au.scope, au.country_code from admin_users au
where au.user_id in (select id from auth.users where phone in
  ('+201000000004','+966500000004','+201000000005'));
```
**Decision rule:**
- Q-AUTH returns 0 rows → no auth users exist → **CREATE NEW** (and Q-ROLE/Q-ADMIN are necessarily empty).
- Q-AUTH returns a row for a phone → that auth user exists → **REUSE** its uid in Step 1/Step 4 (do not create a second). Then check Q-CUST/Q-DRV/Q-ROLE/Q-ADMIN to see which downstream rows already exist (skip those inserts; V2's guards make this safe).

## 4. Cross-reference to migration package
- These results align with `REAL_AUTH_MIGRATION_PACKAGE_V2.md` **PRECHECK** P1 (auth.users), P3 (customers), P4 (drivers), P6 (user_roles), P7 (admin_users), P8 (merchant). Running §3 here = running that PRECHECK; if all clear, Step 4 PROVISION proceeds as `CREATE NEW`.
- No database state was read or written beyond anon-permitted catalog reads. **Audit only.**

> Bottom line: **all 6 accounts are CREATE NEW** (merchant confirmed absent; the rest absent by strong inference). The only thing standing between "inference" and "proof" is running the §3 read-only queries with dashboard/SQL access — which this environment does not have.
