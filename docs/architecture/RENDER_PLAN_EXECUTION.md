# Render Plan Execution (Phase 1, Wave 14)

> The chain closes. The Rendering Pipeline now **interprets the RenderPlan** and hands the existing
> `RenderingPort` an ordinary — but plan-transformed — resolution. The renderer never sees a plan
> and was not modified. Execution is **behind a feature gate that is OFF by default**, so default
> behaviour is byte-identical to Wave 13 (tests 528/528, journeys 52/52, parity 5/5, Guardian
> 0/0/0). **Personalization and Experiments are NOT implemented.**

## Architecture
```
RenderPlan
   ↓
RenderingPipeline.render()          ← gate: opts.executePlan (default OFF)
   ↓ opts.planExecutor.execute(resolution, context)
RenderPlanExecutor                   ← interprets the plan
   ↓ transformed ExperienceResolution (schema with the plan applied)
RenderingPort.render(resolution, context)   ← EXISTING abstraction, unchanged
   ↓
Renderer                             ← untouched, plan-unaware
```
The renderer contract is preserved exactly: a port still receives `(resolution, context)`. All the
plan does is decide *which resolution* it receives. Nothing bypasses the port.

### Why the seam is structural
`context.ts` already type-references `pipeline.ts`. If `pipeline.ts` imported `render-plan.ts` the
graph would close a cycle: `pipeline → render-plan → render-adapter → enforcement → policy →
context → pipeline`. So `pipeline.ts` declares the executor shape **structurally**
(`PipelinePlanExecutor`) and imports nothing new; `render-plan-executor.ts` satisfies that shape
without importing the pipeline. Guardian still reports **0 cycles**.

## Executor (STEP 1)
`createRenderPlanExecutor(plan, { clock? })` → `execute(resolution, context)` returning:
```ts
{ resolution, redirect, applied[], skipped[], executionMs, diagnostics[] }
```
It is **pure, immutable and never throws**. The tree transform is **clone-on-write**: unchanged
branches keep their object identity, and an unaffected plan returns the *same resolution reference*.

**Matching rule** — a plan node applies to the tree node whose `id` equals the plan node's `key`.
Matching is deliberately *not* done on `componentId`, which would apply a change to every block of
a type. Operations are applied to the root `layout` and to every `pages[].layout`.

## Supported operations (STEP 2)
| Operation | Effect on the resolution |
|---|---|
| **Hide** | the matching node (and its subtree) is removed from its parent's `children` |
| **Show** | no-op — visible is the default state; reported in `skipped` for transparency |
| **Replace** | the matching **component** node's `props` are swapped for the plan's content |
| **Override** | rewrites props that **already exist** with that key — it never invents a prop |
| **Redirect** | short-circuits: the port is **not called**; the result status is `redirected` |
| **Metadata** | annotations are surfaced as diagnostics — never rendered into the tree |

Anything that cannot be applied (no matching node, missing/invalid replacement content, a `hide`
targeting a root layout, a replace on a non-component node) is recorded in `skipped` with a reason.
Nothing is dropped silently.

## Pipeline integration (STEP 3, STEP 4)
One step was added to `RenderingPipeline.render()`, between *find the port* and *execute*:
1. if `opts.executePlan !== true` → **nothing happens** (the pre-Wave-14 path, untouched);
2. otherwise run `opts.planExecutor.execute(...)`;
3. on `redirect` → return `status: 'redirected'` **without invoking the port**;
4. otherwise call `port.render(transformedResolution, context)` — the existing abstraction;
5. plan applied/skipped/timing are appended to `result.diagnostics`.

A throwing executor is caught: rendering proceeds with the **untransformed** resolution and a
`plan execution failed` warning. Plan execution can never break rendering.

`RenderStatus` gained one additive member, `'redirected'`. `RenderingPort`, `renderer.ts` and the
pipeline's structure are otherwise unchanged.

## Feature gate (STEP 5)
Two independent switches, both required:
- **Pipeline level** — `RenderOptions.executePlan` (default `false`). Supplying a `planExecutor`
  alone does **not** enable execution; a test asserts this.
- **Runtime level** — `ExecutionOptions.executeRenderPlan` (default `false`). Only when true does
  the runtime build an executor and pass it to the pipeline; otherwise `optsRender()` returns
  `undefined` exactly as before.

Default = OFF at every level. Enable per execution with
`engine.execute(request, { executeRenderPlan: true })`.

## Diagnostics (STEP 6)
The executor returns **applied**, **skipped** (each with a reason) and **executionMs**; the pipeline
folds these into `RenderingResult.diagnostics` as `plan applied: …`, `plan skipped: …` and
`plan execution N.NNNms`. The runtime adds a `render-plan execution: ENABLED (gate on)` diagnostic
so it is always visible in the execution trace when the gate is on.

## Performance (measured, tsx/node, 100k warmed ops, 60-node tree)
| Path | Cost |
|---|---|
| `pipeline.render` — **gate OFF** (baseline) | ~0.49 µs |
| `pipeline.render` — gate ON, empty plan | ~1.46 µs |
| `pipeline.render` — gate ON, hide ×3 | ~52.3 µs |
| executor — empty plan (fast path) | ~0.53 µs |
| executor — hide ×3 (full 60-node walk) | ~49.6 µs |
| executor — override all (full 60-node walk) | ~59.3 µs |

**Gate OFF costs nothing** — one boolean check. A **zero-op fast path** was added after profiling:
a plan with no hide/replace/override never walks the tree, cutting the empty-plan case from ~54 µs
to ~0.53 µs (and gate-on-with-empty-plan rendering from ~51.8 µs to ~1.46 µs). This matters because
most requests carry an empty or metadata-only plan.

When there *are* operations, interpretation costs roughly **0.85 µs per tree node** — for a 60-node
page, ~50 µs, which is meaningfully larger than the rest of the ~20 µs orchestration. That is the
honest price of walking and rebuilding a tree, and the main optimisation target before the gate is
turned on broadly (see Risk Analysis).

## What this wave deliberately did NOT do
- **No renderer or RenderingPort redesign** — the port signature and `renderer.ts` are untouched.
- **No plan reaching the renderer** — the port receives a plain resolution.
- **No default behaviour change** — the gate is off; a test proves gate-off output and diagnostics
  are identical to the baseline.
- **No Personalization, no Experiments.**
- **No Website Runtime / Studio / Delivery / Provider / Policy / Enforcement / adapter / builder changes.**

## Enabling this safely
1. Turn the gate on for a **single low-traffic experience** via `executeRenderPlan: true`.
2. Author block ids that match the flag/section keys the plans target (the matching contract).
3. Watch `plan applied` / `plan skipped` diagnostics — a plan whose ops are all *skipped* means the
   ids do not line up, and is the most likely misconfiguration.
4. Extend Studio↔Public parity to cover plan-driven output before enabling broadly.
