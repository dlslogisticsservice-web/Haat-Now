// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Experience Events Platform (Wave 19).
//
// Makes every Experience decision observable, measurable and replayable. It OBSERVES the runtime
// — it never drives it. Events arrive through the sinks the engine already exposes
// (EventBusPort / AnalyticsPort, and the per-execution onAudience/onFlag/onDecision hooks), so the
// Runtime, Decision Engine, Flags, Experiments, Rollouts and Decision Context are untouched.
//
//   decision → [existing engine sinks] → EventCollector → EventStore → aggregates / replay / export
//
// PURE + DETERMINISTIC: no clock, no randomness, no storage. Timestamps and ids are injected, so
// the same inputs always produce the same stream — which is what makes replay meaningful.
//
// NOTE ON NAMING: `ExperienceEvent` (events.ts, Wave 1) is the AUTHORING/lifecycle contract
// (created/published/archived). This module is the OBSERVABILITY stream, so its type is named
// `ExperienceTelemetryEvent` — two different concerns, no collision in the public barrel.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, DeviceKind, ExperienceId, Json, LocaleCode, PlatformKind, TenantId, TextDirection, Timestamp } from './types';
import type { DecisionContext } from './decision-context';

// ── PART 1 · the unified event model ────────────────────────────────────────────
export type ExperienceTelemetryType =
  | 'decision.evaluated'
  | 'audience.matched'
  | 'flag.evaluated'
  | 'experiment.assigned'
  | 'rollout.decision'
  | 'experience.rendered'
  | 'experience.dismissed'
  | 'experience.clicked'
  | 'experience.converted';

export const TELEMETRY_TYPES: readonly ExperienceTelemetryType[] = [
  'decision.evaluated', 'audience.matched', 'flag.evaluated', 'experiment.assigned',
  'rollout.decision', 'experience.rendered', 'experience.dismissed', 'experience.clicked',
  'experience.converted',
];

/** PART 3 · the context attached to EVERY event. */
export interface EventContext {
  visitorId: string;
  sessionId?: string;
  tenantId: TenantId;
  country?: string;
  locale?: LocaleCode;
  direction?: TextDirection;
  device?: DeviceKind;
  platform?: PlatformKind;
  channel: ChannelId;
  /** Which product surface produced this (customer · merchant · driver · website · admin). */
  surface?: string;
  experienceId?: ExperienceId;
  audiences: string[];
  flags: { [flagId: string]: boolean };
  experiments: { [experimentId: string]: string };
  rollout?: { execute: boolean; reason: string; bucket?: number };
}

export interface ExperienceTelemetryEvent {
  id: string;
  seq: number;
  type: ExperienceTelemetryType;
  at: Timestamp;
  context: EventContext;
  /** Per-type detail: the flag id, the assigned variant, the element clicked, … */
  payload?: { [key: string]: Json };
}

/** Build the attached context from a DecisionContext (PART 3), losslessly but compactly. */
export function eventContextFrom(
  decision: DecisionContext,
  extra: { surface?: string; rollout?: EventContext['rollout'] } = {},
): EventContext {
  const flags: { [k: string]: boolean } = {};
  for (const key of Object.keys(decision.flags ?? {})) flags[key] = !!decision.flags[key].enabled;
  return {
    visitorId: decision.identity.visitorId,
    sessionId: decision.identity.sessionId,
    tenantId: decision.tenantId,
    country: decision.location.country,
    locale: decision.language.locale,
    direction: decision.language.direction,
    device: decision.device.kind,
    platform: decision.device.platform,
    channel: decision.channel,
    surface: extra.surface ?? (decision.attributes.surface as string | undefined),
    experienceId: decision.experienceId,
    audiences: [...decision.audiences],
    flags,
    experiments: { ...decision.experiments },
    rollout: extra.rollout,
  };
}

// ── PART 4 · storage: filter · replay · aggregate · retention · export ──────────
export interface EventQuery {
  types?: ExperienceTelemetryType[];
  visitorId?: string;
  tenantId?: TenantId;
  surface?: string;
  experienceId?: ExperienceId;
  audience?: string;
  flag?: string;
  experiment?: string;
  /** Inclusive ISO bounds (string compare — ISO-8601 sorts lexicographically). */
  since?: Timestamp;
  until?: Timestamp;
  /** Free-text across type, surface, experience, visitor and payload. */
  search?: string;
  limit?: number;
}

export interface EventAggregates {
  totals: { events: number; decisions: number; views: number; clicks: number; dismisses: number; conversions: number };
  rates: { ctr: number; dismissRate: number; conversionRate: number };
  byExperience: Array<{ experienceId: string; views: number; clicks: number; dismisses: number; conversions: number; ctr: number }>;
  flags: Array<{ flagId: string; evaluations: number; on: number; off: number; onRate: number }>;
  audiences: Array<{ audienceId: string; matches: number; views: number; conversions: number }>;
  experiments: Array<{
    experimentId: string;
    variants: Array<{ variant: string; assigned: number; views: number; clicks: number; conversions: number; ctr: number; conversionRate: number }>;
  }>;
  rollout: { evaluated: number; executed: number; adoptionRate: number; reasons: Array<{ reason: string; count: number }> };
}

