# Launch Guardian — Release Center

Every production change, governed and audited: **propose → gate → approve → canary → promote →
verify → (rollback)**. Guardian *orchestrates and records*; humans decide; GitHub/Vercel execute.

**Capability boundary:** Guardian has **no repo write and no deploy credential**. It cannot merge,
cannot push, cannot promote. It presents the gate, records the decision, and calls the provider API
**only** with a signed, human-approved action. Safety by absence of capability.

---

## 1. Release lifecycle

```
PR opened ──► CI gates (Quality Center) ──► Preview deploy (Vercel)
                     │                             │
                     ▼                             ▼
            guardian_releases(state=preview)   smoke on preview
                     │
                     ▼
            Readiness board (gates + health + error budget)
                     │
              human APPROVAL (guardian.release.approve, reason required)
                     │
                     ▼
                 Canary  (10% → 50% → 100%, auto-halt on regression)
                     │
                     ▼
                Promoted ──► post-deploy smoke + 30-min watch
                     │
              regression? ──► ROLLBACK runbook (≤2 min)
```

---

## 2. Readiness gates (the board)

A release is **promotable** only when every blocking gate is green:

| Gate | Source | Blocking |
|---|---|---|
| Unit + routes 100% | QA | ✅ |
| E2E critical journeys 100% | QA | ✅ |
| DB invariants 0 violations | QA / `biz.*` | ✅ |
| A11y 0 critical | QA | ✅ |
| Visual diffs reviewed | QA | ✅ |
| `check:env` passes for target mode | build log | ✅ |
| No open **SEV1/SEV2** on affected services | Incidents | ✅ |
| **Error budget** not exhausted | `guardian_slos` | ✅ (override = super_admin + reason) |
| Preview smoke green | QA | ✅ |
| Perf/load budgets | QA | ⚠ warn |
| Rollback plan present | runbook link | ✅ |

> **Error-budget gate:** if the 30-day budget is spent, feature releases stop; only fixes ship.
> This is the mechanism that converts "we should stabilise" into policy.

---

## 3. Approval workflow

| Step | Actor | Record |
|---|---|---|
| Propose | engineer (PR) | `guardian_releases(sha, state=preview)` |
| Review gates | Release Manager | readiness snapshot frozen into `readiness` jsonb |
| Approve/Reject | `guardian.release.approve` | `guardian_approvals` (+ `audit_logs`), **reason mandatory** |
| Promote | Release Manager | provider call; `state=promoted`, `promoted_at` |
| Verify | auto + human | post-deploy smoke + `/version.json` SHA match |

Rules: **approver ≠ author** for SEV-touching or finance-touching changes. Approval is bound to a
**specific SHA + readiness snapshot** — if the SHA changes, approval is void (no "approve then sneak").
Approvals are append-only (no UPDATE/DELETE grant).

---

## 4. Canary strategy

Vercel serves one build per domain, so canary is **staged exposure**, not weighted routing:

| Stage | Mechanism | Halt condition |
|---|---|---|
| **0 · Preview** | preview URL, internal only | any blocking gate fails |
| **1 · Internal canary** | promote + staff-only verification window (5 min) | any SEV on affected service |
| **2 · Soft canary** | 10% via feature-flag gating of the *changed capability* (reuse `platform_feature_flags`) | error-rate delta > threshold vs previous SHA |
| **3 · Ramp** | 50% → 100% flag rollout | same |
| **4 · Full** | flag removed in a later PR | — |

**Auto-halt:** Guardian compares post-deploy error-rate/latency for the **new SHA generation** vs the
previous. Breach ⇒ incident + page + **rollback recommendation** (never auto-rollback; a human clicks).

*Note:* true traffic-split canary requires a routing layer HAAT NOW doesn't have. Feature-flag
canary is the honest mechanism available today — designed, not pretended.

---

## 5. Rollback

**Primary (frontend, ~2 min):** promote the previous Vercel deployment (or revert the one-line
`vercel.json` build flag for a mode change). Guardian shows the exact previous SHA from
`guardian_releases.previous_sha` and the runbook steps.

| Property | Value |
|---|---|
| **Max rollback time** | **~2 minutes** (atomic Vercel deployment swap) |
| Trigger | Release Manager / on-call, one click → confirmation + reason |
| DB | migrations are additive/forward-only ⇒ **no schema rollback**; data rollback = Supabase **PITR** to the pre-release anchor |
| Payments | revert frontend; COD unaffected; reverse a charge via `payment-refund` if needed |
| Verify after rollback | `/version.json` = previous SHA · `/health.json` ok · smoke green · incident annotated |

The rollback checklist is **generated per release** (from the cutover runbook + the incident's
Rollback artifact) — not a generic wiki page nobody reads at 3am.

---

## 6. Release history & deployment audit

`guardian_releases` + `guardian_approvals` + webhook events give a complete, queryable record:

| Question | Answered by |
|---|---|
| What shipped, when, by whom, approved by whom, why? | releases ⨝ approvals ⨝ audit_logs |
| What did SHA X change? | commit range + changed paths (stored at release time) |
| Which release introduced incident Y? | incident `generation` = SHA |
| How long from PR to production? | timestamps (lead time) |
| Change failure rate / MTTR | releases with rollback or post-deploy SEV ÷ total |
| Was any gate overridden? | approvals with `override_reason` |

**DORA metrics** fall out for free: deployment frequency, lead time, change failure rate, MTTR —
surfaced on the Engineering + CEO dashboards.

---

## 7. Production readiness (launch-specific)

For the initial go-live, the Release Center renders the **existing**
`FINAL_PRODUCTION_CUTOVER_RUNBOOK.md` as an interactive, checkbox-tracked board — same phases
(Secrets · Supabase · Vercel · Mobile · Cutover · Smoke · Rollback · Checklist), each item with
owner, prerequisite, expected result, verification, and rollback action. Ticking a box writes an
approval row. **The runbook stops being a document and becomes state.**

---

## 8. Integrations

| Provider | Direction | Use |
|---|---|---|
| **GitHub** | in (webhook) / out (read) | PR, checks, commit range, changed files |
| **GitHub Actions** | out (dispatch, human-approved) | trigger QA suites / smoke |
| **Vercel** | in (deploy webhook) / out (promote, human-approved) | release state, preview URL, promote/rollback |
| **Supabase** | in | migration state, advisors, invariants |

All outbound provider calls are: human-approved · signed · rate-limited · fully audited.
No Guardian action reaches production without a `guardian_approvals` row.
