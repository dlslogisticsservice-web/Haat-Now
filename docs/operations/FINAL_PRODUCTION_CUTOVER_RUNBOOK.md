# FINAL PRODUCTION CUTOVER RUNBOOK — HAAT NOW

> Launch-day execution document. Code is **frozen / complete**. This runbook activates the
> already-built live backend + application. Nothing here changes application logic.

---

## 0. Context, definitions, roles

**Current state (verified):**
- **Deployed production** = the **sandbox demo** build at `main = bc6576e` (`/version.json`). It is 100% client-side (mock OTP `123456`, localStorage); it does **not** touch the database.
- **Live backend** (Supabase project `umwbzradvbsirsybfxfb`) is **fully migrated & validated**: 65 migrations, 143 tables, 147 functions, 7 storage buckets, 42-row RBAC catalog, `orders.payment_method` (COD), 4 ACTIVE payment edge functions.
- **COD + live-affiliate wiring** is committed on branch `feat/website-platform-architecture` (commit `aa81399`) and is **NOT yet on `main`**. It must be merged as part of cutover.
- **The single activation lever:** `vercel.json` `buildCommand` `"npm run build"` → **`"npm run build:live"`**. `build:live` (`scripts/live.cjs`) sets `HAAT_LIVE_BACKEND=1`, which `vite.config.ts` injects as `VITE_AUTH_MODE=supabase` → the app uses the real Supabase client, real OTP, real payments.

**Roles / owners referenced below:**
| Owner | Responsibility |
|---|---|
| **RM** — Release Manager (you) | Approvals, Vercel dashboard, go/no-go, store consoles |
| **OPS** — Ops/DevOps | Secrets, Supabase dashboard, DNS |
| **AGENT** — Claude (MCP + git) | DB checks via MCP, git merge, `vercel.json` edit, smoke automation — **only on explicit approval** |
| **MOB** — Mobile engineer | Android/iOS signing, store submissions |

**Hard rule:** nothing in Phase 5 executes until **every** checkbox in Phase 1–4 and Phase 8 is ticked.

---

## Phase 1 — Production Secrets

> None are hardcoded. All are injected at the platform (Supabase / Vercel). Anon/publishable keys are public by design; everything below marked *secret* must never be committed.

| Secret | Where configured | How verified | Owner |
|---|---|---|---|
| **SMS provider creds** (e.g. Twilio SID + auth token + sender) | Supabase → Auth → Providers → **Phone** → SMS provider | Send OTP to a real handset on the preview build (Phase 6 AUTH-1) | OPS |
| **`MOYASAR_SECRET_KEY`** (`sk_live_…`) *secret* | Supabase → Edge Functions → **Secrets** | `payment-verify` returns a real charge status on a test charge | OPS |
| **`MOYASAR_PUBLISHABLE_KEY`** (`pk_live_…`) | Vercel env **and/or** function config as used | Gateway page loads on a live checkout | OPS |
| **`MOYASAR_WEBHOOK_SECRET`** *secret* | Supabase → Edge Functions → Secrets | Webhook signature validates; `webhook_events` row written once (idempotent) | OPS |
| **`SUPABASE_SERVICE_ROLE_KEY`** *secret* | Supabase → Edge Functions → Secrets (auto-available to functions) | `payment-refund` / `payment-webhook` execute server-side writes | OPS |
| **`VITE_SUPABASE_URL`** = `https://umwbzradvbsirsybfxfb.supabase.co` | Vercel → Project → Env (Production) | `npm run check:env` passes; app connects | OPS |
| **`VITE_SUPABASE_ANON_KEY`** = `sb_publishable_R8uX…` (publishable, public) | Vercel → Project → Env (Production) | `check:env` passes | OPS |
| **`VITE_GOOGLE_MAPS_API_KEY`** | Vercel → Env (Production) | Tracking map tiles render (Phase 6 MAPS-1) | OPS |
| **`VITE_SENTRY_DSN`** (recommended) | Vercel → Env (Production) | Crash appears in Sentry after a forced test error | OPS |
| **`VITE_ANALYTICS_URL`** (optional) | Vercel → Env (Production) | Collector receives a pageview event | OPS |
| **Rotate `SUPABASE_ACCESS_TOKEN`** in `.mcp.json` | Local dev config (not prod) | Old token revoked in Supabase account | OPS |

- **Prerequisite for the phase:** a live Moyasar merchant account + a live SMS provider account.
- **Rollback action:** secrets are additive/config-only — unsetting them or leaving `buildCommand` on `npm run build` keeps the sandbox demo live. No data risk.

---

## Phase 2 — Supabase (production configuration)

