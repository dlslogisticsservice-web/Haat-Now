# Supabase Migration Report — Production Activation

How the app runs on real Supabase (staging/production), what is already wired, and the operator steps to stand up
a live environment. No schema was changed this sprint.

## Three-environment architecture
| Env | Build flag | `VITE_AUTH_MODE` | Supabase project | Backend |
|---|---|---|---|---|
| **Sandbox** | (default) | `sandbox` | none (Proxy stub) | localStorage; demo + automated E2E |
| **Staging** | `HAAT_LIVE_BACKEND=1` | `supabase` | staging URL/anon key | real Postgres + Auth + RLS + Storage + Realtime + edge fns |
| **Production** | `HAAT_LIVE_BACKEND=1` | `supabase` | production URL/anon key | same live code path as staging |

**Sandbox is never mixed with a live runtime:** in live builds `VITE_AUTH_MODE=supabase`, so every `SANDBOX`
branch is inert and `lib/supabase` returns the real client. This sprint additionally closed the one ungated
sandbox read (`OpsIncidentLog`, see §Data) so no live path touches `sandboxStore`.

## What already runs on real Supabase (code-verified)
- **Auth** — `signInWithOtp`/`verifyOtp`/`getUser`/`onAuthStateChange`/`signOut` (see AUTH_VALIDATION_REPORT).
- **Data** — services use `adminCrud(table)` (→ `supabase.from`) and direct `supabase.from(...)`/RPC in live; the
  client references **78 tables** and many RPCs.
- **Payments** — `paymentOrchestrator.initiate()` → edge functions (see PRODUCTION_READINESS_REPORT §Payments).
- **Storage** — `storage.service` (product/merchant/banner/offer/avatar buckets) + `assets.service`
  (`experience-assets`).
- **Realtime** — order/driver-location/notification/audit channels activate when `VITE_AUTH_MODE=supabase`.
- **RBAC guard** — now identity-driven from `user_roles`/`admin_users` + RLS enforcement (this sprint).

## Schema inventory (existing; unchanged this sprint)
- **48 migrations** in [`supabase/migrations/`](supabase/migrations/), **~110 tables** (all `IF NOT EXISTS`),
  including dedicated `security_hardening` (×2), `rls_recovery`, `admin_rls_policies`, and scale/index migrations.
- **4 edge functions** ([`supabase/functions/`](supabase/functions/)): `payment-initiate`, `payment-verify`,
  `payment-refund`, `payment-webhook` (Deno; service-role vs RLS-scoped clients; HMAC + idempotency).
- **Seeds**: `seed.sql` (idempotent demo content), `seed_demo_accounts.sql` (6 demo accounts — **requires a manual
  `auth.users` creation step** + UUID substitution).
- **Legacy**: `src/db/migrations/0000–0007` (superseded subset of `supabase/migrations`) — reconcile to a single
  source in a follow-up.

## Operator runbook to stand up staging/production
1. Provision a Supabase project (staging first). Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
2. Apply all migrations in `supabase/migrations/` (in order). Confirm RLS policies are enabled.
3. Deploy the 4 edge functions; set their secrets (`MOYASAR_SECRET_KEY`, webhook signing secret, service-role key).
4. Create `auth.users` for real/test users; seed `user_roles`, `roles`, `role_permissions`, `admin_users`
   (grant the intended role/scope per user).
5. Configure the SMS OTP provider (for phone auth).
6. Build with `HAAT_LIVE_BACKEND=1` → ships `VITE_AUTH_MODE=supabase`.
7. Optional infra env vars: `VITE_GOOGLE_MAPS_API_KEY`, `VITE_SENTRY_DSN`, `VITE_ANALYTICS_URL`.

## Data-layer separation (this sprint)
- Audited all 10 `sandboxStore` importers: 9 were already gated by `VITE_AUTH_MODE`; **`OpsIncidentLog` was
  ungated** and would read the sandbox store in live. Fixed: sandbox keeps the demo store; **live reads real
  cancelled orders via `adminCrud('orders')`** (defensive column mapping). No behavior change to the sandbox demo.

## Residual for production runtime sign-off (staging)
- Verify each migration applies cleanly on a fresh project; verify RLS enforces the RBAC matrix.
- Confirm every client RPC the services call exists and returns the expected shape (finance settlements, dispatch,
  loyalty, wallet `complete_delivery`, coupon redeem, KYC).
- Automate the `auth.users` seeding step; reconcile the two migration sets.

## Gate
Typecheck **0** · Build **✓** · Sandbox E2E **24/24**.
