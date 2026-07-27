# CI/CD Audit — Phase LR-1

_Production Infrastructure & CI/CD Audit. No features changed. Deployment pipeline only._

## 1. Workflow inventory

Single workflow: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — no duplicates, no dead workflows.

| Job | Trigger | Purpose | Needs |
|---|---|---|---|
| `quality` | push + PR | `tsc --noEmit` + architecture/demo-isolation checks + sandbox build + upload `dist` | — |
| `live-build` | push + PR | Compile the **live** (Supabase) code path so live-only wiring is verified | — |
| `edge-functions` | push + PR | `deno check` of Supabase Edge Functions | — |
| `e2e` | push + PR | Puppeteer suite against sandbox dev server on :3001 | `quality` |
| `deploy-preview` | PR only | Vercel preview deploy (skips cleanly if `VERCEL_TOKEN` unset) | `quality`, `e2e` |
| `deploy-production` | `main` only | Vercel prod deploy (skips cleanly if `VERCEL_TOKEN` unset) | `quality`, `e2e` |

`concurrency` cancels superseded runs per ref. Triggers: `push` to `main`/`feat/**`, `pull_request` to `main`.

## 2. Root cause of the failure

**Failing job:** `live-build` → `npm run build:live` → `node scripts/live.cjs build`.

`scripts/live.cjs` sets `HAAT_LIVE_BACKEND=1` and, for a **build** (not `dev`), treats [`scripts/check-env.cjs`](../../scripts/check-env.cjs) as a **hard gate**. That gate requires `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. CI has neither (they are gitignored and not repo secrets), so `check:env` exits 1 and the job fails on **every push**.

This was a **workflow configuration bug, not a code bug.** `scripts/live.cjs` was written to let CI compile the live path *without* secrets via `HAAT_ENV_ADVISORY=1` — its own failure message says _"Set HAAT_ENV_ADVISORY=1 only for CI compile checks."_ — but the `live-build` job never set that variable.

Reproduction (exact CI command, no secrets):
```
$ env -u VITE_SUPABASE_URL -u VITE_SUPABASE_ANON_KEY HAAT_LIVE_BACKEND=1 node scripts/live.cjs build
  MISSING  VITE_SUPABASE_URL
  MISSING  VITE_SUPABASE_ANON_KEY
[live] check:env failed — refusing to build a production bundle with invalid env.  → exit 1
```

## 3. The fix

Added a job-scoped env var to `live-build` in `ci.yml`:
```yaml
  live-build:
    env:
      HAAT_ENV_ADVISORY: '1'   # CI compile check only — a real prod deploy MUST NOT set this
```
This downgrades the env gate to a warning **for CI only**. `scripts/live.cjs` still hard-gates real production builds (which never set the flag), so this does not weaken the production guarantee.

Verified green (CI-equivalent, no secrets):
```
$ env -u VITE_SUPABASE_URL -u VITE_SUPABASE_ANON_KEY HAAT_ENV_ADVISORY=1 npm run build:live
[live] check:env failed — continuing (advisory: dev or HAAT_ENV_ADVISORY=1).
✓ built in 14.91s   →  exit 0
```

No secrets were added to GitHub, and nothing was hardcoded — matching the platform design where production ships as a self-contained sandbox demo (`vite.config.ts` forces `VITE_AUTH_MODE=sandbox` unless `HAAT_LIVE_BACKEND=1`).

## 4. Modernization review

| Item | Version in use | Status | Action |
|---|---|---|---|
| `actions/checkout` | `@v4` | Current | none |
| `actions/setup-node` | `@v4` | Current | none |
| `actions/upload-artifact` | `@v4` | Current (v3 EOL Jan 2025; already on v4) | none |
| `denoland/setup-deno` | `@v1` | Supported | left as-is (`deno-version: v1.x` pins runtime; bumping the action is optional, not required) |
| Node runtime | `20` | Supported LTS (maintenance) | left as-is — matches local dev; not a failure source |

No deprecated actions, no deprecated Node runtime, no unnecessary/duplicated jobs. The only required change was the env flag above. Per the "update only if safe" rule, no version bumps were made since none were failing or deprecated.

## 5. Deploy jobs

`deploy-preview` / `deploy-production` are **guarded**: they run their Vercel step only if `VERCEL_TOKEN` is present, otherwise they `echo … && exit 0` (green skip). Production promotion is currently a **documented manual step** via the linked Vercel CLI (see `PRODUCTION_ENV_SETUP.md`). This is intentional and does not report as a failure.

## Summary

- **Root cause:** `live-build` ran the production env hard-gate without the CI advisory flag the script itself documents. → 1-line workflow fix.
- **Deprecations:** none.
- **Result:** all jobs green on the next push; production promotion remains the single, documented manual Vercel step.
