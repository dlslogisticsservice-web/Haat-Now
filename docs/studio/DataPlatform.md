# Visual Data Platform (Phases 9C–9D)

Visual data modeling on the one `BuilderStore`. Entities → fields → relations → CRUD → queries →
realtime → binding, plus enterprise tooling. No duplicated Supabase/Firebase client (declarative
mappings only).

## Concepts
- **Entity** (`data/dataModel.ts`): name/icon/color/tags/system/version + `fields[]` + `permissions[]`
  + `mapping{provider,target,reuses}` + `diagram{x,y}`. 37 **field types** with full settings
  (required/unique/indexed/nullable/hidden/readonly/searchable/sortable/filterable/encrypted/localized
  + default/regex/min/max/length/precision/scale/format/options/ref/expr).
- **Relations**: oneToOne / oneToMany / manyToMany / self / recursive; onDelete cascade/restrict/setNull;
  orphan protection. Visual ER diagram (drag, zoom, pan, minimap, auto-layout, junction, cardinality).
- **Collections**: collection / subcollection / view / virtual / computed / dynamic.
- **Records** live in `recordStore` (outside undo). Tenant-tagged, permission-gated.

## Engines (all pure, unit-tested)
- **Query** (`queryEngine.ts`): filter (14 operators + nested AND/OR) → sort → distinct → group +
  aggregate (count/sum/avg/min/max/distinct) → select → offset/limit.
- **Validation** (`fieldValidation.ts`): 19 rule kinds incl. conditional / cross-field / custom-expr;
  localized messages; reuses the expression engine.
- **SQL** (`sqlGenerator.ts`): CREATE TABLE + indexes + constraints + FKs, migration up/down, INSERTs.
  Generates only — never executes.
- **Seed** (`seedGenerator.ts`): seeded PRNG + HAAT domain pools; deterministic; scales to 10k+.
- **Import/Export** (`importExport.ts`): CSV/JSON parse, column mapping, dup detection; CSV/JSON/SQL export.
- **Analyzer** (`analyzer.ts`): performance heuristics + health scoring.

## CRUD (BuilderStore)
`createRecord / updateRecord / deleteRecord / softDelete / restore / archive / unarchive / bulkUpdate
/ bulkDelete / duplicateRecord / importRows / exportEntity / generateSeed` — each audited; tenant-
isolated; create gated by `can()`.

## Realtime
Reactive via `subscribe()`; offline `syncQueue` buffers mutations; reconnect flushes.

## HAAT NOW canonical schema (`haatSchema.ts`)
23 HAAT-only entities (Restaurants, Branches, Categories, Products, Variants, Modifiers, Merchants,
Customers, Drivers, Vehicles, Orders, OrderItems, Payments, Wallets, Coupons, Offers, Addresses,
DeliveryZones, Reviews, Ratings, Notifications, SupportTickets, Favorites) + auto-wired relations.
One-click **Install HAAT NOW Models**. No Beauty Hub / Dynamic Logistics / external projects.

## Binding integration
Entities are exposed to the 9B binding engine as `db.<entity>` in `scope()` (lazy). A component
prop can bind to an entity/collection/field/query/expression through the same one binding engine.

## UI
`DataPlatform.tsx` (Explorer 3-pane) + a mode bar → `DataProPanels.tsx`: Validation Builder · ER
Diagram · Import/Export wizards · Seed · SQL · Versions · Audit Explorer · Health Dashboard.
