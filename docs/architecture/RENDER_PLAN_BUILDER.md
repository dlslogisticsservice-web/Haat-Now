# Render Plan Builder (Phase 1, Wave 13)

> The Render Decision Adapter emits **imperative** instructions ("hide this", "replace that").
> This builder compiles them into a **declarative `RenderPlan`** — the shape a renderer can consume
> directly, without replaying instruction order or resolving conflicts itself. Still one step short
> of the renderer: **the renderer is untouched** and its output is identical (tests 513/513,
> journeys 52/52, parity 5/5, Guardian 0/0/0). **Personalization and Experiments are NOT implemented.**

## Architecture
```
Decision Enforcement → EnforcedState
        ↓ RenderDecisionAdapter          (Wave 12 — imperative instructions)
   RenderInstructionSet
        ↓ RenderPlanBuilder.build()      (this wave — declarative compilation)
      RenderPlan  →  execution.renderPlan
        ↓ (future wave)
       Renderer
```
Why a plan and not direct binding: instructions are an **ordered stream** with precedence rules
(a `hide` after a `show`, a second `override` on the same key). A renderer should not have to
replay that. The plan is the **resolved, order-independent** answer — "these nodes are visible,
these are hidden, this one is replaced with X" — so every renderer target interprets the same
settled state.

`render-plan.ts` imports the render-adapter/type **contracts** only. Nothing imports it back, so
the dependency stays one-directional and Guardian's runtime-cycle count remains **0**.

## Model (STEP 1)
- **RenderNodePlan** — `{ id, key, targetType, visibility, replaced, content?, overrides?, sources[] }`.
  `id` is the qualified, collision-free `"<targetType>:<key>"` (a `flag:hero` and a `section:hero`
  are distinct nodes); `sources` lists the instruction ids that shaped the node (traceability).
- **RenderPlanMetadata** — `{ builtAt, instructionCount, nodeCount, planSize, hasRedirect, buildMs,
  annotations }`. `annotate` instructions land in `annotations` — non-visual metadata, never markup.
- **RenderPlan** — `{ nodes[], visible[], hidden[], replaced{}, overrides{}, redirect, metadata,
  diagnostics[] }`. `visible`/`hidden`/`replaced` are derived projections of `nodes`, recomputed
  by the builder so they can never drift.

## Plan content (STEP 3)
| Instruction | Plan effect |
|---|---|
| `show` | node → `visible` |
| `hide` | node → `hidden` (**fail-closed**, see below) |
| `replace` | node → `replaced: true` + `content`; surfaced in `replaced{}` |
| `override` | `overrides[key]` |
| `redirect` | `redirect` (empty values ignored) |
| `annotate` | `metadata.annotations[key]` |

**Fail-closed visibility.** If a node receives both `show` and `hide`, **hide wins** — a later
`show` never re-exposes a hidden node, and the conflict is recorded in `plan.diagnostics` rather
than resolved silently. Hiding something that should have been hidden is a safe failure; exposing
something that was meant to be hidden is not.

## Builder (STEP 2) — framework only
`createRenderPlanBuilder({ clock? })` returns:
- **`build(set, opts?)`** — compiles a `RenderInstructionSet` into a `RenderPlan`, emitting `plan.built`.
- **`merge(base, overlay)`** — deterministic composition: **the overlay wins** on visibility,
  content and overrides; `redirect` is `overlay ?? base`; sources, annotations, diagnostics and
  instruction counts accumulate; shared nodes merge rather than duplicate. Projections are recomputed.
- **`validate(plan)`** — structural invariants, returning `{ valid, errors, warnings }`.

It compiles and checks. It renders nothing and decides nothing.

## Validation
**Errors** (plan is unrenderable): duplicate node ids; a node both visible and hidden; a `replaced`
node with no content; an empty-string redirect; `metadata.nodeCount` out of sync with `nodes`.
**Warnings** (renderable but likely a mistake): a `replaced` node that is hidden (the replacement
will never show); a hidden node carrying overrides. Warnings never invalidate a plan.

Plans built by `build()` are valid by construction; `validate()` exists for **merged** and
hand-authored plans, which is where inconsistency can actually arise.

## Adapter integration (STEP 4)
`build()` consumes a **`RenderInstructionSet` only**. `render-adapter.ts` is unmodified — the
builder is a downstream reader, exactly as the adapter is a downstream reader of enforcement.

## Runtime integration (STEP 5)
The builder runs inside the existing **`enforcement` stage**, immediately after the adapter — **no
new stage, no reorder**. The engine always wires it; the plan is exposed as
**`execution.renderPlan`** and summarised in the stage diagnostic, e.g.
`render-plan: 3 node(s), size 5, redirect /go`.

**The renderer is untouched.** The rendering stage, `RenderingPipeline`, `RenderingPort` and
`renderer.ts` were not modified and do not read the plan. A regression test asserts rendered output
is *identical* with an empty plan and with a populated one, so the plan is provably inert today.

## Diagnostics (STEP 6) & Events (STEP 7)
`RenderPlanMetadata` reports **planSize**, **nodeCount**, **instructionCount**, **hasRedirect** and
**buildMs**; `plan.diagnostics` records conflicts (e.g. a suppressed `show`). Event to an optional
sink (`onPlanEvent` on the execution, or `build`'s `opts.onEvent`): **`plan.built`** with node count
and plan size.

## Performance (measured, tsx/node, 200k warmed ops)
| Path | Cost |
|---|---|
| `build` — empty set (no-op) | ~1.5 µs |
| `build` — small set (3 instructions) | ~2.3 µs |
| `build` — large set (41 instructions → 25 nodes) | ~11.1 µs |
| `merge` — two large plans | ~10.5 µs |
| `validate` — large plan | ~1.9 µs |
| `adapt` + `build` — full chain (large) | ~17.4 µs |

A ~1.5 µs floor plus roughly **0.23 µs per instruction**. In the default engine the enforced state
is empty, so the builder pays only the floor. Negligible against the ~20 µs orchestration.

## What this wave deliberately did NOT do
- **No renderer binding** — the renderer neither receives nor reads the plan; output is unchanged.
- **No adapter or enforcement change** — both are unmodified upstream producers.
- **No Personalization, no Experiments.**
- **No new runtime stage / no reorder** — the builder runs within the existing `enforcement` stage.
- **No Website Runtime / Studio / renderer / pipeline / Delivery / Provider changes.**

## Future renderer binding
The plan is now the single artifact a renderer needs. A future wave teaches the rendering stage to
consume `execution.renderPlan` behind an **off-by-default gate**:
- `hidden` → omit those nodes when walking the schema layout;
- `replaced` → substitute `content` for the node's block before `renderPageBody`;
- `overrides` → apply to config-driven props;
- `redirect` → short-circuit rendering and emit a redirect result;
- `metadata.annotations` → attach debug/analytics metadata without touching markup.

Because the plan is renderer-agnostic and pre-resolved, each target (`html-string`, `react-dom`,
future native targets) implements only the interpretation, behind the existing `RenderingPort`.
Recommended rollout: interpret behind the gate, expand Studio↔Public parity and journey coverage
against plan-driven output, then enable. The model, builder, validation and events need no change.
