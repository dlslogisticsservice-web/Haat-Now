# AUTH_SOURCE_REPORT.md — HAAT NOW

_Diagnostic: where is the working `123456` login coming from. Every line below is from a live probe, the source, or a runtime trace (dev server + Puppeteer with network + localStorage capture)._

## AUTH SOURCE = **SANDBOX** (client-side demo code) — NOT Supabase

---

## Decisive proof (two independent facts, either alone is conclusive)
1. **Supabase cannot issue or verify any OTP.** Live: `POST /auth/v1/otp` → `{"error_code":"phone_provider_disabled","msg":"Unsupported phone provider"}`. A Supabase "Test OTP" (incl. `123456`) **requires the Phone provider enabled** — it is not. So `123456` cannot originate from Supabase.
2. **`123456` is honored in exactly one place in the code:** [auth.service.ts:76](src/services/auth.service.ts#L76) — `if (token !== SANDBOX_OTP)` — inside the `if (IS_SANDBOX)` branch of `verifyOtp`. `SANDBOX_OTP = '123456'`. Supabase's `verifyOtp` does not hardcode any code. ⇒ a successful `123456` login **is** the sandbox path.

**Why it's active in the running app:** `const IS_SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox' && import.meta.env.DEV` ([auth.service.ts:14](src/services/auth.service.ts#L14)). `.env` has `VITE_AUTH_MODE=sandbox`. `IS_SANDBOX` is true only when **`import.meta.env.DEV` is true** — i.e. the app is being served as a **development build** (`npm run dev`/`vite` dev) **or** a stale bundle built before the fix (commit `cb8d7ad`). A current production build (`npm run build`, `DEV=false`) returns 0/6 (already proven).

## Required checks
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Current auth flow | Sandbox gate active | `IS_SANDBOX = VITE_AUTH_MODE==='sandbox' && import.meta.env.DEV` = true in the running (dev) build |
| 2 | `sendOtp()` path | **Sandbox** | Returns `{error:null}` if `DEMO_ACCOUNTS[phone]` exists; no `supabase.auth.signInWithOtp`. Runtime: **0 calls to `/auth/v1/*` during login** |
| 3 | `verifyOtp()` path | **Sandbox** | Checks `token === '123456'`, writes `localStorage['haat_sandbox_session']`; no `supabase.auth.verifyOtp` |
| 4 | Exact path of successful logins | localStorage demo path | Runtime: after login, `haat_sandbox_session` present; **0** Supabase auth network calls |
| 5 | Supabase session created? | **NO** | No `sb-*-auth-token` key in localStorage; `getAccessToken()` returns `''` in sandbox |
| 6 | `auth.users` contains these users? | **NO** | Sandbox never touches `auth.users`; provider disabled so OTP can't create users; ids are app-fixed UUIDs (`11111111-0000-…-000000000001`) |
| 7 | Real Supabase JWTs? | **NO** | Session value is plaintext `{"id":"…","phone_number":"+201000000001","role":"customer"}` — not a JWT; no `access_token`/`refresh_token` |
| 8 | Survives page refresh? | **YES** (sandbox) | Runtime: after reload, still logged in + `haat_sandbox_session` persists (localStorage-backed) |
| 9 | Survives logout/login cycles? | **YES** (sandbox) | Logout → back to phone screen + key cleared; login again → succeeds |

## Session Source
**Browser `localStorage` key `haat_sandbox_session`** (client-only JSON blob written by the sandbox `verifyOtp`). No server session, no cookie, no Supabase auth storage.

## JWT Source
**None.** There is no JWT. The "session" is an unsigned, client-written `{id, phone_number, role}` object. `getAccessToken()` returns `''`, so any code calling a real Supabase/edge endpoint with that token would be unauthenticated.

## Risk Level
- **If this "live application" is a local/dev instance (`npm run dev`):** 🟢 **Expected by design** — sandbox is intentionally on in dev for demos; production builds strip it.
- **If this "live application" is publicly reachable / a deployment:** 🔴 **CRITICAL** — it means a **dev-mode build or a pre-fix bundle is deployed**, which is the exact full-role auth bypass (anyone typing `123456` logs in as any role, **including Super Admin**). The fix exists in code but only takes effect in a **production build**.

## Recommended Next Action
1. **Identify what serves the "live" app.** If `123456` works there, it is running with `import.meta.env.DEV=true` (a dev server / `vite preview` of a dev build) or a stale pre-`cb8d7ad` bundle — **not** a current production build.
2. **If it is meant to be production:** deploy a **fresh `npm run build`** of the current code (which yields `DEV=false` → sandbox tree-shaken, 0/6 demo logins — already verified) and serve `dist/` (never `npm run dev`). Set `VITE_AUTH_MODE=supabase` in the deploy env as defense-in-depth.
3. **To get real auth working** (so real accounts log in instead of sandbox): enable the Supabase **Phone provider / Test OTP**, then apply the rest of the production runbook (`FINAL_PRODUCTION_CERTIFICATION.md` — migration 0019, `order_country_code` DEFINER, role provisioning).
4. **For local demos:** keep using `npm run dev` — sandbox `123456` is the intended, contained behavior there.

> Bottom line: the working `123456` is **100% sandbox**, served from a dev-mode/non-production build. No Supabase session, no `auth.users` row, no JWT is involved. Real authentication is still inactive (phone provider disabled).
