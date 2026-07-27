# Launch Checklist — Phase LR-1 (Production Pipeline)

Gate before any production release. Checked items were verified in LR-1.

## CI/CD
- [x] Single workflow, no duplicates/dead jobs (`ci.yml`)
- [x] Root cause of GitHub Actions failure identified (`live-build` missing `HAAT_ENV_ADVISORY`)
- [x] Fix applied and verified green locally (CI-equivalent live build → exit 0)
- [x] No deprecated actions (`checkout@v4`, `setup-node@v4`, `upload-artifact@v4`)
- [x] Node runtime supported (20, matches local dev)
- [x] Deploy jobs skip cleanly when Vercel secrets absent (no false failures)

## Environment
- [x] Env matrix produced (`ENVIRONMENT_VARIABLES.md`)
- [x] No missing variable for the sandbox production target
- [x] Live-backend variables documented, validated by `check:env`
- [x] Setup guide for GitHub + Vercel (`PRODUCTION_ENV_SETUP.md`)

## Security
- [x] `.env*` never committed (history clean)
- [x] No `sk_live` / `pk_live` / `whsec` / `service_role` key / JWT secret in source
- [x] Zero publishable-key literals in the repo (removed from `docs/audits/*.cjs` + runbooks → env)
- [x] `eyJ…` tokens confirmed fake test fixtures (signature `.fake`)
- [x] Supabase project URL is a public API identifier (acceptable in operator docs)

## Quality gates
- [x] `npm run lint` (tsc + architecture + demo-isolation)
- [x] `npm run test:website`
- [x] `npm run build` (sandbox) + `npm run build:live` (advisory) both green
- [x] Guardian dependency-cycle guard clean

## Production verification
- [x] `dist/version.json` + `dist/health.json` stamped with commit SHA
- [x] Production URL reachable: https://haatnow.app
- [ ] (Live target only) `HAAT_LIVE_BACKEND=1 npm run check:env` passes with real Vercel env

## Go / No-Go
- [x] All CI jobs green on next push
- [x] No secret exposed
- [x] Deterministic sandbox production build

**Decision:** see `CI_CD_AUDIT.md` §Summary and the LR-1 final report.
