// ─────────────────────────────────────────────────────────────────────────────
// SQL Generator (Phase 9D) — generates SQL from entity definitions. Pure strings; NEVER executes.
// CREATE TABLE, indexes, unique/foreign-key/check constraints, ALTER (schema diff), migration
// preview + rollback script. Reuses the 9C entity/relation model.
// ─────────────────────────────────────────────────────────────────────────────
import type { Entity, Field, Relation, FieldType } from './dataModel';

const SQL_TYPE: Record<FieldType, string> = {
  text: 'varchar(255)', longtext: 'text', richtext: 'text', email: 'varchar(320)', phone: 'varchar(20)',
  password: 'varchar(255)', url: 'text', color: 'varchar(9)', boolean: 'boolean', integer: 'integer',
  decimal: 'numeric(12,2)', currency: 'numeric(12,2)', date: 'date', time: 'time', datetime: 'timestamptz',
  timestamp: 'timestamptz', duration: 'interval', image: 'text', gallery: 'jsonb', file: 'text', video: 'text',
  audio: 'text', json: 'jsonb', array: 'jsonb', object: 'jsonb', reference: 'uuid', location: 'jsonb',
  geopoint: 'point', rating: 'smallint', qr: 'text', barcode: 'varchar(64)', enum: 'varchar(64)',
  multiselect: 'jsonb', formula: 'text', computed: 'text', autoincrement: 'bigserial', uuid: 'uuid',
};

const tbl = (name: string) => name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

function columnDDL(f: Field): string {
  const parts = [`  ${f.name} ${SQL_TYPE[f.type] || 'text'}`];
  if (f.name === 'id') parts.push('primary key');
  if (f.settings.required) parts.push('not null');
  if (f.settings.unique) parts.push('unique');
  if (f.settings.defaultValue != null && f.settings.defaultValue !== '') parts.push(`default ${/^\d+(\.\d+)?$/.test(f.settings.defaultValue) ? f.settings.defaultValue : `'${f.settings.defaultValue}'`}`);
  return parts.join(' ');
}

/** CREATE TABLE + indexes + check constraints for one entity. */
export function createTableSQL(e: Entity): string {
  const t = tbl(e.name);
  const cols = e.fields.map(columnDDL);
  cols.push('  tenant_id uuid not null');
  const checks: string[] = [];
  for (const f of e.fields) {
    if (f.type === 'rating') checks.push(`  constraint chk_${t}_${f.name} check (${f.name} between 1 and 5)`);
    const r = (f.settings.min != null || f.settings.max != null);
    if (r && (f.type === 'integer' || f.type === 'decimal' || f.type === 'currency')) checks.push(`  constraint chk_${t}_${f.name}_rng check (${f.name} >= ${f.settings.min ?? 0}${f.settings.max != null ? ` and ${f.name} <= ${f.settings.max}` : ''})`);
  }
  const body = [...cols, ...checks].join(',\n');
  const indexes = e.fields.filter(f => f.settings.indexed && f.name !== 'id').map(f => `create index idx_${t}_${f.name} on ${t} (${f.name});`);
  return `create table if not exists ${t} (\n${body}\n);\n${indexes.join('\n')}`.trim();
}

/** Foreign keys from relations touching this entity. */
export function foreignKeysSQL(e: Entity, relations: Relation[], entities: Entity[]): string {
  const name = (id: string) => tbl(entities.find(x => x.id === id)?.name || id);
  return relations.filter(r => r.from === e.id).map(r => {
    const to = name(r.to); const t = tbl(e.name);
    const onDel = r.onDelete === 'cascade' ? 'on delete cascade' : r.onDelete === 'setNull' ? 'on delete set null' : 'on delete restrict';
    return `alter table ${t} add column if not exists ${to}_id uuid;\nalter table ${t} add constraint fk_${t}_${to} foreign key (${to}_id) references ${to}(id) ${onDel};`;
  }).join('\n');
}

/** Full schema DDL for the whole model. */
export function schemaSQL(entities: Entity[], relations: Relation[]): string {
  const tables = entities.map(createTableSQL).join('\n\n');
  const fks = entities.map(e => foreignKeysSQL(e, relations, entities)).filter(Boolean).join('\n\n');
  return `-- HAAT NOW schema (generated · review before running)\n\n${tables}${fks ? `\n\n-- foreign keys\n${fks}` : ''}`;
}

/** ALTER diff between a previous field set and the current one. */
export function alterTableSQL(e: Entity, prevFields: Field[]): string {
  const t = tbl(e.name);
  const prev = new Map(prevFields.map(f => [f.name, f]));
  const cur = new Map(e.fields.map(f => [f.name, f]));
  const out: string[] = [];
  for (const f of e.fields) if (!prev.has(f.name)) out.push(`alter table ${t} add column ${f.name} ${SQL_TYPE[f.type] || 'text'};`);
  for (const f of prevFields) if (!cur.has(f.name)) out.push(`alter table ${t} drop column ${f.name};`);
  for (const f of e.fields) { const p = prev.get(f.name); if (p && p.type !== f.type) out.push(`alter table ${t} alter column ${f.name} type ${SQL_TYPE[f.type] || 'text'};`); }
  return out.length ? out.join('\n') : `-- no schema changes for ${t}`;
}

/** Migration preview (up) + rollback (down) for the whole model. */
export function migrationSQL(entities: Entity[], relations: Relation[]): { up: string; down: string } {
  return { up: schemaSQL(entities, relations), down: entities.map(e => `drop table if exists ${tbl(e.name)} cascade;`).join('\n') };
}

/** INSERT statements for records (export). */
export function insertsSQL(e: Entity, records: Record<string, unknown>[]): string {
  const t = tbl(e.name);
  const cols = e.fields.map(f => f.name);
  return records.map(r => {
    const vals = cols.map(c => { const v = r[c]; if (v == null) return 'null'; if (typeof v === 'number' || typeof v === 'boolean') return String(v); return `'${String(v).replace(/'/g, "''")}'`; });
    return `insert into ${t} (${cols.join(', ')}) values (${vals.join(', ')});`;
  }).join('\n');
}
