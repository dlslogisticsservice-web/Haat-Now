# Experiment Engine (Phase 2, Wave 17)

> The first Dynamic Experience capability: deterministic variant allocation, exposure/conversion
> tracking, and per-variant metrics. It plugs into the **existing** decision pipeline as an
> `ExperimentPolicy` — the policy type `policy.ts` has declared since Wave 7 — so the Runtime, the
> Rendering pipeline and the Engine are **untouched** (tests 584/584, journeys 52/52, parity 5/5,
> Guardian 0/0/0). **No Personalization. No AI.** This allocates and measures; it does not infer.

## Architecture
```
Audience  →  Feature Flags  →  EXPERIMENT  →  Decision  →  Execution
                                   │
                     ExperimentPolicy (type: 'experiment')
                                   ↓ directive  experiment.<id> = <variant>
                     Policy Engine → Enforcement → Instructions → Plan
```
Registering `createExperimentPolicy(registry)` on `engine.policies` is the **entire** integration.
Zero files in the runtime or rendering path changed. The assigned variant travels as a normal
policy directive and lands in the effective decision alongside flags and configuration.

`experiments.ts` imports only the type/policy contracts; `policy.ts` does not import it, so the
dependency stays one-directional and Guardian reports **0 cycles**.

## Model (STEP 1)
- **Experiment** — `{ metadata, status, variants[], allocation, scope? }` with
  `status ∈ draft | running | paused | completed`.
- **Variant** — `{ key, weight, value?, control? }`. Weights are relative: `50/50` is A/B,
  `1/1/2` is a three-arm split where the third gets half the traffic.
- **Allocation** — `{ unit, salt?, traffic? }`. `traffic` (0–100) gates *eligibility*;
  `salt` rotates the hash space to re-randomise without renaming.
- **Exposure** — `{ experimentId, variant, unitId, at }`.
- **Conversion** — `{ experimentId, variant, unitId, metric, value, at }`.
- **Scope** — audiences / experiences / channels / environments, matched against the PolicyContext.

## Allocation (STEP 2, STEP 3)
`allocateVariant(experiment, unitId)` is pure and stable: a stable hash → a bucket in `[0, 10000)`
→ cumulative-weight selection. Guarantees:

- **Stable.** The same unit always receives the same variant, in every process, forever — no
  `Math.random`, no `Date.now`.
- **Traffic ramps do not reshuffle.** Eligibility uses a *separate* hash space from variant
  selection, so raising `traffic` from 20% to 60% admits new units while everyone already in the
  experiment keeps their variant. (Asserted by a test.)
- **Honest refusals.** A non-running, empty, zero-weight, out-of-traffic or out-of-scope experiment
  allocates nobody and returns the reason — it never silently defaults someone into the control arm.

### The allocation unit — read this before running a real test
The default unit is `tenant:experience`, which is **coarse**: every visitor to a page lands in the
same variant, so the test compares *time periods*, not *people*. That is a legitimate page-level
rollout but it is **not** a user-level A/B test. For a true split, inject a stable visitor/session
id:
```ts
createExperimentPolicy(registry, { resolveUnit: ctx => visitorId })
```
This module deliberately does not fabricate a visitor id — there is no stable identity in the
current context, and inventing one would produce a test whose results could not be trusted.

## Exposure (STEP 4)
`ExperimentTracker` records **exposure**, **click**, **conversion** and **completion**. Exposure is
**de-duplicated per (experiment, unit)** — a React re-render or a second `execute()` for the same
unit does not inflate the denominator, which would otherwise silently deflate every rate. Events
can be forwarded to a host analytics seam via `onEvent`.

## Metrics (STEP 5)
Per variant: `exposures, clicks, conversions, completions`, plus
**CTR** = clicks ÷ exposures, **conversionRate** = conversions ÷ exposures, and
**completionRate** = completions ÷ exposures. `report(id)` returns totals, per-variant stats sorted
by conversion rate, and a winner verdict.

### The winner verdict is a guard-rail, not a significance test
`decideWinner` is deliberately conservative and **refuses** to call a winner when:
- any variant has fewer than `minExposures` (default 100) — *"insufficient exposures"*;
- the leader's relative lift over the runner-up is below `minLift` (default 5%) — *"no separation"*;
- there are no conversions, or only one variant has data.

It reports `confident: false` with the reason rather than naming a leader. **This is not a
statistical significance test** — it has no p-value, no confidence interval and no correction for
peeking. Treat a `confident: true` verdict as "worth a proper analysis", and run a real significance
calculation on the exported counts before shipping a variant.

## Runtime integration (STEP 6)
```ts
const registry = createExperimentRegistry();
registry.register({ metadata: { id: 'exp.hero', name: 'Hero copy', version: '1.0.0' },
  status: 'running',
  variants: [{ key: 'A', weight: 50, control: true }, { key: 'B', weight: 50 }],
  allocation: { unit: 'visitor', traffic: 20 } });

engine.policies.register(createExperimentPolicy(registry, { tracker, resolveUnit }));
```
On every execution the policy assigns variants for in-scope running experiments, records one
exposure per unit, and emits `experiment.<id>` directives into the effective decision. Pausing an
experiment (`registry.setStatus(id, 'paused')`) stops directives and exposures on the next request —
the same instant-off property the rollout gate has.

> **Note on the live website path.** The synchronous live bridge (Wave 16) runs
> flags → enforcement and intentionally skips the async Policy stage, so experiments do not yet
> influence live block rendering. They are fully active in the complete `engine.execute()` pipeline.
> Wiring experiments into the live path is a deliberate follow-up (see Wave 18), not an accident.

## Performance (measured, 200k warmed ops)
| Path | Cost |
|---|---|
| `experimentBucket` (hash) | ~0.07 µs |
| `allocateVariant` — A/B | ~0.42 µs |
| `allocateVariant` — 4-way multi-variant | ~0.40 µs |
| `ExperimentPolicy.evaluate` (5 experiments) | ~1.6 µs |
| …with exposure tracking | ~1.9 µs |
| `tracker.report` (2 variants, 2000 exposures) | ~0.9 µs |

Allocation is essentially free; reporting is O(variants), not O(events), because counts are
aggregated on write. Negligible against the ~20 µs policy stage.

## What this wave deliberately did NOT do
- **No Personalization, no AI, no inference** — variants are assigned by hash, nothing is predicted.
- **No Runtime, Rendering or Engine change** — integration is one registered policy.
- **No statistical engine** — the winner heuristic is explicitly a guard-rail (see above).
- **No live-path wiring** — experiments run in the full pipeline, not the synchronous live bridge.
- **No persistence** — the registry and tracker are in-memory; counts do not survive a reload.
