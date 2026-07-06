// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Repository contracts (Wave 0).
// The persistence abstraction every aggregate repository implements. Two concrete
// backends satisfy it: InMemoryRepository (tests / reference) and the Supabase
// repositories. Optimistic locking, soft delete, pagination and filtering are part
// of the contract — not per-repo afterthoughts.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, Result, Page, PageRequest } from '../shared/types';

/** The minimal shape a persisted aggregate must expose for the base contract. */
export interface PersistedEntity {
  id: UUID;
  tenantId: UUID;
  version: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Tenant-scoped repository. Every method is tenant-scoped by construction — a caller
 * cannot read/write across tenants (mirrors the RLS boundary of the tables).
 */
export interface Repository<
  TEntity extends PersistedEntity,
  TCreate,
  TUpdate,
  TField extends string = string,
> {
  create(input: TCreate): Promise<Result<TEntity>>;
  getById(tenantId: UUID, id: UUID): Promise<Result<TEntity>>;
  /** Optimistic-locked update. If `expectedVersion` is set and stale → optimistic_lock error. */
  update(tenantId: UUID, id: UUID, patch: TUpdate, expectedVersion?: number): Promise<Result<TEntity>>;
  /** Soft delete (sets deletedAt). Returns the tombstoned entity. */
  softDelete(tenantId: UUID, id: UUID): Promise<Result<TEntity>>;
  /** Restore a soft-deleted entity. */
  restore(tenantId: UUID, id: UUID): Promise<Result<TEntity>>;
  list(tenantId: UUID, request?: PageRequest<TField>): Promise<Result<Page<TEntity>>>;
}

/**
 * Unit of work for multi-aggregate atomic operations (e.g. reorder a page tree,
 * clone a site). The Supabase implementation delegates to a SECURITY DEFINER RPC
 * (single DB transaction, idempotent) — the Phase 9 pattern. The in-memory
 * implementation runs the callback directly.
 */
export interface UnitOfWork {
  run<T>(work: () => Promise<Result<T>>): Promise<Result<T>>;
}
