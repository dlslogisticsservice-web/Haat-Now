# Website Platform · Unit of Work (Wave 1)

> A production-grade, compensation-based (saga) transaction manager that works across the memory and
> Supabase backends without a single DB transaction — each step registers an `undo`, and a failure
> rolls completed steps back in reverse. Supports transactions, rollback, nested scopes (savepoints),
> atomic updates, and failure recovery.

## Why a saga (not a DB transaction)
PostgREST does not expose multi-statement client transactions. Cross-aggregate operations (reorder a
page tree, clone a site) compose several repository calls. The Unit of Work makes that composition
atomic **from the caller's perspective**: if any step fails, previously-applied steps are compensated.
Single-statement DB atomicity is still available for hot paths via SECURITY DEFINER RPCs
(`website_reorder_pages`).

## API
```ts
interface UnitOfWork { transaction<T>(work: (tx: Transaction) => Promise<Result<T>>): Promise<Result<T>>; }

class Transaction {
  step<T>(op: { do(): Promise<Result<T>>; undo?(value: T): Promise<void> }): Promise<Result<T>>;
  savepoint(): Savepoint;
  rollbackTo(mark: Savepoint): Promise<void>;
  rollback(): Promise<void>;
  commit(): void;
}
```

## Semantics
- **Commit on success:** the body returns an ok-Result → undo history is discarded (durable).
- **Rollback on failure:** the body returns an err-Result (or throws) → completed steps' `undo`
  callbacks run **LIFO**. A step's own `undo` does not run for the step that failed (it didn't apply).
- **Savepoints / nesting:** `savepoint()` marks a point; `rollbackTo(mark)` compensates only steps
  after it — enabling nested/partial rollback within one transaction.
- **Failure recovery:** compensation is best-effort and never throws during rollback (a failing
  `undo` is swallowed so one bad compensation can't strand the rollback).

## Example (page reorder)
```ts
await ctx.uow.transaction(async tx => {
  for (let i = 0; i < ids.length; i++) {
    const prev = (await repo.getById(t, ids[i])).value.position;
    const step = await tx.step({
      do:   () => repo.update(t, ids[i], { position: i }),
      undo: async () => { await repo.update(t, ids[i], { position: prev }); },
    });
    if (!isOk(step)) return err(step.error);   // triggers rollback of prior steps
  }
  return ok(ids.length);
});
```

## Guarantees & tests
Covered by `__tests__/transaction.test.ts`: commit, LIFO compensation on failure, savepoint partial
rollback, and the service-level `PageService.reorder` / `NavigationService.reorder`.
