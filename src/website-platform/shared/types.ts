// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Shared kernel types (Wave 0 foundation).
// Framework-agnostic primitives every layer (domain / repository / events /
// publishing / api) depends on. No runtime dependencies, no `any`.
// ─────────────────────────────────────────────────────────────────────────────

/** A v4 UUID string. Aliased for intent; validated at the edges by `isUuid`. */
export type UUID = string;
/** ISO-8601 timestamp string. */
export type ISODateTime = string;

/** Discriminated result — success or a typed error. Avoids throwing across layers. */
export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = WebsitePlatformError> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}
export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok === true;
}

/** Sort direction for list queries. */
export type SortDirection = 'asc' | 'desc';

/** A single ordering clause. */
export interface SortClause<TField extends string = string> {
  field: TField;
  direction: SortDirection;
}

/** Supported filter operators for repository queries. */
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'is';

/** A single filter predicate against a column. */
export interface FilterClause<TField extends string = string> {
  field: TField;
  operator: FilterOperator;
  value: FilterValue;
}

/** Values a filter may carry — never `any`. */
export type FilterValue = string | number | boolean | null | ReadonlyArray<string | number>;

/** Cursor/offset pagination request (offset-based; cursor-ready shape). */
export interface PageRequest<TField extends string = string> {
  /** 1-based page number (offset pagination). */
  page?: number;
  /** Rows per page (bounded by the repository). */
  pageSize?: number;
  /** Optional opaque cursor (reserved for keyset pagination). */
  cursor?: string | null;
  sort?: ReadonlyArray<SortClause<TField>>;
  filters?: ReadonlyArray<FilterClause<TField>>;
  /** Include soft-deleted rows (default false). */
  withDeleted?: boolean;
}

/** A page of results plus pagination metadata. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
}

/** Standard error shape carried in `Result.error`. */
export interface WebsitePlatformError {
  code: WebsiteErrorCode;
  message: string;
  /** Optional machine-readable detail (safe to log; never PII). */
  detail?: Readonly<Record<string, string | number | boolean | null>>;
}

export type WebsiteErrorCode =
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'optimistic_lock'
  | 'forbidden'
  | 'unavailable'
  | 'unknown';

/** Default bounds applied by repositories when a request omits paging. */
export const PAGE_DEFAULTS = { page: 1, pageSize: 25, maxPageSize: 200 } as const;
