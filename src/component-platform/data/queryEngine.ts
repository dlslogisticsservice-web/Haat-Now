// ─────────────────────────────────────────────────────────────────────────────
// Visual Query Engine (Phase 9C).
//
// Runs a QuerySpec over in-memory records: filter (operators + AND/OR nested groups) → sort →
// distinct → group + aggregate → select projection → offset/limit. Pure and dependency-free, so
// it is unit-testable and reused identically by the builder preview and any bound query. No
// second query engine — this is the ONE query runner the platform uses.
// ─────────────────────────────────────────────────────────────────────────────
import { isGroup, type DataRecord, type FilterCond, type FilterGroup, type QuerySpec } from './dataModel';

const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const cmp = (a: unknown, b: unknown): number => { const na = num(a), nb = num(b); if (na != null && nb != null) return na - nb; return String(a ?? '').localeCompare(String(b ?? '')); };

/** Evaluate one filter condition against a record. */
export function matchCond(rec: DataRecord, c: FilterCond): boolean {
  const v = rec[c.field];
  const s = String(v ?? '');
  const val = c.value ?? '';
  switch (c.op) {
    case 'eq': return num(v) != null && num(val) != null ? num(v) === num(val) : s === val;
    case 'neq': return !(num(v) != null && num(val) != null ? num(v) === num(val) : s === val);
    case 'contains': return s.toLowerCase().includes(val.toLowerCase());
    case 'startsWith': return s.toLowerCase().startsWith(val.toLowerCase());
    case 'endsWith': return s.toLowerCase().endsWith(val.toLowerCase());
    case 'gt': return cmp(v, val) > 0;
    case 'lt': return cmp(v, val) < 0;
    case 'gte': return cmp(v, val) >= 0;
    case 'lte': return cmp(v, val) <= 0;
    case 'between': { const [a, b] = val.split(',').map(x => x.trim()); return cmp(v, a) >= 0 && cmp(v, b) <= 0; }
    case 'in': return val.split(',').map(x => x.trim()).includes(s);
    case 'notIn': return !val.split(',').map(x => x.trim()).includes(s);
    case 'isNull': return v == null || v === '';
    case 'notNull': return v != null && v !== '';
    default: return true;
  }
}

/** Evaluate a (possibly nested) filter group. Empty group ⇒ matches everything. */
export function matchGroup(rec: DataRecord, g: FilterGroup): boolean {
  if (!g.conditions.length) return true;
  const results = g.conditions.map(c => (isGroup(c) ? matchGroup(rec, c) : matchCond(rec, c)));
  return g.combinator === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

export interface QueryResult {
  rows: DataRecord[];
  total: number;           // rows after filter, before limit/offset
  aggregate?: number;
  groups?: { key: string; value: number }[];
}

function aggregateVals(rows: DataRecord[], fn: string, field: string): number {
  if (fn === 'count') return rows.length;
  if (fn === 'distinct') return new Set(rows.map(r => String(r[field] ?? ''))).size;
  const nums = rows.map(r => num(r[field])).filter((x): x is number => x != null);
  if (!nums.length) return 0;
  if (fn === 'sum') return nums.reduce((a, b) => a + b, 0);
  if (fn === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (fn === 'min') return Math.min(...nums);
  if (fn === 'max') return Math.max(...nums);
  return 0;
}

/** Run a query over a record set. Excludes soft-deleted rows by default. */
export function runQuery(records: DataRecord[], spec: QuerySpec, opts: { includeDeleted?: boolean } = {}): QueryResult {
  let rows = records.filter(r => (opts.includeDeleted || !r._deleted));
  rows = rows.filter(r => matchGroup(r, spec.where));

  if (spec.distinct) { const seen = new Set<string>(); rows = rows.filter(r => { const k = String(r[spec.distinct!] ?? ''); if (seen.has(k)) return false; seen.add(k); return true; }); }

  for (const s of [...spec.sort].reverse()) rows.sort((a, b) => (s.dir === 'desc' ? -1 : 1) * cmp(a[s.field], b[s.field]));

  const total = rows.length;

  const result: QueryResult = { rows, total };
  if (spec.aggregate) {
    if (spec.groupBy) {
      const map = new Map<string, DataRecord[]>();
      for (const r of rows) { const k = String(r[spec.groupBy] ?? ''); (map.get(k) || map.set(k, []).get(k)!).push(r); }
      result.groups = [...map.entries()].map(([key, rs]) => ({ key, value: aggregateVals(rs, spec.aggregate!.fn, spec.aggregate!.field) }));
    } else {
      result.aggregate = aggregateVals(rows, spec.aggregate.fn, spec.aggregate.field);
    }
  }

  // offset / limit
  const off = spec.offset || 0;
  let page = rows.slice(off, spec.limit != null ? off + spec.limit : undefined);

  // select projection
  if (spec.select.length) {
    page = page.map(r => { const o: DataRecord = { id: r.id, tenantId: r.tenantId, _createdAt: r._createdAt, _updatedAt: r._updatedAt }; for (const f of spec.select) o[f] = r[f]; return o; });
  }
  result.rows = page;
  return result;
}
