// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Generic collection repository (Wave 1).
// For child/registry/append tables that are NOT full aggregates (no optimistic
// version / soft delete): theme tokens, settings, revisions, publish history,
// component library, feature flags, asset usage, form submissions. One generic
// implementation (memory + Supabase) — no per-table duplication. Rows are camelCase;
// the Supabase backend maps to/from snake_case via the shared mapping kernel.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../../lib/supabase';
import type { Result } from '../shared/types';
import { ok, err } from '../shared/types';
import { errors } from '../shared/errors';
import { entityToRow, rowToEntity, camelToSnake } from './mapping';

/** Shallow-equality filter over a row's fields. */
export type RowFilter<TRow> = Partial<Record<keyof TRow, string | number | boolean | null>>;

export interface CollectionRepository<TRow extends Record<string, unknown>> {
  insert(row: TRow): Promise<Result<TRow>>;
  upsert(row: TRow, conflictKeys: ReadonlyArray<keyof TRow>): Promise<Result<TRow>>;
  find(filter?: RowFilter<TRow>): Promise<Result<TRow[]>>;
  findOne(filter: RowFilter<TRow>): Promise<Result<TRow | null>>;
  remove(filter: RowFilter<TRow>): Promise<Result<number>>;
}

// ── In-memory collection (tests / reference) ─────────────────────────────────────
export class MemoryCollection<TRow extends Record<string, unknown>> implements CollectionRepository<TRow> {
  private readonly rows: TRow[] = [];

  private matches(row: TRow, filter?: RowFilter<TRow>): boolean {
    if (!filter) return true;
    for (const k of Object.keys(filter) as Array<keyof TRow>) {
      if (row[k] !== filter[k]) return false;
    }
    return true;
  }

  async insert(row: TRow): Promise<Result<TRow>> {
    this.rows.push({ ...row });
    return ok({ ...row });
  }
  async upsert(row: TRow, conflictKeys: ReadonlyArray<keyof TRow>): Promise<Result<TRow>> {
    const idx = this.rows.findIndex(r => conflictKeys.every(k => r[k] === row[k]));
    if (idx >= 0) this.rows[idx] = { ...row };
    else this.rows.push({ ...row });
    return ok({ ...row });
  }
  async find(filter?: RowFilter<TRow>): Promise<Result<TRow[]>> {
    return ok(this.rows.filter(r => this.matches(r, filter)).map(r => ({ ...r })));
  }
  async findOne(filter: RowFilter<TRow>): Promise<Result<TRow | null>> {
    const found = this.rows.find(r => this.matches(r, filter));
    return ok(found ? { ...found } : null);
  }
  async remove(filter: RowFilter<TRow>): Promise<Result<number>> {
    let removed = 0;
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.matches(this.rows[i], filter)) { this.rows.splice(i, 1); removed++; }
    }
    return ok(removed);
  }
}

// ── Supabase collection ──────────────────────────────────────────────────────────
interface PgError { message: string }
interface PgList { data: unknown[] | null; error: PgError | null }
interface PgSingle { data: unknown | null; error: PgError | null }
interface Chain extends PromiseLike<PgList> {
  select(columns: string): Chain;
  eq(col: string, val: string | number | boolean | null): Chain;
  single(): PromiseLike<PgSingle>;
  maybeSingle(): PromiseLike<PgSingle>;
}
interface Tbl {
  select(columns: string): Chain;
  insert(row: Record<string, unknown>): Chain;
  upsert(row: Record<string, unknown>, opts: { onConflict: string }): Chain;
  delete(): Chain;
}
function tbl(name: string): Tbl {
  return supabase.from(name) as unknown as Tbl;
}

export class SupabaseCollection<TRow extends Record<string, unknown>> implements CollectionRepository<TRow> {
  constructor(private readonly table: string) {}

  private applyFilter(chain: Chain, filter?: RowFilter<TRow>): Chain {
    let q = chain;
    if (filter) {
      for (const k of Object.keys(filter) as Array<keyof TRow>) {
        q = q.eq(camelToSnake(String(k)), filter[k] as string | number | boolean | null);
      }
    }
    return q;
  }

  async insert(row: TRow): Promise<Result<TRow>> {
    const { data, error } = await tbl(this.table).insert(entityToRow(row)).select('*').single();
    if (error) return err(errors.conflict(`Failed to insert into ${this.table}`, { message: error.message }));
    return ok(rowToEntity<TRow>(data as Record<string, unknown>));
  }
  async upsert(row: TRow, conflictKeys: ReadonlyArray<keyof TRow>): Promise<Result<TRow>> {
    const onConflict = conflictKeys.map(k => camelToSnake(String(k))).join(',');
    const { data, error } = await tbl(this.table).upsert(entityToRow(row), { onConflict }).select('*').single();
    if (error) return err(errors.conflict(`Failed to upsert into ${this.table}`, { message: error.message }));
    return ok(rowToEntity<TRow>(data as Record<string, unknown>));
  }
  async find(filter?: RowFilter<TRow>): Promise<Result<TRow[]>> {
    const { data, error } = await this.applyFilter(tbl(this.table).select('*'), filter);
    if (error) return err(errors.unknown(`Failed to read ${this.table}`, { message: error.message }));
    return ok((data as Record<string, unknown>[] ?? []).map(r => rowToEntity<TRow>(r)));
  }
  async findOne(filter: RowFilter<TRow>): Promise<Result<TRow | null>> {
    const { data, error } = await this.applyFilter(tbl(this.table).select('*'), filter).maybeSingle();
    if (error) return err(errors.unknown(`Failed to read ${this.table}`, { message: error.message }));
    return ok(data ? rowToEntity<TRow>(data as Record<string, unknown>) : null);
  }
  async remove(filter: RowFilter<TRow>): Promise<Result<number>> {
    const { error } = await this.applyFilter(tbl(this.table).delete(), filter);
    if (error) return err(errors.unknown(`Failed to delete from ${this.table}`, { message: error.message }));
    return ok(1);
  }
}

export function createCollection<TRow extends Record<string, unknown>>(backend: 'supabase' | 'memory', table: string): CollectionRepository<TRow> {
  return backend === 'supabase' ? new SupabaseCollection<TRow>(table) : new MemoryCollection<TRow>();
}
