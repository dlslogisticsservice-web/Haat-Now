# Audience & Targeting Engine (Phase 1, Wave 9)

> A **business capability** — not a new infrastructure layer. It matches named, prioritised
> **audiences** against a request context and makes the matched set part of the Runtime context,
> where the Policy Engine (and, later, Feature Flags / Personalization) can target by it. Additive,
> pure, and **framework only** — it evaluates whatever criteria an audience declares; it decides
> nothing. Nothing changes for existing requests (tests 468/468, journeys 52/52, parity 5/5,
> Guardian 0/0/0). **Feature Flags, Personalization and Experiments are NOT implemented.**

## Architecture
```
Runtime · context stage
        ↓ TargetResolver.resolve(context)
  Audience Registry → Target Evaluator → Audience Matcher (per audience)
        ↓
  matched audience ids  →  execution.audiences   (Runtime context)
        ↓
  Policy Engine  (policy.scope.audiences)  ·  Remote Configuration (configuration policies)
        ↓
  Effective Runtime Decision
```
`audience.ts` depends only on the context/type contracts (one-directional — Policy consumes only
audience **ids**, a primitive, and never imports the module), so Guardian's runtime-cycle count
stays **0**.

## Audience model (STEP 1)
```
Audience { metadata, segments[], match? }          // segments combined 'any' (OR, default) | 'all'
  AudienceSegment { id, rules[], match? }          // rules combined 'all' (AND, default) | 'any'
    AudienceRule { criteria, negate? }             // a criteria block, optionally inverted
      AudienceCriteria { …dimensions… }            // AND over the present dimensions
```
- **AudienceMetadata** — `{ id, name, version, priority?, description?, tags? }`.
- **AudienceMatch** — the per-audience result: `{ audienceId, matched, priority, matchedSegments,
  rejectedSegments, criteriaTrace, evaluationMs }`.
- An audience with **no segments** targets everyone; a segment with **no rules** matches.

## Supported targets (STEP 3)
`AudienceCriteria` matches by **tenant, country, locale, channel, environment, role, device,
platform, user segments** (overlap), and **preview mode**. A present dimension must match (AND);
absent dimensions are ignored. Matched against an `AudienceContext` derived from the
`ExperienceContext` by the pure `toAudienceContext`.

## Targeting engine (STEP 2)
- **AudienceMatcher** — `match(audience, ctx)` evaluates one audience (segments → rules → criteria)
  and returns an `AudienceMatch` with a full criteria trace, timed by an injectable clock.
- **TargetEvaluator** — `evaluate(audiences, ctx)` matches many, returning `AudienceMatch[]`.
- **TargetResolver** — `resolve(context, opts?)` maps the context, evaluates every registered
  audience, emits events, and returns a `TargetResolution`. **Framework only** — no audience is
  predefined; the host registers them.

## Matching flow
1. `toAudienceContext(experienceContext, {preview})`.
2. For each registered audience: **criteria** (AND over present dims) → **rule** (optionally
   negated) → **segment** (`all`/`any` over rules) → **audience** (`any`/`all` over segments).
3. Emit `audience.evaluated` then `audience.matched` / `audience.rejected` per audience.
4. Return `TargetResolution { matched (priority-sorted ids), rejected (ids), matches (trace), evaluationMs }`.

## Runtime integration (STEP 5)
Audience resolution happens **inside the existing `context` stage** — no new stage, no stage-order
change. When an audience resolver is wired (the engine always wires one over `engine.audiences`),
the stage resolves audiences and stores the `TargetResolution` on `execution.audiences`; the matched
ids then flow into:
- the **policy** stage — `policyEngine.evaluate(context, { audiences })` → `PolicyContext.audiences`;
- the **configuration** stage — `configuration.resolve(context, { audiences })` → configuration-policy scope.

With **no audiences registered** (the default) nothing matches, `execution.audiences.matched` is
empty, and **no behaviour changes** — the context stage's original note and all downstream stages
are untouched.

## Policy integration (STEP 4)
The Policy Engine gains one additive dimension: `PolicyScope.audiences` and `PolicyContext.audiences`,
matched by overlap in `policyMatchesScope`. A policy can therefore be **scoped to an audience** —
e.g. a configuration policy with `scope.audiences: ['vip']` applies only when `vip` is in the
request's matched audiences. No other policy machinery changed; **Feature Flags are not implemented**.

## Diagnostics (STEP 6) & Events (STEP 7)
`TargetResolution` exposes **matched** ids, **rejected** ids, per-audience **evaluationMs**, and the
**criteriaTrace** (`{dimension, expected, actual, matched}` per evaluated dimension). Events to an
optional sink (`onAudienceEvent` on the execution, or the resolver's `onEvent`): `audience.matched`,
`audience.rejected`, `audience.evaluated`.

## Performance (measured, tsx/node, 100k warmed ops)
| Path | Cost |
|---|---|
| `matcher.match` (single audience, 4 dimensions) | ~2.7 µs |
| `resolver.resolve` (10 audiences, events + trace) | ~29 µs |

~2.9 µs per audience, dominated by the criteria-trace construction and per-audience event emission.
The **default** engine registers no audiences, so the context stage's audience cost is near-zero.
Cost scales linearly with the number of *registered* audiences. Negligible against the ~20 µs
orchestration.

## What this wave deliberately did NOT do
- **No Feature Flags, no Personalization, no Experiments** — audiences only.
- **No new runtime stage / no stage reorder** — resolution lives in the existing `context` stage.
- **No behaviour change** — empty registry ⇒ empty matched set ⇒ identical execution.
- **No Website Runtime / Studio / renderer / Delivery / Provider changes.**

## Future Feature Flag integration
A `FeatureFlagPolicy` (its own policy type, a later wave) evaluates with the **same** matched
audiences already in `PolicyContext.audiences` — a flag becomes "on for audience `vip`" by scoping
the policy `scope.audiences: ['vip']`, reusing this engine unchanged. No audience code changes.

## Future Personalization integration
Personalization/experiment policies select a variant per matched audience (e.g. audience `vip` →
variant `B`) via directives merged into the effective decision, then handed to the resolver/renderer
by a later enforcement hook. The Audience Engine — registry, matcher, criteria, diagnostics, events —
needs no change; only the new policy types and the enforcement step are added.
