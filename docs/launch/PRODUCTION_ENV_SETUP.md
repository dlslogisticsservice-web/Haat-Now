# Production Environment Setup — Phase LR-1

How to configure GitHub + Vercel for a clean production pipeline. Two supported targets.

## Target A — Sandbox demo (current default, zero config)

The shipped build is a self-contained demo (mock OTP `123456`, client-side data). `vite.config.ts` forces `VITE_AUTH_MODE=sandbox`, so **no environment variables are required**.

- **GitHub Actions:** nothing to set. `quality`, `live-build`, `edge-functions`, `e2e` all pass with no secrets.
- **Vercel:** no env vars required. Deploy the default build.
- **Verify:** `npm run preflight` (lint + tests + build) then check `dist/version.json` + `dist/health.json`.

## Target B — Live backend (opt-in, Supabase)

Only when pointing production at a real Supabase project.

### 1. Vercel → Project → Settings → Environment Variables (Production)
| Variable | Value | Type |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Environment Variable |
| `VITE_SUPABASE_ANON_KEY` | publishable key from Supabase → Project Settings → API | Environment Variable |
| `HAAT_LIVE_BACKEND` | `1` | Environment Variable |

> `HAAT_ENV_ADVISORY` must **NOT** be set in Vercel — the production build must keep its hard env gate.

Recommended (optional): `VITE_SENTRY_DSN`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_ANALYTICS_URL`.

### 2. Validate before deploy
```
HAAT_LIVE_BACKEND=1 npm run check:env   # must print "all required client env vars present"
npm run build:live                      # hard-gates on the vars above
```

## Optional — enable Vercel auto-deploy from GitHub Actions

The `deploy-preview` / `deploy-production` jobs skip cleanly unless these **repo Secrets** exist:

GitHub → Settings → Secrets and variables → Actions → New repository secret:
- `VERCEL_TOKEN` — from Vercel → Account → Tokens
- `VERCEL_ORG_ID` — from `.vercel/project.json` (`orgId`) after `vercel link`
- `VERCEL_PROJECT_ID` — from `.vercel/project.json` (`projectId`)

Without them, production promotion stays a **manual** step:
```
vercel deploy --prod --yes    # project already linked to haat-now → haatnow.app
```

## Security rules (enforced)

- Never commit `.env*` (gitignored; `!.env.example` is the only tracked example, placeholders only).
- Never hardcode keys in source or scripts — `docs/audits/*.cjs` read from `process.env` (LR-1).
- Publishable/anon keys may be Vercel Variables; `VERCEL_TOKEN` and all server-side keys are Secrets.
