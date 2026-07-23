# Policy Engine (Phase 1, Wave 7)

> The single decision-making layer. Policies are pluggable, prioritised, scope-matched,
> health-reporting decision units; the Policy Evaluator matches them, evaluates them in priority
> order, merges their results deterministically, and produces the **effective runtime decision**.
> Policy evaluation runs as a new Runtime stage. Additive, pure, and **framework only** — it
> encodes precedence, not domain rules. Nothing changes for existing requests (tests 440/440,
> journeys 52/52, parity 5/5, Guardian 0/0/0). **Remote Configuration, Feature Flags and
> Personalization are NOT implemented** — their policy types are contracts only.

## Architecture
```
Runtime
  ↓
Delivery → Providers → (resolution)
  ↓
Policy stage → PolicyEngine.evaluate
  ↓
Policy Registry  (register · scope-match · prioritise · health)
  ↓
Policy Evaluator (evaluate → evaluateMany → merge → resolveEffectivePolicy)
  ↓
Effective Runtime Decision   { effect, directives, contributors, conflicts }
```
`policy.ts` depends only on the context/type contracts (one-directional — the runtime imports
policy types, policy imports nothing from the runtime), so Guardian's runtime-cycle count stays **0**.

## Policy contracts (STEP 1)
```ts
interface Policy {
  readonly metadata: PolicyMetadata;      // id, name, type, version, priority?, scope?
  applies(ctx: PolicyContext): boolean;   // scope match
  evaluate(ctx: PolicyContext): PolicyResult | Promise<PolicyResult>;
  health(): PolicyHealth;                 // healthy | degraded | offline | unsupported
}
```
- **PolicyType** — `configuration | feature-flag | personalization | experiment | licensing | tenant | geography | runtime-override | (string & {})`.
- **PolicyPriority** — a number; higher wins in evaluation and merge.
- **PolicyScope** — `{ channels?, environments?, roles?, tenants?, locales?, countries?, segments?, experiences?, audiences?, tags? }`, matched against a **PolicyContext** by the pure `policyMatchesScope`. (`audiences` added in Wave 9 — a policy can be scoped to the request's matched audiences; see `AUDIENCE_ENGINE.md`.)
- **PolicyResult** — `{ effect, directives?, reason?, tags? }` where `effect ∈ allow | deny | override | annotate | noop` and `directives` are `{key, value}` contributions.
- **PolicyHealth** — one of the four states below.

**STEP 4 policy types** (`ConfigurationPolicy`, `FeatureFlagPolicy`, `PersonalizationPolicy`,
`ExperimentPolicy`, `LicensingPolicy`, `TenantPolicy`, `GeographyPolicy`, `RuntimeOverridePolicy`)
are **marker interfaces over `Policy`** with a narrowed `metadata.type`. `ConfigurationPolicy` is
implemented via Remote Configuration (Wave 8) and `FeatureFlagPolicy` via the Feature Flags Engine
(Wave 10, `createFeatureFlagPolicy` — see `FEATURE_FLAGS.md`, surfaced through `PolicyContext.flags`);
the rest remain contracts only.

## Registry (STEP 2)
`PolicyRegistry` = `register · unregister · get · has · all · byType · matching · resolve ·
health · ids · size · clear`. `InMemoryPolicyRegistry` is pure infrastructure. `matching(ctx,
types?)` keeps *usable* (healthy/degraded) policies whose scope applies, sorted by priority desc
(healthy before degraded at ties); `resolve` returns the single best; `health()` snapshots every
policy's status by id.

## Evaluator (STEP 3) — framework only
- **`evaluate(policy, ctx)`** — runs one policy; **never throws** — a scope/health miss returns a
  skipped record, a thrown policy is captured as `error`. Timed via an injectable clock.
- **`evaluateMany(policies, ctx)`** — evaluates in priority order (as the registry sorted them).
- **`merge(evaluations)`** — deterministic reduction to `EffectivePolicyDecision`:
  - **effect** — the strongest across contributors by rank `deny > override > allow > annotate > noop`.
  - **directives** — highest-priority policy wins each key; a lower-priority policy setting the
    same key to a *different* value is recorded as a **conflict** (winner/loser/values), never a
    silent overwrite.
  - **contributors** — the policy ids that produced a result.
- **`resolveEffectivePolicy(registry, ctx, {types?})`** — the full flow: match → evaluate → merge,
  returning a `PolicyOutcome` with the decision plus the diagnostics below.

The evaluator has **no business rules** — it merges whatever policies return. What a policy
*decides* is the policy's concern (and no policy is implemented this wave).

## Evaluation flow
1. **Match** — `registry.matching(ctx, types)` → usable, in-scope policies by priority.
2. **Skip** — every other policy of the scoped types is `ignored` (emits `policy.skipped`).
3. **Evaluate** — each matched policy runs (`policy.matched` → `policy.evaluated`), timed.
4. **Merge** — priority-ordered reduction; disagreements emit `policy.conflict`.
5. **Decide** — the `EffectivePolicyDecision` + full trace is returned as the `PolicyOutcome`.

## Runtime integration (STEP 5)
A new **`policy` stage** runs after `resolution` and before `rendering`:
```
request · context · rules · version · configuration · resolution · policy · rendering · response
```
The engine constructs a `PolicyEngine` over an **empty** registry and passes it to the runtime.
With no policies registered the effective decision is `noop` and **nothing about resolution or
rendering changes** — the stage is a framework no-op. When policies are registered (via
`engine.policies.register(...)`), the stage evaluates them, records a summary diagnostic, and
surfaces the full `PolicyOutcome` on `execution.policy`. The decision **does not gate resolution
or rendering yet** — that is a deliberate future hook, not a behaviour change.

## Diagnostics (STEP 6) & Events (STEP 7)
Every `PolicyOutcome` exposes **matched** ids, **ignored** ids, per-policy **priority**,
**evaluationMs**, and the **decision trace** (`evaluations[]` with result/error) plus **totalMs**.
Events to an optional sink (`onPolicyEvent` on the execution, or the evaluator's `onEvent`):
`policy.matched`, `policy.skipped`, `policy.evaluated`, `policy.conflict`.

## Health (STEP 10 parity)
| Status | Meaning | Evaluation |
|---|---|---|
| `healthy` | fully operational | evaluated; preferred |
| `degraded` | operational, reduced | evaluated; ranked after healthy peers at equal priority |
| `offline` | temporarily unavailable | **skipped** |
| `unsupported` | cannot serve this context | **skipped** |

## Conflict resolution
Priority is the sole arbiter: the highest-priority policy that sets a directive key wins;
equal-priority ties resolve in registration/evaluation order (deterministic). A losing value is
not discarded silently — it is recorded in `decision.conflicts` and emitted as `policy.conflict`,
so an operator can see *which* policy overrode *which*. `deny` as an effect is terminal regardless
of directive merging.

## Performance (measured, tsx/node, 50k warmed ops)
| Path | Cost |
|---|---|
| `registry.matching` (8 policies, scope + priority) | ~0.9 µs |
| `merge` (8 results, shared keys → conflicts) | ~3.0 µs |
| `resolveEffectivePolicy` (match → evaluate → merge, 8 policies) | ~11 µs |

The **default** engine registers no policies, so the stage's cost is near-zero (an empty match +
empty merge). Cost scales with the number of *matching* policies, not the number registered.

## Compatibility
Behaviour-preserving. The policy stage is additive; the default empty registry yields a `noop`
decision that touches nothing downstream. The runtime's own Wave-4 test was updated only where it
hard-coded the stage count (now `EXECUTION_STAGES.length`); all stage-order assertions compare
against the `EXECUTION_STAGES` constant and pass unchanged. Delivery, providers, resolution and
rendering are untouched.

## What this wave deliberately did NOT do
- **No Remote Configuration, Feature Flags, or Personalization** — those policy types are contracts.
- **No policy gates resolution or rendering** — the decision is recorded, not enforced, yet.
- **No Website Runtime / Studio / renderer / Delivery / Provider changes.**
- **No persistence or remote policy source** — the registry is in-memory.

## Future Remote Configuration integration
Remote Configuration arrives as a **`ConfigurationPolicy`** (and/or a `ConfigurationProvider`).
The runtime's `configuration` stage (still a placeholder) will consult configuration-typed
policies to shape the config bundle before resolution, and/or the policy stage's directives will
feed `ExecutionContext.configuration`. Priority/scope/health selection, the effective-decision
merge, and the diagnostics/events are already in place — only the concrete policy implementation
is added, with no change to the registry, evaluator, or runtime wiring.

## Future personalization
Personalization and experiments register as `PersonalizationPolicy` / `ExperimentPolicy`. Variant
selection becomes directives merged into the effective decision (e.g. `variant → 'B'`), which a
later wave can hand to the resolver/renderer. The framework — scope matching, priority, conflict
resolution, health, diagnostics — needs no change; only the policy bodies and the enforcement hook
are added.
