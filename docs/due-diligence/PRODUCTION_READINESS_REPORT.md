# Production Readiness Report
**HAAT NOW — Enterprise Due-Diligence Audit (Parts 9 & 10)**
Security review + production-readiness matrix. Read-only. Every claim cites `file:line`.

---

## 0. The defining diligence fact (read first)
**The shipped build is force-compiled into sandbox/demo mode.** `vite.config.ts:12-15`: `authMode = process.env.HAAT_LIVE_BACKEND === '1' ? 'supabase' : 'sandbox'`, hard-baked via `define`; `.env.production:10` also sets `VITE_AUTH_MODE=sandbox`. In sandbox mode the Supabase client is replaced with a no-op stub (`lib/supabase.ts:19-35`) and the entire app runs client-side against `localStorage`. Consequences:
- Every "wired" backend capability below is **present in code but inactive** in the deployed artifact unless someone rebuilds with `HAAT_LIVE_BACKEND=1`.
- As shipped, **anyone can authenticate into any role (including super-admin) with the hardcoded OTP `123456`** (`auth.service.ts:15,30,104-115`).

This is a deliberate, well-documented demo posture — **not** an accidental defect. But for a real production launch it is the master gate: the platform has never been operated against its live backend in the shipped artifact.

---

## 1. Security Review (Part 9)

| # | Issue | Severity | Evidence | Impact |
|---|---|---|---|---|
| S1 | Shipped build authenticates with hardcoded OTP into any role incl. super-admin; sessions in localStorage | **Critical** *(by-design demo; blocker for real launch)* | `auth.service.ts:15` `SANDBOX_OTP='123456'`, super account `:30`, verify `:104-115`; forced sandbox `vite.config.ts:12-15` | Full account/role takeover in the deployed demo. Acceptable only while this artifact is understood as a demo. |
| S2 | **Webhook HMAC verification silently skipped when `PAYMENT_WEBHOOK_SECRET` is unset** | **High** | `payment-webhook/index.ts:64-67` logs a warning and continues without verifying | If the secret isn't configured in the live project, a forged `captured` event can mark orders `paid` (`:183-197`). Must be a hard failure in prod; mitigation is currently operational, not enforced. |
| S3 | Fine-grained RBAC is **client-side only**; server enforcement is coarse RLS, not the permission catalogue | **Medium** | `rbac.service.ts:30-66` (catalogue), `:154-159` (client resolution); `useRbac.tsx`/`Can` gate UI `:14,20-23`. Live identity is fail-closed from role + `admin_users.scope` (`auth.service.ts:145-159`) | Granular perms (`finance.pay`, `security.rbac.manage`) are enforced only in the browser. A live deploy needs RLS to mirror them as the real gate. |
| S4 | Sandbox acting-role defaults to `super_admin` and is user-editable via localStorage | **Medium** *(scoped to sandbox = the shipped mode)* | `rbac.service.ts:180` default `super_admin`; `setActingRole` writes localStorage `:182-185` (no-op in live mode `:179,183`) | In the shipped build a user can self-assign super-admin. Correctly disabled when live. |
| S5 | Permissive CORS `Access-Control-Allow-Origin: *` on payment functions | **Low** | `_shared/cors.ts:4` | Acceptable (each endpoint verifies the caller JWT) but scope to known origins for defense-in-depth. |
| S6 | CSP allows `'unsafe-inline'` for `script-src` | **Low** | `vercel.json:25` | Weakens XSS mitigation; needed for the current Vite/inline setup. Rest of CSP is strong. |

