// ─────────────────────────────────────────────────────────────────────────────
// Guardian Kernel · the kernel itself.
//
// Orchestration ONLY. It knows nothing about orders, payments, websites or QA.
// It boots modules in dependency order, hands each a context, and gets out of
// the way. Every capability arrives via Guardian.use(...).
//
//   const g = Guardian.create();
//   g.use(HealthModule).use(QAModule).use(ClaudeProvider);
//   await g.start();
// ─────────────────────────────────────────────────────────────────────────────
import type { KernelPorts, Result } from './types';
import { ok, err, isErr, systemClock, counterIds, silentLogger, djb2Hasher, manualScheduler } from './types';
import { EventBus } from './events';
import { ConfigStore } from './config';
import type { ConfigBag } from './config';
import { AuditLog } from './audit';
import { PermissionRegistry, applyKernelPolicy } from './permissions';
import { ModuleRegistry } from './registry';
import type { GuardianModule } from './registry';
import { HealthEngine } from './health';
import { KnowledgeEngine } from './knowledge';
import type { KnowledgeSource } from './knowledge';
import { AiRegistry } from './ai';
import { JobScheduler } from './jobs';
import type { JobDef } from './jobs';

export type KernelPhase = 'created' | 'registering' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';

/**
 * What a module receives. This is the ENTIRE surface a module may touch — the
 * kernel exposes engines, never other modules. Peers are found via events,
 * capabilities or the service locator, never by import.
 */
export interface GuardianContext {
  readonly moduleId: string;
  readonly events: EventBus;
  readonly config: ConfigStore;
  readonly audit: AuditLog;
  readonly permissions: PermissionRegistry;
  readonly health: HealthEngine;
  readonly knowledge: KnowledgeEngine;
  readonly ai: AiRegistry;
  readonly jobs: JobScheduler;
  readonly ports: KernelPorts;
  /** Convenience wrappers that stamp provenance automatically. */
  defineConfig(defaults: ConfigBag): Result<true>;
  defineJob(def: Omit<JobDef, 'owner'>): Result<true>;
  addKnowledgeSource(source: KnowledgeSource): Result<true>;
  provide(serviceId: string, value: unknown): Result<true>;
  resolve<T>(serviceId: string): T | undefined;
  /** Peers advertising a capability tag — discovery without coupling. */
  peers(capability: string): GuardianModule[];
  log(action: string, meta?: Record<string, unknown>): void;
}

export interface GuardianOptions { ports?: Partial<KernelPorts> }

export class Guardian {
  readonly events: EventBus;
  readonly config = new ConfigStore();
  readonly audit: AuditLog;
  readonly permissions = new PermissionRegistry();
  readonly health: HealthEngine;
  readonly knowledge: KnowledgeEngine;
  readonly ai = new AiRegistry();
  readonly jobs: JobScheduler;
  readonly registry = new ModuleRegistry();
  readonly ports: KernelPorts;

  private _phase: KernelPhase = 'created';
  private readonly pending: GuardianModule[] = [];

  private constructor(opts: GuardianOptions = {}) {
    this.ports = {
      clock: opts.ports?.clock ?? systemClock,
      ids: opts.ports?.ids ?? counterIds(),
      logger: opts.ports?.logger ?? silentLogger,
      hasher: opts.ports?.hasher ?? djb2Hasher,
      scheduler: opts.ports?.scheduler ?? manualScheduler(),
    };
    this.events = new EventBus(this.ports.clock, this.ports.ids, this.ports.logger);
    this.audit = new AuditLog(this.ports.clock, this.ports.ids, this.ports.hasher);
    this.health = new HealthEngine(this.events, this.ports.clock, this.ports.ids);
    this.knowledge = new KnowledgeEngine(this.ports.clock);
    this.jobs = new JobScheduler(this.events, this.ports.clock, this.ports.logger);

    applyKernelPolicy(this.permissions);

    // Everything on the bus is audited. One line — this is why the audit trail can
    // never miss a module action: modules cannot bypass the bus.
    this.events.onAny((e) => {
      this.audit.append({ actor: e.source, action: e.type, subject: e.id, meta: { payload: e.payload } });
    });
  }

  static create(opts: GuardianOptions = {}): Guardian { return new Guardian(opts); }

  get phase(): KernelPhase { return this._phase; }

  /** THE extension mechanism. Chainable. Modules queue until start(). */
  use(module: GuardianModule): this {
    if (this._phase !== 'created' && this._phase !== 'registering') {
      this.ports.logger.warn('use() after start is ignored', { moduleId: module.id });
      return this;
    }
    this._phase = 'registering';
    this.pending.push(module);
    return this;
  }

