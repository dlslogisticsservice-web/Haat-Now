// ─────────────────────────────────────────────────────────────────────────────
// Monitoring seam — crash reporting + analytics + production logging.
// Real architecture with a provider-agnostic interface. Defaults to console.
// The OPERATOR injects a provider by setting env vars (the only remaining step):
//   VITE_SENTRY_DSN     → crash reporting endpoint (POST envelope)
//   VITE_ANALYTICS_URL  → analytics collector endpoint (POST events)
// No SDK dependency is bundled; we POST minimal payloads so there is no vendor
// lock-in and no PII beyond what the caller passes. NOT a mock — when the env
// var is set, events are actually sent.
// ─────────────────────────────────────────────────────────────────────────────
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ANALYTICS_URL = import.meta.env.VITE_ANALYTICS_URL as string | undefined;
const PROD = import.meta.env.PROD;

function post(url: string, body: unknown) {
  try {
    if ('sendBeacon' in navigator) navigator.sendBeacon(url, JSON.stringify(body));
    else fetch(url, { method: 'POST', body: JSON.stringify(body), keepalive: true }).catch(() => {});
  } catch { /* never throw from telemetry */ }
}

// In-memory ring buffer of the most recent events so an operational dashboard (Launch
// Guardian) can surface crashes/logs without a backend. Bounded, reset on reload (the
// durable copy lives at the configured telemetry backend). Read-only companion to the
// existing seam — no new service.
/** Where a captured signal came from. Optional: older callers simply omit it. */
export type MonitorSource = 'react' | 'console' | 'api' | 'network' | 'performance' | 'app';
export type MonitorEvent = { kind: 'error' | 'log' | 'event'; level?: string; message: string; stack?: string; meta?: unknown; at: string; url?: string; source?: MonitorSource };
const EVENTS: MonitorEvent[] = [];
const MAX_EVENTS = 50;
function record(e: MonitorEvent) { EVENTS.push(e); if (EVENTS.length > MAX_EVENTS) EVENTS.splice(0, EVENTS.length - MAX_EVENTS); }

// ── global capture (see monitoring.installGlobalCapture) ─────────────────────
/** Hooks are installed once per document. */
let installed = false;
/**
 * Re-entrancy guard. A capture hook must never trigger itself — patching console.error
 * while recording through a path that logs, or capturing our own telemetry fetch, would
 * spin. `guard` also swallows: telemetry may never become the incident it reports.
 */
let capturing = false;
function guard(fn: () => void): void {
  if (capturing) return;
  capturing = true;
  try { fn(); } catch { /* never throw from telemetry */ } finally { capturing = false; }
}
/** A main-thread block beyond this is user-visible jank. */
const LONG_TASK_MS = 200;

export const monitoring = {
  /** Report a crash / uncaught error. Console in dev; POST to the DSN when configured. */
  captureError(error: unknown, context?: Record<string, unknown>) {
    const payload = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context, app_version: '1.0.0', at: new Date().toISOString(),
      url: typeof location !== 'undefined' ? location.href : undefined,
    };
    if (!PROD) console.error('[monitoring.captureError]', payload);
    record({ kind: 'error', message: payload.message, stack: payload.stack, meta: context, at: payload.at, url: payload.url });
    if (SENTRY_DSN) post(SENTRY_DSN, payload);
  },

  /** Track a product analytics event. */
  track(event: string, props?: Record<string, unknown>) {
    const payload = { event, props, at: new Date().toISOString() };
    if (!PROD) console.debug('[monitoring.track]', payload);
    record({ kind: 'event', message: event, meta: props, at: payload.at });
    if (ANALYTICS_URL) post(ANALYTICS_URL, payload);
  },

  /** Structured production log. */
  log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
    const line = { level, message, meta, at: new Date().toISOString() };
    record({ kind: 'log', level, message, meta, at: line.at });
    if (level === 'error') console.error('[log]', line);
    else if (level === 'warn') console.warn('[log]', line);
    else if (!PROD) console.info('[log]', line);
  },

  /** Most-recent buffered events (newest first) for the Launch Guardian dashboard. */
  recentEvents(): MonitorEvent[] { return EVENTS.slice().reverse(); },

  /** Whether a real crash-reporting backend is wired (operator env). */
  isCrashReportingEnabled() { return !!SENTRY_DSN; },
  isAnalyticsEnabled() { return !!ANALYTICS_URL; },

  /**
   * Start capturing runtime health into THIS seam (no second collector exists).
   * Idempotent; safe to call once at boot from main.tsx.
   *
   * Captures: uncaught errors + React render crashes (window 'error'), rejected promises,
   * console.error/warn (where React reports component errors), failed API calls and network
   * faults (fetch), and long tasks (performance).
   *
   * Telemetry must never become the incident: every hook is wrapped, re-entrancy is guarded,
   * and our own telemetry endpoints are skipped so a failing DSN cannot feed itself.
   */
  installGlobalCapture(): void {
    if (installed || typeof window === 'undefined') return;
    installed = true;

    window.addEventListener('error', (ev) => {
      guard(() => record({
        kind: 'error', source: 'react',
        message: ev.message || 'Uncaught error',
        stack: ev.error instanceof Error ? ev.error.stack : undefined,
        at: new Date().toISOString(), url: location.href,
      }));
    });

    window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
      guard(() => record({
        kind: 'error', source: 'react',
        message: `Unhandled rejection: ${ev.reason instanceof Error ? ev.reason.message : String(ev.reason)}`,
        stack: ev.reason instanceof Error ? ev.reason.stack : undefined,
        at: new Date().toISOString(), url: location.href,
      }));
    });

    // React reports component errors and key/prop warnings through console.
    for (const level of ['error', 'warn'] as const) {
      const original = console[level].bind(console);
      console[level] = (...args: unknown[]) => {
        original(...args);
        guard(() => {
          const message = args.map(a => (a instanceof Error ? a.message : typeof a === 'string' ? a : '')).join(' ').trim();
          if (!message || message.startsWith('[log]') || message.startsWith('[monitoring')) return;  // our own output
          record({ kind: 'log', level, source: 'console', message: message.slice(0, 300), at: new Date().toISOString(), url: location.href });
        });
      };
    }

    // API + network faults.
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const telemetry = (SENTRY_DSN && url.startsWith(SENTRY_DSN)) || (ANALYTICS_URL && url.startsWith(ANALYTICS_URL));
      const t0 = performance.now();
      try {
        const res = await nativeFetch(input as any, init);
        if (!telemetry && !res.ok) {
          guard(() => record({
            kind: 'error', source: 'api',
            message: `${res.status} ${res.statusText} — ${url}`,
            meta: { status: res.status, ms: Math.round(performance.now() - t0) },
            at: new Date().toISOString(), url,
          }));
        }
        return res;
      } catch (e) {
        if (!telemetry) {
          guard(() => record({
            kind: 'error', source: 'network',
            message: `Network failure — ${url}`,
            stack: e instanceof Error ? e.stack : undefined,
            at: new Date().toISOString(), url,
          }));
        }
        throw e;
      }
    };

    // Performance warnings — long tasks block the main thread (jank).
    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration < LONG_TASK_MS) continue;
          guard(() => record({
            kind: 'log', level: 'warn', source: 'performance',
            message: `Long task blocked the main thread for ${Math.round(entry.duration)}ms`,
            meta: { ms: Math.round(entry.duration) },
            at: new Date().toISOString(), url: location.href,
          }));
        }
      });
      obs.observe({ entryTypes: ['longtask'] });
    } catch { /* longtask unsupported (Safari/Firefox) — the other captures still run */ }
  },
};