### Security checks that PASSED (evidence)
- **No client-side secrets / service-role key:** 0 `service_role` refs in `src/`. Service-role key is read only server-side (`_shared/supabase.ts:10`, `payment-refund:43`). Client uses only the anon *publishable* key (`.env.production:9`). `.env*` is gitignored except `.env.example` (placeholders only).
- **VITE_-prefix hygiene:** all `VITE_`-exposed vars are public by nature (Supabase URL/anon, Google Maps, Stripe/Paymob *public* keys). No private key is `VITE_`-prefixed.
- **Injection:** all DB access via the Supabase SDK (parameterized); no raw SQL interpolation in `src/`. Edge functions validate every input (`payment-initiate:69-77,109-120`; `payment-verify:54-56,75-80`).
- **Webhook integrity (when configured):** HMAC-SHA256 with **constant-time compare** (`payment-webhook:227-259`) + idempotency (`:95-134`) + no-downgrade guards (`:175,188`).
- **XSS:** 0 `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`new Function` in `src/`.
- **Open redirect / `_blank`:** every `target="_blank"` carries `rel="noreferrer"` (`blocks.tsx:135-136`, `ProfileScreen.tsx:404`, `TenantOnboardingWizard.tsx:214`, `PlatformModuleRegistry.tsx:157-158`). `window.location` assignments are trusted (Moyasar URL from edge fn `CheckoutPage.tsx:402`; `tel:` `DriverApp.tsx:432`).
- **Dev hooks all DEV-gated:** `__sb` (`sandboxStore.ts:381`), `__prov` (`provisioning.service.ts:119`), `__tpl` (`templates.service.ts:112`), `__site` (`website.service.ts:272`) — each guarded by `import.meta.env.DEV`, tree-shaken from production. No ungated `window.__` exists.

## 2. Database security posture (cross-ref: Database Review)
- **No per-tenant RLS / no `tenant_id`** on domain tables — isolation deferred to a future rollout (`…000008:6-7`).
- **Prior P0:** an earlier release shipped RLS-enabled-with-zero-policies on 21 core tables (orders/wallets/admin_users…) — full default-deny lockout, remediated in `…000021_rls_recovery.sql:2-8`.
- **Prior IDOR fixes** live in `…000001` and patched in `…000026_security_hardening.sql`: `app_config` writable by any user, `payment_transactions` insert for any order, `support_messages` sender impersonation.
- **`audit_logs` and `settings` have policies but RLS is never `ENABLE`d** → policies inert (`…000021:203-207,219`).
- RLS churn across ≥6 migrations (two named `security_hardening` + one `rls_recovery`) indicates RLS was gotten wrong at least twice on the production track. **A live `pg_policies`/`pg_indexes` audit against the running DB is required to close these out** (migration files alone can't prove final state; `schema_dump.sql` is 0 bytes).

## 3. Production Readiness matrix (Part 10)

| Capability | Status | Evidence |
|---|---|---|
| **Supabase** | Wired (client) / **dormant in shipped build** | `lib/supabase.ts:37-41`; ~48 migrations, 180 `CREATE POLICY`. Shipped build runs the no-op stub (sandbox). |
| **Payments** | **Wired — real Moyasar (SAR)** | `payment-initiate:207-225` real `POST api.moyasar.com/v1/payments`; refund `:203-213`; webhook parses moyasar/stripe/mock. Requires `MOYASAR_SECRET_KEY`/`MOYASAR_CALLBACK_URL`; inactive in `PAYMENT_MODE=sandbox`. |
| **SMS / OTP** | **Missing in code / external-infra** | Live path is Supabase Auth `signInWithOtp`/`verifyOtp({type:'sms'})` (`auth.service.ts:96,118`) — depends on a Supabase phone provider (Twilio) enabled in the dashboard, not wired here. Sandbox uses hardcoded `123456`. |
| **Email** | **Missing** | No provider wired. `email` is only a channel enum (`growth.service.ts:8`); UI notes delivery "requires a provider integration" (`GrowthCenter.tsx:194`). Brand slot `email_header_url` has no consumer. |
| **Maps** | Wired (key-gated) | `@vis.gl/react-google-maps` in `OrderTrackingMap`, `LocationPicker`, `OperationsCommandCenter`, `OrdersList`; render gated on `VITE_GOOGLE_MAPS_API_KEY` (`OrdersList.tsx:488`). Restrict by HTTP-referrer in Google console. |
| **Storage** | **Wired — real uploads** | `storage.service.ts` uses `supabase.storage.from(bucket).upload(...)` across 5 buckets with owner-scoped paths matching storage RLS (`:107-118,133-143`). Inactive in sandbox. |
| **Analytics** | Partial / env-gated | `analytics.service.ts` aggregates from DB; telemetry via `monitoring.service.ts:36-40` POSTs to `VITE_ANALYTICS_URL` only when set. No GA/measurement-id wiring active. |
| **Monitoring / Logging** | Partial — seam only | `monitoring.service.ts:11-53` sends crashes to `VITE_SENTRY_DSN` when set, else console. No SDK bundled by default. Edge functions have structured logging (`_shared/log.ts`). |
| **CI/CD** | **Wired** | `.github/workflows/ci.yml`: typecheck+lint (`:25-26`), build+artifact (`:27-34`), Deno type-check of edge functions (`:36-46`), Puppeteer E2E in sandbox (`:48-66`), Vercel preview on PR (`:68-85`) and prod on `main` (`:87-104`), gated on `VERCEL_*` secrets. |
| **Deployment** | **Wired — strong headers** | `vercel.json`: SPA rewrites, immutable asset caching, full security-header set (`:25-32`): CSP (scoped connect/img/frame-src), HSTS preload (2y), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP. CSP uses `'unsafe-inline'` for scripts (S6). |
| **Backup / Recovery** | Absent in code / external-infra | No backup/DR artifacts in the repo; relies on Supabase-managed backups — not verifiable from code. |

## 4. Bottom line
The **security quality of the code is genuinely strong**: no client secrets, parameterized DB access, HMAC-verified idempotent webhooks, identity/scope guards on every edge function, zero XSS sinks, all dev hooks DEV-gated, and a robust CSP/HSTS deployment. The live backend (RLS, Moyasar, storage, Supabase OTP) is fully *implemented*.

The dominant diligence caveat is **posture, not code**: the artifact ships forced into sandbox/demo mode, and the only code-level residual risk in the live path is **S2** (webhook secret optional). A real production cutover is an **operational** program, not a rewrite:
1. Build with `HAAT_LIVE_BACKEND=1`; set all edge-function secrets (make `PAYMENT_WEBHOOK_SECRET` a hard failure).
2. Enable the Supabase phone (SMS) provider; wire an email provider.
3. **Run a live `pg_policies` audit** and add per-tenant RLS + `tenant_id` before onboarding real tenants (see Database Review §4-5).
4. Reconcile the duplicate `vehicles`/`driver_shifts` tables before the ops backend goes live.
