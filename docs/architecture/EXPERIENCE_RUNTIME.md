# Experience Runtime Orchestrator (Phase 1, Wave 4)

> The single execution coordinator. It owns the complete lifecycle of an experience request,
> running eight explicit, observable stages that coordinate the EXISTING services
> (engine.resolve, pipeline.render, the resolvers). Additive and pure; the Website, Studio,
> renderer, pipeline, publishing and rollback are unchanged (parity 5/5, journeys 52/52).

## Architecture
```
engine.execute(request)
   → ExperienceRuntime.execute
        → [middleware onion]
             → stage loop (metrics + diagnostics + hooks + events per stage)
        → ExperienceExecution { ok, response, stages, metrics, diagnostics }
```
The runtime is decoupled from the concrete engine via `RuntimeEngineDeps { resolve, pipeline,
services }`, so it stays pure and independently testable. The engine constructs one runtime and
exposes `execute()` / `executePreview()` / `executeDraft()`.

## Execution lifecycle (stage diagram)
```
Request → Context → Rules → Version → Configuration → Resolution → Policy → Enforcement → Rendering → Response
```
> **Wave 7 update.** A `policy` stage runs after `resolution` — the Policy Engine's evaluation
> point (see `POLICY_ENGINE.md`).
> **Wave 11 update.** An `enforcement` stage runs immediately before `rendering` — the Decision
> Enforcement Engine applies the effective decisions to an authoritative state (see
> `DECISION_ENFORCEMENT.md`). Both are framework no-ops until policies/flags are registered and
> neither changes rendering. The lifecycle is now **10 stages**.
- **request** — validate (experienceId + context), record mode/preview.
- **context** — use an installed `ContextResolver` if present, else the request context.
- **rules** — `RuleResolver.decide` (observable; records `appliedRules`).
- **version** — `VersionResolver.pick` (observable; records the version).
- **configuration** — loads Remote Configuration (Wave 8) via the coordinator (provider → cache →
  policy); records the effective configuration on `execution.configuration`. Empty (`source:'none'`)
  when no configuration provider is registered. See `REMOTE_CONFIGURATION.md`.
- **resolution** — authoritative: `engine.resolve` (which internally uses the resolvers).
- **policy** — the Policy Engine's effective-decision evaluation (Wave 7). Framework no-op with
  an empty registry; records the `PolicyOutcome` on `execution.policy`. Does not gate rendering yet.
- **enforcement** — the Decision Enforcement Engine (Wave 11). Resolves the effective policy
  decision + flags into typed decisions and applies them to an `EnforcedState` on
  `execution.enforcement`. Record-only — does not change rendering yet. The Render Decision
  Adapter (Wave 12) then converts that state into renderer-agnostic instructions on
  `execution.renderInstructions` (see `RENDER_DECISION_ADAPTER.md`), and the Render Plan Builder
  (Wave 13) compiles those into a declarative plan on `execution.renderPlan` (see
  `RENDER_PLAN_BUILDER.md`) — all record-only; the renderer is untouched.
- **rendering** — `pipeline.render` on the resolution. Wave 14: when the
  `executeRenderPlan` gate is ON (default OFF), the pipeline interprets `execution.renderPlan` and
  renders the transformed resolution through the existing `RenderingPort` (see
  `RENDER_PLAN_EXECUTION.md`).
- **response** — assemble the `ExperienceResponse` (resolution + renderingResult + diagnostics).

Every stage is timed (`metrics.stageMs`), records diagnostics, and fires hooks + events.

## Execution state
`ExecutionContext` is threaded through the stages: `traceId`, `mode`, `request`,
`experienceContext`, `currentStage`, `completedStages`, `appliedRules`, `version`,
`configuration`, `resolution`, `renderingResult`, `diagnostics`, `warnings`, `errors`,
`metrics`, `startedAt`. The final `ExperienceExecution` carries `{ ok, response, stages,
metrics, diagnostics, failedStage?, error? }`.

## Middleware (framework only)
`ExecutionMiddleware = (exec, next) => Promise<void>`, composed as an onion around the stage
loop (`composeMiddleware`, double-`next()` guarded). Examples the framework supports —
**logging, caching, authorization, metrics, tracing, feature-flags** — ship as adapters later;
none are implemented here. A middleware may short-circuit (skip the stages) — verified in tests.

## Observability
- **Hooks** (`RuntimeHooks`): `onBeforeStage`, `onAfterStage`, `onStageFailed`,
  `onExecutionCompleted`, `onExecutionFailed`.
- **Events** (`RuntimeEvent`): `execution.started`, `stage.started`, `stage.completed`,
  `stage.failed`, `execution.completed`, `execution.failed` — delivered to an optional
  `onEvent` sink. No external telemetry is wired (Wave 5+ can bridge these to the monitoring
  seam / analytics port).

## Graceful failure
A stage failure is captured (error + diagnostic + `stage.failed` event) and the loop CONTINUES
— execution always reaches `response` and returns `ok:false` with `failedStage` set. The
orchestrator never throws out of `execute()`.

## Performance (measured, tsx/node, 20k ops)
| Path | Cost |
|---|---|
| `resolveAndRender` (raw, no orchestrator) | ~3.2 µs |
| `execute` (full 8-stage orchestration) | ~19.1 µs |
| `execute` + hooks + events | ~20.3 µs |

Orchestration adds ~16 µs (the stage loop + per-stage metrics/diagnostics + the observable
rules/version calls). Absolute cost is negligible per request. **Caching opportunity**: the
rules/version stages currently re-run the pure resolvers for observability; a future optimization
can read `appliedRules`/`version` back from the authoritative resolution instead.

## Future configuration stage
The `configuration` stage is the seam for **Remote Configuration** (a later wave): a signed,
versioned, cache-aware config bundle resolved via `ConfigurationPort` — the placeholder becomes
a real fetch, populating `ExecutionContext.configuration` before resolution. (Wave 5 added the
Experience Delivery Layer — see `EXPERIENCE_DELIVERY.md` — which already provides the cache slot
and snapshot-signature shape that Remote Configuration will populate.)

## Future personalization
Personalization/experiments slot in as either a middleware (variant selection wrapping the run)
or an extension of the `rules` stage — both already observable, both additive. The pipeline,
resolver and registry never change.
