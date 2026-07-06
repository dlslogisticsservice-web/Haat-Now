// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Generic in-memory repository (Wave 0).
// A COMPLETE implementation of the Repository contract — optimistic locking, soft
// delete, filtering, sorting and pagination — backed by a Map. Used by unit tests
// and as the reference semantics the Supabase repositories must match. Any aggregate
// gets a working repository by supplying a `build` + `applyPatch` pair.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, Result, Page, PageRequest, FilterClause, FilterValue } from '../shared/types';
import { ok, err, PAGE_DEFAULTS } from '../shared/types';
import { errors } from '../shared/errors';
import type { Repository, PersistedEntity, UnitOfWork } from './repository';

export interface MemoryRepositoryOptions<TEntity extends PersistedEntity, TCreate, TUpdate> {
  entityName: string;
  /** Build a fresh entity from create input. `id`/`now` are supplied by the repo. */
  build: (input: TCreate, id: UUID, now: string) => TEntity;
  /** Apply a partial update to a copy of the entity (no version/audit bookkeeping). */
  applyPatch: (entity: TEntity, patch: TUpdate) => TEntity;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
function nowIso(): string {
  return new Date().toISOString();
}
function newId(): UUID {
  return crypto.randomUUID();
}

function readField(entity: PersistedEntity, field: string): FilterValue {
  const record = entity as unknown as Record<string, unknown>;
  const value = record[field];
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value as FilterValue;
  }
  return null;
}

function matches(entity: PersistedEntity, clause: FilterClause): boolean {
  const actual = readField(entity, clause.field);
  const expected = clause.value;
  switch (clause.operator) {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'gt': return actual !== null && expected !== null && actual > (expected as string | number);
    case 'gte': return actual !== null && expected !== null && actual >= (expected as string | number);
    case 'lt': return actual !== null && expected !== null && actual < (expected as string | number);
    case 'lte': return actual !== null && expected !== null && actual <= (expected as string | number);
    case 'in': return Array.isArray(expected) && (expected as ReadonlyArray<string | number>).includes(actual as string | number);
    case 'like': return typeof actual === 'string' && typeof expected === 'string' && actual.toLowerCase().includes(expected.toLowerCase());
    case 'is': return actual === expected;
    default: return false;
  }
}

export class InMemoryRepository<TEntity extends PersistedEntity, TCreate, TUpdate>
  implements Repository<TEntity, TCreate, TUpdate>, UnitOfWork {
  private readonly store = new Map<UUID, TEntity>();

  constructor(private readonly opts: MemoryRepositoryOptions<TEntity, TCreate, TUpdate>) {}

  async create(input: TCreate): Promise<Result<TEntity>> {
    const now = nowIso();
    const entity = this.opts.build(input, newId(), now);
    entity.version = 1;
    entity.createdAt = now;
    entity.updatedAt = now;
    entity.deletedAt = null;
    this.store.set(entity.id, clone(entity));
    return ok(clone(entity));
  }

  async getById(tenantId: UUID, id: UUID): Promise<Result<TEntity>> {
    const found = this.store.get(id);
    if (!found || found.tenantId !== tenantId || found.deletedAt !== null) {
      return err(errors.notFound(this.opts.entityName, id));
    }
    return ok(clone(found));
  }

  async update(tenantId: UUID, id: UUID, patch: TUpdate, expectedVersion?: number): Promise<Result<TEntity>> {
    const found = this.store.get(id);
    if (!found || found.tenantId !== tenantId || found.deletedAt !== null) {
      return err(errors.notFound(this.opts.entityName, id));
    }
    if (expectedVersion !== undefined && expectedVersion !== found.version) {
      return err(errors.optimisticLock(this.opts.entityName, id));
    }
    const next = this.opts.applyPatch(clone(found), patch);
    next.version = found.version + 1;
    next.updatedAt = nowIso();
    this.store.set(id, clone(next));
    return ok(clone(next));
  }

  async softDelete(tenantId: UUID, id: UUID): Promise<Result<TEntity>> {
    const found = this.store.get(id);
    if (!found || found.tenantId !== tenantId) {
      return err(errors.notFound(this.opts.entityName, id));
    }
    found.deletedAt = nowIso();
    found.version += 1;
    found.updatedAt = found.deletedAt;
    this.store.set(id, found);
    return ok(clone(found));
  }

  async restore(tenantId: UUID, id: UUID): Promise<Result<TEntity>> {
    const found = this.store.get(id);
    if (!found || found.tenantId !== tenantId) {
      return err(errors.notFound(this.opts.entityName, id));
    }
    found.deletedAt = null;
    found.version += 1;
    found.updatedAt = nowIso();
    this.store.set(id, found);
    return ok(clone(found));
  }

  async list(tenantId: UUID, request?: PageRequest): Promise<Result<Page<TEntity>>> {
    const page = Math.max(1, request?.page ?? PAGE_DEFAULTS.page);
    const pageSize = Math.min(PAGE_DEFAULTS.maxPageSize, Math.max(1, request?.pageSize ?? PAGE_DEFAULTS.pageSize));
    const filters = request?.filters ?? [];
    const withDeleted = request?.withDeleted ?? false;

    let rows = Array.from(this.store.values()).filter(e =>
      e.tenantId === tenantId && (withDeleted || e.deletedAt === null),
    );
    for (const clause of filters) rows = rows.filter(e => matches(e, clause));

    const sort = request?.sort ?? [];
    if (sort.length > 0) {
      rows.sort((a, b) => {
        for (const clause of sort) {
          const av = readField(a, clause.field);
          const bv = readField(b, clause.field);
          if (av === bv) continue;
          const less = av === null ? true : bv === null ? false : av < (bv as string | number);
          return (less ? -1 : 1) * (clause.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize).map(clone);
    return ok({
      items,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
      nextCursor: null,
    });
  }

  /** UnitOfWork — in memory there is no transaction boundary; run the work directly. */
  async run<T>(work: () => Promise<Result<T>>): Promise<Result<T>> {
    return work();
  }
}