Project ref: **`umwbzradvbsirsybfxfb`**. All items already provisioned unless noted.

| Area | Required config | Expected result | Verification | Owner |
|---|---|---|---|---|
| **Authentication** | Phone provider **enabled** + SMS provider set; disable "confirm email" flows (phone-only); set OTP length/expiry | Real OTP delivered; mock `123456` unreachable in live build | OTP to real phone succeeds; a wrong code fails | OPS |
| **Storage** | 7 buckets present: `product-images, merchant-logos, banners, offer-images, avatars, experience-assets` (public), `kyc-documents` (private) | Uploads via signed URLs succeed; KYC not publicly readable | `select id,public from storage.buckets` = 7 rows, KYC `public=false` | AGENT (verify) / OPS |
| **Realtime** | `notifications`, `orders`, `driver_locations` on `supabase_realtime` publication | Client receives live updates | `pg_publication_tables` shows the 3 tables | AGENT (verify) |
| **RLS** | Enabled on all app tables; policies server-enforced (`rbac_server_enforcement` live) | No cross-tenant/role leakage | `get_advisors(security)` = 0 ERROR/CRITICAL | AGENT (verify) |
| **RLS — optional hardening** | `driver_performance`, `shift_breaks` have RLS off (⚠ non-exploitable: no anon/authenticated grants) | Defense-in-depth | Enable RLS + policies mirroring `driver_shifts` **only if desired** (not required) | OPS |
| **Edge Functions** | `payment-initiate` (verify_jwt=true), `payment-verify` (true), `payment-webhook` (false), `payment-refund` (false) — all ACTIVE | Payment pipeline reachable | `list_edge_functions` = 4 ACTIVE | AGENT (verify) |
| **Cron / Scheduled** | ⚠ `pg_cron` / `pg_net` **not installed** → settlement/finance sweeps are **not** auto-scheduled | Settlements run | Enable `pg_cron`+`pg_net` and schedule, **or** trigger settlements from Admin. Decide before launch. | OPS |
| **Migrations** | 65 applied, `list_migrations` = 65 | Schema matches repo intent | `select count(*) from supabase_migrations.schema_migrations` = 65 | AGENT (verify) |

- **Prerequisite:** Phase 1 SMS + Moyasar secrets set.
- **Rollback action:** DB changes are frozen/additive; no schema rollback needed at cutover. If ever required: PITR to the pre-cutover timestamp (Phase 7).

---

## Phase 3 — Vercel

| Item | Required value | Owner | Verification | Rollback |
|---|---|---|---|---|
| **Environment Variables (Production)** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (required); `VITE_GOOGLE_MAPS_API_KEY`, `VITE_SENTRY_DSN`, `VITE_ANALYTICS_URL` (recommended) | OPS | `check:env` passes in the build log | Remove vars |
| **Build Command** | Change `"npm run build"` → **`"npm run build:live"`** in `vercel.json` (repo) | RM approves / AGENT edits | `git diff vercel.json` shows only this line | Revert the line |
| **Production branch** | `main` | RM | Vercel project settings | — |
| **Domains** | Production domain attached (e.g. `haat-now.vercel.app` + any custom domain) | RM | `curl https://<domain>/health.json` → `ok` | — |
| **Preview deploy** | Build the cutover commit as a **Preview** first (not production) | RM | Preview URL builds `build:live`, `check:env` passes | Delete preview |
| **Production deploy** | Promote preview → production (atomic swap) | RM | `/version.json` shows new SHA, `env: production` | Instant redeploy of prior build |
| **Rollback (Vercel)** | Vercel keeps prior deployments | RM | "Promote to Production" on the previous (sandbox) deployment | ~1–2 min |

- **Prerequisite:** Phase 1 & 2 complete; COD/affiliate commit merged to `main` (Phase 5 step 2).
- **Expected result:** production serves a **live-backend** build.

---

## Phase 4 — Mobile Release

> Web cutover does not depend on mobile; mobile stores are a parallel track. The web PWA is live at cutover.

### Android
| Item | Config | Owner | Verification | Rollback |
|---|---|---|---|---|
| **Signing** | Provide `keystore.properties` + release keystore (gitignored, injected at build) | MOB | Release AAB signed | Use prior signed build |
| **Google Play** | App `com.haatnow.app`, versionCode **1** / versionName **1.0**, minSdk 24 / target 36; upload AAB | MOB | Play Console accepts AAB | Halt rollout |
| **Deep Links** | Custom scheme `haatnow://` intent filter (present) | MOB | `adb` deep-link opens app | — |
| **App Links (HTTPS)** | ⚠ Manifest host = `app.haatnow.com`; emails/iOS use `haatnow.app`. **Reconcile the domain** and host `/.well-known/assetlinks.json` on the chosen host | MOB + OPS | `autoVerify` passes; link opens app, not browser | Fall back to custom scheme |
| **Push** | ⚠ **Not implemented** (no `@capacitor/push-notifications`, no FCM function). Requires Firebase project + FCM key + plugin (native rebuild) | MOB | Test push received on device | Ship without push; in-app Realtime works |

