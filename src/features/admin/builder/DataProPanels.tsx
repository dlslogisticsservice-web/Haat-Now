// ─────────────────────────────────────────────────────────────────────────────
// Data Platform · Enterprise panels (Phase 9D).
//
// Validation Builder · ER Diagram · Import Wizard · Export Wizard · Seed Generator · SQL Generator
// · Schema Versions · Audit Explorer · Health Dashboard. All drive the ONE BuilderStore (9C/9D
// data engine). Pure UI over the store — no new engines.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ZoomIn, ZoomOut, LayoutGrid, GitMerge, Play, Download, Upload, RotateCcw, Save, GitCompare, Search, ShieldCheck, Activity } from 'lucide-react';
import type { BuilderStore } from '../../../component-platform/BuilderStore';
import { VALIDATION_RULES, vid, type ValidationRule } from '../../../component-platform/data/fieldValidation';
import { parseCSV, parseJSONArray } from '../../../component-platform/data/importExport';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 10 };
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--color-on-surface-variant)' };
const es: React.CSSProperties = { padding: '5px 7px', borderRadius: 6, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', fontSize: 11 };
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' };
const ghost: React.CSSProperties = { ...btn, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)' };
const pre: React.CSSProperties = { fontSize: 10, fontFamily: 'ui-monospace,monospace', whiteSpace: 'pre-wrap', color: 'var(--color-on-surface)', maxHeight: 380, overflow: 'auto', margin: 0 };

export type DataMode = 'validation' | 'diagram' | 'import' | 'export' | 'seed' | 'sql' | 'versions' | 'audit' | 'health';

export const DataProPanel: React.FC<{ mode: DataMode; store: BuilderStore; entityId: string | null; lang: 'ar' | 'en' }> = ({ mode, store, entityId, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const entity = entityId ? store.getEntity(entityId) : null;
  if (mode === 'diagram') return <ERDiagram store={store} lang={lang} />;
  if (mode === 'audit') return <AuditExplorer store={store} lang={lang} />;
  if (mode === 'health') return <HealthDashboard store={store} lang={lang} />;
  if (!entity) return <div style={{ ...card, flex: 1, display: 'grid', placeItems: 'center', color: 'var(--color-on-surface-variant)' }}>{L('اختر كياناً', 'Select an entity')}</div>;
  if (mode === 'validation') return <ValidationBuilder store={store} entityId={entity.id} lang={lang} />;
  if (mode === 'import') return <ImportWizard store={store} entityId={entity.id} lang={lang} />;
  if (mode === 'export') return <ExportWizard store={store} entityId={entity.id} lang={lang} />;
  if (mode === 'seed') return <SeedGenerator store={store} entityId={entity.id} lang={lang} />;
  if (mode === 'sql') return <SQLGenerator store={store} entityId={entity.id} lang={lang} />;
  if (mode === 'versions') return <VersionsPanel store={store} entityId={entity.id} lang={lang} />;
  return null;
};

// ── PART 1 · Validation Builder ──
const ValidationBuilder: React.FC<{ store: BuilderStore; entityId: string; lang: 'ar' | 'en' }> = ({ store, entityId, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const entity = store.getEntity(entityId)!;
  const [fieldId, setFieldId] = useState(entity.fields[1]?.id || entity.fields[0]?.id);
  const [rule, setRule] = useState<ValidationRule>('required'); const [value, setValue] = useState(''); const [msg, setMsg] = useState(''); const [when, setWhen] = useState(''); const [test, setTest] = useState('');
  const field = entity.fields.find(f => f.id === fieldId);
  const add = () => { if (!field) return; store.setFieldValidations(entityId, field.id, [...(field.validations || []), { id: vid(), rule, value: value || undefined, when: when || undefined, message: msg || undefined }]); setValue(''); setMsg(''); setWhen(''); };
  const errs = field ? store.validateRecord(entityId, { id: 't', tenantId: store.ctxInfo().tenant, _createdAt: 0, _updatedAt: 0, [field.name]: test }).filter(e => e.field === field.name) : [];
  return (
    <div style={{ ...card, flex: 1, padding: 12, display: 'grid', gap: 10, alignContent: 'start' }} id="data_validation">
      <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 5 }}><ShieldCheck size={12} />{L('مصمّم التحقّق البصري', 'Visual Validation Designer')} · {entity.name}</span>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 2 }}><span style={lbl}>field</span><select id="vb_field" value={fieldId} onChange={e => setFieldId(e.target.value)} style={es}>{entity.fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label style={{ display: 'grid', gap: 2 }}><span style={lbl}>rule</span><select id="vb_rule" value={rule} onChange={e => setRule(e.target.value as ValidationRule)} style={es}>{VALIDATION_RULES.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
        <label style={{ display: 'grid', gap: 2 }}><span style={lbl}>value/arg</span><input id="vb_value" value={value} onChange={e => setValue(e.target.value)} placeholder="min,max / regex / expr" style={{ ...es, width: 150 }} /></label>
        <label style={{ display: 'grid', gap: 2 }}><span style={lbl}>when (conditional)</span><input id="vb_when" value={when} onChange={e => setWhen(e.target.value)} placeholder="rec.active == true" style={{ ...es, width: 150 }} /></label>
        <label style={{ display: 'grid', gap: 2 }}><span style={lbl}>message</span><input id="vb_msg" value={msg} onChange={e => setMsg(e.target.value)} style={{ ...es, width: 150 }} /></label>
        <button id="vb_add" onClick={add} style={btn}><Plus size={11} />{L('قاعدة', 'Rule')}</button>
      </div>
      <div style={{ display: 'grid', gap: 4 }} id="vb_rules">
        {(field?.validations || []).map(v => <div key={v.id} className="vb-rule" data-rule={v.rule} style={{ ...card, padding: '4px 8px', background: 'var(--color-surface-container-high)', display: 'flex', gap: 8, fontSize: 10.5 }}><b>{v.rule}</b>{v.value && <code>{v.value}</code>}{v.when && <span style={{ color: 'var(--color-primary-fixed,#a3f95b)' }}>when {v.when}</span>}<button onClick={() => store.setFieldValidations(entityId, field!.id, (field!.validations || []).filter(x => x.id !== v.id))} style={{ marginInlineStart: 'auto', background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}><Trash2 size={10} /></button></div>)}
        {!(field?.validations || []).length && <span style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('لا قواعد لهذا الحقل', 'No rules for this field')}</span>}
      </div>
      <div style={{ ...card, padding: 8, background: 'var(--color-surface-container-high)', display: 'grid', gap: 6 }}>
        <span style={lbl}>{L('اختبار مباشر', 'Live test')} — {field?.name}</span>
        <input id="vb_test" value={test} onChange={e => setTest(e.target.value)} style={es} />
        <span id="vb_result" data-valid={errs.length ? '0' : '1'} style={{ fontSize: 10.5, fontWeight: 700, color: errs.length ? '#ff6b6b' : 'var(--color-primary-fixed,#a3f95b)' }}>{errs.length ? `✕ ${errs[0].message}` : `✓ ${L('صالح', 'Valid')}`}</span>
      </div>
    </div>
  );
};

// ── PART 2 · ER Diagram ──
const ERDiagram: React.FC<{ store: BuilderStore; lang: 'ar' | 'en' }> = ({ store, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const entities = store.entities();
  useEffect(() => {
    if (!drag) return;
    const move = (e: MouseEvent) => store.setEntityDiagram(drag.id, drag.ox + (e.clientX - drag.sx) / zoom, drag.oy + (e.clientY - drag.sy) / zoom);
    const up = () => setDrag(null);
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [drag, zoom, store]);
  const pos = (id: string) => store.getEntity(id)?.diagram || { x: 40, y: 40 };
  return (
    <div style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} id="er_diagram">
      <div style={{ display: 'flex', gap: 6, padding: 6, borderBottom: '1px solid var(--color-outline-variant)', alignItems: 'center' }}>
        <button id="erd_zoom_out" onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(2)))} style={ghost}><ZoomOut size={12} /></button>
        <span id="erd_zoom" style={{ ...lbl, minWidth: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button id="erd_zoom_in" onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(2)))} style={ghost}><ZoomIn size={12} /></button>
        <button id="erd_autolayout" onClick={() => store.autoLayout()} style={ghost}><LayoutGrid size={12} />{L('ترتيب تلقائي', 'Auto layout')}</button>
        <button id="erd_junction" onClick={() => { const e = entities[0], o = entities[1]; if (e && o) { const j = store.addEntity(`${e.name}_${o.name}`); store.addRelation({ name: `j_${e.name}`, type: 'oneToMany', from: e.id, to: j.id, onDelete: 'cascade', orphanProtection: true }); store.addRelation({ name: `j_${o.name}`, type: 'oneToMany', from: o.id, to: j.id, onDelete: 'cascade', orphanProtection: true }); } }} style={ghost}><GitMerge size={12} />{L('جدول وصل', 'Junction')}</button>
        <span style={{ ...lbl, marginInlineStart: 'auto' }}>{entities.length} {L('كيان', 'entities')} · {store.relations().length} {L('علاقة', 'relations')}</span>
      </div>
      <div style={{ position: 'relative', flex: 1, overflow: 'auto', background: 'radial-gradient(var(--color-outline-variant) 1px, transparent 1px)', backgroundSize: `${24 * zoom}px ${24 * zoom}px` }}>
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: '0 0', width: 2000, height: 1400 }}>
          <svg width={2000} height={1400} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {store.relations().map(r => { const a = pos(r.from), b = pos(r.to); return <g key={r.id} className="erd-relation" data-type={r.type}><line x1={a.x + 90} y1={a.y + 30} x2={b.x + 90} y2={b.y + 30} stroke="var(--color-primary-fixed,#a3f95b)" strokeWidth={1.5} opacity={0.6} /><text x={(a.x + b.x) / 2 + 90} y={(a.y + b.y) / 2 + 26} fill="var(--color-on-surface-variant)" fontSize={9}>{r.type === 'oneToMany' ? '1 → ∞' : r.type === 'manyToMany' ? '∞ ↔ ∞' : '1 → 1'}</text></g>; })}
          </svg>
          {entities.map(e => { const p = e.diagram || { x: 40, y: 40 }; return (
            <div key={e.id} className="erd-entity" data-id={e.id} onMouseDown={ev => { ev.preventDefault(); setDrag({ id: e.id, sx: ev.clientX, sy: ev.clientY, ox: p.x, oy: p.y }); }}
              style={{ position: 'absolute', left: p.x, top: p.y, width: 180, ...card, background: 'var(--color-surface-container-high)', cursor: 'grab', userSelect: 'none', boxShadow: 'var(--shadow-md,0 8px 24px -12px rgba(0,0,0,.5))' }}>
              <div style={{ padding: '6px 9px', borderBottom: '1px solid var(--color-outline-variant)', fontWeight: 800, fontSize: 11.5, display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: e.color }} />{e.name}</div>
              <div style={{ padding: '5px 9px', display: 'grid', gap: 2 }}>{e.fields.slice(0, 5).map(f => <div key={f.id} style={{ fontSize: 9.5, display: 'flex', justifyContent: 'space-between', color: 'var(--color-on-surface-variant)' }}><span>{f.name}</span><span>{f.type}</span></div>)}</div>
            </div>
          ); })}
        </div>
        {/* Minimap */}
        <div id="erd_minimap" style={{ position: 'absolute', bottom: 10, insetInlineEnd: 10, width: 150, height: 100, ...card, background: 'var(--color-surface-container)', overflow: 'hidden' }}>
          {entities.map(e => { const p = e.diagram || { x: 40, y: 40 }; return <span key={e.id} style={{ position: 'absolute', left: p.x / 13, top: p.y / 13, width: 10, height: 5, borderRadius: 2, background: e.color }} />; })}
        </div>
      </div>
    </div>
  );
};

