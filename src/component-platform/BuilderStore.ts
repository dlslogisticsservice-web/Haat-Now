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

let seq = 0;
const uid = (p = 'n') => `${p}_${++seq}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// Design-time state (undoable): the tree, reusable masters, variables, data sources, workflows.
interface State { root: BuilderNode; masters: MasterComponent[]; variables: Variable[]; dataSources: DataSource[]; workflows: Workflow[]; }
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
  private state: State = { root: { id: 'root', specId: '__root__', props: {}, children: [] }, masters: [], variables: [], dataSources: defaultDataSources(), workflows: [] };
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
    const base = { state: this.appState, data: dataScope(this.state.dataSources), theme: { primary: 'primary', surface: 'surface' }, ctx: this.ctx };
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

  subscribe(l: Listener): () => void { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  private emit(): void { this.listeners.forEach(l => l()); }
}
