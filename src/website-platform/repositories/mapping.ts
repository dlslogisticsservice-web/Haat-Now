// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Generic mapping + aggregate factory (Wave 1).
// Eliminates per-entity mapper duplication: because every website_* column maps
// camelCase(entity) ↔ snake_case(row) and jsonb/array columns pass through, a single
// generic mapper serves every aggregate. `defineAggregate` produces BOTH a Supabase
// repository and an in-memory repository from one small spec — the DRY replacement for
// hand-written mappers. (The Wave 0 site/page bespoke mappers remain as-is; frozen.)
// ─────────────────────────────────────────────────────────────────────────────

import type { Repository, PersistedEntity } from './repository';
import { SupabaseRepository } from './supabase.repository';
import { InMemoryRepository } from './memory.repository';

/** Non-column control keys that must never be written to a row. */
const CONTROL_KEYS = new Set(['expectedVersion']);

export function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}
export function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
}

/** Convert a DB row (snake_case) into an entity (camelCase). */
export function rowToEntity<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) out[snakeToCamel(k)] = row[k];
  return out as unknown as T;
}

/** Convert a camelCase object into a DB row, dropping undefined + control keys. */
export function entityToRow(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    if (CONTROL_KEYS.has(k)) continue;
    const v = obj[k];
    if (v !== undefined) out[camelToSnake(k)] = v;
  }
  return out;
}

function asRecord(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>;
}

/** One spec drives both backends for an aggregate. */
export interface AggregateSpec<TEntity extends PersistedEntity, TCreate, TUpdate> {
  table: string;
  entityName: string;
  /** Default values for required entity fields the create DTO does not carry. */
  defaults: (input: TCreate) => Partial<TEntity>;
}

export interface AggregateRepositories<TEntity extends PersistedEntity, TCreate, TUpdate> {
  supabase(): Repository<TEntity, TCreate, TUpdate>;
  memory(): InMemoryRepository<TEntity, TCreate, TUpdate>;
}

/** Build a Supabase + in-memory repository pair for an aggregate from one spec. */
export function defineAggregate<TEntity extends PersistedEntity, TCreate, TUpdate>(
  spec: AggregateSpec<TEntity, TCreate, TUpdate>,
): AggregateRepositories<TEntity, TCreate, TUpdate> {
  return {
    supabase(): Repository<TEntity, TCreate, TUpdate> {
      return new SupabaseRepository<TEntity, TCreate, TUpdate, Record<string, unknown>>({
        table: spec.table,
        entityName: spec.entityName,
        fromRow: r => rowToEntity<TEntity>(r),
        toInsert: input => entityToRow({ ...asRecord(spec.defaults(input)), ...asRecord(input) }),
        toUpdate: patch => entityToRow(asRecord(patch)),
      });
    },
    memory(): InMemoryRepository<TEntity, TCreate, TUpdate> {
      return new InMemoryRepository<TEntity, TCreate, TUpdate>({
        entityName: spec.entityName,
        build: (input, id, now) => ({
          id, version: 1, createdAt: now, updatedAt: now, deletedAt: null,
          ...asRecord(spec.defaults(input)), ...asRecord(input),
        }) as unknown as TEntity,
        applyPatch: (entity, patch) => {
          const patched: Record<string, unknown> = { ...asRecord(entity) };
          const changes = entityToRowCamel(asRecord(patch));
          for (const k of Object.keys(changes)) patched[k] = changes[k];
          return patched as unknown as TEntity;
        },
      });
    },
  };
}

/** Like entityToRow but keeps camelCase keys (for in-memory patching), dropping control keys. */
function entityToRowCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    if (CONTROL_KEYS.has(k)) continue;
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}
