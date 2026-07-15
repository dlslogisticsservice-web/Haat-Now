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
export type MonitorEvent = { kind: 'error' | 'log' | 'event'; level?: string; message: string; stack?: string; meta?: unknown; at: string; url?: string };
const EVENTS: MonitorEvent[] = [];
const MAX_EVENTS = 50;
function record(e: MonitorEvent) { EVENTS.push(e); if (EVENTS.length > MAX_EVENTS) EVENTS.splice(0, EVENTS.length - MAX_EVENTS); }

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
};
