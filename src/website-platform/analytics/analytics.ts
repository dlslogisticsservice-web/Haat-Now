// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Website analytics (Wave 2).
// Typed analytics events for the public website + a cookieless-friendly tracker.
// Tracks visits, funnels, conversion, downloads, app opens, checkout abandonment,
// Conversion-Engine performance, coupon usage, and deep-link success. Privacy-first
// (no PII; hashed identifiers). Reusable by every white-label tenant.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, ISODateTime, Result } from '../shared/types';
import { ok, isOk } from '../shared/types';
import type { JsonObject } from '../domain/entities';
import type { CollectionRepository } from '../repositories/collection';
import { createCollection } from '../repositories/collection';
import type { RepositoryBackend } from '../repositories/registry';

export type WebsiteAnalyticsType =
  | 'page_view' | 'funnel_step' | 'conversion' | 'app_download_click' | 'app_open'
  | 'checkout_abandoned' | 'conversion_shown' | 'conversion_clicked' | 'conversion_dismissed'
  | 'coupon_used' | 'deep_link_success' | 'deep_link_fallback' | 'search';

export interface WebsiteAnalyticsEvent {
  type: WebsiteAnalyticsType;
  tenantId: UUID;
  anonId: string;                 // salted, cookieless-capable first-party id (no PII)
  path: string;
  locale: string;
  device: 'mobile' | 'tablet' | 'desktop';
  country: string | null;
  campaignSource: string | null;
  props: JsonObject;              // event-specific fields (rule id, coupon, funnel step, …)
  at: ISODateTime;
}

export type AnalyticsInput = Omit<WebsiteAnalyticsEvent, 'at'> & { at?: ISODateTime };

/** A destination for analytics events (edge beacon in prod; memory in tests). */
export interface AnalyticsSink {
  emit(event: WebsiteAnalyticsEvent): Promise<Result<true>>;
}

export class MemoryAnalyticsSink implements AnalyticsSink {
  readonly events: WebsiteAnalyticsEvent[] = [];
  async emit(event: WebsiteAnalyticsEvent): Promise<Result<true>> {
    this.events.push(event);
    return ok(true);
  }
  ofType(type: WebsiteAnalyticsType): WebsiteAnalyticsEvent[] {
    return this.events.filter(e => e.type === type);
  }
}

export class AnalyticsTracker {
  constructor(
    private readonly sink: AnalyticsSink,
    private readonly clock: () => ISODateTime = () => new Date().toISOString(),
  ) {}

  track(input: AnalyticsInput): Promise<Result<true>> {
    return this.sink.emit({ ...input, at: input.at ?? this.clock() });
  }

  // Convenience helpers for the most common events.
  pageView(base: Omit<AnalyticsInput, 'type' | 'props'>, props: JsonObject = {}): Promise<Result<true>> {
    return this.track({ ...base, type: 'page_view', props });
  }
  conversionShown(base: Omit<AnalyticsInput, 'type' | 'props'>, ruleId: UUID): Promise<Result<true>> {
    return this.track({ ...base, type: 'conversion_shown', props: { ruleId } });
  }
  deepLink(base: Omit<AnalyticsInput, 'type' | 'props'>, success: boolean): Promise<Result<true>> {
    return this.track({ ...base, type: success ? 'deep_link_success' : 'deep_link_fallback', props: {} });
  }
  couponUsed(base: Omit<AnalyticsInput, 'type' | 'props'>, code: string): Promise<Result<true>> {
    return this.track({ ...base, type: 'coupon_used', props: { code } });
  }
}

// ── Funnel computation ─────────────────────────────────────────────────────────────
export interface FunnelStepResult { step: string; count: number; conversionPct: number }

/** Compute a funnel (ordered steps) from funnel_step events. */
export function computeFunnel(events: ReadonlyArray<WebsiteAnalyticsEvent>, steps: ReadonlyArray<string>): FunnelStepResult[] {
  const counts = steps.map(step => new Set(
    events.filter(e => e.type === 'funnel_step' && e.props.step === step).map(e => e.anonId),
  ).size);
  const top = counts[0] || 0;
  return steps.map((step, i) => ({ step, count: counts[i], conversionPct: top ? Math.round((counts[i] / top) * 100) : 0 }));
}

/** Conversion-Engine performance summary (shown → clicked → dismissed). */
export interface ConversionPerf { shown: number; clicked: number; dismissed: number; ctr: number }
export function conversionPerformance(events: ReadonlyArray<WebsiteAnalyticsEvent>): ConversionPerf {
  const shown = events.filter(e => e.type === 'conversion_shown').length;
  const clicked = events.filter(e => e.type === 'conversion_clicked').length;
  const dismissed = events.filter(e => e.type === 'conversion_dismissed').length;
  return { shown, clicked, dismissed, ctr: shown ? Math.round((clicked / shown) * 100) : 0 };
}

// ── Collection-backed sink (durable; website_analytics_events) ────────────────────
type AnalyticsRow = { id: UUID; tenantId: UUID; type: WebsiteAnalyticsType; anonId: string; path: string; locale: string; device: string; country: string | null; campaignSource: string | null; props: JsonObject; createdAt: ISODateTime } & Record<string, unknown>;

export class CollectionAnalyticsSink implements AnalyticsSink {
  constructor(
    private readonly col: CollectionRepository<AnalyticsRow>,
    private readonly idgen: () => UUID = () => crypto.randomUUID(),
  ) {}
  async emit(event: WebsiteAnalyticsEvent): Promise<Result<true>> {
    const row: AnalyticsRow = {
      id: this.idgen(), tenantId: event.tenantId, type: event.type, anonId: event.anonId,
      path: event.path, locale: event.locale, device: event.device, country: event.country,
      campaignSource: event.campaignSource, props: event.props, createdAt: event.at,
    };
    const r = await this.col.insert(row);
    return isOk(r) ? ok(true) : r;
  }
}

export function createAnalyticsSink(backend: RepositoryBackend): AnalyticsSink {
  return backend === 'memory' ? new MemoryAnalyticsSink() : new CollectionAnalyticsSink(createCollection<AnalyticsRow>(backend, 'website_analytics_events'));
}

export function createAnalyticsTracker(sink: AnalyticsSink = new MemoryAnalyticsSink()): AnalyticsTracker {
  return new AnalyticsTracker(sink);
}
