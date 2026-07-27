// ─────────────────────────────────────────────────────────────────────────────
// Builder Store (Phase 9A).
//
// The session store for the Visual Builder: a tree of component instances plus saved reusable
// (master) components. It owns every tree op the drag & drop and inspector drive — insert, move,
// reorder, nest, duplicate, delete, wrap, unwrap — plus responsive per-breakpoint overrides and
// the master → instance → override → sync/detach lifecycle. Undo/redo via structural snapshots.
// Session-only, no persistence. Rendering is done by the registry's component render fns — no
// second rendering engine.
// ─────────────────────────────────────────────────────────────────────────────
import { getComponent } from './registry';
import type { BuilderNode, MasterComponent, Breakpoint } from './types';
import { evaluate, interpolate, hasBinding, type Scope } from './logic/expression';
import { defaultDataSources, dataScope } from './logic/dataSources';
import type { Variable, Binding, ActionSpec, Condition, Validator, Workflow, WorkflowTraceStep, DataSource } from './logic/logicTypes';
import { defaultFields, mockRecords, did, type Entity, type Field, type Relation, type Collection, type Permission, type QuerySpec, type DataRecord, type AuditEntry, type SchemaVersion } from './data/dataModel';
import { runQuery, type QueryResult } from './data/queryEngine';
import { validateRecord as validateRec, type FieldValidation, type ValidationError } from './data/fieldValidation';
import { generateSeed } from './data/seedGenerator';
import { schemaSQL, migrationSQL, insertsSQL } from './data/sqlGenerator';
import { mapColumns, detectDuplicates, toCSV, toJSON } from './data/importExport';
import { buildHaatModels } from './data/haatSchema';
import { health as healthReport, type HealthReport } from './data/analyzer';

