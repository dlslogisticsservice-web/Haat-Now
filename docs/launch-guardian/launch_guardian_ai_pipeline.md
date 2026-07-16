# Launch Guardian — AI Pipeline

Detection → Correlation → **Root Cause Analysis** → **Repair Artifacts** → Human approval.
The AI is an *analyst that writes reports*, never an agent that edits production.

**Model:** Claude (Anthropic API), invoked **only** from the `guardian-ai` Supabase Edge Function.
The API key never exists in the browser or the repo.

---

## 1. Pipeline stages

```
 Signals ──► [1 DETECT] ──► [2 CORRELATE] ──► Incident
                                               │
                                               ▼
                                     [3 ASSEMBLE EVIDENCE]  (deterministic, no AI)
                                               │
                                               ▼
                                     [4 RCA]  Claude · structured output
                                               │  confidence, cause, impact
                                               ▼
                                     [5 ARTIFACTS]  Claude · 9 documents
                                               │
                                               ▼
                                     [6 HUMAN GATE] ── approve ──► PR (outside Guardian)
                                                    └─ reject ──► feedback → eval set
```

Stages 1–3 are **deterministic code**. Only 4–5 call a model. This keeps cost bounded and makes
the system explainable: if the AI is wrong, the evidence is still right.

---

## 2. Stage 1 — Detection (rules, not vibes)

| Detector | Fires when | Catches |
|---|---|---|
| **Threshold** | value crosses `thresholds` for `min_samples` | high latency, low success ratio |
| **Absence** | expected signal missing in window | dead cron, silent probe, stalled queue |
| **Invariant** | SQL invariant violated | ledger imbalance, negative wallet, double commission |
| **Error-rate** | errors/total > k over window | broken API, routing failure, auth failure |
| **New-fingerprint** | first sighting of a fingerprint | new crash after deploy |
| **Regression** | fingerprint absent in SHA-1, present in SHA | deployment-introduced bug |
| **Anomaly** | value outside seasonal band (EWMA + stddev, day-of-week aware) | order-volume collapse |
| **Trend** | monotonic growth over N windows | **memory leak** (JS heap ↑ across sessions), backlog growth |
| **Test-fail** | CI suite regression | broken page, a11y/SEO/localization/visual regression |
| **Deploy-fail** | Vercel webhook `error` | deployment failure |

**Coverage → detector map for the 16 required detections**

| Required | Detector(s) |
|---|---|
| Errors | error-rate, new-fingerprint |
| Performance degradation | threshold (p95), trend |
| Memory leaks | trend on JS heap / RSS |
| Broken APIs | error-rate + absence on `rpc` probes |
| Database failures | probe `sql` red, error-rate on PostgREST |
| High latency | threshold p95/p99 |
| Deployment failures | deploy-fail webhook |
| Routing failures | synthetic render (`/` vs `/app`) — the `haatnow.app` "Site not found" class |
| Authentication failures | error-rate on OTP verify + probe |
| Payment failures | success-ratio threshold + webhook errors |
| Notification failures | delivery-ratio threshold |
| Realtime failures | absence (no realtime event in window) |
| Mobile crashes | in-app fatal signals (Capacitor) |
| Broken website pages | synthetic + link-check suites |
| SEO failures | QA SEO suite (title/meta/og/canonical/sitemap) |
| Accessibility failures | QA a11y suite (axe violations) |

---

## 3. Stage 2 — Correlation

`fingerprint = hash(kind, service_key, normalized(message | check_key))`
Normalization strips ids/uuids/numbers/timestamps so "order 123 failed" and "order 456 failed"
collapse to one incident.

Rules: same fingerprint + open incident + same `generation` (release SHA) ⇒ **append occurrence**.
New SHA ⇒ new generation (so a regression is visibly *new*, not buried in an old incident).
Storm control: >N/min on one fingerprint ⇒ single incident, `occurrences` counter only.

---

## 4. Stage 3 — Evidence assembly (deterministic)

The evidence bundle is built by code and is the **only** thing the model sees:

| Slice | Content | Cap |
|---|---|---|
| Incident | severity, service(s), first/last seen, occurrences | — |
| Signals | last 20 raw (scrubbed), incl. stack frames | 20 |
| Check history | status transitions of related checks, 24h | 50 pts |
| Release | current SHA, previous SHA, deploy time, `/version.json` | — |
| Change context | commit subjects + **changed file paths** between prev→current SHA | 50 files |
| Correlated | other incidents open in the same window | 5 |
| QA | failing suites/tests touching those paths | 10 |
| Topology | service → dependencies (from `guardian_services`) | — |

**Scrubbing is mandatory** (phones/emails/addresses/tokens redacted at ingest). The model never
receives PII or secrets. Bundle is size-capped and token-budgeted.

---

## 5. Stage 4 — RCA contract

**Structured output only** (tool/JSON schema — no free-form parsing):

