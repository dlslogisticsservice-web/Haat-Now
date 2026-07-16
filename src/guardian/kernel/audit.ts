// ─────────────────────────────────────────────────────────────────────────────
// Guardian Kernel · Audit Log.
//
// Every Guardian action is recorded. IMMUTABLE by construction:
//  · entries are frozen objects — no field can be reassigned after append
//  · each entry carries hash(prev.hash + canonical(entry)) — a HASH CHAIN, so any
//    edit or deletion anywhere in history is detectable by verify()
//  · there is no update() or delete() API. There is no code path to mutate history.
//
// The in-memory chain is the kernel's source of truth; a host attaches a durable
// AuditSink (Supabase table) — sinks receive entries, they never hand them back.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, Hasher, Id, IdGenerator, ISODateTime, Result } from './types';
import { ok, err } from './types';

export interface AuditEntry {
  readonly id: Id;
  readonly seq: number;
  readonly at: ISODateTime;
  readonly actor: string;          // user id, module id, or 'kernel'
  readonly action: string;         // 'module.registered' | 'incident.acked' | 'release.approved' …
  readonly subject?: string;       // what it acted on
  readonly reason?: string;        // required for human decisions (approve/silence/override)
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly prevHash: string;
  readonly hash: string;
}

/** Durable destination. Best-effort: a failing sink must never break the kernel. */
export interface AuditSink { id: string; write(entry: AuditEntry): void | Promise<void> }

export interface AppendInput {
  actor: string;
  action: string;
  subject?: string;
  reason?: string;
  meta?: Record<string, unknown>;
}

const GENESIS = '0'.repeat(8);

/** Stable serialization — key order must not change the hash. */
const canonical = (e: Omit<AuditEntry, 'hash'>): string =>
  JSON.stringify([e.seq, e.at, e.actor, e.action, e.subject ?? '', e.reason ?? '', e.meta ? JSON.stringify(e.meta, Object.keys(e.meta).sort()) : '', e.prevHash]);

export class AuditLog {
  private readonly entries: AuditEntry[] = [];
  private readonly sinks: AuditSink[] = [];

  constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly hasher: Hasher,
  ) {}

  addSink(sink: AuditSink): void { this.sinks.push(sink); }

  /** Append-only. Returns the frozen entry. There is deliberately no way to edit or remove one. */
  append(input: AppendInput): AuditEntry {
    const prevHash = this.entries.length ? this.entries[this.entries.length - 1].hash : GENESIS;
    const base = {
      id: this.ids.next('aud'),
      seq: this.entries.length + 1,
      at: this.clock.iso(),
      actor: input.actor,
      action: input.action,
      subject: input.subject,
      reason: input.reason,
      meta: input.meta ? Object.freeze({ ...input.meta }) : undefined,
      prevHash,
    };
    const entry: AuditEntry = Object.freeze({ ...base, hash: this.hasher.hash(canonical(base)) });
    this.entries.push(entry);

    for (const s of this.sinks) {
      try { void s.write(entry); } catch { /* a sink must never break the chain */ }
    }
    return entry;
  }

  /** Recompute the chain. Detects any mutation, insertion or deletion. */
  verify(): Result<{ entries: number }, { brokenAt: number; reason: string }> {
    let prev = GENESIS;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      if (e.seq !== i + 1) return err({ brokenAt: i, reason: 'sequence gap' });
      if (e.prevHash !== prev) return err({ brokenAt: i, reason: 'prevHash mismatch' });
      const { hash, ...rest } = e;
      if (this.hasher.hash(canonical(rest)) !== hash) return err({ brokenAt: i, reason: 'hash mismatch' });
      prev = e.hash;
    }
    return ok({ entries: this.entries.length });
  }

  list(filter?: { actor?: string; action?: string; subject?: string; limit?: number }): AuditEntry[] {
    let out = this.entries;
    if (filter?.actor) out = out.filter(e => e.actor === filter.actor);
    if (filter?.action) out = out.filter(e => e.action === filter.action);
    if (filter?.subject) out = out.filter(e => e.subject === filter.subject);
    const limit = filter?.limit ?? 100;
    return out.slice(-limit).reverse();
  }

  size(): number { return this.entries.length; }
  head(): string { return this.entries.length ? this.entries[this.entries.length - 1].hash : GENESIS; }
}