### iOS
| Item | Config | Owner | Verification | Rollback |
|---|---|---|---|---|
| **Certificates** | Apple distribution cert + provisioning profile; bundle `com.haatnow.app` | MOB | Archive signs | Prior build |
| **Universal Links** | ⚠ **Not configured** (custom scheme `haatnow` only). Add `com.apple.developer.associated-domains` + host `apple-app-site-association` | MOB + OPS | Link opens app | Custom scheme fallback |
| **Usage strings / export compliance** | Present (location/camera/photos/tracking; `ITSAppUsesNonExemptEncryption=false`) | MOB | App Store validation passes | — |
| **Store assets** | ⚠ **Screenshots missing** — required by both stores | MOB | Console accepts screenshots | Cannot submit without them |

---

## Phase 5 — Production Cutover (exact execution order)

> Execute strictly in order. Do not skip. Each step: **Owner · Prereq · Expected · Rollback · Verify.**

**5.1 — Freeze & backup**
- Owner: OPS · Prereq: none · Expected: a known-good restore point.
- Action: confirm/trigger a Supabase backup; **record the PITR timestamp** `T0`.
- Rollback: n/a (this *is* the anchor). · Verify: backup timestamp noted.

**5.2 — Merge COD/affiliate wiring to `main`**
- Owner: AGENT (on RM approval) · Prereq: Phase 1–4 green.
- Action: fast-forward/merge `feat/website-platform-architecture` commit `aa81399` into `main` **without** the `build:live` flip yet.
- Expected: `main` contains COD + `qualify_referral` wiring; still building sandbox.
- Rollback: `git revert`/reset `main` to `bc6576e`. · Verify: `git log main` shows `aa81399` content; `vercel.json` still `npm run build`.

**5.3 — Set the build flag**
- Owner: RM approves / AGENT edits · Prereq: 5.2 done, Phase 1 secrets set.
- Action: edit `vercel.json` `buildCommand` → `"npm run build:live"`; commit.
- Expected: next build is live-mode.
- Rollback: revert the one line. · Verify: `git diff` shows only `buildCommand`.

**5.4 — Preview deploy (NOT production)**
- Owner: RM · Prereq: 5.3 pushed to a preview branch or PR.
- Action: let Vercel build a **Preview** of the cutover commit.
- Expected: `check:env` passes; preview URL serves live backend.
- Rollback: delete preview. · Verify: run **Phase 6 smoke on the preview URL** — all pass.

**5.5 — Promote to Production**
- Owner: RM · Prereq: 5.4 smoke 100% green.
- Action: merge to `main` / promote the preview deployment to Production.
- Expected: production serves live build.
- Rollback: Phase 7. · Verify: `/version.json` new SHA + `env: production`; `/health.json` = ok.

**5.6 — Post-promote live smoke**
- Owner: RM + AGENT · Prereq: 5.5 done.
- Action: run **Phase 6** against the production domain with a real device for OTP.
- Expected: all journeys pass. · Rollback: Phase 7 if any P0 fails. · Verify: Phase 6 table all ✅.

**5.7 — Enable finance scheduling** (if using automated settlements)
- Owner: OPS · Prereq: cutover stable.
- Action: enable `pg_cron`+`pg_net`, schedule settlement sweep (or confirm Admin-triggered).
- Expected: settlements generate. · Rollback: disable job. · Verify: a scheduled run creates `*_settlements` rows.

---

## Phase 6 — Smoke Tests (run on preview first, then production)