// ── PART 3 · Import Wizard ──
const ImportWizard: React.FC<{ store: BuilderStore; entityId: string; lang: 'ar' | 'en' }> = ({ store, entityId, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const entity = store.getEntity(entityId)!;
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [text, setText] = useState('name,active\nImported A,true\nImported B,false');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dedupe, setDedupe] = useState(''); const [conflict, setConflict] = useState<'skip' | 'overwrite'>('skip');
  const [report, setReport] = useState<string>('');
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const parse = () => { const r = format === 'csv' ? parseCSV(text) : parseJSONArray(text); setRows(r); const m: Record<string, string> = {}; if (r[0]) for (const c of Object.keys(r[0])) m[c] = entity.fields.find(f => f.name.toLowerCase() === c.toLowerCase())?.name || ''; setMapping(m); };
  const run = () => { const res = store.importRows(entityId, rows, { mapping, dedupeKey: dedupe || undefined, conflict }); setReport(res.rolledBack ? `⟲ Rolled back — ${res.errors.slice(0, 3).join('; ')}` : `✓ Imported ${res.imported}, skipped ${res.skipped}`); };
  return (
    <div style={{ ...card, flex: 1, padding: 12, display: 'grid', gap: 8, alignContent: 'start' }} id="data_import">
      <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Upload size={12} />{L('معالج الاستيراد', 'Import Wizard')} · {entity.name}</span>
      <div style={{ display: 'flex', gap: 6 }}><select id="imp_format" value={format} onChange={e => setFormat(e.target.value as 'csv' | 'json')} style={es}><option value="csv">CSV / Excel</option><option value="json">JSON</option></select><button id="imp_parse" onClick={parse} style={ghost}>{L('تحليل ومعاينة', 'Parse + preview')}</button></div>
      <textarea id="imp_text" value={text} onChange={e => setText(e.target.value)} rows={4} style={{ ...es, resize: 'vertical', fontFamily: 'ui-monospace,monospace' }} />
      {cols.length > 0 && <>
        <span style={lbl}>{L('تعيين الأعمدة', 'Column mapping')}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>{cols.map(c => <label key={c} style={{ display: 'grid', gap: 2 }}><span style={{ fontSize: 9.5 }}>{c} →</span><select id={`imp_map_${c}`} className="imp-map" value={mapping[c] || ''} onChange={e => setMapping(m => ({ ...m, [c]: e.target.value }))} style={es}><option value="">(skip)</option>{entity.fields.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select></label>)}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 2 }}><span style={lbl}>dedupe key</span><select id="imp_dedupe" value={dedupe} onChange={e => setDedupe(e.target.value)} style={es}><option value="">none</option>{entity.fields.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 2 }}><span style={lbl}>conflict</span><select id="imp_conflict" value={conflict} onChange={e => setConflict(e.target.value as 'skip' | 'overwrite')} style={es}><option value="skip">skip</option><option value="overwrite">overwrite</option></select></label>
          <button id="imp_run" onClick={run} style={btn}><Play size={11} />{L('تحقّق واستيراد', 'Validate + import')}</button>
        </div>
        <div id="imp_preview" style={{ ...card, padding: 8, background: 'var(--color-surface-container-high)', fontSize: 10 }}>{rows.length} {L('صف للمعاينة', 'rows previewed')}</div>
      </>}
      {report && <div id="imp_report" style={{ ...card, padding: 8, background: 'var(--color-surface-container-high)', fontSize: 11, fontWeight: 700, color: report.startsWith('✓') ? 'var(--color-primary-fixed,#a3f95b)' : '#ffb454' }}>{report}</div>}
    </div>
  );
};

