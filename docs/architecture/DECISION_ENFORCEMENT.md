# Decision Enforcement Engine (Phase 1, Wave 11)

> A Runtime capability, not new infrastructure. The Runtime already *evaluates* decisions (policy
> effect + directives, feature flags); this engine *resolves* those into typed **decisions** and
> *applies* them to an authoritative **EnforcedState** in a new `enforcement` stage placed
> immediately before rendering. Additive, pure, **framework only** — it records what would be
> enforced and does **not** change UI rendering, so everything still works (tests 490/490, journeys
> 52/52, parity 5/5, Guardian 0/0/0). **Personalization and Experiments are NOT implemented.**

## Architecture
```
… → Resolution → Policy → Decision Enforcement → Rendering → Response
                            │
                DecisionResolver   (effective policy decision + effective flags → Decision[])
                            ↓
                DecisionEnforcer   (apply in priority order → EnforcedState + conflicts)
                            ↓
                execution.enforcement  (DecisionOutcome)
```
`enforcement.ts` depends only on the type/policy/flags **contracts** (it imports
`EffectivePolicyDecision` and `EffectiveFlags` as types). Neither `policy.ts` nor `flags.ts`
imports enforcement, so the dependency is one-directional and Guardian's runtime-cycle count stays **0**.

## Decision model (STEP 1)
- **DecisionAction** (STEP 3) — `enable | disable | replace | override | redirect | annotate`.
- **DecisionTarget** — `{ type, key? }` where `type ∈ experience | flag | configuration | route | section | annotation | …`.
- **Decision** — `{ id, action, target, value?, priority, source, reason? }` with `source ∈ policy | feature-flag`.
- **DecisionTrace** — the per-decision record `{ decisionId, action, target, applied, source, reason }`.
- **EnforcedState** — `{ enabled[], disabled[], overrides{}, replacements{}, annotations{}, redirect }` —
  the applied effect, modelled without touching rendering.
- **DecisionOutcome** — `{ state, applied[], skipped[], conflicts[], executionMs }`.

## Enforcement engine (STEP 2) — framework only
- **DecisionResolver.resolve(input)** — maps the effective inputs to decisions:
  - policy `effect: 'deny'` → `disable` the experience (priority 1000);
  - `redirect` directive → `redirect` (200); `override.<k>` → `override` (100); `replace.<k>` →
    `replace` (100); `flag.<k>` directives are **ignored** (flags are the authoritative flag source);
    every other directive → `annotate` (50);
  - each effective **flag** → `enable`/`disable` on `{type:'flag', key}` (source `feature-flag`, priority 10).
- **DecisionEnforcer.apply / applyMany** — applies decisions to the `EnforcedState`; `applyMany`
  sorts by **priority desc** and resolves conflicts deterministically. Timed by an injectable clock.

The resolver/enforcer encode precedence and mechanics, not domain meaning.

## Execution flow
1. Sort decisions by priority (highest first).
2. For each, compute the target key `type:key`; the first (highest-priority) decision **owns** it.
3. A later decision on an owned target: **same effect** → skipped as redundant; **different effect**
   → recorded as a **conflict** and skipped (the higher-priority owner wins).
4. Applied decisions mutate the `EnforcedState`; emit `decision.applied` / `decision.skipped` /
   `decision.conflict`.
5. Return the `DecisionOutcome`.

## Conflict resolution (STEP 7)
Priority is the sole arbiter; the first decision to claim a target wins, and equal-priority ties
resolve in resolution order (deterministic). A loser is never silently dropped — it is recorded in
`conflicts` (winner/loser/actions) and emitted as `decision.conflict`. Because policy decisions get
higher base priorities (deny 1000, redirect 200, override/replace 100, annotate 50) than flags (10),
**policy overrides flags** on a shared target by default.

## Policy integration (STEP 4)
The engine **consumes** the effective Policy Decision (`execution.policy.decision`) — its `effect`
and merged `directives`. The Policy Engine is **not modified**; enforcement is a downstream reader.

## Feature Flag integration (STEP 5)
Each effective feature flag (`execution.flags.flags`) becomes an enforceable `enable`/`disable`
decision on a `flag` target, carrying its variant/value. Flags thus become first-class enforced
decisions, resolvable against and overridable by policy decisions.

## Runtime integration (STEP 6)
A new **`enforcement` stage** runs **immediately before `rendering`** — no existing stage is
reordered:
```
request · context · rules · version · configuration · resolution · policy · enforcement · rendering · response
```
The engine always wires the enforcer; the stage resolves + applies decisions from
`execution.policy` and `execution.flags`, storing the `DecisionOutcome` on `execution.enforcement`.
With no policies/flags the decision set is empty → an empty outcome → **rendering is unchanged**.
The `EnforcedState` is the seam a later wave binds to the renderer; **this wave changes no UI output.**

## Diagnostics (STEP 7) & Events (STEP 8)
`DecisionOutcome` exposes **applied** traces, **skipped** traces, **conflicts**, and **executionMs**;
the stage records a summary diagnostic. Events to an optional sink (`onDecisionEvent` on the
execution, or the enforcer's `onEvent`): `decision.applied`, `decision.skipped`, `decision.conflict`.

## Performance (measured, tsx/node, 200k warmed ops)
| Path | Cost |
|---|---|
| `resolve` (policy + 8 flags → decisions) | ~2.1 µs |
| `applyMany` (12 decisions, no conflicts) | ~3.4 µs |
| `applyMany` (conflict-heavy, 20 decisions) | ~7.0 µs |
| `enforce` (resolve + apply, full) | ~6.8 µs |

The **default** engine has an empty policy decision and no flags, so the stage resolves to an empty
decision set and costs near-zero. Cost scales with the number of decisions; conflicts roughly double
it (extra bookkeeping + events). Negligible against the ~20 µs orchestration.

## What this wave deliberately did NOT do
- **No Personalization, no Experiments.**
- **No UI rendering change** — enforcement is record-only; the rendering stage is untouched.
- **No stage reorder** — `enforcement` is inserted before `rendering`; every other stage keeps its place.
- **No Policy Engine change** — enforcement only *reads* the effective decision.
- **No Website Runtime / Studio / renderer / Delivery / Provider / Audience / Flag changes.**

> **Wave 12 update.** The `EnforcedState` is **not** bound directly to the renderer. The Render
> Decision Adapter converts it into renderer-agnostic instructions
> (`execution.renderInstructions`) — see `RENDER_DECISION_ADAPTER.md`. Enforcement itself is
> unchanged; the adapter is a downstream reader.

## Future Personalization integration
Personalization/experiment policies emit variant decisions (e.g. `replace section:hero` with the
chosen variant, or `override variant`), which flow through this same resolve→apply pipeline into the
`EnforcedState`. The final step — **binding the EnforcedState to the renderer** so `disable` skips a
section, `redirect` short-circuits, and `replace`/`override` swap content — is the natural next wave:
it is the first time the effective decision changes output, so it warrants careful parity testing.
The model, resolver, enforcer, conflict resolution, diagnostics and events need no change.
