// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Launch validation funnel (Launch Sprint 2, Part 8).
// A pure, node-testable aggregator over commerce funnel events → the 7 launch metrics:
// checkout completion, cart abandonment, website→app conversion, order success, refund
// flow, support flow, and tracking latency (p50/p95). The browser recorder reuses the
// existing monitoring seam (no new analytics pipeline, no duplicated logic).
// ─────────────────────────────────────────────────────────────────────────────

export type FunnelEventType =
  | 'discovery_view'      // a discovery/merchant page was viewed (funnel entry)
  | 'add_to_cart'
  | 'checkout_started'
  | 'checkout_completed'
  | 'cart_abandoned'
  | 'website_to_app'      // user chose to continue in the app (hand-off)
  | 'order_success'
  | 'order_failed'
  | 'refund_requested'
  | 'refund_completed'
  | 'support_contacted'
  | 'support_resolved'
  | 'tracking_update';    // carries latencyMs = time from driver ping → UI update

export interface FunnelEvent {
  type: FunnelEventType;
  at: number;             // epoch ms
  sessionId?: string;
  value?: number;         // order/cart value where relevant
  latencyMs?: number;     // tracking_update latency
  meta?: Record<string, unknown>;
}

export interface LaunchMetrics {
  checkoutCompletionRate: number;   // completed / started
  cartAbandonmentRate: number;      // 1 − (started / add_to_cart)
  websiteToAppConversion: number;   // website_to_app / discovery_view (unique sessions)
  orderSuccessRate: number;         // success / (success + failed)
  refundFlowCompletion: number;     // refund_completed / refund_requested
  supportFlowCompletion: number;    // support_resolved / support_contacted
  trackingLatencyP50Ms: number | null;
  trackingLatencyP95Ms: number | null;
  counts: Record<FunnelEventType, number>;
  sampleSize: number;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function uniqueSessions(events: ReadonlyArray<FunnelEvent>, type: FunnelEventType): number {
  const s = new Set<string>();
  let anon = 0;
  for (const e of events) if (e.type === type) { if (e.sessionId) s.add(e.sessionId); else anon++; }
  return s.size + anon;
}

/** Compute the 7 launch metrics from a raw event log. Pure. */
export function computeLaunchMetrics(events: ReadonlyArray<FunnelEvent>): LaunchMetrics {
  const counts = {
    discovery_view: 0, add_to_cart: 0, checkout_started: 0, checkout_completed: 0,
    cart_abandoned: 0, website_to_app: 0, order_success: 0, order_failed: 0,
    refund_requested: 0, refund_completed: 0, support_contacted: 0, support_resolved: 0,
    tracking_update: 0,
  } as Record<FunnelEventType, number>;
  const latencies: number[] = [];
  for (const e of events) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    if (e.type === 'tracking_update' && typeof e.latencyMs === 'number') latencies.push(e.latencyMs);
  }
  latencies.sort((a, b) => a - b);

  return {
    checkoutCompletionRate: ratio(counts.checkout_completed, counts.checkout_started),
    cartAbandonmentRate: counts.add_to_cart > 0 ? 1 - ratio(counts.checkout_started, counts.add_to_cart) : 0,
    websiteToAppConversion: ratio(uniqueSessions(events, 'website_to_app'), uniqueSessions(events, 'discovery_view')),
    orderSuccessRate: ratio(counts.order_success, counts.order_success + counts.order_failed),
    refundFlowCompletion: ratio(counts.refund_completed, counts.refund_requested),
    supportFlowCompletion: ratio(counts.support_resolved, counts.support_contacted),
    trackingLatencyP50Ms: percentile(latencies, 50),
    trackingLatencyP95Ms: percentile(latencies, 95),
    counts,
    sampleSize: events.length,
  };
}

/** A tiny in-memory recorder. `emit` bridges to the existing monitoring seam in the browser
 *  (e.g. monitoring.track); it is optional so the recorder is fully node-testable. */
export interface FunnelRecorder {
  record(type: FunnelEventType, at: number, extra?: Partial<Omit<FunnelEvent, 'type' | 'at'>>): void;
  events(): ReadonlyArray<FunnelEvent>;
  metrics(): LaunchMetrics;
  reset(): void;
}

export function createFunnelRecorder(emit?: (e: FunnelEvent) => void): FunnelRecorder {
  let log: FunnelEvent[] = [];
  return {
    record(type, at, extra) {
      const e: FunnelEvent = { type, at, ...extra };
      log.push(e);
      if (emit) { try { emit(e); } catch { /* never let telemetry break UX */ } }
    },
    events() { return log; },
    metrics() { return computeLaunchMetrics(log); },
    reset() { log = []; },
  };
}
