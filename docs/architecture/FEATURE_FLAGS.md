# Feature Flags Engine (Phase 1, Wave 10)

> A business capability that **reuses the kernel** — no new infrastructure. Feature flags are
> named, prioritised, audience-targetable switches with optional variants. They are evaluated as
> part of the Runtime context (right after audiences), surfaced on the execution, and bridged into
> the Policy Engine through a concrete `FeatureFlagPolicy`. Additive, pure, **framework only** —
> nothing changes for existing requests (tests 481/481, journeys 52/52, parity 5/5, Guardian
> 0/0/0). **Personalization and Experiments are NOT implemented.**

## Architecture
```
Runtime · context stage
        ↓ Audience Resolution (Wave 9)  →  matched audiences
        ↓ Feature Flag Evaluation (this wave, uses those audiences)
        ↓ effective flags  →  execution.flags
        ↓
  Policy Engine (PolicyContext.flags, FeatureFlagPolicy)  ·  Remote Configuration
        ↓
  Effective Runtime Decision
```
`flags.ts` depends only on the context/type contracts **and the Policy contracts** (it imports
`policy.ts` for the `FeatureFlagPolicy`). Critically, **`policy.ts` does NOT import `flags.ts`** —
`PolicyContext.flags` is typed structurally — so the dependency is one-directional and Guardian's
runtime-cycle count stays **0**. It reuses the existing registry/evaluator patterns; it adds no layer.

## Feature Flag model (STEP 1)
```
FeatureFlag {
  metadata,                        // id, name, version, priority?, description?, tags?
  enabled,                         // master switch — off ⇒ always off
  default?  { enabled?, variant?, value? },
  variants? FeatureFlagVariant[],  // { key, value, weight? }
  rules?    FeatureFlagRule[],     // { criteria?, enabled?, variant? } — first match wins
}
```
`FeatureFlagResult` = `{ flagId, enabled, variant?, value?, reason, priority, matchedRuleId?,
evaluationMs }` with `reason ∈ disabled | rule-match | default | no-match`.

## Registry (STEP 2)
`FeatureFlagRegistry` = `register · unregister · get · has · enable · disable · list · all · ids ·
size · clear`, pure `InMemoryFeatureFlagRegistry`. `enable(id)` / `disable(id)` flip a flag's master
switch in place (a disabled flag always resolves off).

## Evaluator (STEP 3) — framework only
- **`evaluate(flag, ctx)`** — master switch → first matching **rule** (in order) → **default**.
  A rule matches when its `FlagCriteria` match (AND over present dims); its `variant` picks a value
  from `variants`. Timed by an injectable clock.
- **`evaluateMany(flags, ctx)`** — evaluate a set.
- **`resolveEffectiveFlags(registry, ctx, {onEvent})`** — evaluate every registered flag → the
  effective flag map `{ id: { enabled, variant?, value? } }`, `matched` (enabled, priority-sorted),
  `rejected`, the full `results` trace, and `evaluationMs`; emits events per flag.

No business flags are predefined; the evaluator resolves whatever a flag declares.

## Evaluation flow
1. `toFlagContext(experienceContext, { preview, audiences })` — the matched audiences come from the
   Audience Engine.
2. Per flag: master switch → rules (first match) → default.
3. Emit `flag.evaluated` then `flag.enabled` / `flag.disabled`.
4. Return the `FlagResolution` (effective map + matched/rejected + trace + timing).

## Audience integration (STEP 4)
`FlagCriteria` targets **matched audiences** (overlap) plus **tenant, country, locale,
environment, channel, preview**. Because flags evaluate *after* audiences in the context stage,
a rule like `{ audiences: ['vip'], enabled: true }` turns a flag on only for the `vip` audience —
reusing the Audience Engine with no change to it.

## Policy integration (STEP 5)
A concrete **`FeatureFlagPolicy`** (`createFeatureFlagPolicy(registry)`, policy type
`feature-flag`) bridges flags into the Policy Engine: its `evaluate` reads the effective flags
already on `PolicyContext.flags` (no double evaluation; standalone it resolves from the registry)
and emits them as `flag.<id>` **directives** (`effect: 'annotate'`) so flag state appears in the
effective decision. Registering it is opt-in. **Personalization is not implemented.**

## Runtime integration (STEP 6)
Flag evaluation happens **inside the existing `context` stage**, immediately after audience
resolution — no new stage, no reorder. The engine wires a flag resolver over `engine.flags`; the
stage stores the `FlagResolution` on `execution.flags`, and the effective flag map flows into:
- the **policy** stage — `policy.evaluate(context, { flags })` → `PolicyContext.flags`;
- the **configuration** stage — `configuration.resolve(context, { flags })` → configuration-policy context.

With **no flags registered** (the default) the effective set is empty and **no behaviour changes**.

## Diagnostics (STEP 7) & Events (STEP 8)
`FlagResolution` exposes **matched** ids, **rejected** ids, per-flag **reason** and **evaluationMs**,
and the full `results` trace. Events to an optional sink (`onFlagEvent` on the execution, or the
resolver's `onEvent`): `flag.evaluated`, `flag.enabled`, `flag.disabled`.

## Performance (measured, tsx/node, 100k warmed ops)
| Path | Cost |
|---|---|
| `evaluate` (single flag, rule + variant) | ~0.33 µs |
| `registry.get` (lookup) | ~0.02 µs |
| `resolveEffectiveFlags` (10 flags) | ~4.1 µs |

~0.4 µs per flag. The **default** engine registers no flags, so the context-stage flag cost is
near-zero; cost scales linearly with the number of *registered* flags. Negligible against the
~20 µs orchestration.

## What this wave deliberately did NOT do
- **No Personalization, no Experiments** — flags only.
- **No new runtime stage / no reorder** — evaluation lives in the existing `context` stage.
- **No behaviour change** — empty registry ⇒ empty effective set ⇒ identical execution.
- **No new infrastructure** — the registry/evaluator reuse the kernel patterns; `PolicyContext.flags`
  is structural to keep the dependency one-directional.
- **No Website Runtime / Studio / renderer / Delivery / Provider / Audience changes.**

## Future Personalization integration
Personalization/experiment policies select a **variant** per matched audience and per flag — the
model already carries `variants` and per-rule `variant` selection, and flags already resolve with
the matched audiences in context. A later `PersonalizationPolicy` (its own type) reads
`PolicyContext.flags` (or a dedicated experiment assignment) and merges the chosen variant into the
effective decision, handed to the resolver/renderer by an enforcement hook. The Feature Flags Engine
— model, registry, evaluator, audience targeting, diagnostics, events — needs no change; only the
new policy type and the enforcement step are added.
