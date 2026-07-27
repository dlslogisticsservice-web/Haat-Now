# Developer Guide — Website Studio

## Getting started
- `npm run dev` — Vite dev server (port 3000). Sign in at `/app?console=1` → `#acct_admin`,
  super-admin `+201000000005`, OTP `123456`.
- `npm run lint` — tsc + architecture + demo-isolation checks.
- `npm run test:website` — 738 unit/integration tests (pure engines, node:test via tsx).
- `npm run build` — Vite build + version stamp + Guardian snapshot.
- `npx tsx scripts/stress-9e.ts` — enterprise stress benchmark.

## Where things live (see ProjectStructure.md)
- Engines (pure, testable): `src/component-platform/{logic,data}/**`, `tokens.ts`, `registry.ts`.
- Store (composition root): `src/component-platform/BuilderStore.ts`.
- Studio UI: `src/features/admin/builder/**`, `src/features/admin/WebsiteCenter.tsx`,
  `src/features/admin/motion/**`.
- Runtime adapters: `src/runtime/adapters/**`.

## Extending
- **Add a component**: append a spec via `mk(...)` in `components.tsx` (auto-registered).
- **Add a field type**: extend `FieldType` in `dataModel.ts` + `SQL_TYPE` in `sqlGenerator.ts`.
- **Add an expression function**: add to the `FN` whitelist in `logic/expression.ts`.
- **Add a data source kind**: extend `DataSourceKind` + `defaultDataSources()`.

## Rules (do not break)
- One store / registry / renderer / expression / query engine. No parallel systems.
- `features/*` must not import sibling `features/*`; no `lib/supabase` in features.
- Keep engines pure (no DOM/React) so they stay unit-testable.
- Public `BuilderStore` API is stable — extend, don't rewrite.