// ── PART 4 · Export Wizard ──
const ExportWizard: React.FC<{ store: BuilderStore; entityId: string; lang: 'ar' | 'en' }> = ({ store, entityId, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const entity = store.getEntity(entityId)!;
  const [format, setFormat] = useState<'csv' | 'json' | 'sql'>('csv');
  const [out, setOut] = useState('');
  return (
    <div style={{ ...card, flex: 1, padding: 12, display: 'grid', gap: 8, alignContent: 'start' }} id="data_export">
      <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Download size={12} />{L('معالج التصدير', 'Export Wizard')} · {entity.name}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <select id="exp_format" value={format} onChange={e => setFormat(e.target.value as 'csv' | 'json' | 'sql')} style={es}><option value="csv">CSV / Excel</option><option value="json">JSON</option><option value="sql">SQL (INSERT)</option></select>
        <button id="exp_run" onClick={() => setOut(store.exportEntity(entityId, format))} style={btn}><Play size={11} />{L('تصدير', 'Export')}</button>
      </div>
      <pre id="exp_output" style={pre}>{out || L('اضغط تصدير لعرض المخرجات', 'Press Export to generate output')}</pre>
    </div>
  );
};

// ── PART 5 · Seed Generator ──
const SeedGenerator: React.FC<{ store: BuilderStore; entityId: string; lang: 'ar' | 'en' }> = ({ store, entityId, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const entity = store.getEntity(entityId)!;
  const [n, setN] = useState('100'); const [result, setResult] = useState('');
  const run = () => { const t0 = performance.now(); const added = store.generateSeed(entityId, Number(n) || 0); const ms = Math.round(performance.now() - t0); setResult(`+${added.toLocaleString()} ${L('سجل في', 'records in')} ${ms}ms`); };
  return (
    <div style={{ ...card, flex: 1, padding: 12, display: 'grid', gap: 10, alignContent: 'start' }} id="data_seed">
      <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Activity size={12} />{L('مولّد بيانات البذور', 'Seed Data Generator')} · {entity.name}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select id="seed_count" value={n} onChange={e => setN(e.target.value)} style={es}>{['10', '100', '1000', '10000'].map(x => <option key={x} value={x}>{Number(x).toLocaleString()}</option>)}</select>
        <button id="seed_run" onClick={run} style={btn}><Play size={11} />{L('توليد', 'Generate')}</button>
        {result && <span id="seed_result" style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary-fixed,#a3f95b)' }}>{result}</span>}
      </div>
      <span style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('يولّد بيانات واقعية للنطاق باستخدام مولّد شبه عشوائي بذري (يتوسّع إلى 10 آلاف+).', 'Realistic domain data via a seeded PRNG — scales to 10k+ without degradation.')}</span>
      <div style={{ fontSize: 11 }}>{L('إجمالي السجلات الآن:', 'Total records now:')} <b>{store.records(entityId, { includeArchived: true }).length.toLocaleString()}</b></div>
    </div>
  );
};

// ── PART 6 · SQL Generator ──
const SQLGenerator: React.FC<{ store: BuilderStore; entityId: string; lang: 'ar' | 'en' }> = ({ store, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [tab, setTab] = useState<'create' | 'migration'>('create');
  const mig = store.migrationSQL();
  return (
    <div style={{ ...card, flex: 1, padding: 12, display: 'grid', gap: 8, alignContent: 'start' }} id="data_sql">
      <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{L('مولّد SQL (لا ينفّذ)', 'SQL Generator (never executes)')}</span>
      <div style={{ display: 'flex', gap: 5 }}><button id="sql_create" onClick={() => setTab('create')} style={tab === 'create' ? btn : ghost}>{L('إنشاء الجداول', 'Create tables')}</button><button id="sql_migration" onClick={() => setTab('migration')} style={tab === 'migration' ? btn : ghost}>{L('ترحيل + تراجع', 'Migration + rollback')}</button></div>
      {tab === 'create' && <pre id="sql_output" style={pre}>{store.entitiesSQL()}</pre>}
      {tab === 'migration' && <><span style={lbl}>-- UP</span><pre id="sql_output" style={pre}>{mig.up}</pre><span style={lbl}>-- DOWN (rollback)</span><pre id="sql_rollback" style={pre}>{mig.down}</pre></>}
    </div>
  );
};

// ── PART 7 · Versions ──
const VersionsPanel: React.FC<{ store: BuilderStore; entityId: string; lang: 'ar' | 'en' }> = ({ store, entityId, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [reason, setReason] = useState(''); const [cmp, setCmp] = useState<number[]>([]);
  const versions = store.schemaVersions(entityId);
  const diff = cmp.length === 2 ? store.compareSchema(entityId, cmp[0], cmp[1]) : [];
  return (
    <div style={{ ...card, flex: 1, padding: 12, display: 'grid', gap: 8, alignContent: 'start' }} id="data_versions">
      <span style={lbl}>{L('سجلّ إصدارات المخطّط', 'Schema version history')}</span>
      <div style={{ display: 'flex', gap: 6 }}><input id="ver_reason" value={reason} onChange={e => setReason(e.target.value)} placeholder={L('سبب الحفظ', 'reason')} style={{ ...es, flex: 1 }} /><button id="ver_save" onClick={() => { store.saveSchemaVersion(entityId, reason); setReason(''); }} style={btn}><Save size={11} />{L('حفظ إصدار', 'Save version')}</button></div>
      <div style={{ display: 'grid', gap: 4 }} id="ver_list">
        {versions.map(v => <div key={v.version} className="ver-row" data-version={v.version} style={{ ...card, padding: '5px 8px', background: 'var(--color-surface-container-high)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 10.5 }}><b>v{v.version}</b><span style={{ flex: 1, color: 'var(--color-on-surface-variant)' }}>{v.reason} · {v.author}</span><button id={`ver_restore_${v.version}`} onClick={() => store.restoreSchemaVersion(entityId, v.version)} style={ghost}><RotateCcw size={10} />{L('استرجاع', 'Restore')}</button><button className="ver-compare" onClick={() => setCmp(c => c.includes(v.version) ? c.filter(x => x !== v.version) : [...c, v.version].slice(-2))} style={{ ...ghost, outline: cmp.includes(v.version) ? '1px solid var(--color-primary-fixed)' : 'none' }}><GitCompare size={10} /></button></div>)}
        {!versions.length && <span style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('لا إصدارات — احفظ واحداً بعد تعديل المخطّط.', 'No versions — save one after editing the schema.')}</span>}
      </div>
      {diff.length > 0 && <div id="ver_diff" style={{ ...card, padding: 8, background: 'var(--color-surface-container-high)', display: 'grid', gap: 3 }}><span style={lbl}>{L('الفروقات', 'Diff')} v{cmp[0]} → v{cmp[1]}</span>{diff.map((d, i) => <div key={i} className="ver-diff-row" style={{ fontSize: 10, fontFamily: 'ui-monospace,monospace' }}><b>{d.field}</b>: {d.change}</div>)}</div>}
    </div>
  );
};

// ── PART 8 · Audit Explorer ──
const AuditExplorer: React.FC<{ store: BuilderStore; lang: 'ar' | 'en' }> = ({ store, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [q, setQ] = useState(''); const [op, setOp] = useState('');
  const entries = store.auditEntries().filter(a => (!op || a.op === op) && (!q || (a.op + a.detail + a.entity).toLowerCase().includes(q.toLowerCase())));
  const ops = [...new Set(store.auditEntries().map(a => a.op))];
  return (
    <div style={{ ...card, flex: 1, padding: 12, display: 'grid', gap: 8, alignContent: 'start' }} id="data_audit">
      <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Search size={12} />{L('مستكشف التدقيق', 'Audit Explorer')} · {store.auditEntries().length}</span>
      <div style={{ display: 'flex', gap: 6 }}><input id="aud_search" value={q} onChange={e => setQ(e.target.value)} placeholder={L('بحث', 'search')} style={{ ...es, flex: 1 }} /><select id="aud_filter" value={op} onChange={e => setOp(e.target.value)} style={es}><option value="">{L('كل العمليات', 'all ops')}</option>{ops.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
      <div style={{ display: 'grid', gap: 3, maxHeight: 420, overflow: 'auto' }} id="aud_timeline">
        {entries.slice(0, 80).map((a, i) => <div key={i} className="aud-row" data-op={a.op} style={{ ...card, padding: '4px 8px', background: 'var(--color-surface-container-high)', display: 'flex', gap: 8, fontSize: 10, fontFamily: 'ui-monospace,monospace' }}><span style={{ color: 'var(--color-primary-fixed,#a3f95b)', minWidth: 110 }}>{a.op}</span><span style={{ minWidth: 70, color: 'var(--color-on-surface-variant)' }}>{a.actor}</span><span style={{ flex: 1 }}>{store.getEntity(a.entity)?.name ?? a.entity} {a.detail}</span></div>)}
        {!entries.length && <span style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('لا سجلّات', 'No audit entries')}</span>}
      </div>
    </div>
  );
};

// ── PART 9+10 · Analyzer + Health Dashboard ──
const HealthDashboard: React.FC<{ store: BuilderStore; lang: 'ar' | 'en' }> = ({ store, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const h = store.health();
  const tile = (k: string, v: React.ReactNode, color?: string) => <div style={{ ...card, padding: 10, background: 'var(--color-surface-container-high)', display: 'grid', gap: 2 }}><span style={lbl}>{k}</span><span style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--color-on-surface)' }}>{v}</span></div>;
  const scoreColor = (s: number) => s >= 80 ? 'var(--color-primary-fixed,#a3f95b)' : s >= 50 ? '#ffb454' : '#ff6b6b';
  return (
    <div style={{ ...card, flex: 1, padding: 12, display: 'grid', gap: 10, alignContent: 'start', overflow: 'auto' }} id="data_health">
      <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Activity size={12} />{L('لوحة صحّة البيانات', 'Data Health Dashboard')}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }} id="hd_dashboard">
        {tile(L('الكيانات', 'Entities'), h.entities)}
        {tile(L('المجموعات', 'Collections'), h.collections)}
        {tile(L('العلاقات', 'Relations'), h.relations)}
        {tile(L('الفهارس', 'Indexes'), h.indexes)}
        {tile(L('التخزين', 'Storage'), `${h.storageKB} KB`)}
        {tile(L('أخطاء التحقّق', 'Validation errors'), h.validationErrors, h.validationErrors ? '#ff6b6b' : undefined)}
        {tile(L('علاقات مكسورة', 'Broken relations'), h.brokenRelations, h.brokenRelations ? '#ff6b6b' : undefined)}
        <div id="hd_perf_score" style={{ ...card, padding: 10, background: 'var(--color-surface-container-high)', display: 'grid', gap: 2 }} data-score={h.performanceScore}><span style={lbl}>{L('الأداء', 'Performance')}</span><span style={{ fontSize: 20, fontWeight: 800, color: scoreColor(h.performanceScore) }}>{h.performanceScore}</span></div>
        <div id="hd_health_score" style={{ ...card, padding: 10, background: 'var(--color-surface-container-high)', display: 'grid', gap: 2 }} data-score={h.healthScore}><span style={lbl}>{L('الصحّة', 'Health')}</span><span style={{ fontSize: 20, fontWeight: 800, color: scoreColor(h.healthScore) }}>{h.healthScore}</span></div>
        {tile(L('تحذيرات', 'Warnings'), h.warnings.length, h.warnings.length ? '#ffb454' : undefined)}
      </div>
      <span style={{ ...lbl }}>{L('محلّل الأداء — التوصيات', 'Performance Analyzer — recommendations')}</span>
      <div style={{ display: 'grid', gap: 4 }} id="hd_issues">
        {h.issues.slice(0, 30).map((iss, i) => <div key={i} className="hd-issue" data-severity={iss.severity} data-kind={iss.kind} style={{ ...card, padding: '6px 9px', background: 'var(--color-surface-container-high)', display: 'flex', gap: 8, fontSize: 10.5 }}><span style={{ width: 8, height: 8, borderRadius: 999, marginTop: 3, background: iss.severity === 'error' ? '#ff6b6b' : iss.severity === 'warn' ? '#ffb454' : 'var(--color-primary-fixed,#a3f95b)' }} /><span style={{ flex: 1 }}><b>{iss.entity ? `${iss.entity}: ` : ''}</b>{iss.message}<div style={{ color: 'var(--color-on-surface-variant)' }}>→ {iss.recommendation}</div></span></div>)}
        {!h.issues.length && <span style={{ fontSize: 10.5, color: 'var(--color-primary-fixed,#a3f95b)' }}>✓ {L('لا مشاكل — النموذج سليم', 'No issues — model is healthy')}</span>}
      </div>
    </div>
  );
};

export default DataProPanel;
