# BuilderStore API (stable surface)

The single session store. Public methods are stable across phases (extend, don't rewrite).

## Tree / components (9A)
`insert · move · reorder · duplicate · remove · wrap · unwrap · setProp · setResponsive · setA11y ·
setMeta · getRoot · getSelected · select · getBreakpoint · setBreakpoint · count · find`
Reusable: `saveAsComponent · insertInstance · renameMaster · editMaster · detach · restoreInstance ·
resolveInstanceProps · resolveInstanceChildren · masters · getMaster`
History: `undo · redo · canUndo · canRedo`

## Logic (9B)
Variables: `variables · addVariable · updateVariable · removeVariable`
State: `getState · setState · timeline · ctxInfo · setCtx · log · getActiveScreen · getLastToast`
Scope/eval: `scope · evalExpr`
Bindings: `setBinding · removeBinding · effectiveProps`
Conditions: `setConditions · evalConditions`
Validators: `setValidators · validateField`
Actions: `addAction · removeAction · runActions`
Workflows: `workflows · addWorkflow · addWorkflowNode · removeWorkflow · runWorkflow`
Debug: `dependencies · dataSources`

## Data (9C/9D)
Entities: `entities · getEntity · addEntity · updateEntity · removeEntity`
Fields: `addField · updateField · removeField · setFieldValidations · validateRecord · validationErrorCount`
Relations/collections: `relations · addRelation · removeRelation · collections · addCollection · removeCollection`
Permissions: `addPermission · removePermission · can`
CRUD: `records · allRecordsRaw · createRecord · updateRecord · deleteRecord · softDelete · restore ·
archive · unarchive · bulkUpdate · bulkDelete · duplicateRecord · importRows · exportEntity ·
generateSeed · seedEntity · query`
Realtime/audit: `auditEntries · syncPending · isOnline · setOnline`
Schema versioning: `schemaVersions · saveSchemaVersion · restoreSchemaVersion · compareSchema`
Diagram: `setEntityDiagram · autoLayout`
SQL: `entitiesSQL · migrationSQL · entityInsertsSQL`
Analysis: `health`
HAAT: `installHaatModels`

## Contract notes
- `state` (design model) is undoable; `recordStore` (rows) + runtime state are **not** in the undo
  snapshot (9E perf/memory).
- `scope()` builds `db.<entity>` **lazily**.
- All engines it delegates to (`logic/*`, `data/*`) are pure and independently unit-tested.