let seq = 0;
const uid = (p = 'n') => `${p}_${++seq}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// Design-time state (undoable): tree, masters, variables, data sources, workflows, and the data
// SCHEMA (entities/relations/collections/schema versions). Phase 9E — record ROWS are kept OUT of
// this snapshot (in recordStore) so undo/redo + every design-time op stays O(schema), not O(rows):
// snapshotting the design model never serializes 100k data rows.
interface State {
  root: BuilderNode; masters: MasterComponent[]; variables: Variable[]; dataSources: DataSource[]; workflows: Workflow[];
  entities: Entity[]; relations: Relation[]; collections: Collection[];
  schemaVersions: Record<string, SchemaVersion[]>;
  /** Phase G2.1 — the active design theme (token → value), applied by the canvas. Undoable. */
  theme: Record<string, string>;
}
type Listener = () => void;

/** Build a fresh node for a spec, seeded with the spec's default props. */
export function makeNode(specId: string): BuilderNode | null {
  const spec = getComponent(specId);
  if (!spec) return null;
  return { id: uid('n'), specId, props: { ...spec.defaultProps }, children: [] };
}

/** Deep-clone a subtree with fresh ids (used by duplicate / detach / insert-instance). */
function reid(node: BuilderNode): BuilderNode {
  return { ...clone(node), id: uid('n'), children: (node.children || []).map(reid) };
}

export class BuilderStore {
  private state: State = { root: { id: 'root', specId: '__root__', props: {}, children: [] }, masters: [], variables: [], dataSources: defaultDataSources(), workflows: [], entities: [], relations: [], collections: [], schemaVersions: {}, theme: {} };
  // Data rows — a separate store OUTSIDE the undo snapshot (Phase 9E memory/perf hardening).
  private recordStore: Record<string, DataRecord[]> = {};
  // Phase G2.1 — AI generation log (not undoable; the generated artifacts are undoable via state).
  private aiLog: { at: number; action: string; detail: string }[] = [];
  // Phase G2.2 — learned project preferences (session meta; drives consistent AI suggestions).
  private prefs: Record<string, string> = {};
  // Data-platform runtime (not undoable): audit log + realtime sync queue.
  private auditLog: AuditEntry[] = [];
  private syncQueue: { op: string; entity: string; recordId: string }[] = [];
  private online = true;
  private selectedId: string | null = null;
  private breakpoint: Breakpoint = 'desktop';
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private listeners = new Set<Listener>();
  // Runtime (execution) state — NOT part of the undo snapshot (these are results of running logic).
  private appState: Record<string, unknown> = {};
  private stateTimeline: { at: number; key: string; value: string }[] = [];
  private actionLog: string[] = [];
  private ctx = { role: 'customer', country: 'SA', lang: 'en', tenant: 'haat' };
  private activeScreen = 'home';
  private lastToast = '';

  // ── undo/redo (structural snapshots of the whole state) ──
  private snap(): void { this.undoStack.push(JSON.stringify(this.state)); if (this.undoStack.length > 100) this.undoStack.shift(); this.redoStack = []; }
  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }
  undo(): void { const s = this.undoStack.pop(); if (!s) return; this.redoStack.push(JSON.stringify(this.state)); this.state = JSON.parse(s); this.emit(); }
  redo(): void { const s = this.redoStack.pop(); if (!s) return; this.undoStack.push(JSON.stringify(this.state)); this.state = JSON.parse(s); this.emit(); }

  // ── selection / breakpoint (UI state, not undoable) ──
  getRoot(): BuilderNode { return this.state.root; }
  getSelectedId(): string | null { return this.selectedId; }
  getSelected(): BuilderNode | null { return this.selectedId ? this.find(this.selectedId)?.node ?? null : null; }
  select(id: string | null): void { this.selectedId = id; this.emit(); }
  getBreakpoint(): Breakpoint { return this.breakpoint; }
  setBreakpoint(bp: Breakpoint): void { this.breakpoint = bp; this.emit(); }
  count(): number { let c = 0; this.walk(this.state.root, () => c++); return c - 1; }

  // ── traversal ──
  private walk(node: BuilderNode, fn: (n: BuilderNode, parent: BuilderNode | null) => void, parent: BuilderNode | null = null): void {
    fn(node, parent);
    for (const ch of node.children) this.walk(ch, fn, node);
  }
  find(id: string): { node: BuilderNode; parent: BuilderNode | null; index: number } | null {
    let hit: { node: BuilderNode; parent: BuilderNode | null; index: number } | null = null;
    const rec = (node: BuilderNode, parent: BuilderNode | null) => {
      const idx = parent ? parent.children.indexOf(node) : -1;
      if (node.id === id) hit = { node, parent, index: idx };
      else for (const ch of node.children) if (!hit) rec(ch, node);
    };
    rec(this.state.root, null);
    return hit;
  }
  private canContain(node: BuilderNode): boolean {
    if (node.id === 'root') return true;
    return !!getComponent(node.specId)?.container;
  }

  // ── insert / move / reorder / nest ──
  /** Insert a NEW component. parentId defaults to root; index defaults to end. Returns the new id. */
  insert(specId: string, parentId = 'root', index?: number): string | null {
    const node = makeNode(specId); if (!node) return null;
    const target = this.find(parentId)?.node; if (!target || !this.canContain(target)) return null;
    this.snap();
    const at = index == null ? target.children.length : Math.max(0, Math.min(index, target.children.length));
    target.children.splice(at, 0, node);
    this.selectedId = node.id;
    this.emit();
    return node.id;
  }
  /** Move an existing node under a new parent at an index (drag reorder / nest). */
  move(id: string, newParentId: string, index?: number): void {
    if (id === newParentId) return;
    const loc = this.find(id); const dest = this.find(newParentId)?.node;
    if (!loc || !loc.parent || !dest || !this.canContain(dest)) return;
    // Guard: cannot move a node into its own descendant.
    let anc: BuilderNode | null = dest; while (anc) { if (anc.id === id) return; anc = this.find(anc.id)?.parent ?? null; }
    this.snap();
    loc.parent.children.splice(loc.index, 1);
    const at = index == null ? dest.children.length : Math.max(0, Math.min(index, dest.children.length));
    dest.children.splice(at, 0, loc.node);
    this.emit();
  }
  reorder(id: string, dir: -1 | 1): void {
    const loc = this.find(id); if (!loc || !loc.parent) return;
    const j = loc.index + dir; if (j < 0 || j >= loc.parent.children.length) return;
    this.snap();
    const arr = loc.parent.children; [arr[loc.index], arr[j]] = [arr[j], arr[loc.index]];
    this.emit();
  }
  duplicate(id: string): void {
    const loc = this.find(id); if (!loc || !loc.parent) return;
    this.snap();
    loc.parent.children.splice(loc.index + 1, 0, reid(loc.node));
    this.emit();
  }
  remove(id: string): void {
    const loc = this.find(id); if (!loc || !loc.parent) return;
    this.snap();
    loc.parent.children.splice(loc.index, 1);
    if (this.selectedId === id) this.selectedId = null;
    this.emit();
  }
  /** Wrap a node in a container (default Stack). */
  wrap(id: string, containerSpecId = 'stack'): void {
    const loc = this.find(id); if (!loc || !loc.parent) return;
    const wrapper = makeNode(containerSpecId); if (!wrapper) return;
    this.snap();
    wrapper.children = [loc.node];
    loc.parent.children.splice(loc.index, 1, wrapper);
    this.selectedId = wrapper.id;
    this.emit();
  }
  /** Unwrap a container — replace it with its children in the parent. */
  unwrap(id: string): void {
    const loc = this.find(id); if (!loc || !loc.parent || !loc.node.children.length) return;
    this.snap();
    loc.parent.children.splice(loc.index, 1, ...loc.node.children);
    this.selectedId = null;
    this.emit();
  }

  // ── property / responsive / a11y / meta edits ──
  setProp(id: string, key: string, value: unknown): void {
    const node = this.find(id)?.node; if (!node) return;
    this.snap();
    // On an instance, prop edits become LOCAL OVERRIDES; otherwise they edit the node directly.
    if (node.masterId) { node.overrides = { ...(node.overrides || {}), [key]: value }; }
    else { node.props = { ...node.props, [key]: value }; }
    this.emit();
  }
  setResponsive(id: string, bp: Breakpoint, key: string, value: unknown): void {
    const node = this.find(id)?.node; if (!node) return;
    this.snap();
    node.responsive = { ...(node.responsive || {}) };
    node.responsive[bp] = { ...(node.responsive[bp] || {}), [key]: value };
    this.emit();
  }
  setA11y(id: string, patch: { label?: string; role?: string }): void {
    const node = this.find(id)?.node; if (!node) return;
    this.snap(); node.a11y = { ...(node.a11y || {}), ...patch }; this.emit();
  }
  setMeta(id: string, patch: { name?: string; hidden?: boolean; locked?: boolean }): void {
    const node = this.find(id)?.node; if (!node) return;
    this.snap(); node.meta = { ...(node.meta || {}), ...patch }; this.emit();
  }

  // ── reusable components (master / instance) ──
  masters(): MasterComponent[] { return this.state.masters; }
  getMaster(id: string): MasterComponent | undefined { return this.state.masters.find(m => m.id === id); }
  /** Save a node's subtree as a reusable master; the node becomes an instance of it. */
  saveAsComponent(id: string, name: string): MasterComponent | null {
    const loc = this.find(id); if (!loc) return null;
    this.snap();
    const master: MasterComponent = { id: uid('m'), name: name || `Component ${this.state.masters.length + 1}`, version: 1, root: reid(loc.node), createdAt: Date.now() };
    this.state.masters.push(master);
    // Convert the original node into an instance.
    loc.node.masterId = master.id; loc.node.overrides = {}; loc.node.children = [];
    this.emit();
    return master;
  }
  insertInstance(masterId: string, parentId = 'root', index?: number): string | null {
    const master = this.getMaster(masterId); if (!master) return null;
    const target = this.find(parentId)?.node; if (!target || !this.canContain(target)) return null;
    this.snap();
    const inst: BuilderNode = { id: uid('n'), specId: master.root.specId, props: {}, children: [], masterId, overrides: {} };
    const at = index == null ? target.children.length : index;
    target.children.splice(at, 0, inst);
    this.selectedId = inst.id;
    this.emit();
    return inst.id;
  }
  renameMaster(masterId: string, name: string): void { const m = this.getMaster(masterId); if (m) { this.snap(); m.name = name; this.emit(); } }
  /** Edit the master itself — updates EVERY instance that has not overridden that key. */
  editMaster(masterId: string, key: string, value: unknown): void {
    const m = this.getMaster(masterId); if (!m) return;
    this.snap(); m.root = { ...m.root, props: { ...m.root.props, [key]: value } }; m.version += 1; this.emit();
  }
  /** Detach an instance — expand it into an independent copy of the master subtree. */
  detach(id: string): void {
    const loc = this.find(id); if (!loc || !loc.node.masterId) return;
    const master = this.getMaster(loc.node.masterId); if (!master) return;
    this.snap();
    const copy = reid(master.root);
    // Preserve any local overrides on the detached root.
    copy.props = { ...copy.props, ...(loc.node.overrides || {}) };
    if (loc.parent) loc.parent.children.splice(loc.index, 1, copy);
    this.selectedId = copy.id;
    this.emit();
  }
  /** Sync / Restore — drop an instance's local overrides so it mirrors the master again. */
  restoreInstance(id: string): void {
    const node = this.find(id)?.node; if (!node || !node.masterId) return;
    this.snap(); node.overrides = {}; this.emit();
  }
  /** The effective props for an instance (master props + local overrides). */
  resolveInstanceProps(node: BuilderNode): Record<string, unknown> {
    if (!node.masterId) return node.props;
    const m = this.getMaster(node.masterId);
    return { ...(m?.root.props || {}), ...(node.overrides || {}) };
  }
  /** The subtree an instance renders (the master's children). */
  resolveInstanceChildren(node: BuilderNode): BuilderNode[] {
    if (!node.masterId) return node.children;
    return this.getMaster(node.masterId)?.root.children || [];
  }

  // ═══ Phase 9B · Application Logic ═══════════════════════════════════════════
  // ── Variables ──
  variables(): Variable[] { return this.state.variables; }
  addVariable(v: Omit<Variable, 'id'>): Variable { this.snap(); const nv: Variable = { ...v, id: uid('v') }; this.state.variables.push(nv); this.emit(); return nv; }
  updateVariable(id: string, patch: Partial<Variable>): void { const v = this.state.variables.find(x => x.id === id); if (v) { this.snap(); Object.assign(v, patch); this.emit(); } }
  removeVariable(id: string): void { this.snap(); this.state.variables = this.state.variables.filter(v => v.id !== id); this.emit(); }

  // ── App state (extends this ONE store — no second state store) ──
  getState(): Record<string, unknown> { return this.appState; }
  setState(key: string, value: unknown): void {
    this.appState = { ...this.appState, [key]: value };
    this.stateTimeline = [...this.stateTimeline, { at: Date.now(), key, value: JSON.stringify(value) }].slice(-60);
    this.emit();
  }
  timeline(): { at: number; key: string; value: string }[] { return [...this.stateTimeline].reverse(); }
  ctxInfo() { return this.ctx; }
  setCtx(patch: Partial<typeof this.ctx>): void { this.ctx = { ...this.ctx, ...patch }; this.emit(); }
  log(): string[] { return [...this.actionLog].reverse().slice(0, 40); }
  getActiveScreen(): string { return this.activeScreen; }
  getLastToast(): string { return this.lastToast; }
  dataSources(): DataSource[] { return this.state.dataSources; }

  /** The evaluation scope shared by bindings, conditions, computed variables and expressions. */
  scope(): Scope {
    const vars: Record<string, unknown> = {};
    // Phase 9C — expose entity records as `db.<entity>`. Phase 9E — LAZY: each entity's rows are
    // filtered only when an expression actually reads db.<entity>, so bindings that use var.*/state.*
    // (the vast majority) never pay the O(rows) cost — evaluation stays O(1) regardless of data size.
    const db: Record<string, unknown> = {};
    const cache: Record<string, unknown> = {};
    for (const e of this.state.entities) {
      const key = e.name.toLowerCase();
      Object.defineProperty(db, key, { enumerable: true, configurable: true, get: () => (key in cache ? cache[key] : (cache[key] = this.records(e.id))) });
    }
    const base = { state: this.appState, data: dataScope(this.state.dataSources), db, theme: { primary: 'primary', surface: 'surface' }, ctx: this.ctx };
    for (const v of this.state.variables) {
      if (v.scope === 'computed' && v.computed) { const r = evaluate(v.computed, { var: vars, ...base }); vars[v.name] = r.ok ? r.value : undefined; }
      else vars[v.name] = v.value;
    }
    return { var: vars, ...base };
  }
  /** Evaluate an arbitrary expression against the live scope (the Live Debugger's evaluator). */
  evalExpr(expr: string) { return evaluate(expr, this.scope()); }

  // ── Bindings ──
  setBinding(nodeId: string, propKey: string, binding: Binding): void { const n = this.find(nodeId)?.node; if (!n) return; this.snap(); n.bindings = { ...(n.bindings || {}), [propKey]: binding }; this.emit(); }
  removeBinding(nodeId: string, propKey: string): void { const n = this.find(nodeId)?.node; if (!n?.bindings) return; this.snap(); const b = { ...n.bindings }; delete b[propKey]; n.bindings = b; this.emit(); }
  /** Effective render props for a node: defaults → props → responsive → resolved bindings. */
  effectiveProps(node: BuilderNode, spec: { defaultProps: Record<string, unknown> }): Record<string, unknown> {
    const base = node.masterId ? this.resolveInstanceProps(node) : { ...spec.defaultProps, ...node.props };
    const out: Record<string, unknown> = { ...base, ...(node.responsive?.[this.breakpoint] || {}) };
    if (node.bindings) {
      const sc = this.scope();
      for (const [k, binding] of Object.entries(node.bindings)) {
        const r = evaluate(binding.expr, sc);
        out[k] = r.ok && r.value != null && r.value !== '' ? r.value : (binding.fallback ?? out[k]);
      }
    }
    // Interpolate {{ }} inside string props.
    for (const k of Object.keys(out)) if (hasBinding(out[k])) out[k] = interpolate(String(out[k]), this.scope());
    return out;
  }

  // ── Conditional logic ──
  setConditions(nodeId: string, conditions: Condition[]): void { const n = this.find(nodeId)?.node; if (!n) return; this.snap(); n.conditions = conditions; this.emit(); }
  evalConditions(node: BuilderNode): { visible: boolean; enabled: boolean } {
    let visible = true, enabled = true;
    if (node.conditions?.length) { const sc = this.scope(); for (const c of node.conditions) { const r = evaluate(c.expr, sc); const ok = !!(r.ok && r.value); if (c.target === 'visible') visible = visible && ok; else enabled = enabled && ok; } }
    return { visible, enabled };
  }

  // ── Validators (form engine) ──
  setValidators(nodeId: string, validators: Validator[]): void { const n = this.find(nodeId)?.node; if (!n) return; this.snap(); n.validators = validators; this.emit(); }
  validateField(node: BuilderNode, value: string): string | null {
    for (const v of node.validators || []) {
      const s = String(value ?? '');
      if (v.kind === 'required' && s.trim() === '') return v.message || 'Required';
      if (s === '') continue;
      if (v.kind === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return v.message || 'Invalid email';
      if (v.kind === 'phone' && !/^\+?[0-9\s-]{7,15}$/.test(s)) return v.message || 'Invalid phone';
      if (v.kind === 'min' && s.length < Number(v.value)) return v.message || `Min ${v.value} chars`;
      if (v.kind === 'max' && s.length > Number(v.value)) return v.message || `Max ${v.value} chars`;
      if (v.kind === 'regex' && v.value && !(() => { try { return new RegExp(String(v.value)).test(s); } catch { return true; } })()) return v.message || 'Invalid format';
      if (v.kind === 'custom' && v.value) { const r = evaluate(String(v.value), { ...this.scope(), value: s }); if (r.ok && !r.value) return v.message || 'Invalid'; }
    }
    return null;
  }

  // ── Actions ──
  addAction(nodeId: string, action: Omit<ActionSpec, 'id'>): void { const n = this.find(nodeId)?.node; if (!n) return; this.snap(); n.actions = [...(n.actions || []), { ...action, id: uid('a') }]; this.emit(); }
  removeAction(nodeId: string, actionId: string): void { const n = this.find(nodeId)?.node; if (!n?.actions) return; this.snap(); n.actions = n.actions.filter(a => a.id !== actionId); this.emit(); }
  /** Execute a node's actions for an event (Run mode). Records to the action log + debugger. */
  runActions(nodeId: string, event = 'click'): void {
    const n = this.find(nodeId)?.node; if (!n?.actions) return;
    for (const a of n.actions.filter(x => x.event === event)) this.execAction(a);
    this.emit();
  }
  private execAction(a: ActionSpec): void {
    const sc = this.scope();
    const p = a.params;
    const val = (raw: unknown) => { const e = evaluate(String(raw ?? ''), sc); return e.ok ? e.value : raw; };
    switch (a.type) {
      case 'setVariable': { const v = this.state.variables.find(x => x.name === p.name); if (v) v.value = 'expr' in p ? val(p.expr) : p.value; this.actionLog.push(`setVariable ${p.name} = ${JSON.stringify(v?.value)}`); break; }
      case 'updateState': { this.setState(String(p.key), 'expr' in p ? val(p.expr) : p.value); this.actionLog.push(`updateState ${p.key}`); break; }
      case 'navigate': { this.activeScreen = String(p.screen ?? 'home'); this.actionLog.push(`navigate → ${this.activeScreen}`); break; }
      case 'toast': case 'snackbar': { this.lastToast = interpolate(String(p.message ?? ''), sc); this.actionLog.push(`${a.type}: ${this.lastToast}`); break; }
      default: this.actionLog.push(`${a.type}${p.message ? `: ${p.message}` : ''}`);
    }
    this.actionLog = this.actionLog.slice(-40);
  }

  // ── Workflows ──
  workflows(): Workflow[] { return this.state.workflows; }
  addWorkflow(name: string): Workflow { this.snap(); const wf: Workflow = { id: uid('wf'), name: name || `Flow ${this.state.workflows.length + 1}`, nodes: [{ id: uid('wn'), type: 'start', label: 'Start', config: {} }, { id: uid('wn'), type: 'finish', label: 'Finish', config: {} }] }; this.state.workflows.push(wf); this.emit(); return wf; }
  addWorkflowNode(wfId: string, type: Workflow['nodes'][number]['type'], config: Record<string, unknown> = {}): void {
    const wf = this.state.workflows.find(w => w.id === wfId); if (!wf) return;
    this.snap();
    const insertAt = Math.max(1, wf.nodes.length - 1); // before Finish
    wf.nodes.splice(insertAt, 0, { id: uid('wn'), type, label: type[0].toUpperCase() + type.slice(1), config });
    this.emit();
  }
  removeWorkflow(id: string): void { this.snap(); this.state.workflows = this.state.workflows.filter(w => w.id !== id); this.emit(); }
  /** Run a workflow and return a debug trace (Flow Debugger). Also applies variable/state effects. */
  runWorkflow(id: string): WorkflowTraceStep[] {
    const wf = this.state.workflows.find(w => w.id === id); if (!wf) return [];
    const trace: WorkflowTraceStep[] = [];
    for (const node of wf.nodes) {
      let result = 'ok';
      if (node.type === 'variable') { const v = this.state.variables.find(x => x.name === node.config.name); if (v) { v.value = 'expr' in node.config ? (this.evalExpr(String(node.config.expr)).value) : node.config.value; result = `${node.config.name}=${JSON.stringify(v.value)}`; } else result = 'variable not found'; }
      else if (node.type === 'condition') { const r = this.evalExpr(String(node.config.expr ?? 'true')); result = r.ok ? `→ ${r.value ? 'true' : 'false'}` : `error: ${r.error}`; }
      else if (node.type === 'action') { this.actionLog.push(`workflow action: ${node.config.label ?? ''}`); result = 'ran'; }
      else if (node.type === 'delay') result = `waited ${node.config.ms ?? 0}ms`;
      else if (node.type === 'finish') result = 'done';
      trace.push({ nodeId: node.id, type: node.type, label: node.label, result });
    }
    this.emit();
    return trace;
  }

  /** Dependency graph — which nodes bind to which variables (Live Debugger). */
  dependencies(): { nodeId: string; spec: string; refs: string[] }[] {
    const varNames = this.state.variables.map(v => v.name);
    const out: { nodeId: string; spec: string; refs: string[] }[] = [];
    this.walk(this.state.root, (n) => {
      if (n.id === 'root' || !n.bindings) return;
      const exprs = Object.values(n.bindings).map(b => b.expr).join(' ');
      const refs = varNames.filter(name => new RegExp(`\\bvar\\.${name}\\b`).test(exprs));
      if (Object.keys(n.bindings).length) out.push({ nodeId: n.id, spec: n.specId, refs });
    });
    return out;
  }

  // ═══ Phase 9C · Visual Data Platform ════════════════════════════════════════
  private audit(op: string, entity: string, recordId: string, detail = ''): void {
    this.auditLog = [...this.auditLog, { at: Date.now(), op, entity, recordId, actor: this.ctx.role, detail }].slice(-200);
    this.syncQueue.push({ op, entity, recordId });
    if (this.online) this.syncQueue = []; // flushed immediately when "online"
  }
  auditEntries(): AuditEntry[] { return [...this.auditLog].reverse(); }
  syncPending(): number { return this.syncQueue.length; }
  isOnline(): boolean { return this.online; }
  setOnline(v: boolean): void { this.online = v; if (v) this.syncQueue = []; this.emit(); } // reconnect flushes the queue

  // ── Entities ──
  entities(): Entity[] { return this.state.entities; }
  getEntity(id: string): Entity | undefined { return this.state.entities.find(e => e.id === id); }
  addEntity(name: string): Entity {
    this.snap();
    const e: Entity = { id: did('e'), name: name || `Entity${this.state.entities.length + 1}`, icon: 'Database', color: '#a3f95b', tags: [], system: false, version: 1, fields: defaultFields(), mapping: { provider: 'local', target: (name || 'entity').toLowerCase(), reuses: '—' }, permissions: (['create', 'read', 'update', 'delete'] as const).map(op => ({ id: did('p'), op, role: 'any' })) };
    this.state.entities.push(e);
    this.recordStore[e.id] = mockRecords(e, this.ctx.tenant, 6);
    this.emit();
    return e;
  }
  updateEntity(id: string, patch: Partial<Entity>): void { const e = this.getEntity(id); if (e) { this.snap(); Object.assign(e, patch); e.version += 1; this.emit(); } }
  removeEntity(id: string): void { this.snap(); this.state.entities = this.state.entities.filter(e => e.id !== id); delete this.recordStore[id]; this.state.relations = this.state.relations.filter(r => r.from !== id && r.to !== id); this.emit(); }

  // ── Fields ──
  addField(entityId: string, type: Field['type'], name: string): void { const e = this.getEntity(entityId); if (!e) return; this.snap(); e.fields.push({ id: did('f'), name: name || `field${e.fields.length}`, type, settings: { filterable: true, sortable: true } }); this.emit(); }
  updateField(entityId: string, fieldId: string, patch: Partial<Field> & { settings?: Partial<Field['settings']> }): void {
    const f = this.getEntity(entityId)?.fields.find(x => x.id === fieldId); if (!f) return; this.snap();
    if (patch.settings) f.settings = { ...f.settings, ...patch.settings };
    if (patch.name != null) f.name = patch.name; if (patch.type) f.type = patch.type;
    this.emit();
  }
  removeField(entityId: string, fieldId: string): void { const e = this.getEntity(entityId); if (!e) return; this.snap(); e.fields = e.fields.filter(f => f.id !== fieldId); this.emit(); }

  // ── Relations ──
  relations(): Relation[] { return this.state.relations; }
  addRelation(r: Omit<Relation, 'id'>): void { this.snap(); this.state.relations.push({ ...r, id: did('rel') }); this.emit(); }
  removeRelation(id: string): void { this.snap(); this.state.relations = this.state.relations.filter(r => r.id !== id); this.emit(); }

  // ── Collections ──
  collections(): Collection[] { return this.state.collections; }
  addCollection(c: Omit<Collection, 'id'>): void { this.snap(); this.state.collections.push({ ...c, id: did('c') }); this.emit(); }
  removeCollection(id: string): void { this.snap(); this.state.collections = this.state.collections.filter(c => c.id !== id); this.emit(); }

  // ── Permissions ──
  addPermission(entityId: string, perm: Omit<Permission, 'id'>): void { const e = this.getEntity(entityId); if (!e) return; this.snap(); e.permissions.push({ ...perm, id: did('p') }); this.emit(); }
  removePermission(entityId: string, permId: string): void { const e = this.getEntity(entityId); if (!e) return; this.snap(); e.permissions = e.permissions.filter(p => p.id !== permId); this.emit(); }
  /** Can the current role perform an op on an entity? (role 'any' / matching role, + optional expr.) */
  can(entityId: string, op: Permission['op']): boolean {
    const e = this.getEntity(entityId); if (!e) return false;
    const perms = e.permissions.filter(p => p.op === op);
    if (!perms.length) return false;
    return perms.some(p => (p.role === 'any' || p.role === this.ctx.role) && (!p.expr || !!this.evalExpr(p.expr).value));
  }

  // ── CRUD (tenant-isolated) ──
  /** Records for an entity, isolated to the current tenant; excludes soft-deleted by default. */
  records(entityId: string, opts: { includeDeleted?: boolean; includeArchived?: boolean } = {}): DataRecord[] {
    return (this.recordStore[entityId] || []).filter(r => r.tenantId === this.ctx.tenant && (opts.includeDeleted || !r._deleted) && (opts.includeArchived || !r._archived));
  }
  allRecordsRaw(entityId: string): DataRecord[] { return this.recordStore[entityId] || []; }
  createRecord(entityId: string, data: Record<string, unknown>): DataRecord | null {
    if (!this.can(entityId, 'create')) { this.audit('create-denied', entityId, '', `role ${this.ctx.role}`); this.emit(); return null; }
    this.snap();
    const rec: DataRecord = { id: did('r'), tenantId: this.ctx.tenant, _createdAt: this.stamp(), _updatedAt: this.stamp(), ...data };
    (this.recordStore[entityId] = this.recordStore[entityId] || []).push(rec);
    this.audit('create', entityId, rec.id); this.emit(); return rec;
  }
  updateRecord(entityId: string, id: string, patch: Record<string, unknown>): void { const r = this.allRecordsRaw(entityId).find(x => x.id === id); if (!r) return; this.snap(); Object.assign(r, patch, { _updatedAt: this.stamp() }); this.audit('update', entityId, id); this.emit(); }
  deleteRecord(entityId: string, id: string): void { this.snap(); this.recordStore[entityId] = this.allRecordsRaw(entityId).filter(r => r.id !== id); this.audit('delete', entityId, id); this.emit(); }
  softDelete(entityId: string, id: string): void { this.updateFlag(entityId, id, '_deleted', true, 'soft-delete'); }
  restore(entityId: string, id: string): void { this.updateFlag(entityId, id, '_deleted', false, 'restore'); }
  archive(entityId: string, id: string): void { this.updateFlag(entityId, id, '_archived', true, 'archive'); }
  unarchive(entityId: string, id: string): void { this.updateFlag(entityId, id, '_archived', false, 'unarchive'); }
  private updateFlag(entityId: string, id: string, flag: '_deleted' | '_archived', val: boolean, op: string): void { const r = this.allRecordsRaw(entityId).find(x => x.id === id); if (!r) return; this.snap(); r[flag] = val; r._updatedAt = this.stamp(); this.audit(op, entityId, id); this.emit(); }
  bulkUpdate(entityId: string, ids: string[], patch: Record<string, unknown>): void { this.snap(); for (const r of this.allRecordsRaw(entityId)) if (ids.includes(r.id)) Object.assign(r, patch, { _updatedAt: this.stamp() }); this.audit('bulk-update', entityId, ids.join(','), `${ids.length} rows`); this.emit(); }
  bulkDelete(entityId: string, ids: string[]): void { this.snap(); this.recordStore[entityId] = this.allRecordsRaw(entityId).filter(r => !ids.includes(r.id)); this.audit('bulk-delete', entityId, ids.join(','), `${ids.length} rows`); this.emit(); }
  duplicateRecord(entityId: string, id: string): void { const r = this.allRecordsRaw(entityId).find(x => x.id === id); if (!r) return; this.snap(); const copy = { ...clone(r), id: did('r'), _createdAt: this.stamp(), _updatedAt: this.stamp() }; this.allRecordsRaw(entityId).push(copy); this.audit('duplicate', entityId, copy.id); this.emit(); }
  importRecords(entityId: string, json: string): number { try { const arr = JSON.parse(json); if (!Array.isArray(arr)) return 0; this.snap(); const recs = arr.map((d: Record<string, unknown>) => ({ id: did('r'), tenantId: this.ctx.tenant, _createdAt: this.stamp(), _updatedAt: this.stamp(), ...d })); (this.recordStore[entityId] = this.recordStore[entityId] || []).push(...recs); this.audit('import', entityId, '', `${recs.length} rows`); this.emit(); return recs.length; } catch { return 0; } }
  exportRecords(entityId: string): string { return JSON.stringify(this.records(entityId), null, 2); }
  seedEntity(entityId: string, n = 6): void { const e = this.getEntity(entityId); if (!e) return; this.snap(); this.recordStore[entityId] = [...(this.recordStore[entityId] || []), ...mockRecords(e, this.ctx.tenant, n)]; this.audit('seed', entityId, '', `${n} rows`); this.emit(); }
  private stamp(): number { return Date.now(); }

  // ── Query (uses the ONE query engine + tenant isolation) ──
  query(spec: QuerySpec, opts: { includeDeleted?: boolean } = {}): QueryResult {
    const recs = this.records(spec.entityId, { includeDeleted: opts.includeDeleted, includeArchived: true });
    return runQuery(recs, spec, opts);
  }

  // ═══ Phase 9D · Enterprise Data Platform ════════════════════════════════════
  // ── Field validations ──
  setFieldValidations(entityId: string, fieldId: string, validations: FieldValidation[]): void { const f = this.getEntity(entityId)?.fields.find(x => x.id === fieldId); if (!f) return; this.snap(); f.validations = validations; this.emit(); }
  /** Validate one record against its entity's field validations (reuses the expression engine). */
  validateRecord(entityId: string, record: DataRecord): ValidationError[] { const e = this.getEntity(entityId); if (!e) return []; return validateRec(e, record, { all: this.records(entityId, { includeArchived: true }), lang: this.ctx.lang as 'ar' | 'en', scope: this.scope() }); }
  /** Total validation errors across all records of all entities (for the health dashboard).
   *  Builds the scope + per-entity record list ONCE (O(total records), not O(n²)). */
  validationErrorCount(): number {
    let n = 0; const scope = this.scope(); const lang = this.ctx.lang as 'ar' | 'en';
    for (const e of this.state.entities) {
      const all = this.records(e.id, { includeArchived: true });
      for (const r of all) n += validateRec(e, r, { all, lang, scope }).length;
    }
    return n;
  }

  // ── Schema versioning ──
  schemaVersions(entityId: string): SchemaVersion[] { return [...(this.state.schemaVersions[entityId] || [])].reverse(); }
  saveSchemaVersion(entityId: string, reason: string): void {
    const e = this.getEntity(entityId); if (!e) return; this.snap();
    const list = this.state.schemaVersions[entityId] = this.state.schemaVersions[entityId] || [];
    list.push({ version: list.length + 1, at: Date.now(), author: this.ctx.role, reason: reason || 'snapshot', snapshot: clone({ name: e.name, fields: e.fields, permissions: e.permissions, mapping: e.mapping }) });
    this.audit('schema-version', entityId, '', `v${list.length} ${reason}`); this.emit();
  }
  restoreSchemaVersion(entityId: string, version: number): void {
    const v = (this.state.schemaVersions[entityId] || []).find(x => x.version === version); const e = this.getEntity(entityId); if (!v || !e) return;
    this.snap(); e.fields = clone(v.snapshot.fields); e.permissions = clone(v.snapshot.permissions); e.mapping = clone(v.snapshot.mapping); e.name = v.snapshot.name; e.version += 1;
    this.audit('schema-restore', entityId, '', `→ v${version}`); this.emit();
  }
  /** Diff two captured schema versions by field name (added / removed / type-changed). */
  compareSchema(entityId: string, a: number, b: number): { field: string; change: string }[] {
    const list = this.state.schemaVersions[entityId] || [];
    const va = list.find(x => x.version === a), vb = list.find(x => x.version === b); if (!va || !vb) return [];
    const fa = new Map(va.snapshot.fields.map(f => [f.name, f])), fb = new Map(vb.snapshot.fields.map(f => [f.name, f]));
    const out: { field: string; change: string }[] = [];
    for (const [name, f] of fb) { if (!fa.has(name)) out.push({ field: name, change: `added (${f.type})` }); else if (fa.get(name)!.type !== f.type) out.push({ field: name, change: `${fa.get(name)!.type} → ${f.type}` }); }
    for (const [name] of fa) if (!fb.has(name)) out.push({ field: name, change: 'removed' });
    return out;
  }

  // ── ER diagram positions ──
  setEntityDiagram(entityId: string, x: number, y: number): void { const e = this.getEntity(entityId); if (!e) return; e.diagram = { x, y }; this.emit(); }
  autoLayout(): void { this.snap(); this.state.entities.forEach((e, i) => { e.diagram = { x: 40 + (i % 5) * 220, y: 40 + Math.floor(i / 5) * 160 }; }); this.emit(); }

  // ── Seed generator (scales to 10k+) ──
  generateSeed(entityId: string, n: number, seed = 42): number { const e = this.getEntity(entityId); if (!e) return 0; this.snap(); const recs = generateSeed(e, this.ctx.tenant, n, seed); this.recordStore[entityId] = [...(this.recordStore[entityId] || []), ...recs]; this.audit('seed-generate', entityId, '', `${n} rows`); this.emit(); return recs.length; }

  // ── SQL generation (never executes) ──
  entitiesSQL(): string { return schemaSQL(this.state.entities, this.state.relations); }
  migrationSQL(): { up: string; down: string } { return migrationSQL(this.state.entities, this.state.relations); }
  entityInsertsSQL(entityId: string): string { const e = this.getEntity(entityId); return e ? insertsSQL(e, this.records(entityId)) : ''; }

  // ── Import (with mapping, dedupe, validate, rollback) ──
  importRows(entityId: string, rows: Record<string, unknown>[], opts: { mapping?: Record<string, string>; dedupeKey?: string; conflict?: 'skip' | 'overwrite' } = {}): { imported: number; skipped: number; errors: string[]; rolledBack: boolean } {
    const e = this.getEntity(entityId); if (!e) return { imported: 0, skipped: 0, errors: ['entity not found'], rolledBack: false };
    let mapped = opts.mapping ? mapColumns(rows, opts.mapping) : rows;
    let skipped = 0;
    if (opts.dedupeKey) { const { dupes } = detectDuplicates(mapped, this.records(entityId, { includeArchived: true }), opts.dedupeKey); if (opts.conflict !== 'overwrite') { const set = new Set(dupes); mapped = mapped.filter((_, i) => !set.has(i)); skipped = dupes.length; } }
    // Validate BEFORE committing — any invalid row rolls the whole import back.
    const errors: string[] = [];
    mapped.forEach((r, i) => { const errs = validateRec(e, { id: 'x', tenantId: this.ctx.tenant, _createdAt: 0, _updatedAt: 0, ...r }); if (errs.length) errors.push(`row ${i + 1}: ${errs[0].message}`); });
    if (errors.length) return { imported: 0, skipped, errors, rolledBack: true };
    this.snap();
    const recs: DataRecord[] = mapped.map(r => ({ id: did('r'), tenantId: this.ctx.tenant, _createdAt: Date.now(), _updatedAt: Date.now(), ...r }));
    this.recordStore[entityId] = [...(this.recordStore[entityId] || []), ...recs];
    this.audit('import', entityId, '', `${recs.length} rows (${skipped} skipped)`); this.emit();
    return { imported: recs.length, skipped, errors: [], rolledBack: false };
  }

  // ── Export (csv / json / sql) ──
  exportEntity(entityId: string, format: 'csv' | 'json' | 'sql', rows?: DataRecord[]): string {
    const e = this.getEntity(entityId); if (!e) return '';
    const data = rows ?? this.records(entityId);
    if (format === 'sql') return insertsSQL(e, data);
    if (format === 'csv') return toCSV(data, e.fields.map(f => f.name));
    return toJSON(data);
  }

  // ── HAAT NOW canonical schema (one-click install) ──
  installHaatModels(seedPer = 8): number {
    this.snap();
    const { entities, relations } = buildHaatModels();
    // Skip entities that already exist by name (idempotent-ish).
    const existing = new Set(this.state.entities.map(e => e.name));
    const added = entities.filter(e => !existing.has(e.name));
    this.state.entities.push(...added);
    this.state.relations.push(...relations.filter(r => added.some(a => a.id === r.from) || added.some(a => a.id === r.to)));
    for (const e of added) this.recordStore[e.id] = generateSeed(e, this.ctx.tenant, seedPer, 7);
    this.audit('install-schema', '', '', `${added.length} HAAT entities`); this.emit();
    return added.length;
  }

  // ── Analyzer + health ──
  private recordCounts(): Record<string, number> { const m: Record<string, number> = {}; for (const e of this.state.entities) m[e.id] = this.records(e.id, { includeArchived: true }).length; return m; }
  health(): HealthReport { return healthReport({ entities: this.state.entities, relations: this.state.relations, recordCounts: this.recordCounts(), collections: this.state.collections.length, validationErrors: this.validationErrorCount() }); }

  // ═══ Phase G2.1 · AI layer support (theme + generation log) ═════════════════
  getTheme(): Record<string, string> { return this.state.theme; }
  /** Apply a theme (token → value). Undoable; the canvas projects it as CSS custom properties. */
  setTheme(vars: Record<string, string>): void { this.snap(); this.state.theme = { ...this.state.theme, ...vars }; this.emit(); }
  clearTheme(): void { if (Object.keys(this.state.theme).length) { this.snap(); this.state.theme = {}; this.emit(); } }
  /** Record an AI generation for the AI History panel (the artifacts themselves are undoable). */
  logAI(action: string, detail: string): void { this.aiLog = [...this.aiLog, { at: Date.now(), action, detail }].slice(-60); this.emit(); }
  aiHistory(): { at: number; action: string; detail: string }[] { return [...this.aiLog].reverse(); }
  // Phase G2.2 — learned preferences (the AI's learning layer; deterministic, session-scoped).
  getPreferences(): Record<string, string> { return this.prefs; }
  setPreferences(p: Record<string, string>): void { this.prefs = { ...this.prefs, ...p }; this.emit(); }

  subscribe(l: Listener): () => void { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  private emit(): void { this.listeners.forEach(l => l()); }
}
