// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Unit of Work (Wave 1).
// A compensation-based (saga) transaction manager that works across the memory and
// Supabase backends without requiring a single DB transaction — each step registers an
// `undo`, and a failure rolls back completed steps in reverse (LIFO). Supports nested
// scopes via savepoints, atomic multi-aggregate updates, and failure recovery.
//
// True single-statement DB atomicity (e.g. tree reorder, site clone) is still available
// via SECURITY DEFINER RPCs (persistence/rpc.ts) for hot paths; the UoW composes
// repository operations for everything else.
// ─────────────────────────────────────────────────────────────────────────────

import type { Result, WebsitePlatformError } from '../shared/types';
import { err } from '../shared/types';
import { errors } from '../shared/errors';

/** A reversible operation: run `do`, and if a later step fails, `undo` compensates it. */
export interface TxStep<T> {
  do: () => Promise<Result<T>>;
  undo?: (value: T) => Promise<void>;
}

interface CompletedStep {
  value: unknown;
  undo?: (value: unknown) => Promise<void>;
}

/** A marker to roll back to (savepoint). */
export type Savepoint = number;

/** An in-flight transaction. Steps are executed in order; failures auto-rollback. */
export class Transaction {
  private readonly completed: CompletedStep[] = [];
  private rolledBack = false;

  /** Execute a reversible step. On failure, the whole transaction rolls back. */
  async step<T>(op: TxStep<T>): Promise<Result<T>> {
    if (this.rolledBack) return err(errors.unavailable('transaction already rolled back'));
    const result = await op.do();
    if (result.ok) {
      this.completed.push({ value: result.value, undo: op.undo as ((v: unknown) => Promise<void>) | undefined });
    } else {
      await this.rollback();
    }
    return result;
  }

  /** Mark a savepoint to roll back to later. */
  savepoint(): Savepoint {
    return this.completed.length;
  }

  /** Compensate every completed step after `mark`, in reverse order. */
  async rollbackTo(mark: Savepoint): Promise<void> {
    while (this.completed.length > mark) {
      const s = this.completed.pop();
      if (s?.undo) {
        try { await s.undo(s.value); } catch { /* best-effort compensation; never throw during rollback */ }
      }
    }
  }

  /** Roll back the entire transaction. */
  async rollback(): Promise<void> {
    await this.rollbackTo(0);
    this.rolledBack = true;
  }

  /** Discard undo history — the transaction is durable. */
  commit(): void {
    this.completed.length = 0;
  }

  get isRolledBack(): boolean {
    return this.rolledBack;
  }
}

export interface UnitOfWork {
  /** Run a body inside a transaction. Committed on ok-Result, rolled back otherwise (or on throw). */
  transaction<T>(work: (tx: Transaction) => Promise<Result<T>>): Promise<Result<T, WebsitePlatformError>>;
}

export class SagaUnitOfWork implements UnitOfWork {
  async transaction<T>(work: (tx: Transaction) => Promise<Result<T>>): Promise<Result<T, WebsitePlatformError>> {
    const tx = new Transaction();
    try {
      const result = await work(tx);
      if (result.ok) tx.commit();
      else if (!tx.isRolledBack) await tx.rollback();
      return result;
    } catch (e) {
      if (!tx.isRolledBack) await tx.rollback();
      return err(errors.unknown('transaction failed', { message: String(e) }));
    }
  }
}
