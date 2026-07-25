// ─────────────────────────────────────────────────────────────────────────────
// Runtime Edit Store (Phase 8E · Runtime Edit Session Engine).
//
// The single source of truth for LOCAL runtime edits. It holds the edited value for each
// (node, property) and notifies subscribers on change. It is pure state — no DOM, no React,
// no persistence (no store/CMS/Supabase/API/localStorage/sessionStorage). A reconciler
// (features/admin/runtimeReconciler) projects this store onto the live runtime after every
// render, so edits survive React re-renders while the components themselves stay untouched.
//
// Each Studio session owns one store; changing channel clears it; a page refresh drops it.
// Future phases (undo / redo / history / save / publish) build on this store.
// ─────────────────────────────────────────────────────────────────────────────

export interface RuntimeEdit {
  /** RuntimeNode id the edit belongs to. */
  nodeId: string;
  channel: string;
  screen: string;
  /** Declared component id (looked up in the component map to re-locate + apply). */
  componentId: string;
  /** Phase 8F — the exact instance this edit targets (never spills to sibling instances). */
  instanceKey: string;
  /** Editable-property key. */
  propKey: string;
  value: string | boolean;
}

type Listener = () => void;

export class RuntimeEditStore {
  private edits = new Map<string, RuntimeEdit>();
  private listeners = new Set<Listener>();

  private key(nodeId: string, propKey: string): string { return `${nodeId}::${propKey}`; }

  /** Add or replace an edit. Notifies subscribers (the reconciler re-projects). */
  set(edit: RuntimeEdit): void {
    this.edits.set(this.key(edit.nodeId, edit.propKey), edit);
    this.emit();
  }

  get(nodeId: string, propKey: string): RuntimeEdit | undefined {
    return this.edits.get(this.key(nodeId, propKey));
  }

  all(): RuntimeEdit[] { return [...this.edits.values()]; }
  count(): number { return this.edits.size; }

  /** Dispose the session's edits (channel change / session end). */
  clear(): void { if (this.edits.size) { this.edits.clear(); this.emit(); } }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(): void { this.listeners.forEach(l => l()); }
}
