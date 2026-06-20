# PRODUCTION_VALIDATION_REPORT.md

_2026-06-20 · Production Readiness Sprint · sandbox success is explicitly NOT counted here._

## Method & access boundary (read this first)
All conclusions below are backed by **live probes** against the real project (`umwbzradvbsirsybfxfb`) using the **anon publishable key** — the only credential available. I have **no service-role key, no DB password, no SQL Editor, no dashboard**. I attempted every path to obtain a real authenticated session and **all are closed**:

| Path to a real session | Live result | Usable? |
|---|---|---|
| Phone OTP (`/auth/v1/otp`) | `400 phone_provider_disabled` | ❌ |
| Email signup (`/auth/v1/signup`) | `disable_signup:false` **but `mailer_autoconfirm:false`** → confirmation required, no token | ❌ (no inbox) |
| Anonymous sign-in | settings `anonymous_users:false` | ❌ |
| OAuth providers | all `false` | ❌ |

**Consequence:** anything requiring an authenticated JWT (authenticated-role grants, RBAC, order/wallet lifecycle, real dashboard mutations) **cannot be runtime-validated from here**. Those are marked **BLOCKED** with the exact query/step to complete them. I did not fabricate PASS for any of them.

---

## 1. Real-mode authentication (`VITE_AUTH_MODE=supabase`)
| Sub-check | Result | Evidence |
|---|---|---|
| Phone login flow | **BLOCKED** | `POST /auth/v1/otp {phone}` → `phone_provider_disabled` (live) |
| Session restore | **CODE-VERIFIED, NOT PROD-VERIFIED** | `authService.getCurrentUser()`→`supabase.auth.getUser()`; correct, but no session can be created to restore |
| Logout | **CODE-VERIFIED** | `authService.signOut()`→`supabase.auth.signOut()` |
| Role resolution from DB | **CODE-VERIFIED** | `resolveHighestRole()` reads `user_roles→roles`; unexercisable without a real user |
**Verdict:** real-mode auth is **not production-validated** — blocked at the disabled phone provider (and no email/anon fallback yields a session).

## 2. Migrations
| Migration | Applied in prod? | Evidence |
|---|---|---|
| `0018_admin_country_scoping` | ✅ **APPLIED** | live: `auth_is_admin()`→`false`, `auth_admin_scope()`→`null`, `auth_admin_country()`→`null`, `order_country_code()` exists (`42501`) |
| `0019_authenticated_grants` | **BLOCKED (unverifiable here)** | `authenticated` grants only affect the `authenticated` role; anon cannot read `pg_catalog`/`information_schema` via REST (`/rest/v1/pg_policies`→404). No JWT obtainable to test behaviorally. |

**SQL proof queries (run in SQL Editor as `postgres`):**
```sql
-- 0018 objects:
select proname, prosecdef from pg_proc where pronamespace='public'::regnamespace
  and proname in ('auth_is_admin','auth_admin_scope','auth_admin_country','order_country_code');
select column_name from information_schema.columns
  where table_schema='public' and table_name='admin_users' and column_name in ('user_id','scope','country_code');

-- 0019 grants (THIS is the unresolved one):
select table_name, string_agg(privilege_type,',' order by privilege_type) privs
from information_schema.role_table_grants
where table_schema='public' and grantee='authenticated'
  and table_name in ('orders','order_items','wallets','notifications','favorites','addresses','customer_carts','cart_items')
group by table_name order by table_name;
-- Expected if 0019 applied: every row present with at least SELECT.
```

## 3. Authenticated-role permissions (orders, order_items, wallets, notifications, favorites, addresses, customer_carts, cart_items)
**Result: BLOCKED — no authenticated JWT obtainable.**
Anon evidence (current security posture, real): **every one of these returns `401/42501` for anon** (correctly blocked) — but that says nothing about the `authenticated` role.
**Proof query (SQL Editor — simulates a logged-in user, no real login needed):**
```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<ANY_REAL_OR_TEST_UID>","role":"authenticated"}';
  select 'orders' t, count(*) from public.orders
  union all select 'wallets', count(*) from public.wallets
  union all select 'notifications', count(*) from public.notifications
  union all select 'customer_carts', count(*) from public.customer_carts
  union all select 'cart_items', count(*) from public.cart_items
  union all select 'favorites', count(*) from public.favorites
  union all select 'addresses', count(*) from public.addresses
  union all select 'order_items', count(*) from public.order_items;
  -- 42501 on any row ⇒ migration 0019 grants NOT applied for that table.
rollback;
```