export interface ExperienceEventStore {
  emit(event: Omit<ExperienceTelemetryEvent, 'id' | 'seq'>): ExperienceTelemetryEvent;
  all(): ExperienceTelemetryEvent[];
  query(q?: EventQuery): ExperienceTelemetryEvent[];
  aggregate(q?: EventQuery): EventAggregates;
  /** PART 4 · replay a filtered slice through a handler, in original order. Returns the count. */
  replay(q: EventQuery | undefined, handler: (e: ExperienceTelemetryEvent) => void): number;
  /** Live feed subscription. Returns an unsubscribe. */
  subscribe(fn: (e: ExperienceTelemetryEvent) => void): () => void;
  export(q?: EventQuery): string;
  clear(): void;
  size(): number;
  retention(): { max: number; stored: number; dropped: number };
}

export interface EventStoreOptions {
  /** Ring-buffer capacity. Oldest events are dropped first and counted. */
  max?: number;
  /** Injected timestamp source — the engine never reads a clock itself. */
  now?: () => Timestamp;
  idPrefix?: string;
}

const rate = (n: number, d: number): number => (d > 0 ? n / d : 0);

export function createExperienceEventStore(opts: EventStoreOptions = {}): ExperienceEventStore {
  const max = opts.max ?? 1000;
  const now = opts.now ?? (() => '');
  const prefix = opts.idPrefix ?? 'evt';

  let buffer: ExperienceTelemetryEvent[] = [];
  let seq = 0;
  let dropped = 0;
  const listeners = new Set<(e: ExperienceTelemetryEvent) => void>();

  const matches = (e: ExperienceTelemetryEvent, q?: EventQuery): boolean => {
    if (!q) return true;
    if (q.types && q.types.length > 0 && !q.types.includes(e.type)) return false;
    if (q.visitorId && e.context.visitorId !== q.visitorId) return false;
    if (q.tenantId && e.context.tenantId !== q.tenantId) return false;
    if (q.surface && e.context.surface !== q.surface) return false;
    if (q.experienceId && e.context.experienceId !== q.experienceId) return false;
    if (q.audience && !e.context.audiences.includes(q.audience)) return false;
    if (q.flag && !(q.flag in e.context.flags)) return false;
    if (q.experiment && !(q.experiment in e.context.experiments)) return false;
    if (q.since && e.at < q.since) return false;
    if (q.until && e.at > q.until) return false;
    if (q.search) {
      const hay = `${e.type} ${e.context.surface ?? ''} ${e.context.experienceId ?? ''} ${e.context.visitorId} ${JSON.stringify(e.payload ?? {})}`.toLowerCase();
      if (!hay.includes(q.search.toLowerCase())) return false;
    }
    return true;
  };

  return {
    emit(input): ExperienceTelemetryEvent {
      const event: ExperienceTelemetryEvent = { ...input, id: `${prefix}_${seq}`, seq, at: input.at || now() };
      seq++;
      buffer.push(event);
      if (buffer.length > max) { buffer = buffer.slice(buffer.length - max); dropped++; }
      listeners.forEach(fn => { try { fn(event); } catch { /* a bad listener must not break emission */ } });
      return event;
    },

    all: () => buffer.slice(),

    query(q) {
      const out = buffer.filter(e => matches(e, q));
      return q?.limit ? out.slice(-q.limit) : out;
    },

    replay(q, handler) {
      let n = 0;
      for (const e of buffer) {
        if (!matches(e, q)) continue;
        try { handler(e); } catch { /* a failing handler must not abort the replay */ }
        n++;
      }
      return n;
    },

    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },

    export(q) {
      return JSON.stringify({ exportedAt: now(), count: this.query(q).length, events: this.query(q) }, null, 2);
    },

    clear() { buffer = []; dropped = 0; },
    size: () => buffer.length,
    retention: () => ({ max, stored: buffer.length, dropped }),

    // ── PART 5 · aggregation ──
    aggregate(q): EventAggregates {
      const events = buffer.filter(e => matches(e, q));
      const count = (t: ExperienceTelemetryType) => events.filter(e => e.type === t).length;

      const views = count('experience.rendered');
      const clicks = count('experience.clicked');
      const dismisses = count('experience.dismissed');
      const conversions = count('experience.converted');

      // per experience
      const expMap = new Map<string, { views: number; clicks: number; dismisses: number; conversions: number }>();
      for (const e of events) {
        const id = e.context.experienceId ?? (e.payload?.experience as string | undefined) ?? '(unknown)';
        if (!['experience.rendered', 'experience.clicked', 'experience.dismissed', 'experience.converted'].includes(e.type)) continue;
        const row = expMap.get(id) ?? { views: 0, clicks: 0, dismisses: 0, conversions: 0 };
        if (e.type === 'experience.rendered') row.views++;
        if (e.type === 'experience.clicked') row.clicks++;
        if (e.type === 'experience.dismissed') row.dismisses++;
        if (e.type === 'experience.converted') row.conversions++;
        expMap.set(id, row);
      }

      // flag usage
      const flagMap = new Map<string, { evaluations: number; on: number }>();
      for (const e of events) {
        if (e.type !== 'flag.evaluated') continue;
        const id = String(e.payload?.flagId ?? '');
        if (!id) continue;
        const row = flagMap.get(id) ?? { evaluations: 0, on: 0 };
        row.evaluations++;
        if (e.payload?.enabled === true) row.on++;
        flagMap.set(id, row);
      }

      // Audience performance.
      // `audience.matched` names ONE audience in its payload while its context carries the whole
      // matched set — counting the context array here would multiply every match by the number of
      // matched audiences. Matches come from the payload; views/conversions are attributed to
      // every audience the visitor was in when the surface was shown.
      const audMap = new Map<string, { matches: number; views: number; conversions: number }>();
      const audRow = (id: string) => {
        const row = audMap.get(id) ?? { matches: 0, views: 0, conversions: 0 };
        audMap.set(id, row);
        return row;
      };
      for (const e of events) {
        if (e.type === 'audience.matched') {
          const id = String(e.payload?.audienceId ?? '');
          if (id) audRow(id).matches++;
          continue;
        }
        if (e.type !== 'experience.rendered' && e.type !== 'experience.converted') continue;
        for (const a of e.context.audiences) {
          const row = audRow(a);
          if (e.type === 'experience.rendered') row.views++;
          else row.conversions++;
        }
      }

      // experiment results
      const xpMap = new Map<string, Map<string, { assigned: number; views: number; clicks: number; conversions: number }>>();
      const bump = (expId: string, variant: string, k: 'assigned' | 'views' | 'clicks' | 'conversions') => {
        const variants = xpMap.get(expId) ?? new Map();
        const row = variants.get(variant) ?? { assigned: 0, views: 0, clicks: 0, conversions: 0 };
        row[k]++;
        variants.set(variant, row);
        xpMap.set(expId, variants);
      };
      for (const e of events) {
        if (e.type === 'experiment.assigned') {
          bump(String(e.payload?.experimentId ?? ''), String(e.payload?.variant ?? ''), 'assigned');
          continue;
        }
        for (const [expId, variant] of Object.entries(e.context.experiments)) {
          if (e.type === 'experience.rendered') bump(expId, variant, 'views');
          if (e.type === 'experience.clicked') bump(expId, variant, 'clicks');
          if (e.type === 'experience.converted') bump(expId, variant, 'conversions');
        }
      }

      // rollout adoption
      const rolloutEvents = events.filter(e => e.type === 'rollout.decision');
      const reasons = new Map<string, number>();
      let executed = 0;
      for (const e of rolloutEvents) {
        const reason = String(e.payload?.reason ?? e.context.rollout?.reason ?? 'unknown');
        reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
        if (e.payload?.execute === true || e.context.rollout?.execute) executed++;
      }

      return {
        totals: { events: events.length, decisions: count('decision.evaluated'), views, clicks, dismisses, conversions },
        rates: { ctr: rate(clicks, views), dismissRate: rate(dismisses, views), conversionRate: rate(conversions, views) },
        byExperience: [...expMap.entries()]
          .map(([experienceId, r]) => ({ experienceId, ...r, ctr: rate(r.clicks, r.views) }))
          .sort((a, b) => b.views - a.views),
        flags: [...flagMap.entries()]
          .map(([flagId, r]) => ({ flagId, evaluations: r.evaluations, on: r.on, off: r.evaluations - r.on, onRate: rate(r.on, r.evaluations) }))
          .sort((a, b) => b.evaluations - a.evaluations),
        audiences: [...audMap.entries()]
          .map(([audienceId, r]) => ({ audienceId, ...r }))
          .sort((a, b) => b.views - a.views),
        experiments: [...xpMap.entries()].map(([experimentId, variants]) => ({
          experimentId,
          variants: [...variants.entries()]
            .map(([variant, r]) => ({ variant, ...r, ctr: rate(r.clicks, r.views), conversionRate: rate(r.conversions, r.views) }))
            .sort((a, b) => b.assigned - a.assigned),
        })),
        rollout: {
          evaluated: rolloutEvents.length,
          executed,
          adoptionRate: rate(executed, rolloutEvents.length),
          reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
        },
      };
    },
  };
}

