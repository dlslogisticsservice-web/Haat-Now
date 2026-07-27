// ─────────────────────────────────────────────────────────────────────────────
// Visual Data Platform (Phase 9C).
//
// Entity Designer · Fields · Relations · Collections · CRUD · Visual Query/Filter builder ·
// Data Explorer (Table/Grid/Card/JSON/Schema/Relations/History) · Permissions · provider mapping ·
// realtime (offline queue + reconnect) · tenant isolation. Drives the ONE BuilderStore (extended
// in 9C) — no second store, no duplicated client. Entity records are exposed to bindings as db.*.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useReducer, useState } from 'react';
import {
  Plus, Trash2, Database, Table2, LayoutGrid, IdCard, Braces, Network, Share2, History as HistoryIcon,
  Archive, ArchiveRestore, Copy, Download, Upload, Wifi, WifiOff, Filter, Link2, ShieldCheck, Users,
} from 'lucide-react';
import type { BuilderStore } from '../../../component-platform/BuilderStore';
import { FIELD_TYPES, FILTER_OPS, emptyQuery, type Entity, type FieldType, type FilterOp, type QuerySpec, type ProviderKind, type PermOp, type RelationType } from '../../../component-platform/data/dataModel';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 10 };
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--color-on-surface-variant)' };
const es: React.CSSProperties = { padding: '5px 7px', borderRadius: 6, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', fontSize: 11 };
const seg = (on: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 700, background: on ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: on ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' });
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' };
const ico: React.CSSProperties = { display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 6, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', cursor: 'pointer' };

export const DataPlatform: React.FC<{ lang: 'ar' | 'en'; store: BuilderStore }> = ({ lang, store }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [, force] = useReducer(c => c + 1, 0);
  useEffect(() => store.subscribe(() => force()), [store]);

  const [selId, setSelId] = useState<string | null>(store.entities()[0]?.id ?? null);
  const [view, setView] = useState<'table' | 'grid' | 'card' | 'json' | 'schema' | 'relations' | 'history'>('table');
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState<QuerySpec | null>(null);
  const [fField, setFField] = useState(''); const [fOp, setFOp] = useState<FilterOp>('contains'); const [fVal, setFVal] = useState('');
  const [nfType, setNfType] = useState<FieldType>('text'); const [nfName, setNfName] = useState('');
  const [imp, setImp] = useState('');

  const entity = selId ? store.getEntity(selId) : null;
  useEffect(() => { if (entity && (!query || query.entityId !== entity.id)) setQuery(emptyQuery(entity.id)); }, [entity, query]);
  const spec: QuerySpec = query && entity && query.entityId === entity.id ? query : (entity ? emptyQuery(entity.id) : emptyQuery(''));
  const result = entity ? store.query(spec) : { rows: [], total: 0 };
  const displayRows = spec.where.conditions.length ? result.rows : store.records(entity?.id ?? '', { includeArchived: showArchived });

  return (
    <div id="data_platform" style={{ display: 'flex', gap: 10, width: '100%', height: '100%', minHeight: 620 }}>
      {/* LEFT — entities + collections + tenant */}
      <div style={{ ...card, width: 210, flexShrink: 0, padding: 8, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Database size={12} />{L('الكيانات', 'Entities')}</span>
          <button id="dp_add_entity" onClick={() => { const e = store.addEntity(`Entity${store.entities().length + 1}`); setSelId(e.id); }} style={ico}><Plus size={13} /></button>
        </div>
        <div style={{ display: 'grid', gap: 3 }} id="dp_entity_list">
          {store.entities().map(e => (
            <button key={e.id} className="dp-entity" data-id={e.id} data-name={e.name} onClick={() => setSelId(e.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', textAlign: 'start', background: selId === e.id ? 'var(--color-surface-container-high)' : 'transparent', outline: selId === e.id ? '1px solid var(--color-primary-fixed)' : 'none' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: e.color }} />
              <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: 'var(--color-on-surface)' }}>{e.name}</span>
              <span style={{ ...lbl }}>{store.records(e.id).length}</span>
            </button>
          ))}
          {store.entities().length === 0 && <span style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('لا كيانات — أنشئ واحداً.', 'No entities — create one.')}</span>}
        </div>
        <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: 8 }}>
          <span style={{ ...lbl }}>{L('المستأجر (عزل)', 'Tenant (isolation)')}</span>
          <select id="dp_tenant" value={store.ctxInfo().tenant} onChange={e => store.setCtx({ tenant: e.target.value })} style={{ ...es, width: '100%', marginTop: 4 }}>
            <option value="haat">haat</option><option value="beauty">beauty</option><option value="logistics">logistics</option>
          </select>
        </div>
        <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: 8, display: 'grid', gap: 4 }} id="dp_collections">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={lbl}>{L('المجموعات', 'Collections')}</span><button id="dp_add_collection" disabled={!entity} onClick={() => entity && store.addCollection({ name: `${entity.name}View`, entityId: entity.id, kind: 'view' })} style={ico}><Plus size={12} /></button></div>
          {store.collections().map(c => <div key={c.id} className="dp-collection" data-kind={c.kind} style={{ fontSize: 10.5, padding: '3px 6px', ...card, background: 'var(--color-surface-container-high)' }}>{c.name} · {c.kind}</div>)}
        </div>
      </div>

      {/* CENTER — Data Explorer */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!entity ? <div style={{ ...card, flex: 1, display: 'grid', placeItems: 'center', color: 'var(--color-on-surface-variant)' }}>{L('اختر أو أنشئ كياناً', 'Select or create an entity')}</div> : <>
          {/* view + CRUD toolbar */}
          <div style={{ ...card, padding: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {([['table', Table2], ['grid', LayoutGrid], ['card', IdCard], ['json', Braces], ['schema', Network], ['relations', Share2], ['history', HistoryIcon]] as const).map(([v, Icon]) => <button key={v} id={`dp_view_${v}`} onClick={() => setView(v)} style={seg(view === v)}><Icon size={12} />{v}</button>)}
            <span style={{ width: 1, height: 16, background: 'var(--color-outline-variant)' }} />
            <button id="dp_add_record" onClick={() => store.createRecord(entity.id, { title: 'New record', active: true })} style={btn}><Plus size={11} />{L('سجل', 'Record')}</button>
            <button id="dp_seed" onClick={() => store.seedEntity(entity.id, 4)} style={seg(false)}>{L('بذور', 'Seed')}</button>
            <button id="dp_export" onClick={() => { /* export to clipboard-less: expose length */ void store.exportRecords(entity.id); }} style={seg(false)}><Download size={11} />{L('تصدير', 'Export')}</button>
            <button id="dp_archived_toggle" onClick={() => setShowArchived(s => !s)} style={seg(showArchived)}><Archive size={11} />{showArchived ? L('يشمل المؤرشف', 'Archived shown') : L('إخفاء المؤرشف', 'Hide archived')}</button>
            <span style={{ width: 1, height: 16, background: 'var(--color-outline-variant)' }} />
            <button id="dp_online_toggle" onClick={() => store.setOnline(!store.isOnline())} style={seg(store.isOnline())}>{store.isOnline() ? <Wifi size={11} /> : <WifiOff size={11} />}{store.isOnline() ? L('متصل', 'Online') : L('غير متصل', 'Offline')}</button>
            <span id="dp_sync_pending" style={{ ...lbl }}>{L('قائمة المزامنة', 'Sync queue')}: {store.syncPending()}</span>
            <span id="dp_record_count" style={{ ...lbl, marginInlineStart: 'auto' }}>{displayRows.length} / {store.records(entity.id, { includeArchived: true }).length} {L('سجل', 'rows')}</span>
          </div>

          {/* query / filter builder */}
          <div style={{ ...card, padding: 6, display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }} id="dp_query_bar">
            <Filter size={12} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />
            <select id="dp_filter_field" value={fField} onChange={e => setFField(e.target.value)} style={es}><option value="">field…</option>{entity.fields.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select>
            <select id="dp_filter_op" value={fOp} onChange={e => setFOp(e.target.value as FilterOp)} style={es}>{FILTER_OPS.map(o => <option key={o} value={o}>{o}</option>)}</select>
            <input id="dp_filter_value" value={fVal} onChange={e => setFVal(e.target.value)} placeholder="value" style={{ ...es, width: 120 }} />
            <button id="dp_filter_add" disabled={!fField} onClick={() => { if (!fField) return; setQuery(q => { const base = q && q.entityId === entity.id ? q : emptyQuery(entity.id); return { ...base, where: { ...base.where, conditions: [...base.where.conditions, { field: fField, op: fOp, value: fVal }] } }; }); }} style={btn}><Plus size={11} />{L('فلتر', 'Filter')}</button>
            <button id="dp_filter_clear" onClick={() => setQuery(emptyQuery(entity.id))} style={seg(false)}>{L('مسح', 'Clear')}</button>
            <span style={{ width: 1, height: 16, background: 'var(--color-outline-variant)' }} />
            <span style={lbl}>{L('ترتيب', 'Sort')}</span>
            <select id="dp_sort_field" value={spec.sort[0]?.field || ''} onChange={e => setQuery({ ...spec, sort: e.target.value ? [{ field: e.target.value, dir: 'asc' }] : [] })} style={es}><option value="">—</option>{entity.fields.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select>
            <span id="dp_query_count" style={{ ...lbl, marginInlineStart: 'auto', color: 'var(--color-primary-fixed,#a3f95b)' }}>{L('نتيجة', 'result')}: {result.total}</span>
          </div>
          {spec.where.conditions.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} id="dp_active_filters">{spec.where.conditions.map((c, i) => 'field' in c && <span key={i} className="dp-filter-chip" style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 999, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>{c.field} {c.op} {c.value}</span>)}</div>}

          {/* explorer body */}
          <div style={{ ...card, flex: 1, overflow: 'auto', padding: 10 }} id="dp_explorer">
            {view === 'table' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }} id="dp_table">
                <thead><tr>{entity.fields.filter(f => !f.settings.hidden).slice(0, 5).map(f => <th key={f.id} style={{ textAlign: 'start', padding: '5px 8px', borderBottom: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>{f.name}</th>)}<th style={{ padding: '5px 8px', borderBottom: '1px solid var(--color-outline-variant)' }}></th></tr></thead>
                <tbody>
                  {displayRows.map(r => (
                    <tr key={r.id} className="dp-row" data-id={r.id} data-archived={r._archived ? '1' : '0'} style={{ opacity: r._archived ? 0.5 : 1 }}>
                      {entity.fields.filter(f => !f.settings.hidden).slice(0, 5).map(f => <td key={f.id} style={{ padding: '5px 8px', borderBottom: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>{f.name === 'title' ? <input value={String(r[f.name] ?? '')} onChange={e => store.updateRecord(entity.id, r.id, { [f.name]: e.target.value })} style={{ ...es, width: '100%' }} className="dp-cell-edit" /> : String(r[f.name] ?? '')}</td>)}
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--color-outline-variant)', whiteSpace: 'nowrap' }}>
                        <button className="dp-row-dup" onClick={() => store.duplicateRecord(entity.id, r.id)} title="Duplicate" style={ico}><Copy size={11} /></button>
                        <button className="dp-row-archive" onClick={() => r._archived ? store.unarchive(entity.id, r.id) : store.archive(entity.id, r.id)} title="Archive" style={ico}>{r._archived ? <ArchiveRestore size={11} /> : <Archive size={11} />}</button>
                        <button className="dp-row-del" onClick={() => store.deleteRecord(entity.id, r.id)} title="Delete" style={{ ...ico, color: '#ff6b6b' }}><Trash2 size={11} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {view === 'grid' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }} id="dp_grid">{displayRows.map(r => <div key={r.id} className="dp-grid-cell" style={{ ...card, padding: 10, background: 'var(--color-surface-container-high)' }}><div style={{ fontWeight: 800, fontSize: 12 }}>{String(r.title ?? r.id)}</div><div style={{ fontSize: 10, color: 'var(--color-on-surface-variant)' }}>{r.id}</div></div>)}</div>}
            {view === 'card' && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} id="dp_cards">{displayRows.map(r => <div key={r.id} className="dp-card" style={{ ...card, padding: 12, width: 200, background: 'var(--color-surface-container-high)' }}><div style={{ fontWeight: 800 }}>{String(r.title ?? '')}</div><div style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', marginTop: 6 }}>{entity.fields.slice(1, 4).map(f => <div key={f.id}>{f.name}: {String(r[f.name] ?? '')}</div>)}</div></div>)}</div>}
            {view === 'json' && <pre id="dp_json" style={{ fontSize: 10.5, color: 'var(--color-on-surface)', whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace,monospace' }}>{JSON.stringify(displayRows, null, 2)}</pre>}
            {view === 'schema' && <div id="dp_schema" style={{ display: 'grid', gap: 4 }}>{entity.fields.map(f => <div key={f.id} className="dp-schema-row" style={{ ...card, padding: '5px 9px', background: 'var(--color-surface-container-high)', display: 'flex', gap: 8, fontSize: 11 }}><b style={{ minWidth: 120 }}>{f.name}</b><span style={{ ...lbl }}>{f.type}</span><span style={{ flex: 1, color: 'var(--color-on-surface-variant)' }}>{Object.entries(f.settings).filter(([, v]) => v === true).map(([k]) => k).join(' · ')}</span></div>)}</div>}
            {view === 'relations' && <div id="dp_relations" style={{ display: 'grid', gap: 6 }}>{store.relations().filter(r => r.from === entity.id || r.to === entity.id).map(r => <div key={r.id} className="dp-relation" data-type={r.type} style={{ ...card, padding: 8, background: 'var(--color-surface-container-high)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 }}><b>{store.getEntity(r.from)?.name}</b><span style={{ color: 'var(--color-primary-fixed,#a3f95b)' }}>─ {r.type} →</span><b>{store.getEntity(r.to)?.name}</b><span style={{ ...lbl }}>onDelete: {r.onDelete}</span></div>)}{store.relations().filter(r => r.from === entity.id || r.to === entity.id).length === 0 && <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{L('لا علاقات', 'No relations')}</span>}</div>}
            {view === 'history' && <div id="dp_history" style={{ display: 'grid', gap: 3 }}>{store.auditEntries().slice(0, 30).map((a, i) => <div key={i} className="dp-audit-row" data-op={a.op} style={{ fontSize: 10, fontFamily: 'ui-monospace,monospace', color: 'var(--color-on-surface-variant)', display: 'flex', gap: 8 }}><span style={{ color: 'var(--color-primary-fixed,#a3f95b)', minWidth: 90 }}>{a.op}</span><span>{store.getEntity(a.entity)?.name ?? a.entity}</span><span style={{ opacity: 0.7 }}>{a.detail}</span></div>)}</div>}
          </div>

          {/* import */}
          <div style={{ ...card, padding: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input id="dp_import_json" value={imp} onChange={e => setImp(e.target.value)} placeholder='[{"title":"Imported"}]' style={{ ...es, flex: 1 }} />
            <button id="dp_import" onClick={() => { store.importRecords(entity.id, imp); setImp(''); }} style={btn}><Upload size={11} />{L('استيراد JSON', 'Import JSON')}</button>
          </div>
        </>}
      </div>

      {/* RIGHT — Entity Designer / Inspector */}
      <div style={{ ...card, width: 280, flexShrink: 0, padding: 10, overflow: 'auto', display: 'grid', gap: 8, alignContent: 'start' }} id="dp_inspector">
        {!entity ? <div style={{ textAlign: 'center', color: 'var(--color-on-surface-variant)', fontSize: 12, padding: 20 }}>{L('صمّم كياناً', 'Design an entity')}</div> : <EntityDesigner store={store} entity={entity} lang={lang} nfType={nfType} setNfType={setNfType} nfName={nfName} setNfName={setNfName} />}
      </div>
    </div>
  );
};

const EntityDesigner: React.FC<{ store: BuilderStore; entity: Entity; lang: 'ar' | 'en'; nfType: FieldType; setNfType: (t: FieldType) => void; nfName: string; setNfName: (s: string) => void }> = ({ store, entity, lang, nfType, setNfType, nfName, setNfName }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [relTo, setRelTo] = useState(''); const [relType, setRelType] = useState<RelationType>('oneToMany');
  const [permOp, setPermOp] = useState<PermOp>('create'); const [permRole, setPermRole] = useState('customer');
  return (
    <>
      <div>
        <span style={lbl}>{entity.system ? L('كيان نظام', 'System entity') : L('كيان مخصّص', 'Custom entity')}</span>
        <input id="dp_entity_name" value={entity.name} onChange={e => store.updateEntity(entity.id, { name: e.target.value })} style={{ ...es, width: '100%', fontWeight: 800, fontSize: 14, marginTop: 3 }} />
        <div style={{ display: 'flex', gap: 5, marginTop: 5 }}><span style={{ ...lbl, ...card, padding: '2px 7px' }}>v{entity.version}</span><span style={{ ...lbl, ...card, padding: '2px 7px' }}>{entity.fields.length} {L('حقل', 'fields')}</span><button id="dp_del_entity" onClick={() => store.removeEntity(entity.id)} style={{ ...ico, marginInlineStart: 'auto', color: '#ff6b6b' }}><Trash2 size={12} /></button></div>
      </div>

      {/* Fields */}
      <div style={{ ...card, padding: 8, display: 'grid', gap: 6 }} id="dp_fields">
        <span style={lbl}>{L('الحقول', 'Fields')}</span>
        <div style={{ display: 'grid', gap: 3 }}>
          {entity.fields.map(f => (
            <div key={f.id} className="dp-field" data-name={f.name} data-type={f.type} style={{ ...card, padding: '5px 7px', background: 'var(--color-surface-container-high)', display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 11, flex: 1 }}>{f.name}</span>
                <span style={{ ...lbl }}>{f.type}</span>
                <button className="dp-field-del" onClick={() => store.removeField(entity.id, f.id)} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}><Trash2 size={10} /></button>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(['required', 'unique', 'indexed', 'searchable', 'encrypted'] as const).map(s => <button key={s} id={`dp_fset_${s}_${f.id}`} className={`dp-fset dp-fset-${s}`} onClick={() => store.updateField(entity.id, f.id, { settings: { [s]: !f.settings[s] } })} style={{ fontSize: 8.5, padding: '1px 6px', borderRadius: 999, border: 'none', cursor: 'pointer', background: f.settings[s] ? 'var(--color-primary-fixed)' : 'var(--color-surface-container)', color: f.settings[s] ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}>{s}</button>)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <select id="dp_field_type" value={nfType} onChange={e => setNfType(e.target.value as FieldType)} style={{ ...es, width: 90 }}>{FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
          <input id="dp_field_name" value={nfName} onChange={e => setNfName(e.target.value)} placeholder="name" style={{ ...es, flex: 1 }} />
          <button id="dp_add_field" onClick={() => { store.addField(entity.id, nfType, nfName || `${nfType}${entity.fields.length}`); setNfName(''); }} style={btn}><Plus size={11} /></button>
        </div>
      </div>

      {/* Relations */}
      <div style={{ ...card, padding: 8, display: 'grid', gap: 6 }} id="dp_relations_editor">
        <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Network size={11} />{L('العلاقات', 'Relations')}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <select id="dp_rel_type" value={relType} onChange={e => setRelType(e.target.value as RelationType)} style={{ ...es, width: 92 }}>{(['oneToOne', 'oneToMany', 'manyToMany', 'self', 'recursive'] as const).map(t => <option key={t} value={t}>{t}</option>)}</select>
          <select id="dp_rel_to" value={relTo} onChange={e => setRelTo(e.target.value)} style={{ ...es, flex: 1 }}><option value="">to…</option>{store.entities().map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <button id="dp_add_relation" disabled={!relTo} onClick={() => { store.addRelation({ name: `${entity.name}_rel`, type: relType, from: entity.id, to: relType === 'self' || relType === 'recursive' ? entity.id : relTo, onDelete: 'cascade', orphanProtection: true }); }} style={btn}><Plus size={11} /></button>
        </div>
        {store.relations().filter(r => r.from === entity.id).map(r => <div key={r.id} style={{ fontSize: 10, ...card, padding: '3px 7px', background: 'var(--color-surface-container-high)', display: 'flex', alignItems: 'center', gap: 6 }}><Link2 size={10} /><span style={{ flex: 1 }}>{r.type} → {store.getEntity(r.to)?.name}</span><button onClick={() => store.removeRelation(r.id)} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}><Trash2 size={9} /></button></div>)}
      </div>

      {/* Permissions */}
      <div style={{ ...card, padding: 8, display: 'grid', gap: 6 }} id="dp_permissions">
        <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 5 }}><ShieldCheck size={11} />{L('الصلاحيات', 'Permissions')}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <select id="dp_perm_op" value={permOp} onChange={e => setPermOp(e.target.value as PermOp)} style={{ ...es, width: 78 }}>{(['create', 'read', 'update', 'delete'] as const).map(o => <option key={o} value={o}>{o}</option>)}</select>
          <select id="dp_perm_role" value={permRole} onChange={e => setPermRole(e.target.value)} style={{ ...es, flex: 1 }}>{['any', 'admin', 'merchant', 'driver', 'customer', 'owner'].map(r => <option key={r} value={r}>{r}</option>)}</select>
          <button id="dp_add_perm" onClick={() => store.addPermission(entity.id, { op: permOp, role: permRole })} style={btn}><Plus size={11} /></button>
        </div>
        {entity.permissions.map(p => <div key={p.id} className="dp-perm" data-op={p.op} data-role={p.role} style={{ fontSize: 10, ...card, padding: '3px 7px', background: 'var(--color-surface-container-high)', display: 'flex', gap: 6 }}><span style={{ flex: 1 }}><b>{p.op}</b> · {p.role}</span><button id={`dp_perm_del_${p.op}_${p.role}`} onClick={() => store.removePermission(entity.id, p.id)} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}><Trash2 size={9} /></button></div>)}
      </div>

      {/* Provider mapping */}
      <div style={{ ...card, padding: 8, display: 'grid', gap: 6 }} id="dp_mapping">
        <span style={lbl}>{L('الربط بالمزوّد (بلا تكرار عميل)', 'Provider mapping (no duplicate client)')}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <select id="dp_map_provider" value={entity.mapping.provider} onChange={e => store.updateEntity(entity.id, { mapping: { ...entity.mapping, provider: e.target.value as ProviderKind, reuses: { local: '—', supabase: 'lib/supabase', firebase: 'firebase (declared)', rest: 'fetch', graphql: 'fetch' }[e.target.value as ProviderKind] } })} style={{ ...es, width: 100 }}>{(['local', 'supabase', 'firebase', 'rest', 'graphql'] as const).map(p => <option key={p} value={p}>{p}</option>)}</select>
          <input id="dp_map_target" value={entity.mapping.target} onChange={e => store.updateEntity(entity.id, { mapping: { ...entity.mapping, target: e.target.value } })} placeholder="table/collection" style={{ ...es, flex: 1 }} />
        </div>
        <span style={{ fontSize: 9.5, color: 'var(--color-on-surface-variant)' }} id="dp_map_reuses">reuses: {entity.mapping.reuses}</span>
      </div>

      {/* Inspector summary + binding path */}
      <div style={{ ...card, padding: 8, display: 'grid', gap: 4 }} id="dp_data_inspector">
        <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Users size={11} />{L('مفتّش البيانات', 'Data inspector')}</span>
        {[['Fields', entity.fields.length], ['Relations', store.relations().filter(r => r.from === entity.id || r.to === entity.id).length], ['Indexes', entity.fields.filter(f => f.settings.indexed).length], ['Permissions', entity.permissions.length], ['Records', store.records(entity.id).length]].map(([k, v]) => <div key={k} style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-on-surface-variant)' }}>{k}</span><b>{v}</b></div>)}
        <div style={{ marginTop: 4, fontSize: 9.5, color: 'var(--color-primary-fixed,#a3f95b)', fontFamily: 'ui-monospace,monospace' }} id="dp_binding_path">{L('اربط عبر:', 'Bind via:')} db.{entity.name.toLowerCase()}</div>
      </div>
    </>
  );
};

export default DataPlatform;
