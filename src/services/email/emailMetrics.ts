// ─────────────────────────────────────────────────────────────────────────────
// Email metrics — in-memory counters + timing, exposed as a dashboard-ready snapshot.
// Fed by emailMonitoring. Pure aside from caller-supplied durations.
// ─────────────────────────────────────────────────────────────────────────────
export type EmailCounter =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'deferred'
  | 'failed'
  | 'dead_lettered'
  | 'retries'
  | 'opened'
  | 'clicked';

const COUNTERS: EmailCounter[] = ['queued', 'sent', 'delivered', 'deferred', 'failed', 'dead_lettered', 'retries', 'opened', 'clicked'];

interface State {
  counters: Record<EmailCounter, number>;
  sendMsTotal: number;
  sendMsCount: number;
  lastFailure: { at: number; template?: string; error?: string } | null;
}

const zero = (): State => ({
  counters: COUNTERS.reduce((a, c) => { a[c] = 0; return a; }, {} as Record<EmailCounter, number>),
  sendMsTotal: 0, sendMsCount: 0, lastFailure: null,
});

let state = zero();
const rate = (n: number, d: number): number => (d > 0 ? Number((n / d).toFixed(4)) : 0);

export interface EmailMetricsSnapshot {
  counters: Record<EmailCounter, number>;
  rates: {
    deliveryRate: number;   // delivered / sent
    failureRate: number;    // failed / (sent + failed)
    openRate: number;       // opened / delivered
    clickRate: number;      // clicked / delivered
  };
  averageSendMs: number;
  retryCount: number;
  lastFailure: State['lastFailure'];
}

export const emailMetrics = {
  inc(counter: EmailCounter, by = 1): void { state.counters[counter] += by; },
  observeSendMs(ms: number): void { if (ms >= 0 && Number.isFinite(ms)) { state.sendMsTotal += ms; state.sendMsCount += 1; } },
  recordFailure(at: number, template?: string, error?: string): void { state.lastFailure = { at, template, error }; },

  snapshot(): EmailMetricsSnapshot {
    const c = state.counters;
    return {
      counters: { ...c },
      rates: {
        deliveryRate: rate(c.delivered, c.sent),
        failureRate: rate(c.failed, c.sent + c.failed),
        openRate: rate(c.opened, c.delivered),
        clickRate: rate(c.clicked, c.delivered),
      },
      averageSendMs: state.sendMsCount > 0 ? Math.round(state.sendMsTotal / state.sendMsCount) : 0,
      retryCount: c.retries,
      lastFailure: state.lastFailure,
    };
  },

  reset(): void { state = zero(); },
};