// ── PART 2 · the collector: existing engine sinks → events, automatically ────────
export interface DecisionSnapshot {
  decision: DecisionContext;
  surface?: string;
  rollout?: EventContext['rollout'];
  /** Audience ids that were evaluated but did not match (for audience.matched accounting). */
  rejectedAudiences?: string[];
}

/**
 * Behavioural signals a surface may attach to an interaction (Wave 20.1). These are what make a
 * Visitor Profile meaningful — `category` and `merchant` feed preferred categories / favourite
 * merchants directly; the rest are carried for segmentation and analysis.
 */
export interface InteractionSignals {
  category?: string;
  merchant?: string;
  campaign?: string;
  offer?: string;
  cuisine?: string;
  storeType?: string;
}

export interface SurfaceEvent extends InteractionSignals {
  experienceId: string;
  surface?: string;
  element?: string;
  metric?: string;
  value?: number;
}

const SIGNAL_KEYS: Array<keyof InteractionSignals> = ['category', 'merchant', 'campaign', 'offer', 'cuisine', 'storeType'];

/** Copy only the signals that were actually supplied — never invent a signal. */
export function signalPayload(s: InteractionSignals): { [k: string]: Json } {
  const out: { [k: string]: Json } = {};
  for (const key of SIGNAL_KEYS) {
    const v = s[key];
    if (typeof v === 'string' && v.length > 0) out[key] = v;
  }
  return out;
}

