// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Near-real-time polling primitive (Wave 4, Part 8).
// Pure, app-agnostic + fully testable (inject a timer). Some website surfaces
// (store availability / inventory / geo-timed promotions) have no dedicated realtime
// channel; they poll an existing service on a short interval. Kept separate from the
// app-coupled realtime adapter so it is isomorphic and node-testable.
// ─────────────────────────────────────────────────────────────────────────────

export type Unsub = () => void;

export interface PollTimer {
  set(fn: () => void, ms: number): number;
  clear(handle: number): void;
}

const defaultTimer: PollTimer = {
  set: (fn, ms) => (typeof setInterval !== 'undefined' ? (setInterval(fn, ms) as unknown as number) : 0),
  clear: h => { if (typeof clearInterval !== 'undefined') clearInterval(h as unknown as ReturnType<typeof setInterval>); },
};

/**
 * Poll `fetchOnce` immediately, then every `intervalMs`, invoking `onUpdate` with each
 * result. Returns an unsubscribe. Used for realtime store availability, inventory and
 * geo/timed promotions (near-real-time). `timer` is injectable for tests.
 */
export function createPollingSubscription<T>(
  fetchOnce: () => Promise<T>,
  intervalMs: number,
  onUpdate: (value: T) => void,
  timer: PollTimer = defaultTimer,
): Unsub {
  let active = true;
  const run = () => { void fetchOnce().then(v => { if (active) onUpdate(v); }).catch(() => { /* keep polling */ }); };
  run();
  const handle = timer.set(run, intervalMs);
  return () => { active = false; timer.clear(handle); };
}