## 4. Admin RBAC (Egypt / Saudi / Super, country isolation)
**Result: BLOCKED — needs real admin sessions.** The mechanism (0018) is **applied** (item 2). 
🔴 **Real defect flagged (static + live):** `order_country_code()` is `SECURITY INVOKER` (live: it returned `42501` running under the caller's role). The `"Admins read orders by scope"` policy on `orders` calls it, and it self-selects from `orders` → **infinite-recursion risk** the moment an admin reads orders. Fix SQL is prepared (make it `SECURITY DEFINER`). 
**Proof query (SQL Editor):**
```sql
begin; set local role authenticated;
  set local request.jwt.claims = '{"sub":"<EG_ADMIN_UID>","role":"authenticated"}';
  select public.auth_admin_scope(), public.auth_admin_country();   -- expect 'country','EG'
  select count(*) from public.orders;   -- EG-only; if ERROR "infinite recursion" → apply the DEFINER fix
rollback;
```

## 5. Order lifecycle (Customer → Merchant → Driver → Delivered)
**Result: BLOCKED — requires authenticated mutations + RPCs.** RPC `complete_delivery(uuid,uuid)` is **deployed and enforces auth** (live: `P0001 Authentication required`). Full create→accept→assign→deliver cannot run without authenticated sessions for customer/merchant/driver.

## 6. Wallet lifecycle (balance, transactions, payout, RPCs)
**Result: BLOCKED.** `complete_delivery`, `complete_delivery_payout`, `adjust_wallet_balance` are **deployed + auth-enforcing** (live `P0001`). Execution + balance/transaction reads need an authenticated session. **Unverified:** whether these RPCs are `SECURITY DEFINER` (required to write under SELECT-only client grants) — proof query:
```sql
select proname, prosecdef as security_definer from pg_proc
where pronamespace='public'::regnamespace
  and proname in ('complete_delivery','complete_delivery_payout','adjust_wallet_balance');
-- security_definer must be true.
```

## 7–9. Dashboard actions (Admin / Merchant / Driver)
**UI wiring / buttons / tabs / navigation: PASS** (code-verified + sandbox runtime 30/30 last sprint — every action has a handler; no dead/disabled/hidden controls; logout present on all portals).
**Real data mutations: BLOCKED** — config save, ticket reply/close, accept order, complete delivery, product/branch CRUD all hit the backend and require an authenticated session (none obtainable). These are **not production-validated**.

| Portal | Buttons/tabs/nav wired | Real backend actions |
|---|---|---|
| Admin | ✅ KPI/Config/Support tabs, refresh, logout, lang, mobile nav | BLOCKED (config save / ticket reply) |
| Merchant | ✅ 4 tabs, logout, lang, mobile nav | BLOCKED (product/branch CRUD, order actions) |
| Driver | ✅ online toggle, logout, lang | BLOCKED (accept order, complete_delivery, earnings) |

## Fake / demo / mock data still present (active only in sandbox)
| Location | What | Active when |
|---|---|---|
| `src/services/auth.service.ts` | `DEMO_ACCOUNTS` map + sandbox login branch (OTP `123456`) | `VITE_AUTH_MODE=sandbox` |
| `src/features/driver/DriverApp.tsx` | `SANDBOX` demo driver profile + earnings + feed | `VITE_AUTH_MODE=sandbox` |
| `src/features/merchant/MerchantApp.tsx` | `SANDBOX` demo merchant/branch/orders/products | `VITE_AUTH_MODE=sandbox` |
| `src/services/payment.service.ts` | `PAYMENT_MODE=sandbox` dry-run payments | `PAYMENT_MODE!=production` |
In **supabase** mode these branches are bypassed (real backend). They are **demo scaffolding, not production data paths**.

## Side effect during this audit
One unconfirmed test auth user (`prodval_*@example.com`) was created while probing whether email signup yields a session (it does not — confirmation required). It is unconfirmed/unusable; I cannot delete it without service-role access. Low impact (dev project).

## Summary
| Item | Production-validated? |
|---|---|
| Migration 0018 applied | ✅ PASS (live) |
| Core RPCs deployed + auth-gated | ✅ PASS (live) |
| Catalog public read / anon restrictions | ✅ PASS (live) |
| Real-mode login (1) | ❌ BLOCKED (provider) |
| Migration 0019 grants (2) | ⛔ BLOCKED (unverifiable here) |
| Authenticated permissions (3) | ⛔ BLOCKED (no JWT) |
| Admin RBAC + isolation (4) | ⛔ BLOCKED (+ recursion defect) |
| Order lifecycle (5) | ⛔ BLOCKED |
| Wallet lifecycle (6) | ⛔ BLOCKED |
| Dashboard real mutations (7–9) | ⛔ BLOCKED (wiring PASS) |

**Net:** the platform is **not yet production-validated**. The blockers are infrastructural (disabled phone provider, no service-role/SQL access, email-confirmation-required), not application-code defects — with one real DB defect (`order_country_code` recursion). All proof queries above are ready to run by anyone with SQL-Editor access.
