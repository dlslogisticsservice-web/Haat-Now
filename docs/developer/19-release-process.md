# 19 · Release Process

> **Audience:** anyone shipping a change to production.
> **Authoritative source:** [../governance/IMPLEMENTATION_STANDARD.md](../governance/IMPLEMENTATION_STANDARD.md)
> (the Definition of Done). This page is the operational how-to.

## Purpose
Ship a change safely: pass the local gate, deploy via the git workflow, and verify production actually serves the
new build. Every sprint runs this to completion before it is "done."

## Architecture: the pipeline
```
feature branch → gate (typecheck + build + E2E) → push → merge --no-ff to main → push → Vercel deploy
   → verify version.json.short == main HEAD short SHA
```
Production build stamps `dist/version.json` with the git short SHA via
[`scripts/gen-version.cjs`](../../scripts/gen-version.cjs); production verification compares that to `main`.

## Flow: the required gate (all green before commit)
```bash
npm run lint                       # typecheck (tsc --noEmit) → 0 errors
npm run build                      # vite build + version.json stamped
node docs/testing/e2e_runner.cjs   # E2E → 24/24 pass, 0 fail
```

## Flow: the git workflow (mandatory)
```bash
# 1. work on a feature branch (never commit straight to main)
git add -A && git commit -m "…"
git push origin <feature-branch>
# 2. CI: wait for green. If the GitHub Actions API is unreachable/rate-limited on this box,
#    gate on the LOCAL CI-equivalent above and record that CI wasn't polled (see the deploy memo).
# 3. merge to main and push
git checkout main
git merge --ff-only origin/main
git merge --no-ff <feature-branch> -m "Merge: …"
git push origin main               # Vercel deploys
```

## Flow: verify production (the gotcha)
Vercel bot-challenges plain `curl`, and the GitHub API is rate-limited on this machine — so **poll
`version.json` with a browser User-Agent** until it matches `main`:
```bash
SHORT=$(git rev-parse --short main)
UA="Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/120 Safari/537.36"
curl -s -A "$UA" "https://haat-now.vercel.app/version.json?t=$(date +%s)"   # poll until "short" == $SHORT
```
Done only when `version.json.short == $SHORT`. Confirm `sw.js` cache `haat-shell-<sha>` when relevant.

## Dependencies
- [`scripts/gen-version.cjs`](../../scripts/gen-version.cjs), [`docs/testing/e2e_runner.cjs`](../testing/),
  `release.service` (app version gates / maintenance at boot), Vercel (hosting).

## Extension points
- **New E2E probe** → add it to the runner (target stays green). **New gate** → add to the Definition of Done.

## Reuse rules
- Always feature-branch → gate → `--no-ff` merge → verify. No force-push. No committing straight to `main`.
- If CI can't be polled, record the local CI-equivalent result in the sprint report — don't skip verification.

## Files involved
- [../governance/IMPLEMENTATION_STANDARD.md](../governance/IMPLEMENTATION_STANDARD.md) (the checklist) ·
  [`scripts/gen-version.cjs`](../../scripts/gen-version.cjs) · [`src/services/release.service.ts`](../../src/services/release.service.ts).

## Do's
- ✅ Green gate before commit. ✅ `--no-ff` merges. ✅ Verify production with a browser UA.
- ✅ Write a sprint report with the deployed SHA + rollback path.

## Don'ts
- ❌ Don't commit to `main` directly. ❌ Don't force-push. ❌ Don't claim "done" before production == the commit.
- ❌ Don't poll the GitHub Actions API here (rate-limited) — gate locally + verify `version.json`.

## Example
```
version.json before: "short":"5ed34be"   → merge + push → poll →
version.json after:  "short":"1536497"   == git rev-parse --short main  ✅ done
```

## Next
[20-coding-standards.md](20-coding-standards.md)
