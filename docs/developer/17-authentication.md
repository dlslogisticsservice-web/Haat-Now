# 17 · Authentication

> **Audience:** developers touching login/session.
> **FROZEN SYSTEM.** Auth/OTP/login/Supabase migration are frozen — change only for a critical production bug,
> and never re-add a `DEV` gate (it broke production login before).

## Purpose
Authenticate users via phone + OTP in two interchangeable modes, deriving the user's role/scope so `App.tsx` can
route them to the right portal.

## Architecture
```
Login screen → auth.service.sendOtp(phone) → auth.service.verifyOtp(phone, code) → session → App role router
                     │ mode = VITE_AUTH_MODE (ONLY gate)
      ┌──────────────┴───────────────────────────┐
sandbox: DEMO_ACCOUNTS + SANDBOX_OTP '123456'     supabase: real phone OTP (HAAT_LIVE_BACKEND=1)
   session → haat_sandbox_session                    session → Supabase Auth
```
- [`src/services/auth.service.ts`](../../src/services/auth.service.ts):
  - `IS_SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox'` — the **only** mode gate. **Do NOT** add
    `&& import.meta.env.DEV` (production build has `DEV=false` → nobody could log in).
  - `SANDBOX_OTP = '123456'`; `DEMO_ACCOUNTS` — E.164-keyed accounts with **valid UUID ids** (so uuid-typed
    Supabase queries never `22P02`).
  - Role resolution reads the highest-priority role from the DB in supabase mode (deliberately not using
    PostgREST embedded ordering — see the in-file note).
- [`src/lib/supabase.ts`](../../src/lib/supabase.ts) — the mode-gated client (no-op realtime in sandbox). Must
  agree with `auth.service` on the mode gate.
- [`src/features/auth/`](../../src/features/auth/) — login/OTP UI + `User` type.

## Flow
```
Enter phone → sendOtp → (sandbox) accept 123456 for a DEMO_ACCOUNT | (live) Supabase sends real OTP
Enter code → verifyOtp → resolve role/scope → persist session → App routes to customer/driver/merchant/admin
account.service handles logout cleanup (clears haat_* keys)
```

## Dependencies
- `lib/supabase` (client + mode), `utils/phone` (`toE164`), `account.service` (logout cleanup), `rbac.service`
  (permissions once authenticated), consumed by `App.tsx` and every portal.

## Extension points
- **New demo account** → add an entry to `DEMO_ACCOUNTS` with a valid UUID id + role + country.
- **New auth mode behavior** → gate on `VITE_AUTH_MODE` only; keep sandbox + live parity.

## Reuse rules
- The mode gate is `VITE_AUTH_MODE` **everywhere** (auth.service, lib/supabase, every service). Never diverge.
- Don't build a second session store — sandbox uses `haat_sandbox_session`, live uses Supabase Auth.

## Files involved
- [`src/services/auth.service.ts`](../../src/services/auth.service.ts) ·
  [`src/services/account.service.ts`](../../src/services/account.service.ts) ·
  [`src/lib/supabase.ts`](../../src/lib/supabase.ts) ·
  [`src/features/auth/`](../../src/features/auth/) · [`vite.config.ts`](../../vite.config.ts) (forces sandbox in
  prod unless `HAAT_LIVE_BACKEND=1`).

## Do's
- ✅ Use the demo accounts + `123456` in sandbox. ✅ Keep UUID ids valid. ✅ Treat auth as frozen — minimal,
  surgical changes only.

## Don'ts
- ❌ **Never** add an `import.meta.env.DEV` gate to auth mode. ❌ Don't create a second session store.
- ❌ Don't change the migration/backend to satisfy a feature (frozen).

## Example
```ts
// Sandbox login (what the E2E suite and demo use):
await authService.sendOtp('+201000000005');       // super admin
await authService.verifyOtp('+201000000005', '123456');  // → admin session, super scope
```

## Next
[16-rbac.md](16-rbac.md) · [18-multi-tenancy.md](18-multi-tenancy.md)
