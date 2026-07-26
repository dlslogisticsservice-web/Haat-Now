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

let seq = 0;
const uid = (p = 'n') => `${p}_${++seq}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

interface State { root: BuilderNode; masters: MasterComponent[]; }
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
  private state: State = { root: { id: 'root', specId: '__root__', props: {}, children: [] }, masters: [] };
  private selectedId: string | null = null;
  private breakpoint: Breakpoint = 'desktop';
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private listeners = new Set<Listener>();

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

  subscribe(l: Listener): () => void { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  private emit(): void { this.listeners.forEach(l => l()); }
}
