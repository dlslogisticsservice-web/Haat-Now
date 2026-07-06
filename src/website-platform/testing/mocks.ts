// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Test mocks & helpers (Wave 0).
// A recording event bus + a fixed-clock helper for deterministic assertions.
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteEvent, WebsiteEventType, EventOfType } from '../events/events';
import type { EventBus, EventHandler, Unsubscribe } from '../events/bus';
import { InMemoryEventBus } from '../events/bus';

/** Wraps InMemoryEventBus and records every published event for assertions. */
export class RecordingEventBus implements EventBus {
  private readonly inner = new InMemoryEventBus();
  readonly published: WebsiteEvent[] = [];

  on<T extends WebsiteEventType>(type: T, handler: EventHandler<EventOfType<T>>): Unsubscribe {
    return this.inner.on(type, handler);
  }
  onAny(handler: EventHandler): Unsubscribe {
    return this.inner.onAny(handler);
  }
  async publish(event: WebsiteEvent): Promise<void> {
    this.published.push(event);
    await this.inner.publish(event);
  }
  /** All recorded events of a given type. */
  ofType<T extends WebsiteEventType>(type: T): EventOfType<T>[] {
    return this.published.filter((e): e is EventOfType<T> => e.type === type);
  }
}
