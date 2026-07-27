// ─────────────────────────────────────────────────────────────────────────────
// Performance Analyzer + Data Health (Phase 9D). Pure heuristics over the data model.
// ─────────────────────────────────────────────────────────────────────────────
import type { Entity, Relation } from './dataModel';

export type Severity = 'info' | 'warn' | 'error';
export interface Issue { severity: Severity; kind: string; entity?: string; message: string; recommendation: string; }
export interface HealthReport {
  entities: number; collections: number; relations: number; indexes: number;
  validationErrors: number; brokenRelations: number; storageKB: number;
  performanceScore: number; healthScore: number; warnings: Issue[]; issues: Issue[];
}

export interface AnalyzeInput { entities: Entity[]; relations: Relation[]; recordCounts: Record<string, number>; collections: number; validationErrors: number; }

/** Detect performance / modeling issues. */
export function analyzeModel(input: AnalyzeInput): Issue[] {
  const { entities, relations, recordCounts } = input;
  const issues: Issue[] = [];
  const byId = new Map(entities.map(e => [e.id, e]));

  for (const e of entities) {
    const count = recordCounts[e.id] || 0;
    if (count > 1000) issues.push({ severity: 'warn', kind: 'large-collection', entity: e.name, message: `${e.name} has ${count.toLocaleString()} records`, recommendation: 'Add pagination + an index on filtered fields.' });
    // filterable but not indexed → potential slow query
    for (const f of e.fields) if (f.settings.filterable && !f.settings.indexed && f.name !== 'id' && count > 200) issues.push({ severity: 'info', kind: 'missing-index', entity: e.name, message: `${e.name}.${f.name} is filterable but not indexed`, recommendation: `Add an index on ${e.name}.${f.name}.` });
    // indexed but small → unused index
    for (const f of e.fields) if (f.settings.indexed && f.name !== 'id' && count < 50) issues.push({ severity: 'info', kind: 'unused-index', entity: e.name, message: `index on ${e.name}.${f.name} on a small collection`, recommendation: 'Drop the index until the collection grows.' });
    // duplicate field names
    const names = e.fields.map(f => f.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length) issues.push({ severity: 'error', kind: 'duplicate-field', entity: e.name, message: `duplicate field(s): ${[...new Set(dupes)].join(', ')}`, recommendation: 'Rename or remove the duplicate field.' });
    // unused entity
    const related = relations.some(r => r.from === e.id || r.to === e.id);
    if (count === 0 && !related) issues.push({ severity: 'info', kind: 'unused-entity', entity: e.name, message: `${e.name} has no records and no relations`, recommendation: 'Seed data or remove the entity.' });
  }
  // heavy / broken relations
  for (const r of relations) {
    if (!byId.has(r.from) || !byId.has(r.to)) { issues.push({ severity: 'error', kind: 'broken-relation', message: `relation ${r.name} references a missing entity`, recommendation: 'Fix or remove the relation.' }); continue; }
    if (r.type === 'manyToMany') issues.push({ severity: 'info', kind: 'heavy-relation', entity: byId.get(r.from)?.name, message: `many-to-many ${r.name}`, recommendation: 'Generate a junction table for the many-to-many relation.' });
  }
  return issues;
}

/** Approx storage: rows × fields × ~24 bytes. */
export function storageKB(entities: Entity[], recordCounts: Record<string, number>): number {
  let bytes = 0;
  for (const e of entities) bytes += (recordCounts[e.id] || 0) * e.fields.length * 24;
  return Math.round(bytes / 1024);
}

export function health(input: AnalyzeInput): HealthReport {
  const issues = analyzeModel(input);
  const brokenRelations = issues.filter(i => i.kind === 'broken-relation').length;
  const indexes = input.entities.reduce((s, e) => s + e.fields.filter(f => f.settings.indexed).length, 0);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warn').length;
  const performanceScore = Math.max(0, 100 - warnCount * 8 - issues.filter(i => i.kind === 'missing-index').length * 3);
  const healthScore = Math.max(0, 100 - errorCount * 25 - input.validationErrors * 2 - brokenRelations * 20 - warnCount * 5);
  return {
    entities: input.entities.length, collections: input.collections, relations: input.relations.length, indexes,
    validationErrors: input.validationErrors, brokenRelations, storageKB: storageKB(input.entities, input.recordCounts),
    performanceScore, healthScore,
    warnings: issues.filter(i => i.severity !== 'info'), issues,
  };
}