  private contextFor(moduleId: string): GuardianContext {
    return {
      moduleId,
      events: this.events, config: this.config, audit: this.audit, permissions: this.permissions,
      health: this.health, knowledge: this.knowledge, ai: this.ai, jobs: this.jobs, ports: this.ports,
      defineConfig: (defaults) => this.config.defineNamespace(moduleId, defaults),
      defineJob: (def) => this.jobs.define({ ...def, owner: moduleId }),
      addKnowledgeSource: (source) => this.knowledge.addSource(source),
      provide: (serviceId, value) => {
        const r = this.registry.provide(serviceId, value, moduleId);
        if (r.ok) void this.events.emit('guardian.service.provided', { serviceId, moduleId }, moduleId);
        return r;
      },
      resolve: <T>(serviceId: string) => this.registry.resolve<T>(serviceId),
      peers: (capability) => this.registry.byCapability(capability).filter(m => m.id !== moduleId),
      log: (action, meta) => { this.audit.append({ actor: moduleId, action, meta }); },
    };
  }

  /**
   * Boot. Registers all queued modules, resolves the dependency graph, then runs
   * register() → start() in topological order. A failing module is isolated and
   * marked `failed`; the kernel keeps running (fail-open) unless the GRAPH itself
   * is invalid, which fails the boot loudly.
   */
  async start(): Promise<Result<{ started: string[]; failed: string[] }, string>> {
    if (this._phase === 'running') return err('guardian already running');
    this._phase = 'starting';

    for (const m of this.pending) {
      const r = this.registry.add(m, this.ports.clock.now());
      if (isErr(r)) { this._phase = 'failed'; return err(r.error); }
      await this.events.emit('guardian.module.registered', { moduleId: m.id, version: m.version }, 'kernel');
    }
    this.pending.length = 0;

    const order = this.registry.resolveOrder();
    if (isErr(order)) { this._phase = 'failed'; return err(order.error); }

    const started: string[] = [], failed: string[] = [];

    for (const id of order.value) {
      const rec = this.registry.get(id)!;
      try { await rec.module.register?.(this.contextFor(id)); }
      catch (e) {
        this.registry.setState(id, 'failed', String(e)); failed.push(id);
        await this.events.emit('guardian.module.failed', { moduleId: id, phase: 'register', error: String(e) }, 'kernel');
      }
    }

    this.config.freeze();   // no config drift once modules are wired

    for (const id of order.value) {
      const rec = this.registry.get(id)!;
      if (rec.state === 'failed') continue;
      this.registry.setState(id, 'starting');
      try {
        await rec.module.start?.(this.contextFor(id));
        this.registry.markStarted(id, this.ports.clock.now());
        started.push(id);
        await this.events.emit('guardian.module.started', { moduleId: id }, 'kernel');
      } catch (e) {
        this.registry.setState(id, 'failed', String(e)); failed.push(id);
        await this.events.emit('guardian.module.failed', { moduleId: id, phase: 'start', error: String(e) }, 'kernel');
      }
    }

    this._phase = 'running';
    await this.events.emit('guardian.booted', { modules: started }, 'kernel');
    return ok({ started, failed });
  }

  /** Graceful shutdown in reverse dependency order. Errors are isolated. */
  async stop(): Promise<Result<{ stopped: string[] }, string>> {
    if (this._phase !== 'running') return err(`cannot stop from phase: ${this._phase}`);
    this._phase = 'stopping';
    const order = this.registry.resolveOrder();
    const ids = order.ok ? [...order.value].reverse() : this.registry.ids().reverse();
    const stopped: string[] = [];
    for (const id of ids) {
      const rec = this.registry.get(id);
      if (!rec || rec.state !== 'started') continue;
      this.registry.setState(id, 'stopping');
      try {
        await rec.module.stop?.(this.contextFor(id));
        this.registry.setState(id, 'stopped');
        stopped.push(id);
        await this.events.emit('guardian.module.stopped', { moduleId: id }, 'kernel');
      } catch (e) {
        this.registry.setState(id, 'failed', String(e));
        await this.events.emit('guardian.module.failed', { moduleId: id, phase: 'stop', error: String(e) }, 'kernel');
      }
    }
    this._phase = 'stopped';
    await this.events.emit('guardian.stopped', { modules: stopped }, 'kernel');
    return ok({ stopped });
  }

  /** One-glance kernel state — the only "dashboard" the kernel itself owns. */
  describe(): {
    phase: KernelPhase;
    modules: { id: string; version: string; state: string; error?: string }[];
    services: { id: string; moduleId: string }[];
    checks: number; jobs: number; providers: string[]; facts: number; audit: number;
  } {
    return {
      phase: this._phase,
      modules: this.registry.list().map(r => ({ id: r.module.id, version: r.module.version, state: r.state, error: r.error })),
      services: this.registry.listServices(),
      checks: this.health.listChecks().length,
      jobs: this.jobs.list().length,
      providers: this.ai.list().map(p => p.id),
      facts: this.knowledge.size(),
      audit: this.audit.size(),
    };
  }
}
