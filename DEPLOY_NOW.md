# DEPLOY_NOW.md — HAAT NOW

Exact steps to deploy the production frontend. Backend (Supabase `umwbzradvbsirsybfxfb`) is live + verified. **No database changes here.**

## Deployment target: **Vercel** (recommended)
Vite + React SPA → Vercel auto-detects the Vite preset; `vercel.json` (committed) pins build + SPA rewrites. Netlify/Cloudflare Pages are viable alternatives (see `DEPLOYMENT_PLAN.md`), but these steps assume **Vercel**.

| Setting | Value |
|---|---|
| Framework preset | Vite (auto) |
| **Build command** | `npm run build` |
| **Output directory** | `dist` |
| Install command | `npm install` (auto) |
| Node version | 20+ (Vercel default) |
| SPA rewrites | `vercel.json` → all routes → `/index.html` |

## Steps

### Option A — Git integration (recommended)
1. Push the branch to GitHub (the work branch `feat/auth-recovery-frontend-sprint`, or merge to `main`).
2. Vercel → **Add New → Project → Import** the repo.
3. Vercel detects Vite + reads `vercel.json` (build `npm run build`, output `dist`). Leave defaults.
4. **Environment Variables:** add all from `VERCEL_ENV_SETUP.md` (Production scope) — **especially `VITE_AUTH_MODE=supabase`**.
5. **Deploy.** Note the assigned URL (e.g. `https://haat-now.vercel.app`).
6. Add a **custom domain** (optional now) → Settings → Domains.

### Option B — Vercel CLI
```bash
npm i -g vercel
vercel login
# from repo root:
vercel link
# add env vars (repeat per var, Production):
vercel env add VITE_AUTH_MODE production        # value: supabase
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
# ...(see VERCEL_ENV_SETUP.md for the full list)...
vercel --prod
```

## Required environment variables (build-time, Production scope)
| Var | Value | Notes |
|---|---|---|
| `VITE_AUTH_MODE` | `supabase` | **critical** — keeps sandbox/demo OTP off |
| `VITE_SUPABASE_URL` | `https://umwbzradvbsirsybfxfb.supabase.co` | |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_R8uXSgCyxFK-TpZsFMnIrg_Mkm-MGOD` | publishable (public) |
| `VITE_GOOGLE_MAPS_API_KEY` | (your key) | optional — maps else fallback |
| `VITE_STRIPE_PUBLIC_KEY` / `VITE_PAYMOB_PUBLIC_KEY` / `VITE_MADA_PUBLIC_KEY` | (publishable) | for card checkout (COD works without) |

Full list + server-side payment secrets → `VERCEL_ENV_SETUP.md`.

## After first deploy
1. Update Supabase **Site URL / Redirect URLs** to the Vercel domain → `SUPABASE_PRODUCTION_CONFIG.md`.
2. Run **smoke tests** → `GO_LIVE_CHECKLIST.md` (+ full `E2E_TEST_PLAN.md`).

## Critical verification (must pass)
- [ ] Deployed bundle has **no** `DEMO_ACCOUNTS`; demo `123456` is **rejected** for a non-provisioned phone.
- [ ] Real OTP login (provisioned account, code `123456` Test OTP) → lands in the correct portal; `localStorage` has `sb-…-auth-token`, no `haat_sandbox_session`.

> Note: this repo is wired to project `umwbzradvbsirsybfxfb` (haat-now-dev). It is the live, fully-provisioned backend used throughout the cutover.
