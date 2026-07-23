# Render Decision Adapter (Phase 1, Wave 12)

> Decision Enforcement produces an `EnforcedState`. That state is **deliberately not bound to the
> renderer**. This adapter translates it into **renderer-agnostic instructions** — a stable,
> transport-like contract that a future renderer binding consumes. Additive, pure, **framework
> only**: the renderer is untouched and its output is byte-identical (tests 500/500, journeys
> 52/52, parity 5/5, Guardian 0/0/0). **Personalization and Experiments are NOT implemented.**

## Architecture
```
Decision Enforcement  →  EnforcedState
                            ↓  RenderDecisionAdapter.adapt()
                       RenderInstructionSet          ← renderer-agnostic
                            ↓
                       execution.renderInstructions
                            ↓  (future wave)
                         Renderer
```
The adapter is the **decoupling seam**. Enforcement knows nothing about rendering; the renderer
knows nothing about policies, flags or decisions. Both speak only `RenderInstruction`.

`render-adapter.ts` imports the enforcement/type **contracts** only. Nothing imports it back, so
the dependency is one-directional and Guardian's runtime-cycle count stays **0**.

> **Deliberate boundary note.** The instruction set is surfaced on `ExperienceExecution`, **not** on
> `ExperienceResponse`. Putting it on the response would force `context.ts` to import the adapter,
> creating `context → render-adapter → enforcement → policy → context` — a genuine cycle. Keeping it
> on the execution preserves the acyclic graph.

## Render instruction model (STEP 1)
- **RenderInstructionType** (STEP 3) — `hide | show | replace | override | redirect | annotate`.
- **RenderInstructionTarget** — `{ type, key? }` with
  `type ∈ section | flag | route | configuration | annotation | …`.
  (Named `RenderInstructionTarget`, not `RenderTarget`, because `pipeline.ts` already exports a
  `RenderTarget` — the render *output target* (`html-string`, `react-dom`, …). Two different
  concepts; the barrel re-exports both, so the names must not collide.)
- **RenderInstruction** — `{ id, type, target, value?, source }` where `source` records the
  `EnforcedState` field it came from (diagnostics).
- **RenderInstructionSet** — `{ instructions[], redirect, produced, ignored[], executionMs }`.

## Adapter (STEP 2)
`createRenderDecisionAdapter({ clock? })` returns:
- **`adapt(state, opts?)`** — one `EnforcedState` → one `RenderInstructionSet`.
- **`adaptMany(states, opts?)`** — adapts each state independently.

Framework only: it translates state to instructions. It makes no decisions, enforces nothing, and
renders nothing.

## Flow
| EnforcedState field | Instruction | Target |
|---|---|---|
| `disabled[]` | `hide` | `flag:<key>` |
| `enabled[]` | `show` | `flag:<key>` |
| `overrides{}` | `override` | `configuration:<key>` |
| `replacements{}` | `replace` | `section:<key>` |
| `annotations{}` | `annotate` | `annotation:<key>` |
| `redirect` | `redirect` | `route` |

Vacuous entries (an `undefined` value, or an empty-string redirect) produce **no** instruction and
are recorded in `ignored` with a reason — never silently dropped. Each created instruction emits
`instruction.created`; each skipped one emits `instruction.ignored`.

## Enforcement integration (STEP 4)
The adapter **consumes `EnforcedState` only**. `enforcement.ts` is unmodified — the adapter is a
downstream reader, exactly as enforcement is a downstream reader of the Policy Engine.

## Runtime integration (STEP 5)
The adapter runs inside the existing **`enforcement` stage**, immediately after `enforce()`
produces the state — **no new stage and no reorder**. The engine always wires it; the result is
stored on `execution.renderInstructions` and summarised in the stage diagnostic, e.g.
`render-adapter: 3 instruction(s), 0 ignored, redirect /go`.

**Renderer behaviour is unchanged.** The rendering stage, `RenderingPipeline`, `RenderingPort` and
`renderer.ts` were not touched; the renderer does not read the instruction set yet. A regression
test asserts the rendered output is *identical* with and without decisions present, so instructions
are produced with provably zero effect on output.

## Diagnostics (STEP 6) & Events (STEP 7)
`RenderInstructionSet` exposes **produced** (instructions generated), **ignored** (with reasons),
and **executionMs**. Events to an optional sink (`onInstructionEvent` on the execution, or the
adapter's `opts.onEvent`): `instruction.created`, `instruction.ignored`.

## Performance (measured, tsx/node, 200k warmed ops)
| Path | Cost |
|---|---|
| `adapt` — empty state (no-op) | ~2.1 µs |
| `adapt` — small state (3 instructions) | ~2.5 µs |
| `adapt` — large state (41 instructions) | ~7.1 µs |
| `adaptMany` — 5 large states | ~32.9 µs |

There is a ~2 µs fixed floor (allocation + clock + walking the six empty collections) and a marginal
cost of roughly **0.12 µs per instruction**. In the default engine the enforced state is empty, so
the adapter pays only the floor. Negligible against the ~20 µs orchestration.

## What this wave deliberately did NOT do
- **No renderer binding** — the renderer neither receives nor reads instructions yet; output is unchanged.
- **No Enforcement change** — `enforcement.ts` untouched; the adapter only reads its output.
- **No Personalization, no Experiments.**
- **No new runtime stage / no reorder** — the adapter runs within the existing `enforcement` stage.
- **No Website Runtime / Studio / renderer / pipeline / Delivery / Provider changes.**

> **Wave 13 update.** Instructions are no longer the last stop before the renderer. The Render Plan
> Builder compiles this instruction set into a declarative `RenderPlan`
> (`execution.renderPlan`) — see `RENDER_PLAN_BUILDER.md`. This adapter is unchanged; the builder
> is a downstream reader, and the renderer binding described below now targets the **plan**.

## Future renderer binding
The next wave binds `RenderInstructionSet` to the rendering stage — the first time a decision
changes output, and therefore the parity-critical step:
- `hide` / `show` → include or omit a section for a flag-gated block;
- `replace` / `override` → swap a section's content or a config-driven prop before `renderPageBody`;
- `redirect` → short-circuit rendering and emit a redirect result instead;
- `annotate` → attach non-visual metadata (debug, analytics) without altering markup.

Because instructions are renderer-agnostic, each renderer target (`html-string`, `react-dom`,
future native targets) can implement its own interpretation behind the existing `RenderingPort`
without the decision layers knowing. Recommended rollout: interpret instructions behind an
off-by-default gate, expand Studio↔Public parity and journey coverage against instruction-driven
output, then enable. The model, adapter, diagnostics and events need no change.
