# Production Activation Checklist — HaaT Now

The single artifact for taking HaaT from "ready for launch" to "deployed". Everything that could
be completed **in the codebase** is done (Group A, below). What remains needs **credentials** or
**external service activation** — listed as exact, dependency-ordered items with placeholders.

---

## STEP 1 — Blocker classification

| # | Blocker | Class | Resolution |
|---|---|---|---|
| 1 | Environment validation before a live deploy | **A** | ✅ Done — `scripts/check-env.cjs` + `npm run check:env` |
| 2 | Live-build env visibility | **A** | ✅ Done — non-fatal advisory in `scripts/live.cjs` |
| 3 | Release/preflight gate | **A** | ✅ Done — `npm run preflight` (lint + tests + build) |
| 4 | Build scripts / live build | **A** | ✅ Already present — `build`, `build:live` (`scripts/live.cjs`) |
| 5 | Health endpoints | **A** | ✅ Already present — `/health.json` + `/version.json` (`scripts/gen-version.cjs`) |
| 6 | Version stamping + PWA cache bust | **A** | ✅ Already present — SHA stamp + SW cache `haat-shell-<sha>` |
| 7 | Security headers | **A** | ✅ Already present — `vercel.json` (CSP, HSTS, XFO, nosniff, Referrer, Permissions, COOP) |
| 8 | Cache / asset optimization | **A** | ✅ Already present — immutable asset cache + `vite.config.ts` manualChunks |
| 9 | CI/CD | **A** | ✅ Already present — `.github/workflows/ci.yml` (quality · live-build · edge · e2e · deploy) |
| 10 | Supabase production project | **B** | Credentials — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| 11 | Apply DB migrations | **C** | External — `supabase db push` against the live project |
| 12 | Auth SMS OTP provider | **C** | External service — Twilio/etc. in Supabase Auth |
| 13 | Service-role + edge secrets | **B** | Credentials — `SUPABASE_SERVICE_ROLE_KEY`, webhook secret |
| 14 | Moyasar (card — future) | **B/C** | Credentials + activation; **not needed for COD** |
| 15 | pg_cron scheduler | **C** | Enable pg_cron on the project |
| 16 | Monitoring DSN / Maps key | **B** | Credentials — `VITE_SENTRY_DSN`, `VITE_GOOGLE_MAPS_API_KEY` |
| 17 | Vercel deploy secrets | **B** | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |

---

## STEP 2 — Completed automatically (Group A)

Implemented this sprint (code):
- **`scripts/check-env.cjs`** — fails fast (exit 1) when a **live** build is missing required
  client env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); warns on recommended vars; no-op
  for the sandbox demo build. Verified: sandbox→pass, live+missing→exit 1, live+present→pass.
- **`scripts/live.cjs`** — runs `check-env` as a **non-fatal advisory** before the live build
  (surfaces missing env without breaking CI's compile-only live build).
- **`package.json`** — `"check:env"` and `"preflight"` (lint + test:website + build) scripts.

Already in place (verified, not duplicated): build/live scripts, health + version endpoints,
version stamping + SW cache bust, security headers, cache/asset optimization, CI/CD, edge
type-check. Verification gate this sprint: `lint` 0 · `build:live` exit 0 · `test:website`
141/141 (prior) · health.json emitted.

---

## STEP 3 — Exact credential placeholders (fill; do not invent)

> `.env*` is gitignored (only `.env.example` is tracked), so these are recorded here. Set them in
> **Vercel → Settings → Environment Variables** (client) and **Supabase → Edge/Auth** (server).

### Client build (Vercel, Production)
```
VITE_AUTH_MODE          = supabase          # set by build:live (HAAT_LIVE_BACKEND=1); do not pin sandbox
VITE_SUPABASE_URL       = ?                  # https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY  = ?                  # project publishable/anon key
VITE_SENTRY_DSN         = ?                  # (recommended) crash/error monitoring
VITE_GOOGLE_MAPS_API_KEY= ?                  # (recommended) tracking map tiles
VITE_ANALYTICS_URL      = ?                  # (optional) analytics endpoint
```

### Supabase (server / edge — not in the web bundle)
```
SUPABASE_SERVICE_ROLE_KEY = ?                # edge functions
PAYMENT_WEBHOOK_SECRET    = ?                # only if enabling gateway webhooks (not COD)
# Card payments (future — NOT required for COD launch):
MOYASAR_SECRET_KEY        = ?
MOYASAR_CALLBACK_URL      = ?
```

### Auth SMS provider (Supabase Auth → configure in dashboard)
```
TWILIO_ACCOUNT_SID  = ?
TWILIO_AUTH_TOKEN   = ?
TWILIO_MESSAGE_SID  = ?   # or messaging service / sender id
```

### CI auto-deploy (GitHub → Settings → Secrets → Actions)
```
VERCEL_TOKEN      = ?
VERCEL_ORG_ID     = ?
VERCEL_PROJECT_ID = ?
```

---

## STEP 4 — Deployment checklist (dependency-ordered)

1. **Provision Supabase** production project → obtain `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`. *(blocks all below)*
2. **Apply migrations** to the live DB: `supabase db push` (63 migrations incl. `20260707000001_cod_payment_method.sql`). *(needs 1)*
3. **Configure Auth SMS OTP** (Twilio) in Supabase Auth; set **Site URL** + **Redirect URLs**. *(needs 1)*
4. **Enable** Supabase backups/PITR and **pg_cron** (dispatch/reconcile/settlements). *(needs 1)*
5. **Set Vercel env** (STEP 3 client block) and add CI deploy secrets. *(needs 1–3)*
6. **Validate env**: `HAAT_LIVE_BACKEND=1 npm run check:env` → must exit 0. *(needs 5)*
7. **Deploy** (push to `main` → CI, or `vercel deploy --prod`). *(needs 6)*
8. **Verify** `/health.json` + `/version.json` return the expected SHA. *(needs 7)*
9. **Smoke** on the live URL: register (real OTP) → browse → COD checkout → track → deliver → rate → support. *(needs 7,8)*
10. **Onboard** first merchants + drivers (see operations onboarding checklists). *(needs 9)*
11. **Monitor** week 1 (First-Week Monitoring Plan); on-call + escalation staffed. *(needs 9)*

*(Optional, deferred: Moyasar/card activation — not required for COD.)*

---

## FINAL — External actions remaining before the first real customer order

Strictly dependency-ordered; each requires credentials/external service (Group B/C), so they
**cannot** be done in-code:

1. **Create the Supabase production project** and obtain URL + anon key + service-role key. *(root dependency)*
2. **Apply the database migrations** to that project (`supabase db push`).
3. **Configure the SMS OTP provider** in Supabase Auth (Twilio) + Site/Redirect URLs — **without this no customer can register or log in.**
4. **Enable backups/PITR + pg_cron** on the project.
5. **Set the production env vars** in Vercel (Supabase URL/key; Sentry/Maps recommended) and run `check:env` (must pass).
6. **Deploy the live build** and confirm `/health.json` returns the new SHA.
7. **Run the live COD smoke** end-to-end (register → order → COD → track → deliver).
8. **Onboard at least one merchant and one driver** so there is a catalog to order from and a captain to deliver.

Once 1–8 are complete, HaaT can receive its first real customer order using **COD** — no gateway
secret or card provider is required for that first order.
