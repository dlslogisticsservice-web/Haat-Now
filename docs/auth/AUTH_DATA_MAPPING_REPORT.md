# AUTH_DATA_MAPPING_REPORT.md — HAAT NOW

Maps the **current runtime demo identities** to real database entities. Source of truth = the live auth path (dev/sandbox build where OTP `123456` works) + code + a runtime network trace. No DB changes.

## The runtime auth path (identical for all 6 roles)
1. `verifyOtp(phone, '123456')` → `IS_SANDBOX` branch ([auth.service.ts:73](../../src/services/auth.service.ts#L73)): checks `DEMO_ACCOUNTS[phone]`, requires token `=== '123456'`, **writes `localStorage['haat_sandbox_session'] = {id, phone_number, role}`**. **Zero Supabase auth calls** (runtime-confirmed: `Supabase AUTH calls during login: NONE`).
2. `getCurrentUser()` → returns that localStorage blob. **Role comes from `DEMO_ACCOUNTS`, not from `user_roles`.**
3. Portals read **`sandboxStore`** (localStorage) for orders/wallet/earnings/analytics; only the **shared anon catalog** is read from the real DB.

**Decisive fact:** the demo UUIDs `11111111-`/`22222222-`/`33333333-`/`44444444-`/`55555555-` exist **only** in `DEMO_ACCOUNTS`. `grep` of all of `supabase/` (migrations + `seed.sql` + `seed_demo_accounts.sql`) → **these UUIDs are not inserted into any table**; `seed.sql` is **catalog-only** (no `customers`/`drivers`/`admin_users`/`user_roles` rows). ⇒ **No real DB record sits behind any demo account.**

**Runtime trace (Customer login, measured):**
- Identity: `localStorage haat_sandbox_session = {"id":"11111111-0000-0000-0000-000000000001","phone_number":"+201000000001","role":"customer"}` (fabricated UUID).
- Real DB tables hit after login: `merchant_branches`, `offers` (shared catalog), `customer_carts` + `notifications` (queried with the fabricated UUID → **no matching rows**). **No `customers`, `user_roles`, `orders`, or `wallets` query** — those come from `DEMO_ACCOUNTS`/`sandboxStore`.

---

## Per-role mapping

### Customer — `+201000000001`
- **Auth Source:** SANDBOX (localStorage `haat_sandbox_session`; OTP `123456`; no JWT)
- **Loaded User Record:** `DEMO_ACCOUNTS['+201000000001']` → `{id: 11111111-…-000000000001, role: customer, country: EG, name: 'عميل مصر'}` — a localStorage object, **not** a `customers` row
- **Loaded Role Record:** hardcoded `role:'customer'` from `DEMO_ACCOUNTS` — **no `user_roles` row read**
- **Database Tables Used:** real (shared catalog): `merchant_branches`, `offers`; attempted with fabricated id (empty): `customer_carts`, `notifications`. Orders/Wallet → `sandboxStore` (no DB)
- **Can Reuse Existing Data = NO** (no `customers`/cart/wallet row exists for `11111111-…`)

### Merchant — `+201000000002`
- **Auth Source:** SANDBOX (localStorage; `123456`)
- **Loaded User Record:** `DEMO_ACCOUNTS['+201000000002']` → `{id: 22222222-…-000000000001, role: merchant, country: EG}` — not a `merchants` row (demo merchant `متجر تجريبي` **confirmed absent** in DB)
- **Loaded Role Record:** hardcoded `merchant` — no `user_roles` row
- **Database Tables Used:** `sandboxStore` for orders/products/revenue ([MerchantApp.tsx:183,232](../../src/features/merchant/MerchantApp.tsx#L183)); no identity/`merchants` DB row read
- **Can Reuse Existing Data = NO** (no `merchants` row for `22222222-…`; the 5 real catalog merchants are `00000000-…-40…44`, unowned by any auth user)

### Driver — `+201000000003`
- **Auth Source:** SANDBOX (localStorage; `123456`)
- **Loaded User Record:** `DEMO_ACCOUNTS['+201000000003']` → `{id: 33333333-…-000000000001, role: driver, country: EG}` — not a `drivers` row
- **Loaded Role Record:** hardcoded `driver` — no `user_roles` row
- **Database Tables Used:** `sandboxStore` for available/active jobs + earnings ([DriverApp.tsx:109-111](../../src/features/driver/DriverApp.tsx#L109)); no identity/`drivers` DB row read
- **Can Reuse Existing Data = NO** (no `drivers` row for `33333333-…`)

### Egypt Admin — `+201000000004`
- **Auth Source:** SANDBOX (localStorage; `123456`)
- **Loaded User Record:** `DEMO_ACCOUNTS['+201000000004']` → `{id: 44444444-…-000000000001, role: admin, country: EG, scope: country}` — not an `admin_users` row
- **Loaded Role Record:** hardcoded `admin` + `scope:'country'` from `DEMO_ACCOUNTS` — **no `admin_users`/`user_roles` row read**
- **Database Tables Used:** `sandboxStore` analytics/orders ([AdminDashboard.tsx:68](../../src/features/admin/AdminDashboard.tsx#L68)); no `admin_users` DB row read
- **Can Reuse Existing Data = NO** (no `admin_users` row for `44444444-…-001`)

### Saudi Admin — `+966500000004`
- **Auth Source:** SANDBOX (localStorage; `123456`)
- **Loaded User Record:** `DEMO_ACCOUNTS['+966500000004']` → `{id: 44444444-…-000000000002, role: admin, country: SA, scope: country}`
- **Loaded Role Record:** hardcoded `admin` + `scope:'country'`, country SA — no DB row
- **Database Tables Used:** `sandboxStore` analytics; no `admin_users` DB row read
- **Can Reuse Existing Data = NO** (no `admin_users` row for `44444444-…-002`)

### Super Admin — `+201000000005`
- **Auth Source:** SANDBOX (localStorage; `123456`)
- **Loaded User Record:** `DEMO_ACCOUNTS['+201000000005']` → `{id: 55555555-…-000000000005, role: admin, country: EG, scope: super}`
- **Loaded Role Record:** hardcoded `admin` + `scope:'super'` — no DB row
- **Database Tables Used:** `sandboxStore` global analytics; no `admin_users` DB row read
- **Can Reuse Existing Data = NO** (no `admin_users` row for `55555555-…`)

---

## Summary
| Role | Phone | Auth Source | User Record | Role Record | Real DB identity row? | Can Reuse |
|---|---|---|---|---|---|---|
| Customer | +201000000001 | SANDBOX (localStorage) | DEMO_ACCOUNTS `11111111-…001` | hardcoded `customer` | none | **NO** |
| Merchant | +201000000002 | SANDBOX (localStorage) | DEMO_ACCOUNTS `22222222-…001` | hardcoded `merchant` | none (demo merchant absent) | **NO** |
| Driver | +201000000003 | SANDBOX (localStorage) | DEMO_ACCOUNTS `33333333-…001` | hardcoded `driver` | none | **NO** |
| Egypt Admin | +201000000004 | SANDBOX (localStorage) | DEMO_ACCOUNTS `44444444-…001` | hardcoded `admin`/country | none | **NO** |
| Saudi Admin | +966500000004 | SANDBOX (localStorage) | DEMO_ACCOUNTS `44444444-…002` | hardcoded `admin`/country | none | **NO** |
| Super Admin | +201000000005 | SANDBOX (localStorage) | DEMO_ACCOUNTS `55555555-…005` | hardcoded `admin`/super | none | **NO** |

## Conclusion (runtime-derived, not provider-inferred)
- Every demo identity is a **client-side localStorage object** with a **fabricated UUID** that exists in **no database table**. Roles are **hardcoded in `DEMO_ACCOUNTS`**, never read from `user_roles`/`admin_users`. Portal data is `sandboxStore` (localStorage). The only real DB reads are the **shared anon catalog**, which is identity-agnostic.
- ⇒ **There is no existing database identity to migrate. `Can Reuse Existing Data = NO` for all 6 — they must be created fresh** (matches `ACCOUNT_EXISTENCE_REPORT.md` → `CREATE NEW`, and the V2 PROVISION step).
- **Optional continuity (not "reuse of data"):** when creating the real `auth.users` (V2 Step 1) you *may*, via the Admin API, set each new user's `id` to the corresponding `DEMO_ACCOUNTS` UUID (e.g. customer = `11111111-…001`) so any incidental references stay stable — but this still creates new rows; there is no pre-existing data behind them.
