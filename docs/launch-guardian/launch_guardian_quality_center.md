# Launch Guardian — Quality Center

A permanent QA platform, not a test folder. It **reuses every harness HAAT NOW already has**,
schedules them, stores results, detects regressions, and gates releases.

**Runner reality:** browsers and node cannot run inside the SPA. All browser/node suites execute in
**GitHub Actions** (plane C); DB/API suites can also run from **Supabase Edge** (plane B). Results
POST back to `guardian-ingest` → `guardian_test_runs`/`guardian_test_results`.

---

## 1. Capability matrix (the 12)

| # | Capability | Runner | Reuses (existing today) | Trigger |
|---|---|---|---|---|
| 1 | **Automated UI testing** | GH Actions + Puppeteer | `docs/testing/e2e_runner.cjs` (24) | PR, nightly, pre-release |
| 2 | **Regression testing** | GH Actions + node | `npm run test:website` (179 unit/integration) | every PR |
| 3 | **API testing** | Edge / GH | RPC contract calls; `ops_simulation.cjs` (20) | PR, hourly (live) |
| 4 | **Load testing** | GH Actions | `docs/testing/loadtest.cjs` | pre-release, weekly |
| 5 | **Visual regression** | GH Actions + Puppeteer | `public_site_shots.cjs` (EN/AR × 9 widths) | PR, pre-release |
| 6 | **Localization validation** | node | `docs/testing/localization/loc_validate.cjs`, `content_verify.cjs` | PR |
| 7 | **Accessibility testing** | GH Actions + axe | new axe pass over existing shot routes | PR, nightly |
| 8 | **Performance testing** | GH Actions + Lighthouse | vitals probes; bundle budget | PR, nightly |
| 9 | **Broken link detection** | GH Actions crawler | site map from `defaultSite()` routes | nightly |
| 10 | **Route validation** | node (pure) | `auth-routing.test.ts` (incl. the apex-host regression) | every PR |
| 11 | **DB consistency validation** | Edge SQL | the `biz.*` invariants (ledger/wallet/settlement) | hourly (live) |
| 12 | **Production smoke tests** | GH Actions | Phase-6 smoke set from `FINAL_PRODUCTION_CUTOVER_RUNBOOK.md` | post-deploy |

> Nothing here is invented from scratch — 9 of 12 wrap harnesses that already exist and pass today
> (179 / 24 / 20). The Quality Center's value is **scheduling, history, regression detection, and gating**.

---

## 2. Suite contract

Every suite reports one shape (so the platform is runner-agnostic):

| Field | Meaning |
|---|---|
| `suite` | `unit`, `e2e`, `visual`, `a11y`, `seo`, `loc`, `links`, `routes`, `api`, `load`, `dbconsistency`, `smoke` |
| `release_sha` | build under test |
| `env` | `preview` \| `production` \| `local` |
| `passed` / `failed` / `skipped` / `duration_ms` | |
| `results[]` | `{name, status, duration_ms, error?, artifact_urls[]}` |
| `artifacts[]` | screenshots, diffs, traces, reports (Supabase Storage bucket `guardian-artifacts`, private) |

Failures ⇒ Detections (`test-fail` detector) ⇒ Incidents ⇒ (optionally) AI RCA.

---

## 3. Visual regression design

- **Baselines** per `(route, locale, width, theme)` stored in private Storage; pointer row in DB.
- Compare = pixel diff with a tolerance + **ignore regions** (timestamps, Unsplash imagery, ETA
  counters — the known non-determinism in this app).
- A diff over threshold ⇒ **review required** (never auto-approve). Reviewer either **accepts new
  baseline** (records who/why) or files it as a bug.
- Matrix: EN/AR × {320, 375, 768, 1440} × {light, dark} for the flagship routes.
  RTL is first-class — Arabic is a launch language, and RTL overflow has already bitten us once.

---

## 4. Flake management (or the suite becomes noise)

| Rule | Detail |
|---|---|
| Flake detection | same test, same SHA, different outcomes ⇒ `flaky` |
| Quarantine | flaky tests are auto-quarantined (reported, **not** release-blocking) + a bug incident opened |
| Flake budget | > 2% flake ⇒ QA dashboard alert; quarantined tests expire in 14 days (fix or delete) |
| Retries | max 1, and a pass-on-retry is recorded as flake — never as green |

A test that is allowed to be flaky forever is a lie told on a schedule.

---

## 5. Scheduling

| When | Suites |
|---|---|
| **Every PR** | unit, routes, loc, a11y (changed routes), visual (changed routes), lint/tsc |
| **Merge to main** | full unit + e2e + visual + a11y + links |
| **Nightly** | everything incl. load + links + perf; publish trend |
| **Hourly (live)** | api, dbconsistency (invariants), smoke (light) |
| **Post-deploy** | production smoke (Phase-6 set), then visual on production |
| **Pre-release gate** | full matrix; result feeds Release Center |

---

## 6. Environments

| Env | Purpose | Data |
|---|---|---|
| `local` | dev | sandbox |
| `preview` (Vercel) | **the gate** — every PR gets one | sandbox or live-preview |
| `production` | smoke only, read-mostly | live |

**Rule:** destructive/write suites never run against production. Production smoke is read-only +
one synthetic COD order in a **test merchant/zone**, reconciled and excluded from finance rollups
(tagged `is_synthetic`) — so smoke never pollutes GMV or the ledger.

---

## 7. Quality gates (consumed by the Release Center)

| Gate | Blocking? | Threshold |
|---|---|---|
| unit + routes | **blocking** | 100% pass |
| e2e critical journeys | **blocking** | 100% pass |
| dbconsistency (invariants) | **blocking** | 0 violations |
| a11y | blocking | 0 criticals |
| visual | review-required | no unreviewed diffs |
| perf | warn | LCP/CLS/INP budgets |
| load | warn (blocking pre-launch) | p95 under target at N rps |
| links / seo / loc | warn | 0 broken links; meta present |

Gate results write to `guardian_releases.readiness` — the Release Center reads, never recomputes.

---

## 8. What the QA Center does NOT do

- ❌ Does not run tests in the browser/Super Admin (impossible + wrong place). It **triggers and
  displays**; CI executes. V1's Regression panel already states this honestly.
- ❌ Does not auto-fix failing tests.
- ❌ Does not replace code review.
- ❌ Does not gate on flaky/quarantined tests.
