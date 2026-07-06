// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Event bus (Wave 0).
// A typed publish/subscribe bus with per-type and wildcard subscriptions. Wave 0
// ships the in-memory implementation used by services + tests; the durable outbox
// (DB trigger → events table → scheduled drainer) implements the same interface in
// a later wave, so callers never change.
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteEvent, WebsiteEventType, EventOfType } from './events';

export type EventHandler<E extends WebsiteEvent = WebsiteEvent> = (event: E) => void | Promise<void>;
export type Unsubscribe = () => void;

export interface EventBus {
  /** Subscribe to a single event type (typed payload). */
  on<T extends WebsiteEventType>(type: T, handler: EventHandler<EventOfType<T>>): Unsubscribe;
  /** Subscribe to every event. */
  onAny(handler: EventHandler): Unsubscribe;
  /** Publish an event to all matching subscribers. */
  publish(event: WebsiteEvent): Promise<void>;
}

/** In-memory bus. Handlers run sequentially; a throwing handler is isolated so one
 *  bad subscriber never blocks the others (errors are collected and re-reported). */
export class InMemoryEventBus implements EventBus {
  private readonly typed = new Map<WebsiteEventType, Set<EventHandler>>();
  private readonly wildcard = new Set<EventHandler>();

  on<T extends WebsiteEventType>(type: T, handler: EventHandler<EventOfType<T>>): Unsubscribe {
    const set = this.typed.get(type) ?? new Set<EventHandler>();
    // Safe upcast: the handler is invoked only with events whose type === T.
    set.add(handler as EventHandler);
    this.typed.set(type, set);
    return () => set.delete(handler as EventHandler);
  }

  onAny(handler: EventHandler): Unsubscribe {
    this.wildcard.add(handler);
    return () => this.wildcard.delete(handler);
  }

  async publish(event: WebsiteEvent): Promise<void> {
    const failures: unknown[] = [];
    const run = async (h: EventHandler) => {
      try {
        await h(event);
      } catch (e) {
        failures.push(e);
      }
    };
    const handlers = this.typed.get(event.type);
    if (handlers) {
      for (const h of handlers) await run(h);
    }
    for (const h of this.wildcard) await run(h);
    if (failures.length > 0) {
      throw new AggregateEventError(event.type, failures);
    }
  }
}

/** Raised when one or more subscribers throw during publish. */
export class AggregateEventError extends Error {
  readonly failures: ReadonlyArray<unknown>;
  constructor(type: string, failures: ReadonlyArray<unknown>) {
    super(`${failures.length} handler(s) failed for event ${type}`);
    this.name = 'AggregateEventError';
    this.failures = failures;
  }
}
