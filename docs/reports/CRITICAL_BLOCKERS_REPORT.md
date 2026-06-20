# CRITICAL_BLOCKERS_REPORT.md

_Ranked by severity. Every item is backed by a live probe (see PRODUCTION_VALIDATION_REPORT.md)._

## 🔴 BLOCKER-1 — Supabase Phone provider disabled
- **Evidence:** `POST /auth/v1/otp` → `400 phone_provider_disabled`; `/auth/v1/settings` → `"phone": false`.
- **Impact:** the app's only login UI (phone OTP) cannot authenticate in `supabase` mode → **no real users, no authenticated sessions, nothing downstream is testable**.
- **Owner:** Supabase dashboard (Auth → Providers → Phone). Not fixable from the codebase.
- **Fix:** enable Phone + add Test OTP numbers (no SMS cost) or wire Twilio/MessageBird.

## 🔴 BLOCKER-2 — No service-role / DB / SQL-Editor access in this environment
- **Evidence:** no service-role key, DB password, `supabase` CLI, `psql`, or `pg` module present; `/rest/v1/pg_policies` → 404 for anon.
- **Impact:** cannot apply migrations, cannot run SQL proof queries, cannot verify `authenticated` grants/RLS behaviorally. Gates items 2–6 of the validation.
- **Fix:** run the prepared SQL/migrations in the Supabase SQL Editor (queries provided in the validation report).

## 🔴 BLOCKER-3 — Migration `0019_authenticated_grants` not confirmed applied
- **Evidence:** unverifiable via anon; no `GRANT … TO authenticated` exists in any earlier migration (catalog needed manual anon grants), so the strong prior is it is **not applied** — but **not asserted as fact**.
- **Impact:** if unapplied, **every logged-in user gets `42501`** on orders/wallets/carts/notifications/favorites/addresses → the entire authenticated app is non-functional even after login is enabled.
- **Fix:** apply `0019` (idempotent) and confirm with the `role_table_grants` proof query.

## 🟠 BLOCKER-4 — `order_country_code()` is SECURITY INVOKER → RLS recursion
- **Evidence (live):** the function returned `42501` (ran under the caller's role = invoker). It self-`SELECT`s from `orders` and is referenced by the `"Admins read orders by scope"` policy on `orders`.
- **Impact:** an admin reading `orders` triggers `infinite recursion detected in policy for relation "orders"` → **admin order views break**; country isolation untestable.
- **Fix:** `CREATE OR REPLACE … SECURITY DEFINER` (SQL prepared in prior phase). Apply before any admin order read.

## 🟠 BLOCKER-5 — Email auth requires confirmation; no fallback session path
- **Evidence:** `disable_signup:false` but `mailer_autoconfirm:false`; `anonymous_users:false`; all OAuth `false`.
- **Impact:** even with email enabled there is no way to obtain a usable JWT without inbox access → no alternative to fix BLOCKER-1 for testing.
- **Fix:** enable Test OTP (BLOCKER-1) **or** temporarily set `mailer_autoconfirm` / create a confirmed test user via dashboard.

## 🟡 BLOCKER-6 — Money/delivery RPC SECURITY DEFINER status unverified
- **Evidence:** `complete_delivery`/`complete_delivery_payout`/`adjust_wallet_balance` deployed + auth-gated (`P0001`), but `prosecdef` not readable via anon.
- **Impact:** if any is `INVOKER`, wallet/payout writes fail under SELECT-only client grants.
- **Fix:** verify with the `pg_proc.prosecdef` query; `ALTER FUNCTION … SECURITY DEFINER` if needed.

## 🟡 BLOCKER-7 — Push notifications not end-to-end
- **Evidence (prior audits):** `push_tokens` never written; no FCM/web-push/service worker.
- **Impact:** no real push delivery (in-app Realtime only).

## 🟢 BLOCKER-8 — Residual demo/mock paths
- **Evidence:** `DEMO_ACCOUNTS` + sandbox branches in `auth.service`, `DriverApp`, `MerchantApp`; `PAYMENT_MODE=sandbox`.
- **Impact:** none in production mode (bypassed when `VITE_AUTH_MODE=supabase`), but must be confirmed off before go-live.

## Dependency order
BLOCKER-1 → BLOCKER-3 → BLOCKER-4 → (then items 3–6 become testable) → BLOCKER-6 → BLOCKER-7. BLOCKER-2 is the access prerequisite for 3/4/6.
