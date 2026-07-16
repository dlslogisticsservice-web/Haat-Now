// ─────────────────────────────────────────────────────────────────────────────
// Guardian Kernel · Module Registry, Service Discovery & Lifecycle.
//
// No hardcoded wiring. A module declares `id`, `version`, `dependsOn`, and what it
// `provides`. The registry topologically sorts, detects cycles/missing deps, and
// drives the lifecycle. The kernel never names a concrete module.
//
//   registered → started → stopped        (failed is terminal for that module)
// ─────────────────────────────────────────────────────────────────────────────
import type { Result } from './types';
import { ok, err, isErr } from './types';
import type { GuardianContext } from './kernel';

export type ModuleState = 'registered' | 'starting' | 'started' | 'stopping' | 'stopped' | 'failed';

/**
 * The extension contract. EVERY future capability (Health checks, QA, Security,
 * Release, Knowledge sources, AI providers) is one of these.
 */
export interface GuardianModule {
  readonly id: string;
  readonly version: string;
  /** Module ids that must start first. Missing/cyclic ⇒ boot fails loudly. */
  readonly dependsOn?: readonly string[];
  /** Service ids this module puts in the locator (for discovery + conflict detection). */
  readonly provides?: readonly string[];
  /** Declarative capability tags (e.g. 'ai.provider', 'health.checks'). */
  readonly capabilities?: readonly string[];

  /** Wire up: define config/permissions/knowledge sources, subscribe to events. No I/O. */
  register?(ctx: GuardianContext): void | Promise<void>;
  /** Begin work: schedule jobs, open subscriptions. */
  start?(ctx: GuardianContext): void | Promise<void>;
  /** Release everything. Must be idempotent. */
  stop?(ctx: GuardianContext): void | Promise<void>;
}

export interface ModuleRecord {
  module: GuardianModule;
  state: ModuleState;
  error?: string;
  registeredAt: number;
  startedAt?: number;
}

export class ModuleRegistry {
  private readonly records = new Map<string, ModuleRecord>();
  private readonly services = new Map<string, { value: unknown; moduleId: string }>();

  add(module: GuardianModule, now: number): Result<true> {
    if (!module.id) return err('module.id is required');
    if (!module.version) return err(`module ${module.id}: version is required`);
    if (this.records.has(module.id)) return err(`module already registered: ${module.id}`);
    for (const s of module.provides ?? []) {
      const owner = this.serviceOwner(s);
      if (owner) return err(`service conflict: '${s}' already provided by '${owner}'`);
    }
    this.records.set(module.id, { module, state: 'registered', registeredAt: now });
    return ok(true);
  }

  private serviceOwner(serviceId: string): string | null {
    for (const [, r] of this.records) if ((r.module.provides ?? []).includes(serviceId)) return r.module.id;
    return null;
  }

  // ── Service discovery (locator) ────────────────────────────────────────────
  provide(serviceId: string, value: unknown, moduleId: string): Result<true> {
    if (this.services.has(serviceId)) return err(`service already provided: ${serviceId}`);
    this.services.set(serviceId, { value, moduleId });
    return ok(true);
  }
  resolve<T>(serviceId: string): T | undefined { return this.services.get(serviceId)?.value as T | undefined; }
  hasService(id: string): boolean { return this.services.has(id); }
  listServices(): { id: string; moduleId: string }[] {
    return [...this.services.entries()].map(([id, v]) => ({ id, moduleId: v.moduleId })).sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Modules advertising a capability tag — how a module finds peers without importing them. */
  byCapability(tag: string): GuardianModule[] {
    return [...this.records.values()].filter(r => (r.module.capabilities ?? []).includes(tag)).map(r => r.module);
  }

  get(id: string): ModuleRecord | undefined { return this.records.get(id); }
  list(): ModuleRecord[] { return [...this.records.values()]; }
  ids(): string[] { return [...this.records.keys()]; }
  setState(id: string, state: ModuleState, error?: string): void {
    const r = this.records.get(id); if (!r) return;
    r.state = state; if (error) r.error = error;
  }
  markStarted(id: string, now: number): void {
    const r = this.records.get(id); if (!r) return;
    r.state = 'started'; r.startedAt = now;
  }

  /**
   * Topological start order. Fails on missing dependency or cycle — a broken graph
   * must never boot half-way.
   */
  resolveOrder(): Result<string[], string> {
    const order: string[] = [];
    const temp = new Set<string>();
    const done = new Set<string>();

    const visit = (id: string, path: string[]): Result<true, string> => {
      if (done.has(id)) return ok(true);
      if (temp.has(id)) return err(`dependency cycle: ${[...path, id].join(' → ')}`);
      const rec = this.records.get(id);
      if (!rec) return err(`missing dependency: '${id}' (required by ${path[path.length - 1] ?? 'root'})`);
      temp.add(id);
      for (const dep of rec.module.dependsOn ?? []) {
        const r = visit(dep, [...path, id]);
        if (isErr(r)) return r;
      }
      temp.delete(id);
      done.add(id);
      order.push(id);
      return ok(true);
    };

    for (const id of this.records.keys()) {
      const r = visit(id, []);
      if (isErr(r)) return err(r.error);
    }
    return ok(order);
  }
}
