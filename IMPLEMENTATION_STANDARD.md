# Implementation Standard — Definition of Done

The **permanent Definition of Done** for every sprint. Not architecture, not governance — the execution
contract. A sprint is **not done** until **every** item below passes. No exceptions, no "will fix later".

---

## 1. Required Quality Gates
All must be green before commit:
- **Typecheck:** `npm run lint` (tsc `--noEmit`) → **0 errors**.
- **Lint:** 0 errors (same command; no new warnings introduced).
- **Build:** `npm run build` → succeeds; `dist/version.json` + `sw.js` stamped.
- **E2E:** `node docs/testing/e2e_runner.cjs` → **24/24 pass, 0 fail**.

## 2. Required Verification (runtime, not code-presence)
- Verify **behavior at runtime via the real UI** (Puppeteer or manual), never "the class/service exists".
- Every objective in the sprint prompt is independently exercised — no generalizing one entity's pass to others.
- Verification evidence (the observed result) is recorded in the sprint report.

## 3. Required Runtime Checks
- **0 console errors** across the exercised flows (filter only favicon/404/401 noise).
- **Persistence:** state changes survive a reload.
- **Cross-module:** a change propagates to every dependent surface it should (e.g. order → finance/admin).
- **Permission (RBAC):** where the feature is gated, the `<Can>`/role gate is verified (allowed vs denied).
- **No regressions:** previously-verified flows still work; **frozen systems untouched** (see §10).

## 4. Required Production Checks
- Production serves the **new build**: `version.json.short` == `git rev-parse --short main`.
- The changed feature is reachable on production (spot-check the entry point).
- No new production console/runtime errors introduced.

## 5. Required Deployment Checks (git workflow — mandatory)
1. Work on a **feature branch** (never commit straight to `main`).
2. Commit → **push feature branch**.
3. **Wait for CI green.** If the GitHub Actions API is unreachable/rate-limited, gate on the **local
   CI-equivalent** (typecheck 0 · build ✓ · E2E 24/24) and record that CI wasn't polled.
4. `git checkout main` → `git merge --ff-only origin/main` → `git merge --no-ff <feature>` (no force-push).
5. **Push `main`** → Vercel deploys.
6. Proceed to §8 version verification. Stop only when production matches the commit.

## 6. Required Documentation Updates
- A **sprint report** `PHASE_<x>_<y>_IMPLEMENTATION_REPORT.md` (or `<SPRINT>_REPORT.md`) covering: objectives
  delivered, files changed, reuse (no-duplication) proof, runtime verification results, bugs found/fixed,
  remaining blockers, production readiness, and the deployed SHA.
- Committed **in the same PR/merge** as the code.

## 7. Required Registry Updates
- **Any new service** ships with the governance header (AUTHORIZED BY / Phase / Purpose / Existing services
  reused / Why new / Duplicate analysis / Consumers / Future merge candidate) **and** a `SERVICE_REGISTRY.md`
  entry (category, owner domain, health, deps, consumers) **in the same commit**.
- New permissions → added to `rbac.service`; new providers → `platform.service` registry. Respect layer +
  forbidden-dependency rules.

## 8. Required Version Verification
- `short=$(git rev-parse --short main)`.
- Poll `https://haat-now.vercel.app/version.json` with a **browser User-Agent** (Vercel bot-challenges plain
  curl) until `version.json.short == $short`.
- Confirm `sw.js` cache name `haat-shell-<sha>` matches when relevant.
- **Done only when production == the merged commit.**

## 9. Required Rollback Verification
- Every live-surface change is **additive + feature-flagged** where it touches an existing verified flow;
  disabling the flag restores prior behavior exactly.
- The **rollback path is stated** in the sprint report (flag to disable, or `git revert <sha>` + redeploy).
- Design Center + White Label + auth remain backward-compatible (defaults = no behavior change until used).

## 10. Required Acceptance Criteria
A sprint is accepted only if ALL hold:
- ✅ All sprint objectives delivered + runtime-verified.
- ✅ Quality gates green (§1); 0 console errors (§3).
- ✅ No duplication — existing engines reused; new service (if any) governed (§7).
- ✅ **Frozen systems untouched** unless a critical production bug required it (frozen: auth/OTP/login/Supabase
  migration/production backend/DB architecture; Design Center; White Label engine; **Payment Rule** — no
  gateway while `HAAT_LIVE_BACKEND` disabled).
- ✅ Deployed via the git workflow (§5); production verified (§8); rollback path stated (§9).
- ✅ Sprint report + registry updates committed (§6, §7).
- ✅ No regression to previously-verified flows.

---

## Reusable Sprint Checklist (copy into every sprint)

```
SPRINT: <name / phase>            BRANCH: <feature-branch>            DATE: <YYYY-MM-DD>

BUILD & GATES
[ ] Typecheck 0 errors        (npm run lint)
[ ] Lint 0 errors / no new warnings
[ ] Build succeeds            (npm run build → version.json stamped)
[ ] E2E 24/24 pass

VERIFICATION (runtime, real UI)
[ ] Every objective exercised independently (no generalizing)
[ ] 0 console errors on exercised flows
[ ] State persists across reload
[ ] Cross-module propagation verified
[ ] RBAC/permission gate verified (if applicable)
[ ] No regression to prior verified flows

NO-DUPLICATION / GOVERNANCE
[ ] Existing engines reused (no parallel system)
[ ] New service (if any) has governance header + SERVICE_REGISTRY entry + owner domain
[ ] Layer rules + forbidden-dependency rules respected
[ ] 0 circular imports

FROZEN CONSTRAINTS
[ ] Auth/OTP/migration/backend untouched
[ ] Design Center + White Label untouched (unless critical bug)
[ ] Payment Rule honored (no gateway while HAAT_LIVE_BACKEND disabled)

DEPLOY
[ ] Commit on feature branch → pushed
[ ] CI green (or local CI-equivalent recorded if API unavailable)
[ ] main: merge --ff-only origin/main → merge --no-ff feature → push (no force)
[ ] version.json.short == git rev-parse --short main  (browser UA)
[ ] Feature reachable on production; no new prod errors

DOCS
[ ] Sprint report generated + committed (objectives/files/reuse/verification/bugs/readiness/SHA)
[ ] Rollback path stated (flag or git revert)

ACCEPTANCE
[ ] All acceptance criteria (§10) satisfied → sprint DONE
```

---

## STANDARDS FROZEN
This Definition of Done + Sprint Checklist are **frozen**. No further documentation. Every future sprint runs
this checklist to completion before it is "done".

**The next prompt starts Phase 0.2 implementation. STOP — no implementation in this turn.**
