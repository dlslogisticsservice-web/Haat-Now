// ─────────────────────────────────────────────────────────────────────────────
// kv — the single namespaced localStorage primitive for the sandbox CRUD tables
// (the `haat_crud_*` key scheme that CrudManager / workspaces / seeders share).
//
// Phase-2 persistence consolidation: services previously re-implemented this same
// try/parse/stringify logic inline (cx, finance, growthb, onboarding, subscription,
// ops/command, demoSeed, …). They now delegate here so there is ONE implementation
// and ONE audit point for the demo persistence namespace. Key scheme is unchanged,
// so existing stored data is fully backward-compatible.
// ─────────────────────────────────────────────────────────────────────────────

const key = (table: string) => `haat_crud_${table}`;

export const kv = {
  /** All rows of a table (empty array on missing/parse error). */
  list<T = any>(table: string): T[] {
    try { return JSON.parse(localStorage.getItem(key(table)) || '[]'); } catch { return []; }
  },

  /** Overwrite a table's rows. */
  set<T = any>(table: string, rows: T[]): void {
    try { localStorage.setItem(key(table), JSON.stringify(rows)); } catch { /* quota / private mode */ }
  },

  /** True if the table has at least one row. */
  has(table: string): boolean {
    try { return JSON.parse(localStorage.getItem(key(table)) || '[]').length > 0; } catch { return false; }
  },
};
