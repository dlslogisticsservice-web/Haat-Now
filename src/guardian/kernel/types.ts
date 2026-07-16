// ─────────────────────────────────────────────────────────────────────────────
// Guardian Kernel · shared types + PORTS.
//
// The kernel is PURE: no React, no DOM, no Supabase, no fetch, no timers of its
// own. Everything the outside world provides enters through a Port. That is what
// makes the kernel runnable in the browser, a Supabase Edge Function, node, and a
// test — and what guarantees it can never reach into business logic.
//
// Adapters (browser/edge/node) are supplied by the HOST at boot, never imported here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result — no throwing across kernel boundaries.
 *
 * NOTE: this repo does not enable `strictNullChecks`, so a bare discriminated union
 * does NOT narrow via `if (r.ok)`. We therefore expose type-predicate guards
 * (`isOk`/`isErr`) — the same idiom the website-platform layer already uses. Always
 * narrow with the guards, never with a raw `.ok` truthiness check.
 */
export interface Ok<T> { ok: true; value: T }
export interface Err<E> { ok: false; error: E }
export type Result<T, E = string> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> { return r.ok; }
export function isErr<T, E>(r: Result<T, E>): r is Err<E> { return !r.ok; }

export type ISODateTime = string;
export type Id = string;

/** Ordered from least to most urgent. Shared by health, incidents and alerts. */
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export const SEVERITY_ORDER: readonly Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
export const severityRank = (s: Severity): number => SEVERITY_ORDER.indexOf(s);
export const maxSeverity = (a: Severity, b: Severity): Severity => (severityRank(a) >= severityRank(b) ? a : b);

/** Health status algebra. `unknown` is NOT green — an unmeasured thing is never healthy. */
export type HealthStatus = 'green' | 'yellow' | 'red' | 'unknown';
const STATUS_ORDER: readonly HealthStatus[] = ['green', 'unknown', 'yellow', 'red'];
/** Composite roll-up: worst-of-children. `yellow` never masks `red`. */
export const worstStatus = (list: readonly HealthStatus[]): HealthStatus =>
  list.reduce<HealthStatus>((w, s) => (STATUS_ORDER.indexOf(s) > STATUS_ORDER.indexOf(w) ? s : w), 'green');

// ── PORTS ────────────────────────────────────────────────────────────────────

/** Time. Injected so tests are deterministic and the kernel never calls Date.now(). */
export interface Clock { now(): number; iso(): ISODateTime }

/** Identity. Injected so ids are deterministic under test. */
export interface IdGenerator { next(prefix?: string): Id }

/** Structured logging sink. The host decides where it goes. */
export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

/** Content hash — used for the tamper-evident audit chain. Default is portable; a host may inject sha256. */
export interface Hasher { hash(input: string): string }

/** Deferred execution. Injected so the kernel owns no timers (and tests need no wall-clock). */
export interface Scheduler {
  setTimer(fn: () => void, ms: number): Id;
  clearTimer(id: Id): void;
}

/** Everything the kernel needs from the outside world. */
export interface KernelPorts {
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
  hasher: Hasher;
  scheduler: Scheduler;
}

// ── Default portable adapters (safe in every runtime; hosts may override) ─────

export const systemClock: Clock = { now: () => Date.now(), iso: () => new Date().toISOString() };

export const counterIds = (seed = 0): IdGenerator => {
  let n = seed;
  return { next: (prefix = 'id') => `${prefix}_${(++n).toString(36)}` };
};

export const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };

/** djb2 — deterministic, dependency-free, portable. Same primitive already used for site signatures. */
export const djb2Hasher: Hasher = {
  hash(input: string): string {
    let h = 5381;
    for (let i = 0; i < input.length; i++) h = ((h * 33) ^ input.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, '0');
  },
};

/** Manual scheduler — the kernel default. Hosts inject a real timer adapter; tests drive it by hand. */
export const manualScheduler = (): Scheduler & { runDue(now: number): number; pending(): number } => {
  const timers = new Map<Id, { at: number; fn: () => void }>();
  let n = 0;
  return {
    setTimer(fn, ms) { const id = `t_${++n}`; timers.set(id, { at: ms, fn }); return id; },
    clearTimer(id) { timers.delete(id); },
    runDue(now) {
      let ran = 0;
      for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); ran++; }
      return ran;
    },
    pending: () => timers.size,
  };
};
