# Environment Variables — Phase LR-1

Authoritative matrix of every environment variable the build/deploy pipeline reads. Sources compared: **GitHub Actions** (`ci.yml`), **Vercel** (deploy env), **local** (`.env` / `.env.local` / `.env.production`), and `.env.example`.

## How the auth mode is decided

`vite.config.ts` is the **single committed source of truth**: it forces `VITE_AUTH_MODE=sandbox` unless `HAAT_LIVE_BACKEND=1` is set at build time. The shipped production build is a self-contained sandbox demo, so **no external variable is required for the default production build**. The live (Supabase) variables are required only for an opt-in live backend.

## Matrix

| Variable | Required? | GitHub Actions | Vercel (prod) | Local | Status |
|---|---|---|---|---|---|
| `HAAT_LIVE_BACKEND` | Only for live builds | not set (sandbox) | not set (sandbox) | opt-in via `dev:live`/`build:live` | ✅ correct — off = sandbox demo |
| `HAAT_ENV_ADVISORY` | CI compile only | **`1` on `live-build`** (LR-1 fix) | must NOT be set | dev sets implicitly | ✅ fixed |
| `VITE_AUTH_MODE` | Derived | forced `sandbox` (e2e job) | forced `sandbox` by `vite.config.ts` | forced by build | ✅ deterministic |
| `VITE_SUPABASE_URL` | Live only | n/a (advisory) | needed only if live | in `.env`/`.env.production` (untracked) | ✅ optional for sandbox |
| `VITE_SUPABASE_ANON_KEY` | Live only | n/a (advisory) | needed only if live | untracked | ✅ optional for sandbox (publishable key) |
| `VERCEL_TOKEN` | Deploy automation | secret (unset → skip) | n/a | n/a | ⚪ optional — manual deploy today |
| `VERCEL_ORG_ID` | Deploy automation | secret (unset → skip) | n/a | n/a | ⚪ optional |
| `VERCEL_PROJECT_ID` | Deploy automation | secret (unset → skip) | n/a | n/a | ⚪ optional |
| `VITE_SENTRY_DSN` | Recommended | not set | optional | optional | ⚪ optional — monitoring degraded without |
| `VITE_GOOGLE_MAPS_API_KEY` | Recommended | not set | optional | optional | ⚪ optional — map tiles degraded |
| `VITE_ANALYTICS_URL` | Recommended | not set | optional | optional | ⚪ optional |

Legend: ✅ ok · ⚪ optional (no failure if absent).

## Required vs optional

- **Required for the default (sandbox) production build:** _none_. This is by design.
- **Required only for a live backend (`HAAT_LIVE_BACKEND=1`):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (validated by `scripts/check-env.cjs`).
- **Optional / recommended:** `VITE_SENTRY_DSN`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_ANALYTICS_URL` (warned, non-fatal).
- **Deploy automation (optional):** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` — absent → deploy jobs skip cleanly; promotion is manual.

## Missing / mismatches found (and resolved)

1. `HAAT_ENV_ADVISORY` was **missing** on the `live-build` job → caused the CI failure. **Fixed** in LR-1.
2. No other variable is missing for the sandbox production target. The live-only Supabase vars are correctly absent from CI and from the committed tree (they live in `.env*`, which is gitignored, and in Vercel/Supabase config when a live backend is provisioned).

## Secrets vs variables

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are **publishable/public** by design (embedded in the client bundle when live, protected by RLS). They can be Vercel **Environment Variables** (not Secrets). They are still never committed.
- `VERCEL_TOKEN` is a true **Secret** → GitHub Actions Secret only.
- Server-side secrets (Supabase `service_role`, payment provider keys, SMS provider) are **not part of the web build** — they live in Supabase/Edge Function config, never in this repo.
