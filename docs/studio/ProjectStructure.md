# Project Structure — Website Studio

```
src/
  component-platform/
    tokens.ts                design tokens → theme CSS vars
    types.ts                 ComponentSpec / PropSpec / BuilderNode / MasterComponent
    registry.ts              component registry (register/get/list/byCategory/search)
    components.tsx           87 component specs (14 categories) — auto-registered
    BuilderStore.ts          the ONE session store (facade → pure engines)
    logic/                   Application Logic Platform (9B)
      expression.ts          safe expression engine (no eval)
      logicTypes.ts          Variable/Binding/Action/Condition/Validator/Workflow/DataSource
      dataSources.ts         unified data-source abstraction (wraps existing services)
    data/                    Visual Data Platform (9C/9D)
      dataModel.ts           Entity/Field/Relation/Collection/Permission/QuerySpec/SchemaVersion
      queryEngine.ts         the ONE query runner (pure)
      fieldValidation.ts     19 validation rule kinds (pure)
      sqlGenerator.ts        CREATE/ALTER/migration/inserts (pure, never executes)
      seedGenerator.ts       seeded PRNG domain data (pure, scales to 10k+)
      importExport.ts        CSV/JSON parse + CSV/JSON/SQL export (pure)
      haatSchema.ts          23 canonical HAAT NOW entities + relations
      analyzer.ts            performance analyzer + health scoring (pure)
    __tests__/               expression / queryEngine / dataPlatform unit tests
  features/admin/
    WebsiteCenter.tsx        Studio host; opens all surfaces; owns the shared BuilderStore
    builder/
      ComponentPlatform.tsx  Visual Component Platform UI (library/canvas/inspector)
      LogicPanels.tsx        Logic inspector tab + Live Debugger dock
      DataPlatform.tsx       Data Platform (Explorer + mode bar)
      DataProPanels.tsx      Validation/ERDiagram/Import/Export/Seed/SQL/Versions/Audit/Health
    motion/                  Motion Studio + Boot Simulator (8J)
  runtime/                   Runtime Adapter/Registry + selection/editing engines (8A–8I)
  experience-entry/          Entry Experience runtime + Motion model (8I/8J)
scripts/
  stress-9e.ts               enterprise stress benchmark
  check-architecture.cjs     feature isolation + no-lib/supabase (CI)
  gen-guardian-snapshot.ts   dependency-cycle guard
docs/
  studio/                    this documentation set
  testing/                   Puppeteer verification harnesses
```
