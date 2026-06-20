# FINAL_PRODUCTION_CERTIFICATION.md — HAAT NOW

_Certification run. PASS is granted only with live/runtime proof. Everything requiring Supabase admin access was attempted; the access does not exist in this environment (proof below), so those items cannot be PASSED here — they are marked with the exact action + command to close them._

## Access reality (why some phases cannot be executed here)
Re-verified this sprint — not assumed:
| Capability | Result |
|---|---|
| Service-role key / `sb_secret_*` in repo/env | **ABSENT** (only publishable anon key present) |
| `SUPABASE_ACCESS_TOKEN` (Management API) | **ABSENT** |
| DB password / `DATABASE_URL` / `PGPASSWORD` | **ABSENT** |
| `supabase` CLI · `psql` · `pg` node module | **ABSENT** |
| `~/.supabase/access-token` | **ABSENT** |
| anon key → `GET /auth/v1/admin/users` | **`401`** (cannot touch auth config) |
| Supabase MCP server | not connected |

⇒ I cannot enable the Phone provider, configure Test OTP, run DDL, apply migrations, or read `pg_catalog`/`information_schema`. These need the Supabase **dashboard** or a **service-role/Management token**. All **code-reachable** blockers are already resolved (sandbox exploit — see Auth).

---

## PHASE 1 — Supabase Auth Activation — ❌ FAIL (external)
- **Sandbox exploit (code-reachable): ✅ PASS** — prod build = 0/6 demo logins; `DEMO_ACCOUNTS`/OTP tree-shaken; committed `cb8d7ad`/`ba0b08a` (`IS_SANDBOX = … && import.meta.env.DEV`).
- **Real provider activation: ❌ FAIL** — `/auth/v1/otp` → `phone_provider_disabled`; `email` enabled but `mailer_autoconfirm=false`; OAuth/anonymous off → **no provider yields a session**, so Customer/Merchant/Driver/Egypt-Admin/Saudi-Admin/Super-Admin real logins **cannot succeed**.
- **Fix (dashboard — requires access I don't have):** Auth → Providers → **Phone = ON** (Twilio/MessageBird **or** Auth → enable **Test OTP** numbers `+2010000000xx`/`+9665000000xx` → `123456`). Then real login is verifiable.
- **Remaining risk:** 🔴 No real authentication until the provider is enabled.

## PHASE 2 — Migration 0019 Verification — ⛔ FAIL (external)
- **Status: UNVERIFIED** — anon → `role_table_grants`/`pg_policies`/`information_schema` = `404`; no JWT obtainable. No `GRANT … TO authenticated` exists in any confirmed-applied migration (strong prior: **not applied**).
- **Fix (SQL Editor):** run `supabase/migrations/20260614000019_authenticated_grants.sql`, then verify:
```sql
select table_name, string_agg(privilege_type,',' order by privilege_type) g
from information_schema.role_table_grants
where table_schema='public' and grantee='authenticated'
and table_name in ('orders','order_items','wallets','notifications','customer_carts','cart_items','favorites','addresses')
group by table_name;          -- expect 8 rows, each ≥ SELECT (+ INSERT/UPDATE where written)
```
- **Remaining risk:** 🔴 If unapplied, every logged-in user gets `42501` on these tables.

## PHASE 3 — order_country_code Fix — ❌ FAIL (external)
- **Status:** live RPC → `42501` ⇒ runs as caller = **SECURITY INVOKER**; self-`SELECT`s `orders` while referenced by the admin `orders` policy → **infinite recursion** on admin reads. `search_path` not pinned.
- **Fix (SQL Editor):**
```sql
create or replace function public.order_country_code(p_order_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select c.country_code from orders o
  join customers cu on cu.id = o.customer_id
  join countries c on c.id = cu.country_id        -- adjust to actual FK chain
  where o.id = p_order_id
$$;
revoke all on function public.order_country_code(uuid) from public;
grant execute on function public.order_country_code(uuid) to authenticated;
```
  Then live-test: Egypt Admin reads only EG orders, Saudi Admin only SA, neither reads foreign orders (needs Phase 1 sessions).
- **Remaining risk:** 🟠 Admin order reads recurse; country isolation unenforced until applied.

## PHASE 4 — Real RBAC Validation — ⛔ FAIL (blocked by Phase 1)
- Cannot validate Customer/Merchant/Driver/Admin scoping, cross-country, privilege-escalation, direct-API or RLS bypass — **no real session obtainable**. DB mechanism (migration 0018: `auth_is_admin/scope/country`) is live (`auth_is_admin()→false` for anon), but row-level enforcement needs a JWT.
- **Fix:** after Phases 1–3, run the role-scoped read/write probes per role.
- **Remaining risk:** 🔴 RBAC unproven.

## PHASE 5 — Real Data Validation — ❌ FAIL (blocked by Phases 1–2)
- Driver/Merchant/Admin portals currently render `sandboxStore` demo data in dev/sandbox; the **real** service paths (`driverService`, `merchantService`, `orderService`, `adminService`, `complete_delivery` RPC) exist and compile but return no rows without auth + Phase-2 grants.
- **Fix:** Phases 1–2, then load each portal with a real session and confirm DB rows.
- **Remaining risk:** 🟠 Portals not yet shown on real data.

## PHASE 6 — End-to-End Production Workflow — ❌ FAIL (blocked by Phases 1–2)
- Real Customer→Merchant→Driver→Wallet→Notifications lifecycle cannot be executed without sessions + grants. (Sandbox lifecycle is 10/10, but **sandbox ≠ production** and is not counted here.)
- **Fix:** after Phases 1–3, run the real lifecycle and verify each stage via Supabase rows.
- **Remaining risk:** 🟠 Real workflow unproven.

---

## FINAL TABLE
| Section | PASS/FAIL | Evidence | Fix Applied / Required | Remaining Risk |
|---|---|---|---|---|
| **Auth** | ❌ FAIL | exploit fixed (0/6 prod) ✅; real provider `phone_provider_disabled` | code fix committed; **enable Phone/Test OTP (dashboard)** | 🔴 no real login |
| **Migration 0019** | ⛔ FAIL | grants unreadable via anon (`404`); not in applied migrations | **apply 0019 + verify (SQL)** | 🔴 `42501` for users |
| **order_country_code** | ❌ FAIL | RPC `42501` = INVOKER; recursion | **DEFINER recreate (SQL)** | 🟠 admin reads recurse |
| **RBAC** | ⛔ FAIL | no real session | after Phases 1–3 | 🔴 unproven |
| **Driver Portal** | ❌ FAIL | real path blocked by auth+grants | after Phases 1–2 | 🟠 demo data only |
| **Merchant Portal** | ❌ FAIL | real path blocked by auth+grants | after Phases 1–2 | 🟠 demo data only |
| **Admin Portal** | ❌ FAIL | real path blocked by auth+grants/#3 | after Phases 1–3 | 🟠 demo data only |
| **Real Workflow** | ❌ FAIL | cannot run without sessions+grants | after Phases 1–3 | 🟠 unproven |

## FINAL RESULT: 🔴 **PRODUCTION READY = NO**

**Single remaining root cause:** **external Supabase admin access is unavailable to this environment** (no service-role key / Management token / dashboard / SQL Editor — proven above). Every code-reachable blocker is resolved and committed. The four DB/dashboard actions — **(1) enable Phone provider or Test OTP, (2) apply migration `0019`, (3) recreate `order_country_code` as `SECURITY DEFINER`, (4) provision real role rows** — are the entire and only path to GO; each has its exact command above.

**To let me execute these and re-verify to GO:** provide a **service-role key** (or `SUPABASE_ACCESS_TOKEN`) in the environment, **or** run the four commands in the Supabase dashboard/SQL Editor. With either, I will run real logins for all six roles, the grant query, the recursion-free country-scoping tests, and the real end-to-end lifecycle, and re-issue this certification.
