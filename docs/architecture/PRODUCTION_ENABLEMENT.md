# Production Enablement (Phase 2, Wave 15)

> Phase 1 built the kernel. This wave makes the existing execution chain **operable**: who gets it
> (rollout gate + canary), what it costs (metrics), and how to stop it instantly (kill switch +
> circuit breaker). **No new architectural layer was added** — this is the control surface for the
> Wave 14 feature gate. Default remains a hard global OFF (tests 549/549, journeys 52/52, parity
> 5/5, Guardian 0/0/0).

## Feature gate (STEP 1)
`RolloutGate` resolves one decision per request, in strict precedence:

| Order | Condition | Decision |
|---|---|---|
| 1 | breaker tripped | `tripped` → OFF |
| 2 | `enabled: false` (**default**) | `global-off` → OFF |
| 3 | `experiences` contains the experience | `experience-allowlist` → ON |
| 4 | `tenants` contains the tenant | `tenant-allowlist` → ON |
| 5 | `percentage > 0` and bucket < percentage | `percentage-in` → ON |
| 6 | anything else | `no-criteria` → **OFF** |

Two safety properties are deliberate:
- **Enabled ≠ rolled out.** Flipping `enabled: true` with no tenant/experience/percentage yields
  `no-criteria` and executes nothing. There is no way to accidentally enable everyone.
- **Deterministic bucketing.** `rolloutBucket(tenant, experience)` is a stable hash — never
  `Math.random()`. The same experience is in or out consistently across requests and processes, and
  a bucket that is in at N% stays in at any higher percentage (monotonic ramp).

Precedence with the per-request flag: an explicit `ExecutionOptions.executeRenderPlan` boolean
always wins (used by tests and manual drills); otherwise the gate decides.

## Canary (STEP 4)
Three scopes, narrowest first — all proven against the real website renderer:
```ts
{ enabled: true, experiences: ['tenant-1'] }   // one experience
{ enabled: true, tenants: ['tenant-1'] }       // one tenant
{ enabled: true, percentage: 5 }               // deterministic 5% ramp
```
Isolation is tested: with `experiences: ['tenant-1']`, a request for `tenant-2` on the *same
engine* renders the untouched baseline HTML.

## Metrics (STEP 2)
`RenderPlanMetrics` aggregates per execution: **executions, failures, redirects**, **latency**
(total/min/max/avg), **plan size** (total/max/avg), **nodes modified**, **operations executed**,
**operations skipped**. Read with `engine.renderPlanMetrics.snapshot()`.

Every execution also carries its own record on `execution.renderPlanExecution`:
`{ executed, reason, bucket?, applied[], skipped[], nodesModified, planSize, executionMs,
redirected, failed }` — so a single request explains itself without consulting aggregates. The
rendering stage logs `render-plan execution: ON (experience-allowlist) — 1 applied, 0 skipped,
1 node(s) modified` or `OFF (global-off)`.

**Watch `operationsSkipped`.** A canary whose operations are all *skipped* means the plan's keys do
not match any node id — the most likely misconfiguration, and invisible in output.

## Rollback (STEP 3)
Three independent mechanisms, all verified by tests:
1. **Instant disable** — `engine.rollout.disable('reason')` takes effect on the very next request;
   HTML returns byte-identical to the never-enabled baseline (asserted against the real renderer).
2. **Fallback rendering** — a throwing plan executor is caught in the pipeline; rendering proceeds
   with the **untransformed** resolution plus a `plan execution failed` warning. Plan execution
   cannot break a page.
3. **Circuit breaker** — `tripAfterFailures: N` auto-disables after N *consecutive* failures. A
   success resets the streak. A tripped breaker is **not** cleared by `enable()`; it requires an
   explicit `reset()`, so a flapping failure cannot silently re-enable itself.

## Website channel enablement (STEP 5)
Enabled for **one** experience (`tenant-1`) through the real mapper and the real `SnapshotRenderer`:
a feature flag named for the node id, defaulted off → policy → enforcement → instructions → plan →
gate → pipeline → HTML with that block removed and every other block untouched.

> **Scope caveat — read this before declaring production done.** The deployed Website Runtime does
> **not** route through the Experience Engine; it renders through its existing path. This wave
> enables the canary *inside the engine*, exercised against real website content and the real block
> renderers. Making it affect live traffic requires wiring the engine into the Website Runtime —
> a separate, explicitly-scoped change that prior waves prohibited. See the readiness report.

## Parity (STEP 6)
- **Canary OFF** — HTML from a configured-but-disabled engine is byte-identical to an engine with
  no rollout config at all.
- **Canary ON** — only the targeted block disappears; hero and the sibling richtext are asserted
  present, and `wp-hero` markup confirms the real block renderers still produced the output.
- **Post-rollback** — HTML after `disable()` is byte-identical to the baseline.
- The existing live suites (journeys 52/52, Studio↔Public parity 5/5) remain green, as the
  deployed site is untouched.

## Performance (STEP 7 — measured on the real website channel, 12-block page, 20k warmed ops)
| Path | Cost |
|---|---|
| `gate.shouldExecute` (percentage bucket) | ~1.0 µs |
| `execute()` — baseline (no rollout config) | ~51.1 µs |
| `execute()` — canary configured but **OFF** | ~57.8 µs |
| `execute()` — **canary ON** (hides 1 of 12 blocks) | ~77.8 µs |
| `execute()` — percentage 100% | ~73.0 µs |

**Canary ON costs ≈ +22–27 µs per request (~+45%)** over baseline on a 12-block page — the plan
walk dominates, consistent with the ~0.85 µs/node measured in Wave 14. The gate check itself is
~1 µs; the baseline-vs-gated-off delta (~6 µs) is at the edge of run-to-run variance and is not a
meaningful cost. Absolute numbers remain small, but the ramp should be watched on larger pages,
where cost scales linearly with node count.

## Operating runbook
1. **Deploy with `rollout` omitted** — global OFF, zero behaviour change.
2. **Canary one experience**: `{ enabled: true, experiences: ['<id>'], tripAfterFailures: 3 }`.
3. **Verify** `renderPlanExecution.reason === 'experience-allowlist'`, `nodesModified > 0`, and
   `operationsSkipped === 0`. Compare HTML against the gate-off baseline.
4. **Ramp** via `percentage` (monotonic — buckets already in stay in).
5. **Abort** with `engine.rollout.disable('<incident>')`; confirm the next request returns baseline
   HTML. Investigate `snapshot().failures` and the per-request `skipped[]` reasons.

## What this wave deliberately did NOT do
- **No new framework layer** — only controls/observability for the existing gate.
- **No Personalization, no Experiments.**
- **No Runtime redesign** — one stage body (`rendering`) gained the gate decision + metrics.
- **No Website Runtime modification** — the deployed site is untouched.
