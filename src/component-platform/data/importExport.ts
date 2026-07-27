// ─────────────────────────────────────────────────────────────────────────────
// Import / Export (Phase 9D) — pure parsers + serializers for CSV / JSON / SQL.
// Import: parse → column mapping → duplicate detection → validate → (store applies with rollback).
// Export: CSV / JSON / SQL, field-projected, filter-aware (caller passes the rows). No new client.
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a CSV string (quoted fields + commas supported) into row objects keyed by the header. */
export function parseCSV(text: string): Record<string, string>[] {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n').filter(l => l.trim() !== '');
  if (lines.length < 1) return [];
  const parseLine = (line: string): string[] => {
    const out: string[] = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) { const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } }
    out.push(cur); return out.map(s => s.trim());
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => { const cells = parseLine(line); const o: Record<string, string> = {}; headers.forEach((h, i) => { o[h] = cells[i] ?? ''; }); return o; });
}

export function parseJSONArray(text: string): Record<string, unknown>[] {
  try { const v = JSON.parse(text); return Array.isArray(v) ? v : [v]; } catch { return []; }
}

/** Apply a column mapping { sourceColumn → targetField } (unmapped columns dropped). */
export function mapColumns(rows: Record<string, unknown>[], mapping: Record<string, string>): Record<string, unknown>[] {
  const keys = Object.keys(mapping).filter(k => mapping[k]);
  if (!keys.length) return rows;
  return rows.map(r => { const o: Record<string, unknown> = {}; for (const src of keys) o[mapping[src]] = r[src]; return o; });
}

/** Duplicate detection against existing rows by a key field. */
export function detectDuplicates(incoming: Record<string, unknown>[], existing: Record<string, unknown>[], keyField: string): { dupes: number[]; keys: Set<string> } {
  const keys = new Set(existing.map(r => String(r[keyField] ?? '')));
  const dupes: number[] = [];
  incoming.forEach((r, i) => { const k = String(r[keyField] ?? ''); if (k && keys.has(k)) dupes.push(i); });
  return { dupes, keys };
}

// ── Export ──
export function toCSV(records: Record<string, unknown>[], fields: string[]): string {
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const header = fields.join(',');
  const body = records.map(r => fields.map(f => esc(r[f])).join(',')).join('\n');
  return `${header}\n${body}`;
}

export function toJSON(records: Record<string, unknown>[]): string { return JSON.stringify(records, null, 2); }
