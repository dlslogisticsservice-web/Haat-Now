# PRODUCTION_CUTOVER_REPORT.md

Audit only — no fixes applied. Every row is backed by a live probe (anon key) or the built bundle (`dist/assets/index-*.js`). `authenticated`-role items remain unverifiable here (no service-role / SQL Editor / real session).

## Overall verdict: 🔴 **NO-GO**
Multiple Critical blockers: real auth disabled, the current build is **sandbox-mode with demo credentials embedded**, and `0019` grants are unconfirmed.

| # | Item | PASS/FAIL | Evidence | Risk | Fix Applied | Go/No-Go |
|---|---|---|---|---|---|---|
| 1 | **Migration 0019** (authenticated grants) | ⛔ UNVERIFIED→FAIL | anon cannot read `pg_catalog`/`role_table_grants` (404); no `GRANT…TO authenticated` in any applied migration (strong prior: unapplied) | 🔴 Critical — logged-in users get `42501` on orders/wallets/carts | None (audit only) — apply `0019` + run the `role_table_grants` proof query | **NO-GO** |
| 2 | **order_country_code** | ❌ FAIL | live RPC → `42501` (runs as caller ⇒ **SECURITY INVOKER**); self-selects `orders` inside the admin `orders` policy | 🟠 High — admin order reads hit `infinite recursion detected in policy` | None — `CREATE OR REPLACE … SECURITY DEFINER` (SQL prepared) | **NO-GO** |
| 3 | **All RLS policies** | 🟡 PARTIAL | anon correctly blocked on owner tables (`orders/wallets/notifications/driver_earnings` → `401/42501`); catalog public (`merchant_branches` → `200`); 0018 admin helpers live (`auth_is_admin→false`) | 🟡 Medium — authenticated/admin **row** enforcement unverifiable without a JWT | None | **CONDITIONAL** |
| 4 | **Real Supabase auth** | ❌ FAIL | `POST /auth/v1/otp` → `phone_provider_disabled`; email signup requires confirmation; anon/OAuth off | 🔴 Critical — no real login possible | None — enable Phone provider + Test OTP (dashboard) | **NO-GO** |
| 5 | **RBAC enforcement** | ⛔ BLOCKED→FAIL | mechanism (0018) applied, but no admin session obtainable + recursion bug (#2) | 🟠 High — cannot prove Egypt/Saudi/Super isolation; admin orders would error | None — depends on #2 + #4 | **NO-GO** |
| 6 | **Demo account isolation** | ❌ FAIL | demo accounts are sandbox-only (`auth.service` `DEMO_ACCOUNTS`), **but** the prod bundle embeds them + OTP `123456` (see #7); in sandbox mode they grant full role access | 🔴 Critical — if shipped in sandbox mode, anyone logs in as Super Admin with `123456` | None — build-time strip + pin `VITE_AUTH_MODE=supabase` | **NO-GO** |
| 7 | **Sandbox code exposure** | ❌ FAIL | **prod bundle contains:** `haat_sb_orders`×1, `sandbox`×2, `123456`×4, demo phone `201000000005`×1, demo names (`كابتن/متجر تجريبي`)×2. `.env` `VITE_AUTH_MODE=sandbox` ⇒ Vite inlines it ⇒ **the build is permanently sandbox-active** | 🔴 Critical — production build = sandbox build with hardcoded demo login | None — set `VITE_AUTH_MODE=supabase` at build + build-time guard to exclude `sandboxStore`/`DEMO_ACCOUNTS` | **NO-GO** |
| 8 | **Driver Portal real data** | ⛔ BLOCKED→FAIL | sandbox renders demo driver/feed/earnings; real path (`driverService` + `complete_delivery`) exists but needs auth+grants (#1,#4) | 🟠 High — currently demo data, real untested | None | **NO-GO** |
| 9 | **Merchant Portal real data** | ⛔ BLOCKED→FAIL | sandbox renders demo branch/orders/products; real path (`merchantService`/`orderService`) exists, needs auth+grants | 🟠 High | None | **NO-GO** |
| 10 | **Admin Portal real data** | ⛔ BLOCKED→FAIL | sandbox feeds order count; real path (`adminService.getGlobalAnalytics` + 0018 scoping) exists, blocked by #1/#2/#4 | 🟠 High | None | **NO-GO** |

## Critical blockers (must clear before GO)
1. 🔴 **Build ships in sandbox mode with demo credentials** (#6, #7) — `123456` + Super-Admin phone are in the bundle and active. **Hardest blocker; trivially exploitable if deployed as-is.**
2. 🔴 **Phone provider disabled** (#4) — no real auth path.
3. 🔴 **Migration 0019 unconfirmed** (#1) — authenticated users would be `42501`-locked.
4. 🟠 **`order_country_code` recursion** (#2) — breaks admin orders + RBAC.

## Required before re-audit (none done here — audit only)
- Build with `VITE_AUTH_MODE=supabase`; add a build-time flag so `sandboxStore`/`DEMO_ACCOUNTS`/OTP are excluded from prod bundles; re-run the bundle grep → expect **0** hits for `123456`/`haat_sb_orders`/demo phones.
- Enable Phone provider + Test OTP; apply `0019`; apply `order_country_code` DEFINER fix; provision roles; verify money/delivery RPCs `prosecdef=true`.
- Re-run authenticated-role + RBAC proof queries (in `PRODUCTION_VALIDATION_REPORT.md`) and the portal/workflow suites in supabase mode.

## Go/No-Go
**NO-GO for production.** The single most urgent item is the **sandbox-in-bundle / demo-credential exposure (#6/#7)** — a security issue, not just readiness. Clear the four critical blockers, then re-audit to convert the BLOCKED rows to verified PASS/FAIL.
