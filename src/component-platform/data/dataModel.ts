// ─────────────────────────────────────────────────────────────────────────────
// Visual Data Model (Phase 9C).
//
// The declarative schema behind the Visual Data Platform: entities, fields (with full settings),
// relations, collections, permissions, and query/filter specs. Records live in the ONE
// BuilderStore (extended in 9C) — this file is PURE TYPES + helpers (no store, no DOM, no client).
// External providers (Supabase/Firebase/REST/GraphQL) are referenced by a declarative `mapping`
// only — never a duplicated client.
// ─────────────────────────────────────────────────────────────────────────────

export type FieldType =
  | 'text' | 'longtext' | 'richtext' | 'email' | 'phone' | 'password' | 'url' | 'color'
  | 'boolean' | 'integer' | 'decimal' | 'currency'
  | 'date' | 'time' | 'datetime' | 'timestamp' | 'duration'
  | 'image' | 'gallery' | 'file' | 'video' | 'audio'
  | 'json' | 'array' | 'object' | 'reference' | 'location' | 'geopoint'
  | 'rating' | 'qr' | 'barcode' | 'enum' | 'multiselect'
  | 'formula' | 'computed' | 'autoincrement' | 'uuid';

export const FIELD_TYPES: FieldType[] = [
  'text', 'longtext', 'richtext', 'email', 'phone', 'password', 'url', 'color',
  'boolean', 'integer', 'decimal', 'currency',
  'date', 'time', 'datetime', 'timestamp', 'duration',
  'image', 'gallery', 'file', 'video', 'audio',
  'json', 'array', 'object', 'reference', 'location', 'geopoint',
  'rating', 'qr', 'barcode', 'enum', 'multiselect',
  'formula', 'computed', 'autoincrement', 'uuid',
];

export interface FieldSettings {
  required?: boolean; unique?: boolean; indexed?: boolean; nullable?: boolean;
  hidden?: boolean; readOnly?: boolean; searchable?: boolean; sortable?: boolean;
  filterable?: boolean; encrypted?: boolean; localized?: boolean;
  defaultValue?: string; regex?: string; min?: number; max?: number; length?: number;
  precision?: number; scale?: number; format?: string;
  /** For enum/multiselect. */ options?: string[];
  /** For reference/relation fields — the entity it points to. */ ref?: string;
  /** For formula/computed — an expression over the record (fields addressed by name). */ expr?: string;
}

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  settings: FieldSettings;
  /** Phase 9D — visual validation rules for this field. */
  validations?: import('./fieldValidation').FieldValidation[];
}

export type RelationType = 'oneToOne' | 'oneToMany' | 'manyToMany' | 'self' | 'recursive';
export type OnDelete = 'cascade' | 'restrict' | 'setNull';
export interface Relation {
  id: string;
  name: string;
  type: RelationType;
  from: string;   // entity id
  to: string;     // entity id
  onDelete: OnDelete;
  orphanProtection: boolean;
}

export type ProviderKind = 'local' | 'supabase' | 'firebase' | 'rest' | 'graphql';
export interface Entity {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  tags: string[];
  system: boolean;
  version: number;
  fields: Field[];
  /** Declarative mapping to an existing provider — never a duplicated client. */
  mapping: { provider: ProviderKind; target: string; reuses?: string };
  permissions: Permission[];
  /** Phase 9D — position on the ER diagram canvas. */
  diagram?: { x: number; y: number };
}

/** Phase 9D — a captured schema snapshot for entity versioning. */
export interface SchemaVersion {
  version: number;
  at: number;
  author: string;
  reason: string;
  snapshot: Pick<Entity, 'name' | 'fields' | 'permissions' | 'mapping'>;
}

export type CollectionKind = 'collection' | 'subcollection' | 'view' | 'virtual' | 'computed' | 'dynamic';
export interface Collection { id: string; name: string; entityId: string; kind: CollectionKind; parentId?: string; query?: QuerySpec; }

export type PermOp = 'create' | 'read' | 'update' | 'delete';
export interface Permission { id: string; op: PermOp; role: string; expr?: string; }

// ── Query + Filter specs ──
export type FilterOp = 'eq' | 'neq' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte' | 'between' | 'in' | 'notIn' | 'isNull' | 'notNull';
export const FILTER_OPS: FilterOp[] = ['eq', 'neq', 'contains', 'startsWith', 'endsWith', 'gt', 'lt', 'gte', 'lte', 'between', 'in', 'notIn', 'isNull', 'notNull'];
export interface FilterCond { field: string; op: FilterOp; value: string; }
export interface FilterGroup { combinator: 'AND' | 'OR'; conditions: (FilterCond | FilterGroup)[]; }
export type AggregateFn = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';
export interface QuerySpec {
  entityId: string;
  select: string[];          // [] = all
  where: FilterGroup;
  sort: { field: string; dir: 'asc' | 'desc' }[];
  groupBy?: string;
  aggregate?: { fn: AggregateFn; field: string };
  limit?: number;
  offset?: number;
  distinct?: string;
}

export interface DataRecord { id: string; tenantId: string; _createdAt: number; _updatedAt: number; _archived?: boolean; _deleted?: boolean; [k: string]: unknown; }
export interface AuditEntry { at: number; op: string; entity: string; recordId: string; actor: string; detail: string; }

export const isGroup = (x: FilterCond | FilterGroup): x is FilterGroup => 'combinator' in x;
export const emptyQuery = (entityId: string): QuerySpec => ({ entityId, select: [], where: { combinator: 'AND', conditions: [] }, sort: [] });

let dseq = 0;
export const did = (p = 'd') => `${p}_${Date.now().toString(36)}_${++dseq}`;

/** A default field set for a new entity. */
export function defaultFields(): Field[] {
  return [
    { id: did('f'), name: 'id', type: 'uuid', settings: { required: true, unique: true, indexed: true, readOnly: true } },
    { id: did('f'), name: 'title', type: 'text', settings: { required: true, searchable: true, sortable: true, filterable: true } },
    { id: did('f'), name: 'active', type: 'boolean', settings: { defaultValue: 'true', filterable: true } },
    { id: did('f'), name: 'createdAt', type: 'timestamp', settings: { readOnly: true, sortable: true } },
  ];
}

/** Deterministic mock records for an entity (no Math.random → stable seeds). */
export function mockRecords(entity: Entity, tenantId: string, n = 6): DataRecord[] {
  const out: DataRecord[] = [];
  for (let i = 0; i < n; i++) {
    const rec: DataRecord = { id: did('r'), tenantId, _createdAt: 1_700_000_000_000 + i * 86_400_000, _updatedAt: 1_700_000_000_000 + i * 86_400_000 };
    for (const f of entity.fields) {
      if (f.name === 'id') { rec[f.name] = rec.id; continue; }
      if (f.name === 'createdAt') { rec[f.name] = rec._createdAt; continue; }
      switch (f.type) {
        case 'boolean': rec[f.name] = i % 2 === 0; break;
        case 'integer': case 'autoincrement': rec[f.name] = i + 1; break;
        case 'decimal': case 'currency': rec[f.name] = (i + 1) * 9.5; break;
        case 'rating': rec[f.name] = (i % 5) + 1; break;
        case 'email': rec[f.name] = `user${i + 1}@haat.app`; break;
        case 'enum': case 'multiselect': rec[f.name] = (f.settings.options || ['a', 'b'])[i % (f.settings.options?.length || 2)]; break;
        default: rec[f.name] = `${f.name} ${i + 1}`;
      }
    }
    out.push(rec);
  }
  return out;
}
