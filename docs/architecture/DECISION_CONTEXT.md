# Decision Context (Phase 2, Wave 18)

> One context object every decision capability reads. Until now audiences, flags, experiments and
> policies each received a different slice of the request. This unifies them behind a single,
> deterministically-built value the runtime populates **before policy evaluation** — and it closes
> the identity gap flagged in Wave 17, so experiment allocation can finally be per-visitor rather
> than per-page. Additive: no Runtime redesign, no Policy redesign (tests 604/604, journeys 52/52,
> parity 5/5, Guardian 0/0/0). **No Personalization. No AI** — this *describes* a request, it does
> not infer from it.

## Model
```
DecisionContext {
  identity   VisitorIdentity          // visitorId, kind, userId?, sessionId?, since?
  tenantId · channel · environment · role
  language   { locale, direction }
  device     { kind, platform, mobile? }
  location   { country?, region?, city?, timezone? }
  experienceId? · preview
  segments[] · audiences[]
  flags       { id: { enabled, variant?, value? } }
  experiments { experimentId: variantKey }
  attributes  { … }                   // extensible provider bag
  now
}
```
`flags` and `experiments` are typed **structurally** so this module imports neither `flags.ts` nor
`policy.ts`. `policy.ts` imports *this* one — the dependency stays one-directional and Guardian
reports **0 cycles**.

## Identity
| Case | Behaviour |
|---|---|
| **Anonymous** | `anonymousVisitor(seed)` — id derived from a durable seed the host persists. Stable across sessions; a new session changes only `sessionId`. |
| **Authenticated** | `authenticatedVisitor(userId)` — keyed by **account**, so identity survives a cleared browser token and is consistent across devices. Uses a separate hash namespace from anonymous ids. |
| **No seed available** | the explicit `UNKNOWN_VISITOR`. |

`deriveVisitorId(seed)` is a pure hash: same seed → same id, in every process, forever.

**The engine never mints an identity.** It has no storage and no clock; minting one per request
would produce ids that look stable and are not, silently corrupting every experiment. The host owns
persistence — `src/experience-channels/website/visitor.ts` reads/writes `localStorage`
(durable) and `sessionStorage` (per session), degrades to a session-only identity in private mode,
and falls back to `UNKNOWN_VISITOR` rather than faking stability. `forgetWebsiteVisitor()` clears it.

`decisionUnitId(ctx)` returns the visitor id when one is known, else the coarse
`tenant:experience` — and the difference is observable, so a page-level test is never mistaken for
a user-level one.

## Providers
```ts
interface DecisionContextProvider {
  readonly id: string;
  readonly priority?: number;                 // ascending → higher priority applied LAST → wins
  contribute(current, input): Partial<DecisionContext> | null;
}
```
Build order — **defaults → providers (ascending priority) → explicit overrides**:
- **Merge semantics.** Scalars and arrays are *replaced* when provided; the nested record members
  (`language`, `device`, `location`, `flags`, `experiments`, `attributes`) are *key-merged*, so one
  provider can add `location.city` without erasing another's `location.country`. `undefined` never
  erases.
- **Override.** `decisionOverrides` is applied last and beats every provider.
- **Isolation.** A throwing provider contributes nothing and later providers still run — a bad
  provider cannot break a request.
- **Idempotent registration.** Re-using a provider id replaces it rather than duplicating.
- **Pure.** Same input → deep-equal context, every time.

## Runtime integration
Populated at the end of the existing **`context` stage** — after audiences and flags, and therefore
**before policy evaluation**, as required. No new stage, no reordering:

```
context stage:  audiences → flags → BUILD DecisionContext        → execution.decisionContext
policy stage:   policy.evaluate(…, { decision })                 → PolicyContext.decision
                ↓ experiment.* directives folded back in (withExperiments)
```
Experiment variants are the one field that cannot exist before policy runs — they are *assigned*
during it. The context is therefore built first (per the requirement) and **enriched immutably**
afterwards, so the returned `execution.decisionContext` carries the complete picture.

Per-request inputs: `ExecutionOptions.visitor` (host-supplied identity) and
`ExecutionOptions.decisionOverrides`. Engine-level: `ExperienceEngineOptions.contextProviders`,
plus `engine.decisionContext` to register providers later.

**Policy was extended, not redesigned:** one optional `PolicyContext.decision` field, threaded
through `toPolicyContext` — exactly the additive pattern used for `audiences` (Wave 9) and `flags`
(Wave 10). Existing policies are untouched and keep reading the fields they already used.

## Consuming it
```ts
engine.policies.register(createExperimentPolicy(registry, {
  resolveUnit: ctx => ctx.decision ? decisionUnitId(ctx.decision) : 'anonymous',
}));
```
That single line upgrades Wave 17 from page-level to **visitor-level** allocation, and a test
asserts the same visitor receives the same variant across separate executions.

## Performance (measured, 200k warmed ops; execute at 20k)
| Path | Cost |
|---|---|
| `deriveVisitorId` | ~0.23 µs |
| `baseDecisionContext` | ~0.23 µs |
| `mergeDecisionContext` | ~0.32 µs |
| `builder.build` — no providers | ~0.25 µs |
| `builder.build` — 3 providers + override | ~1.9 µs |
| `execute()` — context built, no providers | ~48 µs |
| `execute()` — context built, 3 providers | ~42 µs |

Context construction is ~0.25 µs and ~0.55 µs per provider — immaterial inside a ~45 µs execution
(the two `execute()` figures differ by less than run-to-run variance, so the provider cost is not
measurable at that level).

## What this wave deliberately did NOT do
- **No Personalization, no AI, no inference.**
- **No Runtime redesign** — population added to the existing `context` stage.
- **No Policy redesign** — one optional additive field.
- **No identity minting in the engine** — the host owns persistence.
- **No PII** — the context carries a derived opaque id, coarse location and device class; nothing
  identifying is stored or hashed beyond the host-supplied seed.
