# Deployment Verification Report

**Production is serving the newest build — verified across every checkpoint** (Git SHA, bundle hashes,
service-worker version, cache headers).

| Field | Value |
|---|---|
| **Commit SHA** | `c80e5b3f48f643fd7e53deee2e879192e7f04798` (`c80e5b3`) |
| **Branch** | `feat/auth-recovery-frontend-sprint` |
| **Merge strategy** | **clean fast-forward** `feat → main` (0 divergent commits) — `origin/main` == HEAD |
| **GitHub Actions** | ✅ GREEN — Typecheck·Lint·Build · Edge Functions (Deno) · E2E 24/24 |
| **Deployment URL** | https://haat-now.vercel.app (HTTP 200, React app mounted) |
| **Build ID** | `version.json` → sha `c80e5b3`, version `1.0.0` |
| **Build timestamp** | `2026-06-27T22:25:18Z` |
| **Deployment method** | Vercel ↔ GitHub integration — auto-deploy on push to `main` |
| **Cache status** | assets `immutable` (content-hashed); `version.json`/`health.json` `no-store`; SW cache versioned per build |
| **Remaining manual steps** | none for deploy; optional CI-token path + vanity-domain DNS (below) |

## Post-deploy validation (production vs local build of `c80e5b3`)
| Check | Production | Match |
|---|---|---|
| **Git SHA** | `version.json.sha` = `c80e5b3f48…` = local HEAD | ✅ |
| **Build timestamp** | `2026-06-27T22:25:18Z` (fresh) | ✅ |
| **version.json** | `{name, version:1.0.0, sha, short, builtAt, env:production}` 200 | ✅ |
| **health.json** | `{status:"ok", sha:"c80e5b3"}` 200 | ✅ |
| **JS bundle hash** | `/assets/index-WIcRpKWv.js` = local | ✅ identical |
| **CSS bundle hash** | `/assets/index-BfHvHlnP.css` = local | ✅ identical |
| **Asset hash strategy** | content-hashed filenames, `Cache-Control: …immutable` | ✅ |
| **Service Worker version** | `sw.js` cache = `haat-shell-c80e5b3` (stamped per build) | ✅ |
| **PWA cache version** | same `haat-shell-c80e5b3`; SW `activate` purges non-matching caches | ✅ |
| **IndexedDB schema version** | app uses no IndexedDB | ✅ N/A |
| **LocalStorage app version** | `haat_app_version` = `APP_VERSION` (`1.0.0`) set on boot | ✅ |

## Why no stale content is served
- **Navigations are network-first** — online users always fetch fresh `index.html` (which references the
  current hashed bundles); the cached shell is used only offline.
- **Content-hashed bundles** — a new build ⇒ new filenames ⇒ guaranteed cache-miss ⇒ fresh fetch. No stale
  JS/CSS is reachable.
- **SW cache name is build-stamped** (`haat-shell-<sha>`) — each deploy installs a new SW whose `activate`
  deletes the previous cache, so the offline shell cache cannot go stale across releases.
- **`version.json`/`health.json` are `no-store`** — verification always reads the live value.

## Deployment-path notes (no undocumented blocker)
- **Primary (used, working):** Vercel's native GitHub integration deploys `main` to production on push.
  The fast-forward to `main` triggered the build; production updated and was verified.
- **Secondary (redundant, idle):** CI `deploy-production` job runs `vercel deploy --prod` only when
  `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` repo secrets exist. They are not set, so it self-skips
  — **not a blocker** (the native integration already deploys). Add the 3 secrets to enable the CI path.
- **Vanity domain `app.haatnow.com`** — DNS not pointed at Vercel (operator step). `haat-now.vercel.app`
  is the working production URL.

## Note on this report's own commit
This `.md` is doc-only — committing it changes **no application module**, so the JS/CSS bundle hashes
stay identical; only `version.json`/`health.json`/`sw.js` re-stamp to the report's commit SHA on the next
auto-deploy. Production continuously tracks `main` (= HEAD).

## Conclusion
The newest implementation **is live on production and verified** by SHA + identical JS/CSS bundle hashes +
versioned service worker. **No undocumented deployment blocker remains.**
