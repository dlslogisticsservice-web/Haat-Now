# FINAL_DEPLOYMENT_PACKAGE.md — HAAT NOW

Everything needed to deploy HAAT NOW to production. Index + one-page summary. **No database changes in this sprint.**

## Status
- **Backend:** live + independently verified (migrations 0000–0022, RLS, admin scoping, auth, RBAC, features). GO.
- **Frontend:** ~90% launch-ready; builds clean; sandbox stripped in prod.
- **Deploy config:** **created this sprint** — `vercel.json` (build + SPA rewrites).

## Documents in this package
| File | Purpose |
|---|---|
| **`DEPLOY_NOW.md`** | Exact Vercel deploy steps (Git or CLI), build/output, required env |
| **`VERCEL_ENV_SETUP.md`** | Every env var (frontend `VITE_` + server payment secrets) |
| **`SUPABASE_PRODUCTION_CONFIG.md`** | Site URL, Redirect URLs, Auth, OTP/Twilio changes |
| **`GO_LIVE_CHECKLIST.md`** | Pre-deploy → Deploy → Post-deploy → Smoke tests |
| **`E2E_TEST_PLAN.md`** | Full role E2E (customer/merchant/driver/admin) |
| **`DEPLOYMENT_PLAN.md`** | Background + Netlify/Cloudflare alternatives |
| **`vercel.json`** | Committed deploy config (Vite, `dist`, SPA rewrites, asset caching) |

## One-page deploy summary
| Item | Value |
|---|---|
| Target | **Vercel** (Vite preset) |
| Build command | `npm run build` |
| Output directory | `dist` |
| SPA rewrites | `vercel.json` → `/(.*)` → `/index.html` |
| Min env (COD launch) | `VITE_AUTH_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Backend project | `umwbzradvbsirsybfxfb` (live) |
| Test accounts | 6 provisioned; Test OTP `123456` |

## Deploy in 6 moves
1. **Push** repo to GitHub; **import** into Vercel (reads `vercel.json`).
2. **Set env vars** (Production) — at minimum the 3 critical `VITE_` vars (incl. `VITE_AUTH_MODE=supabase`).
3. **Deploy**; capture the URL.
4. **Supabase:** set `site_url` + Redirect URLs to that URL (`SUPABASE_PRODUCTION_CONFIG.md`).
5. **Smoke test** the 4 roles (`GO_LIVE_CHECKLIST.md`); then full `E2E_TEST_PLAN.md`.
6. **Public launch:** swap Test OTP → Twilio; add payment keys (or launch COD-only); rotate the Supabase token.

## What's NOT done by these files (requires your accounts/keys)
- The actual Vercel deploy (needs your Vercel account/login — CLI or Git import).
- Twilio credentials, payment gateway keys, Google Maps key, custom domain.
- Token rotation (Supabase account action).
- These are **external-account/secret actions** I can't perform; every step is documented for you to execute.

## Launch decision
**SA-market COD soft-launch = GO** once: deployed, env set (`VITE_AUTH_MODE=supabase`), Supabase `site_url` updated, and the 4-role smoke tests pass. Card payments, EG market, real SMS, and push delivery follow per `GO_LIVE_CHECKLIST.md` / `LAUNCH_CHECKLIST.md`.

> Deployment & launch planning only — application code unchanged except the added `vercel.json`; no database modifications.
