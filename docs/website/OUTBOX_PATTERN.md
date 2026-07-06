# Website Platform · Outbox Pattern (Wave 1)

> Replaces the Wave 0 in-memory-only event assumption with a durable transactional outbox: every
> published event is PERSISTED before/with delivery, enabling replay, retry, idempotency, and
> dead-letter handling. Implements the Wave 0 `EventBus` interface, so producers are unchanged.

## Model
`website_event_outbox(id, tenant_id, type, payload, meta, idempotency_key UNIQUE, status, attempts,
last_error, created_at, processed_at)`. Status ∈ `pending | processed | failed | dead`.

## Flow
```
publish(event)
  → if event.meta.idempotencyKey already in outbox → SKIP (idempotent dedup)
  → INSERT outbox row (status=pending)
  → deliver to in-process subscribers (InMemoryEventBus)
       success → status=processed, processed_at
       throw   → attempts++, status = attempts >= MAX ? 'dead' : 'failed', last_error
```

## Guarantees
- **Persistence:** the event is stored durably (survives a crash after commit) — the outbox row is
  the source of truth for delivery.
- **Idempotency:** dedup by `meta.idempotencyKey` (unique) so a retried producer never double-emits.
- **Replay:** `replay()` re-delivers all `pending` + `failed` rows (durable catch-up after an outage).
- **Retry / DLQ prep:** failed deliveries increment `attempts`; at `MAX_OUTBOX_ATTEMPTS (5)` a row is
  moved to `dead` (`deadLetters()` surfaces them) for manual/automated intervention.

## Interface
```ts
interface OutboxBus extends EventBus {
  replay(): Promise<Result<number>>;
  deadLetters(): Promise<Result<OutboxRecord[]>>;
  pending(): Promise<Result<OutboxRecord[]>>;
}
```
Backends: `PersistentOutboxBus` over the generic collection (memory for tests, Supabase for prod).
The DB helper `website_outbox_append(...)` (runtime migration) provides the server-side idempotent
insert for the durable drainer that later waves add (scheduled edge / pg_cron).

## Consumers
Journeys, analytics, observability, realtime invalidation subscribe to the typed catalog
(`EVENT_CATALOG.md`). The outbox decouples producers from consumers and makes delivery reliable.

## Tests
`__tests__/outbox.test.ts`: persistence + delivery, idempotency dedup, failure → failed record,
replay re-delivery.
