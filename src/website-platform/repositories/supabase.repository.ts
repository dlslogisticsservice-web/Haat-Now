// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Supabase repository backend (Wave 0).
// A single generic table repository (no per-aggregate duplication) that satisfies
// the Repository contract against a website_* table: optimistic locking via a
// conditional version-guarded UPDATE, soft delete, tenant scoping, and paginated/
// filtered/sorted list queries. Concrete Site/Page repositories are thin configs.
//
// NOTE: this module talks to Supabase directly, which is permitted outside
// src/features/** (the architecture guard). It is NOT imported by the running app
// in Wave 0 — the legacy Website Center path is unchanged.
//
// The Supabase JS client is untyped without generated DB types, and its filter
// methods live on the post-`select()` builder. We bridge to a minimal STRUCTURAL
// query interface (below) so this module stays fully typed without the `any` keyword.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../../lib/supabase';
import type { UUID, Result, Page, PageRequest, FilterClause } from '../shared/types';
import { ok, err, PAGE_DEFAULTS } from '../shared/types';
import { errors } from '../shared/errors';
import type { Repository, PersistedEntity } from './repository';
import type { WebsiteSite, WebsitePage } from '../domain/entities';
import type { CreateSiteDto, UpdateSiteDto, CreatePageDto, UpdatePageDto } from '../domain/dto';
import {
  siteFromRow, siteInsert, siteUpdate, pageFromRow, pageInsert, pageUpdate,
  type SiteRow, type PageRow,
} from './rows';

// ── Minimal structural view of the PostgREST builder we depend on ───────────────
interface PgError { message: string }
interface PgList { data: unknown[] | null; error: PgError | null; count: number | null }
interface PgSingle { data: unknown | null; error: PgError | null }
type FilterVal = string | number | boolean | null | ReadonlyArray<string | number>;

interface FilterChain extends PromiseLike<PgList> {
  select(columns: string, opts?: { count: 'exact' }): FilterChain;
  eq(col: string, val: FilterVal): FilterChain;
  neq(col: string, val: FilterVal): FilterChain;
  gt(col: string, val: FilterVal): FilterChain;
  gte(col: string, val: FilterVal): FilterChain;
  lt(col: string, val: FilterVal): FilterChain;
  lte(col: string, val: FilterVal): FilterChain;
  in(col: string, vals: ReadonlyArray<string | number>): FilterChain;
  ilike(col: string, pattern: string): FilterChain;
  is(col: string, val: FilterVal): FilterChain;
  order(col: string, opts: { ascending: boolean }): FilterChain;
  range(from: number, to: number): FilterChain;
  single(): PromiseLike<PgSingle>;
  maybeSingle(): PromiseLike<PgSingle>;
}
interface TableChain {
  select(columns: string, opts?: { count: 'exact' }): FilterChain;
  insert(row: Record<string, unknown>): FilterChain;
  update(row: Record<string, unknown>): FilterChain;
}

function table(name: string): TableChain {
  return supabase.from(name) as unknown as TableChain;
}

export interface SupabaseRepoConfig<TEntity extends PersistedEntity, TCreate, TUpdate, TRow> {
  table: string;
  entityName: string;
  fromRow: (row: TRow) => TEntity;
  toInsert: (input: TCreate) => Record<string, unknown>;
  toUpdate: (patch: TUpdate) => Record<string, unknown>;
  /** Entity field → DB column overrides (defaults to camel→snake). */
  columnMap?: Readonly<Record<string, string>>;
}

function camelToSnake(field: string): string {
  return field.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
}
function nowIso(): string {
  return new Date().toISOString();
}