| Field | Type | Rule |
|---|---|---|
| `probable_cause` | string | must cite ≥1 evidence ref |
| `affected_services` | string[] | subset of known `guardian_services.key` |
| `customer_impact` | `{users_est, orders_est, revenue_est, basis}` | `basis` must name the metric used |
| `severity_recommendation` | sev1..sev4 | may *raise* but never lower an invariant's floor |
| `recommended_fix` | string | minimal-change language, no redesign |
| `confidence` | 0.00–1.00 | calibrated (below) |
| `evidence_refs` | ids[] | signal/commit/check ids actually used |
| `unknowns` | string[] | what it could not determine ← **required, prevents false certainty** |

**Confidence calibration**
| Band | Meaning | UI treatment |
|---|---|---|
| ≥0.80 | cause named + regression window pinned + changed file matches stack | show as *probable cause* |
| 0.50–0.79 | plausible, partial evidence | show as *hypothesis* |
| <0.50 | insufficient evidence | show **"insufficient evidence"** + list `unknowns` — do **not** show a guess |

**Anti-hallucination guardrails**
- The model may only reference services/files/commits present in the bundle; post-validate every
  reference — an invented file path invalidates the analysis (auto-retry once, then mark low-confidence).
- No fabricated metrics: `customer_impact.basis` must map to a real check/rollup.
- If evidence is thin, the correct answer is `confidence < 0.5` + `unknowns` — the system rewards
  saying "I don't know."

---

## 6. Stage 5 — Repair artifacts (the 9 deliverables)

Generated per incident, **immutable + versioned** in `guardian_artifacts`.

| Artifact | Audience | Contents |
|---|---|---|
| **Developer Report** | engineer | what broke, since when, blast radius, repro steps, evidence links |
| **Technical Analysis** | senior eng | mechanism, why now, why this code path, alternatives considered |
| **Git Diff Recommendation** | engineer | unified diff, **minimal**, touching fewest files; "no refactor / no redesign" enforced in the prompt |
| **Claude Prompt** | agent-assisted fix | self-contained: root cause, files, logs, stack, minimal-patch request |
| **Codex Prompt** | alt. agent | same payload, Codex-shaped |
| **Regression Checklist** | QA | suites to run + specific cases touching the changed paths |
| **Validation Checklist** | engineer | how to prove the fix locally/preview |
| **Deployment Checklist** | release mgr | gates + order (sourced from the cutover runbook) |
| **Rollback Checklist** | on-call | exact revert steps + max rollback time + verification |

**Hard boundary (repeated because it matters):** Guardian holds **no repo write credential**. The
Git Diff Recommendation is *rendered text*. Applying it means a human opens a PR. There is no code
path from Guardian to `main`. This is enforced by absence of capability, not by policy.

---

## 7. Prompt engineering contract

- **Versioned prompts** (`prompt_version` on every analysis) — changing a prompt is a tracked change.
- **System prompt** encodes the invariants: minimal patch; reuse existing services; never refactor;
  never redesign; cite evidence; declare unknowns; output must match the schema.
- **Grounding**: repo facts (stack, conventions, module map) are injected from a curated context
  pack — *not* recalled from model memory.
- **Determinism**: temperature low for RCA; artifacts may be slightly higher for prose.
- **Caching**: keyed `(fingerprint, generation, prompt_version)` — a recurring incident on the same
  build reuses the analysis instead of re-billing.

---

## 8. Cost, budget, and abuse control

| Control | Rule |
|---|---|
| Trigger | RCA runs only on **new** `(fingerprint, generation)` or manual `guardian.ai.run` |
| Debounce | ≥5 min after first occurrence (let the storm settle) |
| Daily budget | hard cap in `guardian` config; on exhaustion → queue + notify, never silently drop |
| Token cap | evidence bundle truncated by priority (invariants > stacks > history) |
| Cost ledger | `input_tokens/output_tokens/cost_usd` recorded per analysis → Finance dashboard |
| Concurrency | max N in-flight; sev1 preempts |

---

## 9. Evaluation & feedback loop

Guardian must get *better*, provably:
- Every analysis gets a human verdict: **accurate / partially / wrong** (one click on the Incident).
- Verdicts + evidence form a **golden set**; prompt changes are diffed against it before rollout.
- Tracked KPIs: RCA accuracy %, mean confidence-vs-correctness calibration error, artifact
  acceptance rate, **MTTA/MTTR before vs after Guardian**, false-positive alert rate.
- A prompt version that regresses the golden set is not promoted (same discipline as code).

---

## 10. Failure modes & responses

| Failure | Response |
|---|---|
| AI API down/rate-limited | incident still opens, alerts still fire; analysis queued + marked `pending` — **detection never depends on AI** |
| Model returns invalid schema | one retry → else store `analysis_failed`, surface raw evidence to the human |
| Hallucinated reference | post-validation rejects → low-confidence path |
| Cost spike | budget cap trips → queue + notify Finance/Eng |
| Evidence too thin | `confidence<0.5` + `unknowns` shown; no speculative cause displayed |
