// ─────────────────────────────────────────────────────────────────────────────
// Runtime Reconciler (Phase 8E · Runtime Edit Session Engine).
//
// Projects the Runtime Edit Store onto the live runtime. Because the real app components
// are production code (not Studio-aware — editing them would violate feature isolation),
// the store is authoritative and this reconciler keeps the rendered runtime consistent
// with it: whenever React re-renders the runtime (carousel rotation, navigation, any
// update) the reconciler re-applies the stored edits, so edits never disappear during the
// session. This replaces Phase 8D's scattered one-shot writes with ONE store-driven,
// re-applied projection — the store is the single source of truth.
//
// Local-only. No persistence. Re-application is idempotent and self-excluded from the
// MutationObserver (disconnect during apply) to avoid loops.
// ─────────────────────────────────────────────────────────────────────────────
import { componentsFor } from '../../runtime/selection/componentMap';
import { writeBinding } from './runtimeWriter';
import { instanceKeyOf } from './runtimeInstance';
import type { RuntimeEditStore, RuntimeTransaction } from '../../runtime/selection/EditStore';

/**
 * Project each transaction's APPLIED value onto the EXACT instance it targets (Phase 8F — no
 * sibling spill). appliedValue is always the last VALID value (Phase 8G): an invalid or pending
 * transaction carries the previous valid value, so a rejected edit leaves the runtime unchanged.
 */
export function applyEdits(root: Element, txns: RuntimeTransaction[]): void {
  for (const tx of txns) {
    const comp = componentsFor(tx.channel, tx.screen).find(m => m.metadata.id === tx.componentId);
    if (!comp) continue;
    const prop = comp.metadata.editableProps.find(p => p.key === tx.propKey);
    if (!prop) continue;
    if (prop.type === 'color') { writeBinding(root, prop, tx.appliedValue, root); continue; } // theme var on the root
    // Re-locate the SPECIFIC instance by its stable key among all candidates of this type.
    const candidates = Array.from(root.querySelectorAll(comp.match));
    const target = candidates.find(el => instanceKeyOf(el) === tx.instanceKey);
    if (target) writeBinding(target, prop, tx.appliedValue, root);
  }
}

/** Keeps a runtime root consistent with the edit store across every re-render. */
export class RuntimeReconciler {
  private observer: MutationObserver | null = null;
  private unsub: (() => void) | null = null;

  constructor(private root: Element, private store: RuntimeEditStore) {}

  start(): void {
    this.reconcile();
    // Reconcile SYNCHRONOUSLY in the observer callback (a microtask that runs BEFORE the
    // browser paints the mutation), so a re-rendered value is corrected before it is ever
    // visible — no flicker. The MutationObserver batches mutations into one callback, so this
    // is one reconcile per render batch, and only when edits exist.
    this.observer = new MutationObserver(() => this.reconcile());
    this.observer.observe(this.root, { childList: true, subtree: true, characterData: true });
    this.unsub = this.store.subscribe(() => this.reconcile());
  }

  stop(): void {
    this.observer?.disconnect(); this.observer = null;
    this.unsub?.(); this.unsub = null;
  }

  private reconcile(): void {
    if (!this.store.count()) return;
    // Exclude our own writes from the observer to avoid a reconcile loop.
    this.observer?.disconnect();
    try { applyEdits(this.root, this.store.all()); }
    finally { this.observer?.observe(this.root, { childList: true, subtree: true, characterData: true }); }
  }
}
