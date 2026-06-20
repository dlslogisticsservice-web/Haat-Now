# PRODUCTION_CUTOVER_REPORT.md — HAAT NOW Final Production Audit

_2026-06-20 · Final cutover audit. Every conclusion is backed by a live probe (anon key), the built bundle, or a runtime login against the served production build. Items requiring a service-role key, SQL Editor, or a real authenticated JWT are **UNVERIFIABLE here** and marked as such — never guessed._

## DECISION: 🔴 **NO-GO — Production Ready = NO**

---

## SECTION 1 — Auth Mode Verification — ❌ FAIL
**Evidence (repo files):**
| File | Present | `VITE_AUTH_MODE` / `AUTH_MODE` |
|---|---|---|
| `.env` | ✅ | **`sandbox` / `sandbox`** |
| `.env.local` / `.env.production` / `.env.preview` / `.env.development` | ❌ absent | — |
| `vercel.json`, `netlify.toml`, `railway.*`, `render.yaml`, `.github/workflows/*` | ❌ none in repo | — |

- The **only** build-time auth config in the repository is `.env = sandbox`. Vite inlines `VITE_AUTH_MODE` at build, so a build from this repo as-is is **sandbox**.
- **Vercel / Railway / Render / Netlify / GitHub Actions secrets are platform-side and NOT in the repository** → their values are **UNVERIFIABLE from the codebase**; they must be inspected in each platform dashboard. **No evidence exists that any production deployment overrides `VITE_AUTH_MODE=supabase`.**
- **Verdict:** FAIL — the committed/only config builds `sandbox`; production-`supabase` is unproven for every deploy path.

## SECTION 2 — Sandbox Exploitability — ❌ FAIL · **EXPLOITABLE = YES**
**Method:** `npm run build` (`.env=sandbox`) → `vite preview` (`:4173`) → real login attempts, OTP `123456`.
```
LOGIN-OK  Customer     +201000000001  portalLoaded=true  roleAssigned=customer
LOGIN-OK  Merchant     +201000000002  portalLoaded=true  roleAssigned=merchant
LOGIN-OK  Driver       +201000000003  portalLoaded=true  roleAssigned=driver
LOGIN-OK  Egypt Admin  +201000000004  portalLoaded=true  roleAssigned=admin
LOGIN-OK  Super Admin  +201000000005  portalLoaded=true  roleAssigned=admin
LOGIN-OK  Saudi Admin  +201000000006  portalLoaded=true  roleAssigned=admin
EXPLOITABLE = YES (6/6, incl. Super Admin)
```
Login succeeds, portal loads, access granted, role assigned — for **all 6**. **Control:** a rebuild with `VITE_AUTH_MODE=supabase` previously yielded `BLOCKED` (login → "Unsupported phone provider"), confirming the build-time env is the root cause. **Verdict:** FAIL.

## SECTION 3 — Production Bundle Inspection — ❌ FAIL
**Bundle:** `dist/assets/index-*.js` (794 KB), built with current `.env`.
| Token | Occurrences |
|---|---|
| `sandbox` | 2 |
| `haat_sb_orders` | 1 |
| `123456` | 4 |
| `201000000001` / `201000000005` | 1 each |
| demo name `كابتن تجريبي` | 1 |
| `DEMO_ACCOUNTS` (identifier) | 0 (minified away — the **data** is present) |

- **Present:** yes. **Reachable:** yes. **Executable:** yes — proven in Section 2 (the embedded OTP `123456` + demo phones produce working logins). **Dead code only:** NO. **Verdict:** FAIL — sandbox functionality is present *and* executable in the production bundle.

## SECTION 4 — Migration 0019 (authenticated grants) — ⛔ UNVERIFIABLE → FAIL
- **Live:** `/rest/v1/pg_policies` → `404`, `/rest/v1/role_table_grants` → `404` (anon cannot read `information_schema`/`pg_catalog` via REST). No authenticated JWT obtainable to test behaviorally.
- No `GRANT … TO authenticated` exists in any applied migration (strong prior: unapplied). **Cannot confirm applied / successful / no-drift / no-partial.**
- **Proof query (SQL Editor required):**
```sql
select table_name, string_agg(privilege_type,',' order by privilege_type)
from information_schema.role_table_grants
where table_schema='public' and grantee='authenticated'
and table_name in ('orders','order_items','wallets','notifications','favorites','addresses','customer_carts','cart_items')
group by table_name;   -- expect 8 rows w/ ≥ SELECT
```
- **Verdict:** FAIL (not confirmable here; risk = logged-in users `42501`).

## SECTION 5 — order_country_code — ❌ FAIL
- **Live execution:** `POST /rpc/order_country_code` → `42501 permission denied for table orders` — it runs under the **caller's** role ⇒ **SECURITY INVOKER** (a DEFINER fn would return data/null, like `auth_is_admin()→false`).
- It self-`SELECT`s `orders` and is referenced by the admin `"Admins read orders by scope"` policy on `orders` → **infinite-recursion risk** (`infinite recursion detected in policy for relation "orders"`) the moment an admin reads orders. Country isolation therefore unenforceable.
- **Verdict:** FAIL — must be `SECURITY DEFINER`.

