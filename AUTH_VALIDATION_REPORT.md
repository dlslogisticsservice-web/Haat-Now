# Auth Validation Report — Production Activation

**Scope chosen:** harden the LIVE (Supabase) path, keep sandbox first-class behind the flag; validate at
**code level + sandbox E2E** now, with live-runtime sign-off flagged for staging (no SMS OTP reachable here).

## Result
The live authentication path was found **already implemented and correctly gated** — Phase 2 required
verification, not new code (no placeholder was invented). Production auth uses **only real Supabase Auth**; the
sandbox demo identity is a separate path behind `VITE_AUTH_MODE`.

## Environment model (three-tier)
| Env | `VITE_AUTH_MODE` | Identity source |
|---|---|---|
| **Sandbox** (demo + E2E) | `sandbox` | `DEMO_ACCOUNTS` + `localStorage haat_sandbox_session` |
| **Staging** | `supabase` (staging project vars) | real Supabase Auth |
| **Production** | `supabase` (prod project vars) | real Supabase Auth |
Staging and production share **one** live code path; they differ only by which Supabase project
(`VITE_SUPABASE_URL`/`ANON_KEY`) is built in (`HAAT_LIVE_BACKEND=1`).

## Live auth surface — code-verified ([`src/services/auth.service.ts`](src/services/auth.service.ts))
| Concern | Live implementation | Verified |
|---|---|---|
| Request OTP | `supabase.auth.signInWithOtp({ phone })` | ✅ code |
| Verify OTP → session | `supabase.auth.verifyOtp({ phone, token, type:'sms' })` | ✅ code |
| **Session recovery** | `getCurrentUser()` → `supabase.auth.getUser()` + role | ✅ code |
| **Refresh tokens** | supabase-js default `autoRefreshToken` (persisted session) | ✅ code (default client) |
| **Logout** | `supabase.auth.signOut()` | ✅ code |
| **Role resolution** | `resolveHighestRole()` over `user_roles → roles(name,priority)` (JS max-priority; documented PostgREST-ordering workaround) | ✅ code |
| Admin scope | `getAdminScope()` → `admin_users.scope` (super/country) | ✅ code |
| **Country resolution** | `country-detection.service` (offline-first: manual → persisted → GPS → locale → default) | ✅ code |
| Access token (edge fns) | `getAccessToken()` → `getSession().access_token` | ✅ code |
| Auth-state subscription | `supabase.auth.onAuthStateChange` (login/logout/refresh) | ✅ code |
| New-customer bootstrap | auto-insert into `customers` on first customer login | ✅ code |

**LocalStorage identity is NOT used in live mode** — every branch above is gated by `IS_SANDBOX`, and the live
branch touches only Supabase. The `App.tsx` session-restore + `onAuthStateChange` keep the real session
authoritative (no fake session stored).

## Sandbox parity (preserved)
Sandbox login (`DEMO_ACCOUNTS` + OTP `123456`) is unchanged. Verified by the E2E suite: customer/merchant/driver/
admin login journeys **24/24 pass**.

## What still needs a staging run (live runtime sign-off)
These cannot be exercised from this environment (no reachable SMS OTP / seeded users) and are the residual
validation before production trust:
1. Real phone-OTP send/verify against the staging Supabase project (SMS provider configured).
2. `user_roles`/`roles` seeded so `resolveHighestRole` returns the intended role per user.
3. `admin_users` seeded so `getAdminScope` returns super/country correctly.
4. Token auto-refresh across an expiry boundary (long-session test).
5. `seed_demo_accounts.sql` requires the manual `auth.users` creation step first.

## Gate
Typecheck **0** · Build **✓** · Sandbox E2E **24/24**. No behavior change to the sandbox demo.
