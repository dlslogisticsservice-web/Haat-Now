// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Transactional outbox (Wave 1).
// Replaces the in-memory-only assumption: every published event is PERSISTED to
// website_event_outbox before/with local delivery, enabling durable delivery,
// replay, retry, idempotency (dedup by meta.idempotencyKey), and dead-letter prep.
// Implements the Wave 0 EventBus interface, so producers are unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, ISODateTime, Result } from '../shared/types';
import { ok } from '../shared/types';
import type { JsonObject } from '../domain/entities';
import type { WebsiteEvent, WebsiteEventType, EventOfType } from '../events/events';
import type { EventBus, EventHandler, Unsubscribe } from '../events/bus';
import { InMemoryEventBus } from '../events/bus';
import type { CollectionRepository } from '../repositories/collection';
import { createCollection } from '../repositories/collection';
import type { RepositoryBackend } from '../repositories/registry';

export type OutboxStatus = 'pending' | 'processed' | 'failed' | 'dead';

export interface OutboxRecord {
  id: UUID;
  tenantId: UUID;
  type: WebsiteEventType;
  payload: JsonObject;
  meta: JsonObject;
  idempotencyKey: string | null;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  createdAt: ISODateTime;
  processedAt: ISODateTime | null;
}

type OutboxRow = OutboxRecord & Record<string, unknown>;

/** Max delivery attempts before an event is dead-lettered. */
export const MAX_OUTBOX_ATTEMPTS = 5;

export interface OutboxBus extends EventBus {
  /** Re-publish persisted events that are still pending/failed (durable replay). */
  replay(): Promise<Result<number>>;
  /** Records that have exceeded MAX_OUTBOX_ATTEMPTS (dead-letter queue). */
  deadLetters(): Promise<Result<OutboxRecord[]>>;
  pending(): Promise<Result<OutboxRecord[]>>;
}

export class PersistentOutboxBus implements OutboxBus {
  private readonly local = new InMemoryEventBus();

  constructor(private readonly store: CollectionRepository<OutboxRow>) {}

  on<T extends WebsiteEventType>(type: T, handler: EventHandler<EventOfType<T>>): Unsubscribe {
    return this.local.on(type, handler);
  }
  onAny(handler: EventHandler): Unsubscribe {
    return this.local.onAny(handler);
  }

  async publish(event: WebsiteEvent): Promise<void> {
    // Idempotency: dedup by idempotencyKey when present.
    if (event.meta.idempotencyKey) {
      const existing = await this.store.findOne({ idempotencyKey: event.meta.idempotencyKey });
      if (existing.ok && existing.value) return;
    }
    const record = this.toRecord(event, 'pending');
    await this.store.insert(record);
    await this.deliver(event, record);
  }

  private async deliver(event: WebsiteEvent, record: OutboxRow): Promise<void> {
    try {
      await this.local.publish(event);
      await this.store.upsert({ ...record, status: 'processed', processedAt: new Date().toISOString() }, ['id']);
    } catch (e) {
      const attempts = record.attempts + 1;
      const status: OutboxStatus = attempts >= MAX_OUTBOX_ATTEMPTS ? 'dead' : 'failed';
      await this.store.upsert({ ...record, status, attempts, lastError: String(e) }, ['id']);
    }
  }

  async replay(): Promise<Result<number>> {
    const pending = await this.store.find({ status: 'pending' });
    const failed = await this.store.find({ status: 'failed' });
    const rows = [...(pending.ok ? pending.value : []), ...(failed.ok ? failed.value : [])];
    let replayed = 0;
    for (const row of rows) {
      const event = this.fromRecord(row);
      await this.deliver(event, row);
      replayed++;
    }
    return ok(replayed);
  }

  async deadLetters(): Promise<Result<OutboxRecord[]>> {
    return this.store.find({ status: 'dead' });
  }
  async pending(): Promise<Result<OutboxRecord[]>> {
    return this.store.find({ status: 'pending' });
  }

  private toRecord(event: WebsiteEvent, status: OutboxStatus): OutboxRow {
    return {
      id: event.meta.id,
      tenantId: event.meta.tenantId,
      type: event.type,
      payload: event.payload as unknown as JsonObject,
      meta: event.meta as unknown as JsonObject,
      idempotencyKey: event.meta.idempotencyKey,
      status,
      attempts: 0,
      lastError: null,
      createdAt: event.meta.occurredAt,
      processedAt: null,
    };
  }

  private fromRecord(row: OutboxRow): WebsiteEvent {
    return { type: row.type, meta: row.meta as unknown as WebsiteEvent['meta'], payload: row.payload as unknown as WebsiteEvent['payload'] } as WebsiteEvent;
  }
}

export function createOutboxBus(backend: RepositoryBackend): OutboxBus {
  return new PersistentOutboxBus(createCollection<OutboxRow>(backend, 'website_event_outbox'));
}
