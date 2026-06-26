# CI Pipeline Fix Report

## Root cause
`package.json` `lint` = `tsc --noEmit`, and **`tsconfig.json` had no `exclude`**, so the Node
TypeScript compiler typechecked the **Deno Edge Functions** under `supabase/functions/`. Those run
on Deno, not Node — they use the `Deno` global and `npm:@supabase/supabase-js@2` specifiers, which
Node's `tsc` cannot resolve. Result: **14 errors**:
- `error TS2304: Cannot find name 'Deno'` (×13)
- `error TS2307: Cannot find module 'npm:@supabase/supabase-js@2'` (×1)

across `_shared/supabase.ts`, `payment-initiate`, `payment-refund`, `payment-verify`,
`payment-webhook`.

## Why local "passed" but GitHub failed
- **Local:** every prior sprint ran `npm run lint 2>&1 | grep -vE "supabase/functions"` — the grep
  filtered the Deno errors out of view, so it *looked* green. The exit code was still non-zero.
- **GitHub Actions:** `quality` runs `npm run lint` **raw**. A non-zero exit from `tsc` fails the
  step → the job (and pipeline) goes red. CI never filtered, so it surfaced the real failure.
- **Vercel:** Vercel builds with `npm run build` (`vite build`, esbuild) which **does not typecheck**
  — esbuild strips types per-file and never resolves the Deno specifiers. So Vercel built fine while
  the typecheck-based CI step failed. Different tool, different behavior.

## Fix (architectural — Deno files separated from Node, not bypassed)
| File | Change |
|---|---|
| `tsconfig.json` | Added `"exclude": ["node_modules","dist",".vercel","supabase/functions"]`. The app typecheck no longer touches Deno code. |
| `supabase/functions/deno.json` | **New.** Proper Deno config (lib `deno.window`/`dom`, strict, import map `@supabase/supabase-js → npm:@supabase/supabase-js@2`). The functions are now self-describing for Deno tooling. |
| `.github/workflows/ci.yml` | **New `edge-functions` job** using `denoland/setup-deno` + `deno check **/*.ts` in `supabase/functions`. The Deno code is still validated — with the **right tool** — so CI is not weakened. |

CI was **not** bypassed: the app is typechecked by Node `tsc` (its files only); the Edge Functions
are typechecked by Deno (`deno check`). Each runtime uses its own compiler.

## Exact pipeline run locally (proof)
- `npm run lint` (tsc --noEmit) → **0 errors** (raw, unfiltered).
- `npm run build` (vite build) → **✓ built**.
- `node docs/testing/e2e_runner.cjs` → **E2E 24/24 pass, 0 fail**.
- `deno check` → **deno is not installed in this environment**; CI installs it via
  `denoland/setup-deno`. The functions import only `npm:@supabase/supabase-js@2` (Deno-native npm
  support) + the `Deno` global (built-in), both of which `deno check` resolves.

## Blockers I cannot clear from this environment (documented, not hidden)
- **Observing GitHub Actions:** the `gh` CLI is **not installed** here and there is no GitHub API
  token, so I cannot `gh run watch` the run. The fix above is what turns `quality` green (verified
  by reproducing the exact command locally). Confirm the run at the repo's Actions tab after push.
- **Vercel production promotion:** requires repo secrets `VERCEL_TOKEN` / `VERCEL_ORG_ID` /
  `VERCEL_PROJECT_ID`, which are not available to me. The workflow's `deploy-production` job
  (on `main`) already runs `vercel deploy --prod` automatically **once those secrets are set** — so
  production auto-promotion is configured; it just needs an operator to add the three secrets
  (Settings → Secrets → Actions) and merge to `main`. I cannot add secrets or push to `main`.
- **Production URL 200 / smoke test:** depends on the Vercel deploy above; cannot run without the
  deployment having occurred.

## Final state
- Root cause fixed; **typecheck/build/E2E all green locally** with the exact CI commands.
- GitHub Actions `quality` + `e2e` + `edge-functions` jobs are now correctly configured.
- Production auto-promotion is configured and gated only on the three Vercel secrets (the single
  remaining operator action).