/**
 * Turns one decision into the full event set, and exposes the sink adapters the engine already
 * accepts. Nothing here creates events by hand at a call site — a decision or a surface
 * interaction is described once and the collector derives every event from it.
 */
export interface ExperienceEventCollector {
  store: ExperienceEventStore;
  /** Emits decision.evaluated + audience.matched + flag.evaluated + experiment.assigned + rollout.decision. */
  recordDecision(snapshot: DecisionSnapshot): ExperienceTelemetryEvent[];
  recordRendered(ctx: EventContext, e: SurfaceEvent): ExperienceTelemetryEvent;
  recordDismissed(ctx: EventContext, e: SurfaceEvent): ExperienceTelemetryEvent;
  recordClicked(ctx: EventContext, e: SurfaceEvent): ExperienceTelemetryEvent;
  recordConverted(ctx: EventContext, e: SurfaceEvent): ExperienceTelemetryEvent;
}

export function createExperienceEventCollector(store: ExperienceEventStore): ExperienceEventCollector {
  const emit = (type: ExperienceTelemetryType, context: EventContext, payload?: { [k: string]: Json }) =>
    store.emit({ type, at: context.experienceId !== undefined ? '' : '', context, payload });

  const surfaceEvent = (type: ExperienceTelemetryType, ctx: EventContext, e: SurfaceEvent) =>
    store.emit({
      type,
      at: '',
      context: { ...ctx, experienceId: e.experienceId, surface: e.surface ?? ctx.surface },
      payload: {
        experience: e.experienceId,
        ...(e.element ? { element: e.element } : {}),
        ...(e.metric ? { metric: e.metric } : {}),
        ...(typeof e.value === 'number' ? { value: e.value } : {}),
        ...signalPayload(e),
      },
    });

  return {
    store,

    recordDecision({ decision, surface, rollout, rejectedAudiences }): ExperienceTelemetryEvent[] {
      const context = eventContextFrom(decision, { surface, rollout });
      const out: ExperienceTelemetryEvent[] = [];

      out.push(emit('decision.evaluated', context, {
        audiences: context.audiences.length,
        flags: Object.keys(context.flags).length,
        experiments: Object.keys(context.experiments).length,
        ...(rejectedAudiences ? { rejectedAudiences: rejectedAudiences.length } : {}),
      }));

      for (const audienceId of context.audiences) out.push(emit('audience.matched', context, { audienceId }));
      for (const flagId of Object.keys(context.flags)) {
        out.push(emit('flag.evaluated', context, { flagId, enabled: context.flags[flagId] }));
      }
      for (const [experimentId, variant] of Object.entries(context.experiments)) {
        out.push(emit('experiment.assigned', context, { experimentId, variant }));
      }
      if (rollout) out.push(emit('rollout.decision', context, { execute: rollout.execute, reason: rollout.reason, ...(typeof rollout.bucket === 'number' ? { bucket: rollout.bucket } : {}) }));

      return out;
    },

    recordRendered: (ctx, e) => surfaceEvent('experience.rendered', ctx, e),
    recordDismissed: (ctx, e) => surfaceEvent('experience.dismissed', ctx, e),
    recordClicked: (ctx, e) => surfaceEvent('experience.clicked', ctx, e),
    recordConverted: (ctx, e) => surfaceEvent('experience.converted', ctx, e),
  };
}
