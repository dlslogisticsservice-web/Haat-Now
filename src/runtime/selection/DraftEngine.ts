// ─────────────────────────────────────────────────────────────────────────────
// Draft Save Pipeline (Phase 8I).
//
// Turns the current runtime edits (transactions in the RuntimeEditStore) into managed DRAFTS:
//   • Change Set   — an immutable snapshot of the current edits, with a validation verdict.
//   • Draft Builder— build() assembles a Change Set from the store's current transactions.
//   • Draft Validation — a draft is valid only if every change is valid; errors are surfaced.
//   • Save Queue   — valid drafts are enqueued, then flushed to a session "saved" list.
//   • Draft Recovery — recover() re-applies a saved/queued draft's values back into the store.
//
// SESSION-ONLY. NO PERSISTENCE and NO PUBLISH: nothing is written to a store/CMS/Supabase/API/
// localStorage/sessionStorage, and there is no publish step (that is Phase 8J). "Saving" only
// moves a draft between in-memory lists. The store remains the single source of truth — the
// engine reads it (build) and writes through its public commit() (recover); it never bypasses it.
// ─────────────────────────────────────────────────────────────────────────────
import type { RuntimeEditStore, RuntimeTransaction } from './EditStore';

export interface ChangeSetItem {
  nodeId: string;
  channel: string;
  screen: string;
  componentId: string;
  instanceKey: string;
  propKey: string;
  previousValue: string | boolean;
  currentValue: string | boolean;
  valid: boolean;
  error: string;
}

export type DraftStatus = 'draft' | 'invalid' | 'queued' | 'saved';

export interface ChangeSet {
  id: string;
  label: string;
  createdAt: number;
  changes: ChangeSetItem[];
  status: DraftStatus;
  validation: { valid: boolean; errors: string[] };
}

type Listener = () => void;

const itemOf = (t: RuntimeTransaction): ChangeSetItem => ({
  nodeId: t.nodeId, channel: t.channel, screen: t.screen, componentId: t.componentId,
  instanceKey: t.instanceKey, propKey: t.propKey, previousValue: t.previousValue,
  currentValue: t.currentValue, valid: t.valid, error: t.error,
});

export class DraftEngine {
  private queue: ChangeSet[] = [];
  private saved: ChangeSet[] = [];
  private seq = 0;
  private listeners = new Set<Listener>();

  constructor(private store: RuntimeEditStore) {}

  private validate(changes: ChangeSetItem[]): { valid: boolean; errors: string[] } {
    const errors = changes.filter(c => !c.valid).map(c => `${c.propKey}: ${c.error || 'invalid'}`);
    return { valid: errors.length === 0, errors };
  }

  /** Draft Builder — snapshot the store's current CHANGED transactions into a Change Set. */
  build(label?: string): ChangeSet {
    const changes = this.store.all()
      .filter(t => t.currentValue !== t.previousValue || !t.valid) // only real changes/invalid
      .map(itemOf);
    const validation = this.validate(changes);
    return {
      id: `cs_${++this.seq}`,
      label: label || `Draft ${this.seq}`,
      createdAt: Date.now(),
      changes,
      status: changes.length === 0 ? 'draft' : (validation.valid ? 'draft' : 'invalid'),
      validation,
    };
  }

  /** Enqueue a built draft onto the Save Queue. Rejected if empty or failing validation. */
  enqueue(cs: ChangeSet): boolean {
    if (!cs.changes.length || !cs.validation.valid) return false;
    this.queue.push({ ...cs, status: 'queued' });
    this.emit();
    return true;
  }

  /** Convenience: build the current edits and enqueue in one call. Returns the change set. */
  saveDraft(label?: string): ChangeSet {
    const cs = this.build(label);
    if (this.enqueue(cs)) return { ...cs, status: 'queued' };
    return cs; // invalid/empty — surfaced to the UI, not queued
  }

  /** Process the Save Queue — move every queued draft to the session "saved" list (no persistence). */
  flush(): number {
    if (!this.queue.length) return 0;
    const n = this.queue.length;
    for (const cs of this.queue) this.saved.push({ ...cs, status: 'saved' });
    this.queue = [];
    this.emit();
    return n;
  }

  /** Draft Recovery — re-apply a saved/queued draft's values back into the edit store. */
  recover(id: string): boolean {
    const cs = [...this.saved, ...this.queue].find(c => c.id === id);
    if (!cs) return false;
    for (const c of cs.changes) {
      this.store.commit({
        nodeId: c.nodeId, channel: c.channel, screen: c.screen, componentId: c.componentId,
        instanceKey: c.instanceKey, propKey: c.propKey, value: c.currentValue, previousValue: c.previousValue,
      });
    }
    this.emit();
    return true;
  }

  queued(): ChangeSet[] { return [...this.queue]; }
  savedDrafts(): ChangeSet[] { return [...this.saved].reverse(); }
  private currentChanges(): ChangeSetItem[] {
    return this.store.all().filter(t => t.currentValue !== t.previousValue || !t.valid).map(itemOf);
  }
  pendingChangeCount(): number { return this.currentChanges().length; }
  /** Validate the current edits WITHOUT building a change set (no side-effects). */
  previewValidation(): { valid: boolean; errors: string[] } { return this.validate(this.currentChanges()); }

  /** Dispose (channel change / session end). */
  clear(): void {
    if (this.queue.length || this.saved.length) { this.queue = []; this.saved = []; this.emit(); }
  }

  subscribe(l: Listener): () => void { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  private emit(): void { this.listeners.forEach(l => l()); }
}