## SECTION 6 — Real Authentication — ❌ FAIL
- **Phone provider:** `phone_provider_disabled` (live) → phone OTP login impossible.
- **Email provider:** enabled but `mailer_autoconfirm:false` (confirmation required) → signup yields no session.
- **OAuth / anonymous:** all disabled.
- Signup / login / logout / session-persistence / refresh / protected-routes are **code-correct and centralized** (`auth.service.ts`) but **cannot be exercised** — no provider yields a real session. **Verdict:** FAIL (no real auth path live).

## SECTION 7 — RBAC — ⛔ UNVERIFIABLE → FAIL
- DB mechanism applied (0018: `auth_is_admin/scope/country` live), but **no real session obtainable** (Section 6) → DB/API/UI authorization, RLS row-enforcement, country isolation, cross-role & cross-country access, privilege-escalation **cannot be runtime-tested**.
- The only "RBAC" observable today is the **sandbox role assignment** (Section 2) — which is the exploit, not real enforcement. Plus the Section 5 recursion would break admin reads.
- **Verdict:** FAIL (unverifiable + blocked by #5/#6). Proof requires the JWT-simulation queries in SQL Editor.

## SECTION 8 — Test Accounts — ❌ FAIL (real) / exploit (sandbox)
- **Real mode:** accounts not provisioned in `auth.users`/`user_roles`/`admin_users` (no SQL access) **and** cannot log in (phone disabled). Correct role/country/permission assignment **unverifiable**.
- **Sandbox mode:** all 6 log in with correct roles assigned (Section 2) — but this is the demo backdoor, not production auth. **Verdict:** FAIL.

## SECTION 9 — Driver Portal real data — ❌ FAIL
- Renders **demo data** from `sandboxStore` (sandbox build). Real path (`driverService` + `complete_delivery` RPC) exists but needs auth + grants (#4/#6). Orders/wallet/earnings/status/delivery shown are **not real**. **Verdict:** FAIL (demo data).

## SECTION 10 — Merchant Portal real data — ❌ FAIL
- Renders **demo branch/orders/products/revenue** from `sandboxStore`. Real path (`merchantService`/`orderService`) exists, blocked by auth + grants. **Verdict:** FAIL (demo data).

## SECTION 11 — Admin Portal real data — ❌ FAIL
- Analytics/order-count fed by `sandboxStore` in sandbox; real `adminService.getGlobalAnalytics` + 0018 country scoping blocked by #4/#5/#6. **Verdict:** FAIL (demo data; scoping unenforceable due to #5).

---

## SECTION 12 — Final Go / No-Go

| Section | PASS/FAIL |
|---|---|
| 1 Auth mode | ❌ FAIL |
| 2 Exploitability (EXPLOITABLE=YES) | ❌ FAIL |
| 3 Bundle inspection | ❌ FAIL |
| 4 Migration 0019 | ⛔ FAIL (unverifiable) |
| 5 order_country_code | ❌ FAIL |
| 6 Real authentication | ❌ FAIL |
| 7 RBAC | ⛔ FAIL (unverifiable) |
| 8 Test accounts | ❌ FAIL |
| 9 Driver real data | ❌ FAIL |
| 10 Merchant real data | ❌ FAIL |
| 11 Admin real data | ❌ FAIL |

- **PASS / FAIL:** FAIL (0 of 11 sections pass).
- **Evidence:** runtime logins (6/6 exploited), bundle grep, live RPC/auth probes — all above.
- **Root cause:** (a) build ships `VITE_AUTH_MODE=sandbox` → demo backdoor active with OTP `123456`; (b) real auth provider disabled; (c) authenticated grants (`0019`) unconfirmed; (d) `order_country_code` SECURITY INVOKER → admin RLS recursion. (b)–(d) require Supabase dashboard/SQL access absent from this environment.
- **Risk Level:** 🔴 **Critical** — Section 2 is an actively-exploitable Super-Admin auth bypass, not merely a readiness gap.
- **Fix Required (in order):**
  1. Build production with `VITE_AUTH_MODE=supabase` **and** add a build-time guard to strip `sandboxStore`/`DEMO_ACCOUNTS`/OTP from the bundle; re-run Section 2 → expect 6/6 BLOCKED and Section 3 → 0 hits.
  2. Enable Supabase Phone provider (+ Test OTP).
  3. Apply migration `0019`; confirm with the role_table_grants query.
  4. Apply `order_country_code` `SECURITY DEFINER` fix.
  5. Provision real roles (`seed_demo_accounts.sql`); verify money/delivery RPCs `prosecdef=true`.
  6. Re-run RBAC + portal + workflow suites in `supabase` mode to convert Sections 7–11 to verified PASS.
- **Go / No-Go:** 🔴 **NO-GO.**
- **Production Ready = NO.**

> Nothing was guessed: confirmed-true via live evidence — exploitability, bundle contents, `order_country_code` invoker status, phone provider disabled, 0018 applied. Genuinely unverifiable from this environment (no service-role/SQL/JWT, platform secrets not in repo) — `0019` application, authenticated-role RBAC, platform env values — are labeled UNVERIFIABLE with the exact query/step to close them.
