// ─────────────────────────────────────────────────────────────────────────────
// Runtime Edit Store (Phase 8E · 8F · 8G).
//
// The single source of truth for LOCAL runtime edits. Phase 8G turns each edit into a managed
// TRANSACTION: the store validates every value, records the previous/current/applied values,
// stamps a dirty state, and appends to an in-memory, session-only transaction log. It is still
// pure state — no DOM, no React, no persistence (no store/CMS/Supabase/API/localStorage/
// sessionStorage). A reconciler (features/admin/runtimeReconciler) projects the APPLIED value
// of each transaction onto the live runtime after every render.
//
// Key invariants:
//   • Only a VALID value is applied to the runtime — an invalid edit is recorded (so the
//     Inspector shows the error) but appliedValue keeps the last valid value, so the runtime
//     stays stable and a rejected edit leaves it unchanged.
//   • Transactions are keyed by (nodeId, propKey); the node id is instance-scoped (Phase 8F),
//     so editing one instance never touches a sibling.
//   • previousValue is the baseline captured on the FIRST edit and never overwritten, so the
//     Inspector can always show original → current.
//
// Each Studio session owns one store; changing channel clears it; a page refresh drops it.
// ─────────────────────────────────────────────────────────────────────────────
import { componentsFor } from './componentMap';
import { validateValue } from './validation';

/** The lifecycle state of an edited instance/property, surfaced in the Inspector. */
export type DirtyState = 'clean' | 'pending' | 'dirty' | 'invalid' | 'resolved';

export interface RuntimeTransaction {
  /** Unique, monotonic per session — identifies this transaction in the log. */
  id: string;
  /** RuntimeNode id the edit belongs to (instance-scoped — Phase 8F). */
  nodeId: string;
  channel: string;
  screen: string;
  /** Declared component id (looked up in the component map to validate + re-locate + apply). */
  componentId: string;
  /** The exact instance this edit targets (never spills to sibling instances). */
  instanceKey: string;
  /** Editable-property key. */
  propKey: string;
  /** Baseline value, captured on the first edit and never overwritten. */
  previousValue: string | boolean;
  /** The value the user last entered (may be invalid). */
  currentValue: string | boolean;
  /** The value actually projected onto the runtime — always the last VALID value. */
  appliedValue: string | boolean;
  timestamp: number;
  valid: boolean;
  /** Validation error (empty when valid). */
  error: string;
  state: DirtyState;
}

/** What the edit handler supplies for each keystroke/toggle. */
export interface CommitInput {
  nodeId: string;
  channel: string;
  screen: string;
  componentId: string;
  instanceKey: string;
  propKey: string;
  value: string | boolean;
  /** Original value — used only when the transaction is first created. */
  previousValue: string | boolean;
}

type Listener = () => void;
const MAX_LOG = 100;

export class RuntimeEditStore {
  private txns = new Map<string, RuntimeTransaction>();
  private logEntries: RuntimeTransaction[] = [];
  private listeners = new Set<Listener>();
  private seq = 0;

  private key(nodeId: string, propKey: string): string { return `${nodeId}::${propKey}`; }

  /** Look up the editable-property spec so we can validate against its declared rules. */
  private propSpec(input: CommitInput) {
    const comp = componentsFor(input.channel, input.screen).find(m => m.metadata.id === input.componentId);
    return comp?.metadata.editableProps.find(p => p.key === input.propKey);
  }

