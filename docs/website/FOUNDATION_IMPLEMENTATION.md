# Wave 0 — Foundation Implementation Summary

> HaaT Now · Website Platform · Wave 0 (first engineering wave). Implementation only —
> no Website Builder, CMS, or Visual Editor. Every gate green; the legacy Website Center is
> untouched.

## 1. What was built
The complete infrastructure the Website Platform's future features depend on, delivered as a
**self-contained, additive module** at `src/website-platform/` that the running app does **not**
import — so the shipped bundle and E2E are byte-identical.

```
src/website-platform/
├── index.ts                      public module surface (barrel)
├── shared/                       types (Result/Page/filters), errors, validation kernel
├── domain/                       enums, entities (23 aggregates), DTOs + validation
├── flags/                        feature-flag resolver (defaults DISABLED)
├── events/                       typed event catalog (24 events) + in-memory bus
├── repositories/                 Repository contract, generic Supabase + in-memory backends,
│                                 row↔entity mappers, site/page configs, UnitOfWork
├── publishing/                   snapshot/renderer/delivery CONTRACTS (no impl yet)
├── api/                          REST route contracts + GraphQL-readiness (no endpoints)
├── compat/                       legacy ↔ platform adapter + flag-gated backend selector
├── testing/                      factories, mocks (recording bus)
└── __tests__/                    31 tests (repository, validation, serialization, events,
                                  contracts, compat, migration)
```

## 2. Design guarantees (mandatory rules → how they were met)
| Rule | How |
|---|---|
| No breaking changes / legacy keeps working | New module is unwired; `grep` confirms zero external imports → tree-shaken out of the bundle |
| Migration additive | `create table if not exists` throughout; no `drop`, no alter of existing tables |
| Everything behind feature flags | `WEBSITE_FLAGS` + `StaticFlagResolver`; `defaultFlagResolver` = all disabled; compat selector returns `legacy` in Wave 0 |
| Backward compatible | Legacy service imported **type-only** in compat (erased at compile; no runtime coupling) |
| Every commit compiles + passes gates | lint (tsc+arch) ✓, tests 31/31 ✓, build ✓, build:live ✓, E2E 24/24 ✓ |
| No partial systems | The in-memory repository is a COMPLETE backend (CRUD, optimistic lock, soft delete, pagination, filter, sort); the Supabase backend implements the same contract |
| No `any`, no dead code, no TODO placeholders, no arch violations | `tsc --noEmit` clean; no `any` keyword; repositories live outside `features/**` (guard passes) |

## 3. Quality gates (final validation)
- `npm run lint` → tsc `--noEmit` **0 errors** + architecture guard **0 violations**.
- `npm run test:website` → **31 passed**, 0 failed.
- `npm run build` (sandbox) → ✓. `npm run build:live` → ✓.
- E2E (Puppeteer) → **24/24 pass** (unchanged from before Wave 0).

## 4. Foundation modules (mapped to the brief)
1. **Website Platform module** — `src/website-platform/` with clear domain boundaries; separate from legacy `src/services/website.service.ts`.
2. **Domain model** — 23 entities, enums with CHECK-mirrored unions, DTOs + validators, repository/service contracts.
3. **Database foundation** — `supabase/migrations/20260705000100_website_platform_foundation.sql`: all `website_*` tables, multi-tenant, RLS, indexes, constraints, versioning, publishing + audit support (see `DATABASE_REFERENCE.md`).
4. **Repository layer** — interface + generic Supabase impl (optimistic locking, pagination, filtering, soft delete) + in-memory impl + `UnitOfWork`.
5. **Event backbone** — 24 typed events + typed bus (see `EVENT_CATALOG.md`).
6. **Publishing foundation** — `SnapshotCompiler`/`Renderer`/`DeliveryTarget`/`PublishingEngine` contracts (no rendering impl, per scope).
7. **Feature flags** — per-tenant + per-environment, defaults off.
8. **Compatibility layer** — legacy↔platform mapping + zero-downtime, reversible backend selection.
9. **Shared types** — DTOs, entities, events, API contracts, validation kernel.
10. **Developer infrastructure** — factories, mocks, in-memory backend, test runner (`scripts/test-website.cjs`), `__tests__/`.

## 5. What was deliberately NOT built (out of Wave 0 scope)
Website Builder, CMS features, Visual Editor, rendering/compile implementation, API endpoint
handlers, GraphQL server. These land in later waves behind the flags this wave established.

## 6. Deliverable index
- Files created / modified, migrations, flags, repositories, events, contracts, tests, coverage,
  risk, rollback → see this file's companion sections in the commit body and
  `MIGRATION_GUIDE.md` (migration risk + rollback).

---

## 7. Wave 1 — Persistence Engine (additive on this foundation)
Wave 1 makes the platform **data-driven** without touching Wave 0's frozen architecture (it reuses
the Repository contract, the generic Supabase/in-memory backends, the event bus interface, and the
`website_*` schema). Added:
- **21 repository targets** (17 aggregates via a DRY `defineAggregate` factory + 8 child collections),
  Supabase + in-memory, with optimistic locking / soft delete / pagination / filtering.
- **12 services** (generic `AggregateService` + named), repository-only, with automatic audit +
  validation + events + transactions.
- **Unit of Work** (saga: rollback / savepoints / recovery), **transactional outbox** (durable
  events: replay/retry/idempotency/DLQ), **audit trail** (who/when/before/after/correlation/tenant/
  env), **snapshot storage** (draft+published, hash/checksum/version), **Supabase Storage gateway**
  (tenant-namespaced), **observability** (logging/tracing/metrics/health/repo-diagnostics), and
  **background-worker infrastructure** (queue/registry/runner — no domain logic).
- **DB runtime migration** `20260705000200`: outbox/audit/snapshot/jobs tables, RPCs, views, a
  materialized view, and indexes.
- **68 tests** (91% line coverage; the remainder is Supabase-backed code that requires a live DB) +
  a **benchmark harness** (`BENCHMARK_REPORT.md`).
- One backward-compatible core edit: `src/lib/supabase.ts` guarded with `import.meta.env &&` so the
  module is import-safe under Node (tests/bench) while preserving Vite's build-time `define`
  (browser behavior unchanged; E2E 24/24).

Full detail: `PERSISTENCE_ENGINE.md`, `SERVICE_LAYER.md`, `UNIT_OF_WORK.md`, `OUTBOX_PATTERN.md`,
`AUDIT_TRAIL.md`, `SNAPSHOT_STORAGE.md`, `BENCHMARK_REPORT.md`, `DATABASE_REFERENCE.md`.