| ID | Journey | Steps | Expected result | Owner |
|---|---|---|---|---|
| AUTH-1 | Authentication | Request OTP to a **real** phone; enter code | Logged in; session issued; `123456` rejected | RM |
| CUST-1 | Customer | Browse restaurants/grocery/pharmacy → search → add to cart → checkout | Order created in DB | RM |
| COD-1 | COD | Select **Cash on Delivery** → place order | Order `payment_method='cod'`; `payment_attempts` provider `cod`; **no gateway** | RM |
| PAY-1 | Payments (card) | Select card → Moyasar page → pay test charge | `payment-verify` → paid; `webhook_events` one row | RM |
| MERCH-1 | Merchant | Login → receive order → accept → ready | Status transitions; auto-dispatch trigger fires | RM |
| DRV-1 | Driver | Login → assigned → pickup → deliver → collect cash → complete | `payment_status` paid; wallet credited | RM |
| FIN-1 | Finance | After delivery | Ledger balanced (Σdebit=Σcredit); settlement queued; no negative balances | RM |
| AFF-1 | Affiliate | `?ref` referred customer places first order | `qualify_referral` credits commission **once** | RM |
| MAPS-1 | Maps | Open tracking | Map tiles + driver marker + ETA render | RM |
| WEB-1 | Website | Load public homepage | New homepage renders; `/version.json` new SHA | RM |
| STUDIO-1 | Website Studio | Admin → Studio preview | Preview == public (parity) | RM |
| NOTIF-1 | Notifications | Trigger an in-app notification | Received via Realtime (⚠ push N/A until Phase 4 push done) | RM |

- **Prerequisite:** cutover build deployed to the target (preview, then prod).
- **Pass bar:** **all P0 rows (AUTH/CUST/COD/PAY/MERCH/DRV/FIN) green** before promoting / before declaring GO.

---

## Phase 7 — Rollback Plan

**Primary rollback (fast, safe) — frontend flip:**
1. Owner: RM. Revert `vercel.json` `buildCommand` → `"npm run build"` (or Vercel → promote the previous **sandbox** deployment `bc6576e`).
2. Redeploy.
- **Maximum rollback time:** **~2 minutes** (atomic Vercel deployment swap).
- **Why safe:** the sandbox build ignores the database entirely, so it is unaffected by any live-mode state. Users return to the working demo.
- **Verification after rollback:** `/version.json` shows the sandbox SHA; `/health.json` ok; AUTH-1 uses demo OTP again; no user-facing errors.

**Database rollback (rarely needed):**
- The 27 cutover migrations are **additive / backward-compatible** — the sandbox frontend never reads them, so they can be left in place with zero impact.
- True data rollback = **Supabase PITR to `T0`** (Phase 5.1). No destructive migration exists, so there is no data-loss scenario to reverse.
- Verification: `list_migrations` + spot-check row counts vs `T0`.

**Payments rollback:**
- If Moyasar misbehaves: revert frontend (removes live card path); COD orders unaffected. Refund via `payment-refund` if a charge must be reversed.

---

## Phase 8 — Launch Checklist (every box before pressing Deploy)

**Secrets & backend (OPS)**
- ☐ SMS provider configured; OTP delivered to a real phone (AUTH-1 on preview).
- ☐ `MOYASAR_SECRET_KEY`, `MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_WEBHOOK_SECRET` set; test charge verified.
- ☐ `SUPABASE_SERVICE_ROLE_KEY` available to functions.
- ☐ `get_advisors(security)` = 0 ERROR/CRITICAL.
- ☐ Storage buckets = 7 (KYC private); Realtime publication = 3 tables.
- ☐ Finance scheduling decided (pg_cron enabled **or** Admin-triggered).
- ☐ `.mcp.json` access token rotated.

**Vercel (OPS/RM)**
- ☐ `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set (Production); `check:env` passes.
- ☐ `VITE_GOOGLE_MAPS_API_KEY` set (maps); `VITE_SENTRY_DSN` set (recommended).
- ☐ COD/affiliate commit `aa81399` merged to `main`.
- ☐ `vercel.json` `buildCommand` = `npm run build:live` (committed, **not yet promoted**).

**Preview gate (RM)**
- ☐ Preview deploy built `build:live` successfully.
- ☐ **Phase 6 smoke on preview: all P0 green.**

**Go / No-Go (RM)**
- ☐ RM sign-off to promote to Production.

**Post-cutover (RM/AGENT)**
- ☐ `/version.json` = new SHA, `env: production`; `/health.json` ok.
- ☐ Phase 6 smoke on production: all P0 green.
- ☐ Monitor Sentry + payment webhooks 24–48h.

**Mobile (MOB) — parallel, not blocking web launch**
- ☐ Android signed AAB + screenshots + App-Links domain reconciled + `assetlinks.json` hosted.
- ☐ iOS cert + Universal Links + screenshots.
- ☐ Push (FCM/APNs) decided (in or out of v1).

---

### Estimated cutover window
DB already migrated → **~0 downtime**. Frontend promote (preview→prod) ~10–15 min. Full window incl. preview smoke + go/no-go: **~half a day**. Rollback if needed: **~2 min**.

**STOP — do not deploy. This runbook is prepared for execution on your approval.**
