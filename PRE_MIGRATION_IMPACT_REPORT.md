# PRE_MIGRATION_IMPACT_REPORT.md — HAAT NOW

Read-only impact analysis before running `REAL_AUTH_MIGRATION_PACKAGE.md` Step 4. **No database changes were made** — only anon-key REST probes + schema (migration) inspection. Project `umwbzradvbsirsybfxfb`.

## Access limits of this audit (so nothing is overstated)
- **Anon-readable** (real row counts obtained): `merchants`, `merchant_branches`, `zones`.
- **RLS-blocked from anon → `401`** (counts/contents NOT visible here): `roles`, `user_roles`, `admin_users`, `customers`, `drivers`, `wallets`, `orders`, `countries`.
- **`auth.users`**: not REST-exposed (`404`) — only the dashboard/SQL can enumerate it.
- ⇒ For the `401`/`404` tables, **row count = UNKNOWN-here**; duplicate risk is derived from the **declared schema constraints** (authoritative) + the package's conflict clauses. The read-only pre-checks in §3 close these unknowns in the SQL Editor without changing anything.

## 1. Per-table findings
| Table | Row count | Existing demo accounts | Existing production data | Missing (Step 4 adds) | Duplicate risk |
|---|---|---|---|---|---|
| **auth.users** | UNKNOWN (404, not REST) | unknown | unknown | 6 users (created in **Step 1**, not Step 4) | ⚠️ Dashboard "Add user" fails if a phone already exists — verify in Users list first |
| **roles** | UNKNOWN (401) — seeded by migration 0006 | n/a | 4 system roles: customer/driver/merchant/admin (expected) | none (Step 4 only *references* roles) | 🟢 None — read-only reference |
| **user_roles** | UNKNOWN (401) | unknown | unknown | 6 role mappings | 🟢 **LOW** — `primary key (user_id, role_id)` + `on conflict do nothing` ⇒ idempotent |
| **admin_users** | UNKNOWN (401) | unknown | unknown | 3 admin rows | 🟢 **LOW** — `unique(user_id)` (idx from 0018) + `on conflict (user_id) do update` ⇒ idempotent |
| **customers** | UNKNOWN (401) | unknown | unknown | 1 (the demo customer) | 🟡 **MEDIUM** — `phone_number` is **UNIQUE**; `on conflict (id) do nothing` will **not** catch a phone collision → if `+201000000001` already exists under a different id, the insert **errors**. New auth-uid means no id collision |
| **drivers** | UNKNOWN (401) | unknown | unknown | 1 (the demo driver) | 🟡 **MEDIUM** — same as customers, phone `+201000000003` |
| **merchants** | **5** (anon-read) | **NONE** — `'متجر تجريبي'` absent | 5 seed restaurants: الجليلة, مايسترو بيتزا, التميمي, مليون قهوة, صيدلية النهدي (ids `…040–044`) | 1 (the demo merchant) | 🟢 **LOW** — `id` PK, new uid; no name uniqueness; no clash with the 5 seeds |
| **merchant_branches** | **5** (anon-read) | **NONE** — `'الفرع التجريبي'` absent | 5 seed branches (ids `…050–054`, all `is_active=true`) | 1 (the demo branch) | 🟢 **LOW** — `where not exists (merchant_id=…)` guard ⇒ idempotent |
| **wallets** | UNKNOWN (401) | unknown | unknown | 2 (customer + driver) | 🔴 **HIGH** — table has **NO unique constraint** on `(owner_type, owner_id)` (only `id` PK, auto-generated). The package's `on conflict do nothing` has **no arbiter** → it does **not** prevent duplicates. Re-running Step 4f, or a wallet already created by `adjust_wallet_balance` during a prior order, yields **duplicate wallet rows** |

## 2. Verdict — Step 4 provisioning = **PARTIALLY REQUIRED** (required, but not safe exactly as written)
- **Required:** YES — the 6 demo identities are **not present** (confirmed absent for merchant/branch; the rest are RLS-hidden but must be created since Step 1 mints fresh auth uids). So provisioning is **not NOT-REQUIRED**.
- **Unconditionally SAFE:** NO — two concrete hazards must be handled first:
  1. 🔴 **wallets (HIGH):** not idempotent → will create duplicate wallets. **Must** use a `where not exists` guard (or add `unique(owner_type,owner_id)` first).
  2. 🟡 **customers/drivers (MEDIUM):** `phone_number` uniqueness can collide with pre-existing rows that this anon audit cannot see → could hard-error the insert.
- Everything else (`user_roles`, `admin_users`, `merchants`, `merchant_branches`) is **idempotent and safe** by its existing constraints + conflict clauses.

## 3. Required actions before running Step 4 (do these first)
**A. Read-only pre-checks** — paste into SQL Editor; **all SELECT, change nothing.** They convert every "UNKNOWN-here" to a known value and surface any collision:
```sql
select count(*) total_auth_users from auth.users;
select phone, count(*) from auth.users
  where phone in ('+201000000001','+201000000002','+201000000003','+201000000004','+966500000004','+201000000005')
  group by phone;                                            -- expect 0 rows pre-Step-1
select name, count(*) from roles group by name order by name; -- expect customer/driver/merchant/admin
select count(*) user_roles_rows from user_roles;
select user_id, scope, country_code from admin_users;        -- see if any admins already exist
select id, phone_number from customers where phone_number in ('+201000000001');  -- expect 0 rows
select id, phone_number from drivers   where phone_number in ('+201000000003');  -- expect 0 rows
select owner_type, owner_id, count(*) from wallets group by 1,2 having count(*) > 1;  -- existing dup wallets
select owner_type, owner_id from wallets
  where owner_id in ('<CUSTOMER_UID>','<DRIVER_UID>');        -- expect 0 rows (after Step 1)
```
Proceed only if: demo phones return **0 rows** in `customers`/`drivers`/`auth.users`, and the dup-wallet query returns **0 rows**.

**B. Use this corrected, idempotent wallet insert in Step 4f** (replaces the `on conflict do nothing` version):
```sql
insert into wallets (owner_type, owner_id, balance)
select 'customer','PASTE_CUSTOMER_UID'::uuid, 250.00
where not exists (select 1 from wallets where owner_type='customer' and owner_id='PASTE_CUSTOMER_UID'::uuid);
insert into wallets (owner_type, owner_id, balance)
select 'driver','PASTE_DRIVER_UID'::uuid, 80.00
where not exists (select 1 from wallets where owner_type='driver' and owner_id='PASTE_DRIVER_UID'::uuid);
```
(Optional hardening, separate change: `create unique index if not exists idx_wallets_owner on wallets(owner_type, owner_id);` — but verify no existing duplicates first via the query above.)

**C. If a pre-check shows a demo phone already in `customers`/`drivers`:** reuse that existing row's id as the auth uid (or pick a different test phone) instead of inserting — do not force a second row.

## 4. Corruption-prevention summary
| Hazard | Prevented by |
|---|---|
| Duplicate users | Step 1 dashboard check + `auth.users` phone pre-check (§3A) |
| Duplicate wallets | 🔴 corrected `where not exists` insert (§3B) — **the one mandatory package fix** |
| Duplicate branches | existing `where not exists` guard — OK |
| Duplicate role assignments | composite PK `(user_id, role_id)` + `on conflict do nothing` — OK |
| Data corruption / failed txn | customers/drivers phone pre-check (§3A/C) before insert |

**Bottom line:** Step 4 is **required and mostly safe**, with **one HIGH-risk fix mandatory** (wallets idempotency) and **two MEDIUM pre-checks** (customer/driver phone uniqueness, auth.users phones). No database state was altered by this audit.
