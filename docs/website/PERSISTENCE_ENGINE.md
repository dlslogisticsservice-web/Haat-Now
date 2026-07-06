# Website Platform · Persistence Engine (Wave 1)

> The data-driven core: store, retrieve, version and manage websites entirely from the database.
> Additive on the Wave 0 foundation; no builder / CMS UI / editor / rendering / publishing — persistence only.
> Everything is behind feature flags (default OFF); the module is unwired, so the app is unchanged.

## 1. Shape
```
services/       12 services (AggregateService generic + named) — repository-only
  └─ repositories/  Repository contract → { generic Supabase backend | in-memory backend }
       ├─ mapping.ts        camel↔snake + defineAggregate (DRY: one factory → all aggregates)
       ├─ registry.ts       RepositoryBundle (17 aggregates), backend-selectable
       ├─ collection.ts     generic child/registry repository (memory + Supabase)
       └─ child.ts          named child repos (theme tokens, settings, revisions, …)
  └─ persistence/unit-of-work.ts   saga transactions (rollback / savepoints / recovery)
  └─ audit/         who/when/before/after/correlation/tenant/environment
  └─ outbox/        durable events (persist → deliver; replay/retry/idempotency/DLQ)
  └─ snapshot/      draft+published snapshots (hash/checksum/version) — persistence only
  └─ storage/       Supabase Storage gateway (tenant-namespaced) — no UI
  └─ observability/ structured logging, tracing hooks, metrics, health, repo diagnostics
  └─ workers/       job queue + registry + runner (infrastructure only; no domain logic)
```

## 2. Repositories (Part 1)
- **One `Repository<TEntity,TCreate,TUpdate>` contract** (Wave 0) with create / getById / update
  (optimistic-locked) / softDelete / restore / list (pagination + filtering + sorting).
- **Two backends, one behavior:** `SupabaseRepository` (generic, version-guarded UPDATE) and
  `InMemoryRepository` (reference semantics + tests).
- **DRY factory `defineAggregate`** turns one spec into both backends for an aggregate — the 15
  aggregates beyond site/page are ~2 lines each (no hand-written mappers). Site/Page keep their
  Wave 0 bespoke mappers (frozen).
- **Child/registry tables** (theme tokens, settings, revisions, publish history, component library,
  feature flags, asset usage, form submissions) use one generic `CollectionRepository` (insert /
  upsert / find / findOne / remove), memory + Supabase.
- **21 repository targets** from the brief are covered: 17 aggregates + 8 child collections
  (Media Metadata = assets aggregate + media-variant aggregate + asset-usage child).

## 3. Optimistic locking, soft delete, versioning
- Every aggregate row carries `version` (guarded UPDATE: `... where version = expectedVersion`;
  mismatch → `optimistic_lock`), `deleted_at` (soft delete + restore), and audit timestamps.
- `expectedVersion` on update DTOs is the caller's concurrency token; omitted → read-current-then-write.

## 4. Transactions
- The **Unit of Work** (`persistence/unit-of-work.ts`) is a compensation-based saga: each step
  registers an `undo`; failure rolls completed steps back LIFO. Supports savepoints + nesting +
  failure recovery. See `UNIT_OF_WORK.md`. Hot atomic ops also have SECURITY DEFINER RPCs
  (`website_reorder_pages`) in the runtime migration.

## 5. Backends & flags
- `createPlatformContext({ backend: 'memory' | 'supabase' })` wires repos + children + audit +
  outbox + snapshots + storage + uow. The compat selector keeps every tenant on the legacy backend
  until `website.db_backend` is enabled (default OFF).

## 6. Node-safety note
The persistence engine runs under Node (tests/bench) as well as the browser. `src/lib/supabase.ts`
was made import-safe (`import.meta.env &&` guard) so importing repository modules under Node does not
crash — the literal `import.meta.env.VITE_*` expressions are preserved verbatim so Vite's build-time
`define` still fires (browser behavior unchanged; verified by E2E 24/24).

## 7. Companion docs
`SERVICE_LAYER.md` · `UNIT_OF_WORK.md` · `OUTBOX_PATTERN.md` · `AUDIT_TRAIL.md` ·
`SNAPSHOT_STORAGE.md` · `BENCHMARK_REPORT.md` · `DATABASE_REFERENCE.md`.
