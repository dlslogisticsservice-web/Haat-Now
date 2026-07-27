// ─────────────────────────────────────────────────────────────────────────────
// Application Logic UI (Phase 9B).
//
// LogicTab   — the selected node's Bindings / Actions / Conditions / Validation editors.
// LogicDock  — the bottom Live Debugger + authoring dock: Variables, Data Sources, Workflows,
//              State (+ timeline), Expression evaluator, Dependency graph, Action log.
// Both drive the ONE BuilderStore (extended in 9B); no new store/runtime.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { Plus, Trash2, Play, Variable as VarIcon, Workflow as WfIcon, Bug, Braces, Database, GitBranch, Link2, Zap } from 'lucide-react';
import type { BuilderStore } from '../../../component-platform/BuilderStore';
import { getComponent } from '../../../component-platform/registry';
import type { BuilderNode } from '../../../component-platform/types';
import { VAR_SCOPES, VAR_TYPES, ACTION_TYPES, VALIDATOR_KINDS, WORKFLOW_NODE_TYPES, type ActionType, type ValidatorKind, type WorkflowNodeType } from '../../../component-platform/logic/logicTypes';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 10 };
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--color-on-surface-variant)' };
const es: React.CSSProperties = { width: '100%', padding: '5px 7px', borderRadius: 6, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', fontSize: 11 };
const seg = (on: boolean): React.CSSProperties => ({ padding: '4px 9px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 700, background: on ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: on ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' });
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' };

// ── Selected-node logic editor (Bindings / Actions / Conditions / Validation) ──
export const LogicTab: React.FC<{ store: BuilderStore; node: BuilderNode; lang: 'ar' | 'en' }> = ({ store, node, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [sub, setSub] = useState<'bind' | 'actions' | 'cond' | 'valid'>('bind');
  const spec = getComponent(node.specId);
  const [aType, setAType] = useState<ActionType>('setVariable');
  const [aP1, setAP1] = useState(''); const [aP2, setAP2] = useState('');
  const [cTarget, setCTarget] = useState<'visible' | 'enabled'>('visible'); const [cExpr, setCExpr] = useState('');
  const [vKind, setVKind] = useState<ValidatorKind>('required'); const [vVal, setVVal] = useState(''); const [vTest, setVTest] = useState('');

  const resolved = spec ? store.effectiveProps(node, spec) : {};

  return (
    <div style={{ display: 'grid', gap: 8 }} id="cp_logic_tab">
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {([['bind', L('ربط', 'Bindings')], ['actions', L('إجراءات', 'Actions')], ['cond', L('شروط', 'Conditions')], ['valid', L('تحقّق', 'Validation')]] as const).map(([id, t]) => <button key={id} id={`lt_tab_${id}`} onClick={() => setSub(id)} style={seg(sub === id)}>{t}</button>)}
      </div>

      {sub === 'bind' && (
        <div style={{ ...card, padding: 8, display: 'grid', gap: 8 }} id="lt_bindings">
          <span style={lbl}>{L('اربط الخصائص بالبيانات/المتغيّرات/التعبيرات', 'Bind properties to data / variables / expressions')}</span>
          {(spec?.props || []).map(p => {
            const bound = !!node.bindings?.[p.key];
            return (
              <div key={p.key} style={{ display: 'grid', gap: 3 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10.5, color: 'var(--color-on-surface)' }}>{p.label}</span>
                  <button id={`lt_bind_${p.key}`} onClick={() => bound ? store.removeBinding(node.id, p.key) : store.setBinding(node.id, p.key, { mode: 'expression', expr: '' })} style={seg(bound)}><Link2 size={10} />{bound ? L('مربوط', 'Bound') : L('ربط', 'Bind')}</button>
                </span>
                {bound && <>
                  <input id={`lt_bindexpr_${p.key}`} value={String(node.bindings![p.key].expr)} placeholder="e.g. var.appName + ' 🎉'" onChange={e => store.setBinding(node.id, p.key, { ...node.bindings![p.key], expr: e.target.value })} style={es} />
                  <span style={{ fontSize: 9.5, color: 'var(--color-primary-fixed,#a3f95b)' }} className="lt-bind-resolved" data-prop={p.key}>= {String(resolved[p.key] ?? '—')}</span>
                </>}
              </div>
            );
          })}
        </div>
      )}

      {sub === 'actions' && (
        <div style={{ ...card, padding: 8, display: 'grid', gap: 8 }} id="lt_actions">
          <span style={lbl}>{L('إجراءات عند النقر', 'Actions on event')}</span>
          <div style={{ display: 'grid', gap: 5 }}>
            <select id="lt_action_type" value={aType} onChange={e => setAType(e.target.value as ActionType)} style={es}>{ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
            {(aType === 'setVariable') && <><input id="lt_action_p1" value={aP1} placeholder="variable name" onChange={e => setAP1(e.target.value)} style={es} /><input id="lt_action_p2" value={aP2} placeholder="value or expression" onChange={e => setAP2(e.target.value)} style={es} /></>}
            {(aType === 'updateState') && <><input id="lt_action_p1" value={aP1} placeholder="state key" onChange={e => setAP1(e.target.value)} style={es} /><input id="lt_action_p2" value={aP2} placeholder="value" onChange={e => setAP2(e.target.value)} style={es} /></>}
            {(aType === 'navigate') && <input id="lt_action_p1" value={aP1} placeholder="screen" onChange={e => setAP1(e.target.value)} style={es} />}
            {(aType === 'toast' || aType === 'snackbar') && <input id="lt_action_p1" value={aP1} placeholder="message ({{var.x}})" onChange={e => setAP1(e.target.value)} style={es} />}
            <button id="lt_action_add" onClick={() => { const params: Record<string, unknown> = aType === 'setVariable' ? { name: aP1, expr: aP2 } : aType === 'updateState' ? { key: aP1, value: aP2 } : aType === 'navigate' ? { screen: aP1 } : { message: aP1 }; store.addAction(node.id, { event: 'click', type: aType, params }); setAP1(''); setAP2(''); }} style={btn}><Plus size={11} />{L('إضافة إجراء', 'Add action')}</button>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {(node.actions || []).map(a => <div key={a.id} className="lt-action" data-type={a.type} style={{ display: 'flex', alignItems: 'center', gap: 6, ...card, padding: '4px 7px', background: 'var(--color-surface-container-high)' }}><span style={{ fontSize: 10, fontWeight: 700, flex: 1 }}>{a.event} → {a.type} {JSON.stringify(a.params).slice(0, 30)}</span><button onClick={() => store.removeAction(node.id, a.id)} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}><Trash2 size={11} /></button></div>)}
          </div>
          {(node.actions || []).length > 0 && <button id="lt_run" onClick={() => store.runActions(node.id, 'click')} style={{ ...btn, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)' }}><Play size={11} />{L('تشغيل الإجراءات', 'Run actions')}</button>}
        </div>
      )}

      {sub === 'cond' && (
        <div style={{ ...card, padding: 8, display: 'grid', gap: 8 }} id="lt_conditions">
          <span style={lbl}>{L('منطق شرطي (رؤية/تفعيل)', 'Conditional logic (visibility / enable)')}</span>
          <select id="lt_cond_target" value={cTarget} onChange={e => setCTarget(e.target.value as 'visible' | 'enabled')} style={es}><option value="visible">visible</option><option value="enabled">enabled</option></select>
          <input id="lt_cond_expr" value={cExpr} placeholder="e.g. var.loggedIn == true" onChange={e => setCExpr(e.target.value)} style={es} />
          <button id="lt_cond_add" onClick={() => { store.setConditions(node.id, [...(node.conditions || []), { target: cTarget, expr: cExpr }]); setCExpr(''); }} style={btn}><Plus size={11} />{L('إضافة شرط', 'Add condition')}</button>
          <div style={{ display: 'grid', gap: 4 }}>{(node.conditions || []).map((c, i) => <div key={i} className="lt-cond" data-target={c.target} style={{ ...card, padding: '4px 7px', background: 'var(--color-surface-container-high)', fontSize: 10 }}><code>{c.target}: {c.expr}</code></div>)}</div>
          <span style={{ fontSize: 10, color: 'var(--color-primary-fixed,#a3f95b)' }} id="lt_cond_eval">→ {JSON.stringify(store.evalConditions(node))}</span>
        </div>
      )}

      {sub === 'valid' && (
        <div style={{ ...card, padding: 8, display: 'grid', gap: 8 }} id="lt_validation">
          <span style={lbl}>{L('قواعد التحقّق (النماذج)', 'Field validation rules')}</span>
          <select id="lt_val_kind" value={vKind} onChange={e => setVKind(e.target.value as ValidatorKind)} style={es}>{VALIDATOR_KINDS.map(k => <option key={k} value={k}>{k}</option>)}</select>
          {(vKind === 'min' || vKind === 'max' || vKind === 'regex' || vKind === 'custom') && <input id="lt_val_value" value={vVal} placeholder={vKind === 'regex' ? 'pattern' : vKind === 'custom' ? 'expr (uses value)' : 'number'} onChange={e => setVVal(e.target.value)} style={es} />}
          <button id="lt_val_add" onClick={() => { store.setValidators(node.id, [...(node.validators || []), { kind: vKind, value: vVal }]); setVVal(''); }} style={btn}><Plus size={11} />{L('إضافة قاعدة', 'Add rule')}</button>
          <div style={{ display: 'grid', gap: 4 }}>{(node.validators || []).map((v, i) => <div key={i} className="lt-validator" data-kind={v.kind} style={{ ...card, padding: '4px 7px', background: 'var(--color-surface-container-high)', fontSize: 10 }}>{v.kind}{v.value ? `: ${v.value}` : ''}</div>)}</div>
          <span style={lbl}>{L('تجربة القيمة', 'Test value')}</span>
          <input id="lt_val_test" value={vTest} onChange={e => setVTest(e.target.value)} style={es} />
          {(() => { const err = store.validateField(node, vTest); return <span id="lt_val_result" data-valid={err ? '0' : '1'} style={{ fontSize: 10.5, fontWeight: 700, color: err ? '#ff6b6b' : 'var(--color-primary-fixed,#a3f95b)' }}>{err ? `✕ ${err}` : `✓ ${L('صالح', 'Valid')}`}</span>; })()}
        </div>
      )}
    </div>
  );
};

// ── Bottom dock: Variables · Data · Workflows · State · Expression · Dependencies ──
export const LogicDock: React.FC<{ store: BuilderStore; lang: 'ar' | 'en' }> = ({ store, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [tab, setTab] = useState<'vars' | 'data' | 'flows' | 'state' | 'expr' | 'deps'>('vars');
  const [vName, setVName] = useState(''); const [vScope, setVScope] = useState('global'); const [vType, setVType] = useState('string'); const [vValue, setVValue] = useState('');
  const [expr, setExpr] = useState('var.appName'); const [wfTrace, setWfTrace] = useState<string>('');
  const scope = store.scope();
  const varsVal = (scope.var || {}) as Record<string, unknown>;

  return (
    <div id="cp_logic_dock" style={{ ...card, padding: 8, display: 'grid', gap: 8, gridTemplateRows: 'auto 1fr', minHeight: 150 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <Bug size={13} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />
        {([['vars', VarIcon, L('متغيّرات', 'Variables')], ['data', Database, L('بيانات', 'Data')], ['flows', WfIcon, L('مسارات', 'Workflows')], ['state', Braces, L('الحالة', 'State')], ['expr', Zap, L('تعبير', 'Expression')], ['deps', GitBranch, L('تبعيات', 'Deps')]] as const).map(([id, Icon, t]) => <button key={id} id={`dock_tab_${id}`} onClick={() => setTab(id)} style={{ ...seg(tab === id), display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon size={11} />{t}</button>)}
      </div>

      <div style={{ overflow: 'auto' }}>
        {tab === 'vars' && (
          <div style={{ display: 'grid', gap: 8 }} id="dock_variables">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr) auto', gap: 5, alignItems: 'end' }}>
              <label style={{ display: 'grid', gap: 2 }}><span style={lbl}>name</span><input id="dock_var_name" value={vName} onChange={e => setVName(e.target.value)} style={es} /></label>
              <label style={{ display: 'grid', gap: 2 }}><span style={lbl}>scope</span><select id="dock_var_scope" value={vScope} onChange={e => setVScope(e.target.value)} style={es}>{VAR_SCOPES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
              <label style={{ display: 'grid', gap: 2 }}><span style={lbl}>type</span><select id="dock_var_type" value={vType} onChange={e => setVType(e.target.value)} style={es}>{VAR_TYPES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
              <label style={{ display: 'grid', gap: 2, gridColumn: 'span 2' }}><span style={lbl}>{vScope === 'computed' ? 'expression' : 'value'}</span><input id="dock_var_value" value={vValue} onChange={e => setVValue(e.target.value)} style={es} /></label>
              <button id="dock_var_add" onClick={() => { if (!vName.trim()) return; const t = vType; const coerce = (x: string): unknown => t === 'number' ? (Number(x) || 0) : t === 'boolean' ? (x === 'true') : t === 'json' || t === 'array' || t === 'object' ? (() => { try { return JSON.parse(x); } catch { return x; } })() : x; store.addVariable({ name: vName.trim(), scope: vScope as never, type: vType as never, value: vScope === 'computed' ? undefined : coerce(vValue), computed: vScope === 'computed' ? vValue : undefined }); setVName(''); setVValue(''); }} style={btn}><Plus size={11} />{L('إضافة', 'Add')}</button>
            </div>
            <div style={{ display: 'grid', gap: 3 }} id="dock_var_list">
              {store.variables().map(v => <div key={v.id} className="dock-var" data-name={v.name} data-scope={v.scope} style={{ display: 'flex', alignItems: 'center', gap: 8, ...card, padding: '4px 8px', background: 'var(--color-surface-container-high)', fontSize: 10.5 }}><span style={{ fontWeight: 800, color: 'var(--color-primary-fixed,#a3f95b)' }}>{v.name}</span><span style={{ ...lbl }}>{v.scope}·{v.type}</span><span style={{ flex: 1, color: 'var(--color-on-surface)', fontFamily: 'ui-monospace,monospace' }}>= {JSON.stringify(varsVal[v.name])}</span><button onClick={() => store.removeVariable(v.id)} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}><Trash2 size={11} /></button></div>)}
              {store.variables().length === 0 && <span style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('لا متغيّرات — أضف واحداً.', 'No variables — add one.')}</span>}
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div style={{ display: 'grid', gap: 3 }} id="dock_datasources">
            {store.dataSources().map(d => <div key={d.id} className="dock-ds" data-kind={d.kind} style={{ display: 'flex', gap: 8, ...card, padding: '5px 8px', background: 'var(--color-surface-container-high)', fontSize: 10.5 }}><span style={{ fontWeight: 800, minWidth: 130 }}>{d.name}</span><span style={{ ...lbl }}>{d.kind}</span><span style={{ flex: 1, color: 'var(--color-on-surface-variant)' }}>reuses: {d.reuses}</span></div>)}
          </div>
        )}

        {tab === 'flows' && (
          <div style={{ display: 'grid', gap: 6 }} id="dock_workflows">
            <button id="dock_wf_add" onClick={() => store.addWorkflow('')} style={btn}><Plus size={11} />{L('مسار جديد', 'New workflow')}</button>
            {store.workflows().map(wf => (
              <div key={wf.id} className="dock-wf" data-wf={wf.id} style={{ ...card, padding: 8, background: 'var(--color-surface-container-high)', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><WfIcon size={12} /><span style={{ fontWeight: 800, flex: 1 }}>{wf.name}</span>
                  <select onChange={e => { if (e.target.value) { store.addWorkflowNode(wf.id, e.target.value as WorkflowNodeType, e.target.value === 'condition' ? { expr: 'var.count > 0' } : e.target.value === 'variable' ? { name: 'count', expr: 'var.count + 1' } : {}); e.currentTarget.value = ''; } }} style={{ ...es, width: 'auto' }} id={`dock_wf_addnode_${wf.id}`} defaultValue=""><option value="">+ node</option>{WORKFLOW_NODE_TYPES.filter(t => t !== 'start' && t !== 'finish').map(t => <option key={t} value={t}>{t}</option>)}</select>
                  <button id={`dock_wf_run_${wf.id}`} onClick={() => setWfTrace(store.runWorkflow(wf.id).map(s => `${s.type}:${s.result}`).join('  ›  '))} style={{ ...btn }}><Play size={10} />{L('تشغيل', 'Run')}</button>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{wf.nodes.map(nn => <span key={nn.id} className="wf-node" data-type={nn.type} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>{nn.type}</span>)}</div>
              </div>
            ))}
            {wfTrace && <div id="dock_wf_trace" style={{ ...card, padding: 6, fontSize: 9.5, fontFamily: 'ui-monospace,monospace', color: 'var(--color-primary-fixed,#a3f95b)', background: 'var(--color-surface-container-high)' }}>{wfTrace}</div>}
          </div>
        )}

        {tab === 'state' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div id="dock_state" style={{ display: 'grid', gap: 3, alignContent: 'start' }}><span style={lbl}>{L('الحالة الحيّة', 'Live state')}</span>{Object.entries(store.getState()).map(([k, v]) => <div key={k} className="dock-state-row" data-key={k} style={{ ...card, padding: '4px 7px', background: 'var(--color-surface-container-high)', fontSize: 10, display: 'flex', gap: 6 }}><b>{k}</b><span style={{ color: 'var(--color-on-surface-variant)' }}>{JSON.stringify(v)}</span></div>)}{Object.keys(store.getState()).length === 0 && <span style={{ fontSize: 10, color: 'var(--color-on-surface-variant)' }}>{L('لا حالة بعد', 'No state yet')}</span>}</div>
            <div id="dock_timeline" style={{ display: 'grid', gap: 3, alignContent: 'start' }}><span style={lbl}>{L('الخطّ الزمني', 'Timeline')}</span>{store.timeline().slice(0, 12).map((t, i) => <div key={i} className="dock-timeline-row" style={{ ...card, padding: '3px 7px', background: 'var(--color-surface-container-high)', fontSize: 9.5, fontFamily: 'ui-monospace,monospace' }}>{t.key} = {t.value}</div>)}</div>
            <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 3 }} id="dock_log"><span style={lbl}>{L('سجلّ الإجراءات', 'Action log')}</span>{store.log().slice(0, 8).map((l, i) => <div key={i} style={{ fontSize: 9.5, color: 'var(--color-on-surface-variant)', fontFamily: 'ui-monospace,monospace' }}>· {l}</div>)}</div>
          </div>
        )}

        {tab === 'expr' && (
          <div style={{ display: 'grid', gap: 6 }} id="dock_expr_panel">
            <span style={lbl}>{L('مُقيّم التعبيرات (حيّ)', 'Live expression evaluator')}</span>
            <input id="dock_expr" value={expr} onChange={e => setExpr(e.target.value)} style={es} />
            {(() => { const r = store.evalExpr(expr); return <div id="dock_expr_result" data-ok={r.ok ? '1' : '0'} style={{ ...card, padding: 8, background: 'var(--color-surface-container-high)', fontSize: 11, fontFamily: 'ui-monospace,monospace', color: r.ok ? 'var(--color-primary-fixed,#a3f95b)' : '#ff6b6b' }}>{r.ok ? `= ${JSON.stringify(r.value)}` : `✕ ${r.error}`}</div>; })()}
            <span style={{ fontSize: 9.5, color: 'var(--color-on-surface-variant)' }}>{L('النطاق:', 'Scope:')} var.* · state.* · data.* · theme.* · ctx.* · fn: len,upper,currency,round,sum,contains…</span>
          </div>
        )}

        {tab === 'deps' && (
          <div style={{ display: 'grid', gap: 3 }} id="dock_deps">
            <span style={lbl}>{L('مخطّط التبعيات (عقدة ← متغيّرات)', 'Dependency graph (node ← variables)')}</span>
            {store.dependencies().map((d, i) => <div key={i} className="dock-dep" data-node={d.nodeId} style={{ ...card, padding: '4px 8px', background: 'var(--color-surface-container-high)', fontSize: 10, display: 'flex', gap: 8 }}><b>{d.spec}</b><span style={{ color: 'var(--color-on-surface-variant)' }}>← {d.refs.length ? d.refs.map(r => `var.${r}`).join(', ') : 'expr'}</span></div>)}
            {store.dependencies().length === 0 && <span style={{ fontSize: 10, color: 'var(--color-on-surface-variant)' }}>{L('لا روابط بعد', 'No bindings yet')}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
