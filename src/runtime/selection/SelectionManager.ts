// ─────────────────────────────────────────────────────────────────────────────
// Selection Manager (Phase 8A · Runtime Selection Layer).
//
// Framework-agnostic store for the current hover + selection, with a subscribe/notify
// bus so the overlay and the inspector react to changes. Pure TypeScript — no React, no
// DOM, no fiber. This is the foundation future sprints (editing, bindings, drag & drop)
// build on: they subscribe here; they never touch React internals.
// ─────────────────────────────────────────────────────────────────────────────
import type { RuntimeNode, RuntimeSelectionState } from './RuntimeNode';

type Listener = (state: RuntimeSelectionState) => void;

export class SelectionManager {
  private hover: RuntimeNode | null = null;
  private selected: RuntimeNode | null = null;
  private history: RuntimeNode[] = [];
  private listeners = new Set<Listener>();

  getState(): RuntimeSelectionState {
    return { hover: this.hover, selected: this.selected };
  }

  getSelected(): RuntimeNode | null { return this.selected; }
  getHover(): RuntimeNode | null { return this.hover; }
  getHistory(): RuntimeNode[] { return [...this.history]; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(): void {
    const state = this.getState();
    this.listeners.forEach(l => l(state));
  }

  setHover(node: RuntimeNode | null): void {
    if (this.hover?.id !== node?.id) { this.hover = node; this.emit(); }
  }

  /** Select a node (or null to deselect). Records selection history. */
  select(node: RuntimeNode | null): void {
    if (this.selected?.id === node?.id) return;
    this.selected = node;
    if (node) this.history.push(node);
    this.emit();
  }

  /** Clear both hover and selection (e.g. Escape, screen switch, click-empty). */
  clear(): void {
    if (this.selected || this.hover) { this.selected = null; this.hover = null; this.emit(); }
  }
}