export class SupabaseRepository<TEntity extends PersistedEntity, TCreate, TUpdate, TRow>
  implements Repository<TEntity, TCreate, TUpdate> {
  constructor(private readonly cfg: SupabaseRepoConfig<TEntity, TCreate, TUpdate, TRow>) {}

  private column(field: string): string {
    return this.cfg.columnMap?.[field] ?? camelToSnake(field);
  }

  private applyFilter(q: FilterChain, clause: FilterClause): FilterChain {
    const col = this.column(clause.field);
    const v = clause.value;
    switch (clause.operator) {
      case 'eq': return q.eq(col, v);
      case 'neq': return q.neq(col, v);
      case 'gt': return q.gt(col, v);
      case 'gte': return q.gte(col, v);
      case 'lt': return q.lt(col, v);
      case 'lte': return q.lte(col, v);
      case 'in': return q.in(col, Array.isArray(v) ? v : [v as string | number]);
      case 'like': return q.ilike(col, `%${String(v)}%`);
      case 'is': return q.is(col, v);
      default: return q;
    }
  }

  async create(input: TCreate): Promise<Result<TEntity>> {
    const { data, error } = await table(this.cfg.table).insert(this.cfg.toInsert(input)).select('*').single();
    if (error) return err(errors.conflict(`Failed to create ${this.cfg.entityName}`, { message: error.message }));
    return ok(this.cfg.fromRow(data as TRow));
  }

  async getById(tenantId: UUID, id: UUID): Promise<Result<TEntity>> {
    const { data, error } = await table(this.cfg.table)
      .select('*').eq('id', id).eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle();
    if (error) return err(errors.unknown(`Failed to read ${this.cfg.entityName}`, { message: error.message }));
    if (!data) return err(errors.notFound(this.cfg.entityName, id));
    return ok(this.cfg.fromRow(data as TRow));
  }

  async update(tenantId: UUID, id: UUID, patch: TUpdate, expectedVersion?: number): Promise<Result<TEntity>> {
    let version = expectedVersion;
    if (version === undefined) {
      const current = await this.getById(tenantId, id);
      if (!current.ok) return current;
      version = current.value.version;
    }
    const row = { ...this.cfg.toUpdate(patch), version: version + 1, updated_at: nowIso() };
    const { data, error } = await table(this.cfg.table)
      .update(row).eq('id', id).eq('tenant_id', tenantId).eq('version', version).is('deleted_at', null)
      .select('*').maybeSingle();
    if (error) return err(errors.unknown(`Failed to update ${this.cfg.entityName}`, { message: error.message }));
    if (!data) {
      const exists = await this.getById(tenantId, id);
      return exists.ok ? err(errors.optimisticLock(this.cfg.entityName, id)) : err(errors.notFound(this.cfg.entityName, id));
    }
    return ok(this.cfg.fromRow(data as TRow));
  }

  async softDelete(tenantId: UUID, id: UUID): Promise<Result<TEntity>> {
    const now = nowIso();
    const { data, error } = await table(this.cfg.table)
      .update({ deleted_at: now, updated_at: now }).eq('id', id).eq('tenant_id', tenantId)
      .select('*').maybeSingle();
    if (error) return err(errors.unknown(`Failed to delete ${this.cfg.entityName}`, { message: error.message }));
    if (!data) return err(errors.notFound(this.cfg.entityName, id));
    return ok(this.cfg.fromRow(data as TRow));
  }

  async restore(tenantId: UUID, id: UUID): Promise<Result<TEntity>> {
    const { data, error } = await table(this.cfg.table)
      .update({ deleted_at: null, updated_at: nowIso() }).eq('id', id).eq('tenant_id', tenantId)
      .select('*').maybeSingle();
    if (error) return err(errors.unknown(`Failed to restore ${this.cfg.entityName}`, { message: error.message }));
    if (!data) return err(errors.notFound(this.cfg.entityName, id));
    return ok(this.cfg.fromRow(data as TRow));
  }

  async list(tenantId: UUID, request?: PageRequest): Promise<Result<Page<TEntity>>> {
    const page = Math.max(1, request?.page ?? PAGE_DEFAULTS.page);
    const pageSize = Math.min(PAGE_DEFAULTS.maxPageSize, Math.max(1, request?.pageSize ?? PAGE_DEFAULTS.pageSize));

    let q: FilterChain = table(this.cfg.table).select('*', { count: 'exact' }).eq('tenant_id', tenantId);
    if (!(request?.withDeleted ?? false)) q = q.is('deleted_at', null);
    for (const clause of request?.filters ?? []) q = this.applyFilter(q, clause);
    for (const clause of request?.sort ?? []) q = q.order(this.column(clause.field), { ascending: clause.direction === 'asc' });

    const from = (page - 1) * pageSize;
    q = q.range(from, from + pageSize - 1);

    const { data, error, count } = await q;
    if (error) return err(errors.unknown(`Failed to list ${this.cfg.entityName}`, { message: error.message }));
    const rows = (data as TRow[] | null) ?? [];
    const total = count ?? rows.length;
    return ok({
      items: rows.map(r => this.cfg.fromRow(r)),
      total,
      page,
      pageSize,
      hasMore: from + pageSize < total,
      nextCursor: null,
    });
  }
}

// ── Concrete repositories (thin configs; behavior comes from the generic base) ──
export function createSupabaseSiteRepository(): Repository<WebsiteSite, CreateSiteDto, UpdateSiteDto> {
  return new SupabaseRepository<WebsiteSite, CreateSiteDto, UpdateSiteDto, SiteRow>({
    table: 'website_sites',
    entityName: 'WebsiteSite',
    fromRow: siteFromRow,
    toInsert: siteInsert,
    toUpdate: siteUpdate,
  });
}

export function createSupabasePageRepository(): Repository<WebsitePage, CreatePageDto, UpdatePageDto> {
  return new SupabaseRepository<WebsitePage, CreatePageDto, UpdatePageDto, PageRow>({
    table: 'website_pages',
    entityName: 'WebsitePage',
    fromRow: pageFromRow,
    toInsert: pageInsert,
    toUpdate: pageUpdate,
  });
}