  /**
   * Turn one edit into a transaction: validate, stamp a dirty state, keep the runtime-applied
   * value valid, and append an immutable snapshot to the session log. Notifies subscribers
   * (the reconciler re-projects; the Inspector re-renders).
   */
  commit(input: CommitInput): RuntimeTransaction {
    const k = this.key(input.nodeId, input.propKey);
    const existing = this.txns.get(k);
    const previousValue = existing ? existing.previousValue : input.previousValue;

    const spec = this.propSpec(input);
    const { valid, error } = spec ? validateValue(spec, input.value) : { valid: true, error: '' };

    // Only a valid value reaches the runtime; an invalid edit keeps the last valid value.
    const appliedValue = valid ? input.value : (existing ? existing.appliedValue : previousValue);
    const changed = input.value !== previousValue;
    const state: DirtyState = !valid
      ? 'invalid'
      : changed
        ? 'dirty'
        // Valid and back at the baseline: 'resolved' if it had been edited, else pristine 'clean'.
        : (existing && existing.state !== 'clean' ? 'resolved' : 'clean');

    const tx: RuntimeTransaction = {
      id: existing?.id ?? `tx_${++this.seq}`,
      nodeId: input.nodeId,
      channel: input.channel,
      screen: input.screen,
      componentId: input.componentId,
      instanceKey: input.instanceKey,
      propKey: input.propKey,
      previousValue,
      currentValue: input.value,
      appliedValue,
      timestamp: Date.now(),
      valid,
      error,
      state,
    };

    this.txns.set(k, tx);
    this.appendLog(tx);
    this.emit();
    return tx;
  }

  /**
   * Open a transaction in the 'pending' state while async validation runs (e.g. probing whether
   * an image URL actually loads). The value is recorded but NOT applied yet — the runtime keeps
   * its last valid value until commit() confirms, so a bad URL never flashes onto the runtime.
   */
  beginPending(input: CommitInput): RuntimeTransaction {
    const k = this.key(input.nodeId, input.propKey);
    const existing = this.txns.get(k);
    const previousValue = existing ? existing.previousValue : input.previousValue;
    const tx: RuntimeTransaction = {
      id: existing?.id ?? `tx_${++this.seq}`,
      nodeId: input.nodeId, channel: input.channel, screen: input.screen,
      componentId: input.componentId, instanceKey: input.instanceKey, propKey: input.propKey,
      previousValue,
      currentValue: input.value,
      appliedValue: existing ? existing.appliedValue : previousValue, // unchanged until confirmed
      timestamp: Date.now(), valid: false, error: '', state: 'pending',
    };
    this.txns.set(k, tx);
    this.appendLog(tx);
    this.emit();
    return tx;
  }

  /** Reject a pending transaction (async validation failed) — records the error, applies nothing. */
  reject(nodeId: string, propKey: string, error: string): void {
    const tx = this.txns.get(this.key(nodeId, propKey));
    if (!tx) return;
    const rejected: RuntimeTransaction = { ...tx, valid: false, error, state: 'invalid' };
    this.txns.set(this.key(nodeId, propKey), rejected);
    this.appendLog(rejected);
    this.emit();
  }

  private appendLog(tx: RuntimeTransaction): void {
    this.logEntries.push({ ...tx });
    if (this.logEntries.length > MAX_LOG) this.logEntries.splice(0, this.logEntries.length - MAX_LOG);
  }

  /** The current transaction for one instance/property (undefined if never edited). */
  transactionFor(nodeId: string, propKey: string): RuntimeTransaction | undefined {
    return this.txns.get(this.key(nodeId, propKey));
  }

  /** Every current transaction belonging to one runtime node/instance. */
  transactionsForNode(nodeId: string): RuntimeTransaction[] {
    return [...this.txns.values()].filter(t => t.nodeId === nodeId);
  }

  /** The session transaction log, newest first. */
  log(): RuntimeTransaction[] { return [...this.logEntries].reverse(); }

  /** Current transactions — the reconciler applies each one's appliedValue. */
  all(): RuntimeTransaction[] { return [...this.txns.values()]; }
  count(): number { return this.txns.size; }

  /** Dispose the session (channel change / session end). */
  clear(): void {
    if (this.txns.size || this.logEntries.length) {
      this.txns.clear();
      this.logEntries = [];
      this.emit();
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(): void { this.listeners.forEach(l => l()); }
}
