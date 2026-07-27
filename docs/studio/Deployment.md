# Deployment — HAAT NOW

## Target
- Vercel project **haat-now** → apex **https://haatnow.app** (team `dlslogisticsservice-webs-projects`).
- The repo is linked (`.vercel/`, gitignored). CLI authenticated as `dlslogisticsservice-web`.

## Deploy (production)
```
npx vercel@latest deploy --prod --yes      # remote build with the project's prod env; aliases haatnow.app
```
Returns a deployment id + URL; ~1 min. Deploys the current working tree regardless of git branch
(does not require merging to main).

## Verify
```
curl -s https://haatnow.app/version.json    # .short must equal `git rev-parse --short HEAD`
curl -s https://haatnow.app/health.json     # { status: ok, sha }
```

## Build pipeline
`npm run build` = Vite build → `gen-version.cjs` (stamps `version.json`/`health.json` + SW cache) →
Guardian snapshot (`gen-guardian-snapshot.ts`, fails on cycles/violations).

## Environment
Production env vars (Vercel): `VITE_AUTH_MODE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
The shipped build is the **sandbox demo** (mock OTP `123456`, localStorage); the real backend is
dormant behind `HAAT_LIVE_BACKEND=1`.

## Gates before deploy
tsc · eslint/architecture · 738 tests · build · Guardian (0 cycles) · Studio regression (43 + 32) ·
per-phase browser verification (local + production).
