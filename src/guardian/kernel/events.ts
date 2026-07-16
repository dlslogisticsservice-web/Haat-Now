// ─────────────────────────────────────────────────────────────────────────────
// Guardian Kernel · Event Bus.
//
// THE law: modules never import each other. They speak only through this bus.
// That is what makes modules hot-pluggable and the kernel free of business logic.
//
// The catalog (GuardianEventMap) is an INTERFACE, so a future module declares its
// own events by declaration merging — no kernel edit, no hardcoded wiring:
//
//   declare module '.../events' {
//     interface GuardianEventMap { 'qa.run.finished': { suite: string; failed: number } }
//   }
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, IdGenerator, Id, ISODateTime, Logger, Severity, HealthStatus } from './types';

/**
 * Core event catalog. Kernel + health events are OWNED here. Platform events are
 * DECLARED here (payload contracts only) so emitters/consumers agree — the kernel
 * itself never emits them; that is the modules' job.
 */
export interface GuardianEventMap {
  // ── kernel lifecycle ──
  'guardian.booted': { modules: string[] };
  'guardian.stopped': { modules: string[] };
  'guardian.module.registered': { moduleId: string; version: string };
  'guardian.module.started': { moduleId: string };
  'guardian.module.stopped': { moduleId: string };
  'guardian.module.failed': { moduleId: string; phase: string; error: string };
  'guardian.service.provided': { serviceId: string; moduleId: string };
  'guardian.job.started': { jobId: string };
  'guardian.job.finished': { jobId: string; ms: number };
  'guardian.job.failed': { jobId: string; error: string };
  'guardian.config.changed': { namespace: string; key: string };
  'guardian.audit.appended': { entryId: string; action: string };

  // ── health engine ──
  'health.check.registered': { key: string };
  'health.status.changed': { key: string; from: HealthStatus; to: HealthStatus };
  'health.incident.opened': { incidentId: Id; key: string; severity: Severity };
  'health.incident.acknowledged': { incidentId: Id; by: string };
  'health.incident.escalated': { incidentId: Id; level: number };
  'health.incident.resolved': { incidentId: Id; by: string };
  'health.recovered': { key: string; incidentId?: Id };

  // ── platform contracts (declared, emitted by future modules) ──
  'order.created': { orderId: string; total: number };
  'order.failed': { orderId: string; reason: string };
  'payment.failed': { orderId?: string; provider: string; reason: string };
  'deployment.started': { sha: string; env: string };
  'deployment.finished': { sha: string; env: string; ok: boolean };
  'api.timeout': { endpoint: string; ms: number };
  'database.slow': { query: string; ms: number };
  'realtime.disconnected': { channel: string };
  'driver.offline': { driverId: string };
  'merchant.blocked': { merchantId: string; reason: string };
  'website.published': { slug: string; version: number };
}

export type EventType = keyof GuardianEventMap;

export interface GuardianEvent<K extends EventType = EventType> {
  id: Id;
  type: K;
  at: ISODateTime;
  source: string;
  payload: GuardianEventMap[K];
  correlationId?: Id;
}

export type Handler<K extends EventType> = (e: GuardianEvent<K>) => void | Promise<void>;
export type AnyHandler = (e: GuardianEvent) => void | Promise<void>;
export type Unsubscribe = () => void;

/** Observe/transform every event before dispatch (audit, tracing). Return false to drop. */
export type Middleware = (e: GuardianEvent) => boolean | void;

export interface EventBusOptions { historyLimit?: number }

export class EventBus {
  private readonly handlers = new Map<string, Set<AnyHandler>>();
  private readonly wildcard = new Set<AnyHandler>();
  private readonly middleware: Middleware[] = [];
  private readonly history: GuardianEvent[] = [];
  private readonly historyLimit: number;

  constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly logger: Logger,
    opts: EventBusOptions = {},
  ) { this.historyLimit = opts.historyLimit ?? 200; }

  use(mw: Middleware): Unsubscribe {
    this.middleware.push(mw);
    return () => { const i = this.middleware.indexOf(mw); if (i >= 0) this.middleware.splice(i, 1); };
  }

  on<K extends EventType>(type: K, handler: Handler<K>): Unsubscribe {
    let set = this.handlers.get(type as string);
    if (!set) { set = new Set(); this.handlers.set(type as string, set); }
    set.add(handler as AnyHandler);
    return () => { set!.delete(handler as AnyHandler); };
  }

  /** Subscribe to every event (audit, forwarders). */
  onAny(handler: AnyHandler): Unsubscribe {
    this.wildcard.add(handler);
    return () => { this.wildcard.delete(handler); };
  }

  once<K extends EventType>(type: K, handler: Handler<K>): Unsubscribe {
    const off = this.on(type, async (e) => { off(); await handler(e); });
    return off;
  }

  /**
   * Publish. Handler failures are ISOLATED and logged — one bad module must never
   * break the bus or the product (kernel fail-open principle).
   */
  async emit<K extends EventType>(type: K, payload: GuardianEventMap[K], source = 'kernel', correlationId?: Id): Promise<GuardianEvent<K>> {
    const event: GuardianEvent<K> = { id: this.ids.next('evt'), type, at: this.clock.iso(), source, payload, correlationId };

    for (const mw of this.middleware) {
      try { if (mw(event as GuardianEvent) === false) return event; }
      catch (e) { this.logger.error('event middleware threw', { type, error: String(e) }); }
    }

    this.history.push(event as GuardianEvent);
    if (this.history.length > this.historyLimit) this.history.splice(0, this.history.length - this.historyLimit);

    const targets: AnyHandler[] = [...(this.handlers.get(type as string) ?? []), ...this.wildcard];
    for (const h of targets) {
      try { await h(event as GuardianEvent); }
      catch (e) { this.logger.error('event handler threw', { type, error: String(e) }); }
    }
    return event;
  }

  /** Recent events (bounded ring) — for diagnostics and the Knowledge Engine. */
  recent(limit = 50): GuardianEvent[] { return this.history.slice(-limit).reverse(); }

  listenerCount(type?: EventType): number {
    return type ? (this.handlers.get(type as string)?.size ?? 0) + this.wildcard.size : this.wildcard.size;
  }

  clear(): void { this.handlers.clear(); this.wildcard.clear(); this.history.length = 0; }
}
