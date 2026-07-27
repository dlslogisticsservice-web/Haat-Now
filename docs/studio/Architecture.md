# HAAT NOW Website Studio — Architecture

_Phase 9E audit baseline. The Studio is a visual application builder (components, logic, data)
layered on the HAAT NOW runtime. One store, one registry, one renderer, one expression engine._

## Subsystem map (single-instance, no parallel systems)

```
                         ┌────────────────────────────────────────────┐
                         │              WebsiteCenter (host)            │
                         │  channels · Motion Studio · Component/Data   │
                         └───────────────┬──────────────────────────────┘
                                         │ shares ONE
                                ┌────────▼─────────┐
                                │   BuilderStore    │  ← the single source of truth
                                │  (facade/session) │
                                └───┬───┬───┬───┬───┘
        ┌──────────────┬───────────┘   │   │   └───────────┬───────────────┐
        ▼              ▼               ▼   ▼               ▼               ▼
   Component      Logic (9B)       Data (9C/9D)        Motion (8J)     Publish/Draft
   Registry     expression·        entities·fields·    MotionStore·    DraftEngine·
   + tokens     bindings·          relations·CRUD·     PublishEngine   PublishEngine
   + renderer   actions·workflows  queryEngine·SQL·                    (versioning)
                                   seed·validation·
                                   analyzer
```

Every editing surface (Component Platform, Data Platform, Motion Studio, Website Center, Entry
Experience) mutates the **same `BuilderStore`** and renders through the **same Component Registry
render functions** (or the runtime adapters). There is no second store, runtime, registry, query
engine, binding engine or rendering engine — enforced by the Architecture Guardian (0 cycles).

## Dependency graph (one-directional, acyclic — Guardian: 0 cycles / 0 violations, 516 files)

```
component-platform/tokens        ← (leaf)
component-platform/logic/expression   ← (leaf, pure)
component-platform/data/{dataModel,queryEngine,sqlGenerator,seedGenerator,importExport,
                         fieldValidation,haatSchema,analyzer}  ← pure, leaf-ish
component-platform/registry ← components.tsx (specs) ← tokens/types
component-platform/BuilderStore ← registry + logic/* + data/*        (composition root)
features/admin/builder/{ComponentPlatform,DataPlatform,DataProPanels,LogicPanels} ← BuilderStore
features/admin/WebsiteCenter ← the above (host)
```

Feature isolation (`features/*` may not import sibling `features/*`) and the no-`lib/supabase`-in-
features rule are CI-enforced (`scripts/check-architecture.cjs`).

## Data flow
`UI event → BuilderStore method → mutate state / recordStore → emit() → subscribers re-render →
NodeView reads effectiveProps() (bindings resolved via expression engine over scope()) → registry
render fn → DOM`.

## Store flow
`BuilderStore.state` (undoable design model: tree, masters, variables, dataSources, workflows,
entities, relations, collections, schemaVersions) is snapshotted for undo/redo. **Record ROWS live
in `recordStore` OUTSIDE the snapshot** (9E) so history stays O(schema), never O(rows). Runtime
execution state (appState, timeline, audit log, sync queue) is also outside undo.

## Rendering flow
Component tree → `NodeView` (recursive) → `store.effectiveProps(node)` (defaults → props →
responsive overrides → resolved bindings/interpolation) → `spec.render()` → real DOM. Conditional
visibility/enable evaluated per node. No virtual second renderer.

## Memory flow
Session-only, in-memory. The undo stack holds ≤100 JSON snapshots of the **design model only**
(rows excluded). `scope()` builds `db.<entity>` **lazily** (getters) so data rows are materialised
only when an expression reads them.

## Runtime flow
The Studio edits the real HAAT runtime through the Runtime Registry/Adapters (customer/merchant/
driver/website) via dynamic `import()` — the Studio never statically imports app screens.

## Coupling analysis
- Pure leaves (expression, queryEngine, sqlGenerator, seedGenerator, importExport, fieldValidation,
  analyzer, tokens, dataModel) depend on nothing but types — **fully decoupled, unit-testable**.
- `BuilderStore` is the composition root that delegates to those pure modules (thin facade, not a
  God object: the heavy logic lives in the pure modules it calls).
- UI panels depend only on `BuilderStore` + registry.

## Complexity analysis
- Query: O(rows) single-pass filter/sort. Aggregate: O(rows).
- Expression: O(expression length); scope build O(1) amortised (lazy db).
- Undo/redo: O(design-model size), independent of row count.
- Tree ops: O(tree). Snapshot-based undo is O(tree) per op (acceptable for interactive scale).

## Potential risks (tracked)
- Snapshot-based undo is O(tree) per op → thousands of rapid programmatic inserts are O(n²).
  Non-issue for interactive use (dozens of components); documented, not a defect.
- Records non-undoable by design (9E) — a deliberate memory/perf trade-off.
