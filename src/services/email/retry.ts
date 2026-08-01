// ─────────────────────────────────────────────────────────────────────────────
// Retry + timeout primitives. Pure/deterministic where it matters: backoffMs takes
// the attempt number and returns a delay (exponential, capped) with no clock/random,
// so scheduling is unit-testable. `sleep` is the only real-time piece and is injectable.
// ─────────────────────────────────────────────────────────────────────────────
export interface RetryOptions {
  /** Total attempts (1 = no retry). */
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryOptions = { attempts: 3, baseDelayMs: 500, maxDelayMs: 15_000 };

/** Exponential backoff for a 1-based attempt index, capped at maxDelayMs. */
export function backoffMs(attempt: number, o: RetryOptions = DEFAULT_RETRY): number {
  const exp = o.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(o.maxDelayMs, Math.max(0, Math.round(exp)));
}

export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

/**
 * Resolve a promise or, if it does not settle within `ms`, resolve with `onTimeout()`.
 * Never rejects — the caller gets a value either way (used to convert a hung fetch into
 * a structured timeout result). Uses AbortController-independent timing.
 */
export function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; resolve(onTimeout()); } }, ms);
    const finish = (v: T) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };
    p.then(finish).catch(() => finish(onTimeout()));
  });
}
