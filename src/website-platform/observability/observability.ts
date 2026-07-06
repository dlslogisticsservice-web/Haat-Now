// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Observability (Wave 1).
// Structured logging, tracing hooks, metrics interfaces, health checks, and a
// repository-diagnostics wrapper (latency + error counters). Zero external deps;
// production sinks can implement these interfaces later without changing callers.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, Result, Page, PageRequest } from '../shared/types';
import { isOk } from '../shared/types';
import type { Repository, PersistedEntity } from '../repositories/repository';

// ── Structured logging ───────────────────────────────────────────────────────────
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Readonly<Record<string, string | number | boolean | null>>;
export interface StructuredLogger {
  log(level: LogLevel, message: string, fields?: LogFields): void;
  child(bindings: LogFields): StructuredLogger;
}

export class ConsoleLogger implements StructuredLogger {
  constructor(private readonly bindings: LogFields = {}) {}
  log(level: LogLevel, message: string, fields?: LogFields): void {
    const line = JSON.stringify({ level, message, ...this.bindings, ...fields });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
  child(bindings: LogFields): StructuredLogger {
    return new ConsoleLogger({ ...this.bindings, ...bindings });
  }
}
export class NoopLogger implements StructuredLogger {
  log(): void { /* noop */ }
  child(): StructuredLogger { return this; }
}

// ── Tracing hooks ────────────────────────────────────────────────────────────────
export interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  end(): void;
}
export interface Tracer {
  startSpan(name: string, attributes?: LogFields): Span;
}
export class NoopTracer implements Tracer {
  startSpan(): Span {
    return { setAttribute() { /* noop */ }, end() { /* noop */ } };
  }
}

// ── Metrics ──────────────────────────────────────────────────────────────────────
export type MetricTags = Readonly<Record<string, string>>;
export interface MetricsSink {
  counter(name: string, value?: number, tags?: MetricTags): void;
  gauge(name: string, value: number, tags?: MetricTags): void;
  histogram(name: string, value: number, tags?: MetricTags): void;
}
export class InMemoryMetrics implements MetricsSink {
  readonly counters = new Map<string, number>();
  readonly histograms = new Map<string, number[]>();
  readonly gauges = new Map<string, number>();
  private key(name: string, tags?: MetricTags): string {
    return tags ? `${name}{${Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(',')}}` : name;
  }
  counter(name: string, value = 1, tags?: MetricTags): void {
    const k = this.key(name, tags);
    this.counters.set(k, (this.counters.get(k) ?? 0) + value);
  }
  gauge(name: string, value: number, tags?: MetricTags): void {
    this.gauges.set(this.key(name, tags), value);
  }
  histogram(name: string, value: number, tags?: MetricTags): void {
    const k = this.key(name, tags);
    const arr = this.histograms.get(k) ?? [];
    arr.push(value);
    this.histograms.set(k, arr);
  }
}
export class NoopMetrics implements MetricsSink {
  counter(): void { /* noop */ }
  gauge(): void { /* noop */ }
  histogram(): void { /* noop */ }
}

// ── Health checks ──────────────────────────────────────────────────────────────
export type HealthStatus = 'up' | 'down' | 'degraded';
export interface HealthResult { name: string; status: HealthStatus; detail?: string }
export interface HealthCheck { name: string; check(): Promise<HealthResult> }

export class HealthRegistry {
  private readonly checks: HealthCheck[] = [];
  register(check: HealthCheck): this { this.checks.push(check); return this; }
  async run(): Promise<{ status: HealthStatus; checks: HealthResult[] }> {
    const results = await Promise.all(this.checks.map(c => c.check()));
    const status: HealthStatus = results.some(r => r.status === 'down')
      ? 'down' : results.some(r => r.status === 'degraded') ? 'degraded' : 'up';
    return { status, checks: results };
  }
}

// ── Repository diagnostics (latency + error counters) ────────────────────────────
export interface Diagnostics { metrics: MetricsSink; logger: StructuredLogger; now: () => number }

export function createDiagnostics(overrides: Partial<Diagnostics> = {}): Diagnostics {
  return {
    metrics: overrides.metrics ?? new NoopMetrics(),
    logger: overrides.logger ?? new NoopLogger(),
    now: overrides.now ?? (() => Date.now()),
  };
}

/** Wrap a repository so every call records latency + ok/err counters. */
export function instrumentRepository<TEntity extends PersistedEntity, TCreate, TUpdate>(
  inner: Repository<TEntity, TCreate, TUpdate>,
  entity: string,
  diag: Diagnostics,
): Repository<TEntity, TCreate, TUpdate> {
  const time = async <T>(op: string, fn: () => Promise<Result<T>>): Promise<Result<T>> => {
    const start = diag.now();
    const result = await fn();
    diag.metrics.histogram('website.repo.latency_ms', diag.now() - start, { entity, op });
    if (isOk(result)) {
      diag.metrics.counter('website.repo.ok', 1, { entity, op });
    } else {
      diag.metrics.counter('website.repo.err', 1, { entity, op });
      diag.logger.log('warn', 'repository operation failed', { entity, op, code: result.error.code });
    }
    return result;
  };
  return {
    create: input => time('create', () => inner.create(input)),
    getById: (t, id) => time('getById', () => inner.getById(t, id)),
    update: (t, id, patch, v) => time('update', () => inner.update(t, id, patch, v)),
    softDelete: (t, id) => time('softDelete', () => inner.softDelete(t, id)),
    restore: (t, id) => time('restore', () => inner.restore(t, id)),
    list: (t: UUID, req?: PageRequest): Promise<Result<Page<TEntity>>> => time('list', () => inner.list(t, req)),
  };
}
