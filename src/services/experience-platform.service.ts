// ─────────────────────────────────────────────────────────────────────────────
// Experience Platform · the product's single access point to the Experience Runtime.
//
// This is WIRING, not a new engine. It creates ONE ExperienceEngine (Waves 1–18) for the whole
// application and gives every surface — Customer app, Merchant portal, Driver portal, Website,
// Admin — the same decision:
//
//   Decision Context → Audiences → Feature Flags → Experiments → Rollout
//
// Nothing here re-implements a registry, resolver, policy, renderer or metric. Every capability
// is the one already built; this module only registers the platform's own definitions and exposes
// a React hook so screens can ask "is this on for this visitor?".
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import {
  createExperienceEngine, createTargetResolver, createFeatureFlagResolver,
  createExperimentRegistry, createExperimentTracker, createExperimentPolicy,
  createDecisionContextBuilder, baseDecisionContext, decisionUnitId, allocateVariant,
  createExperienceEventStore, createExperienceEventCollector, eventContextFrom,
  deriveVisitorProfile, deriveSegments, personalize,
  type VisitorProfile, type BehaviouralSegment, type ExperienceCandidate, type PersonalizationDecision,
  type ExperienceEventCollector, type ExperienceEventStore, type EventContext, type ExperienceTelemetryEvent, type InteractionSignals,
  type Audience, type DecisionContext, type ExperienceContext, type ExperienceEngine,
  type Experiment, type ExperimentReport, type ExperimentTracker, type ExperimentRegistry,
  type FeatureFlag, type RolloutConfig, type TargetResolver, type FeatureFlagResolver,
} from '../experience-engine';
import { resolveWebsiteVisitor } from '../experience-channels/website/visitor';
import { monitoring } from './monitoring.service';
import { hydrateExperienceState, persistedFlag, persistedExperimentStatus, persistedRollout, hydrateVisitorHistory, persistedVisitorHistory, saveVisitorHistory } from './experience-state.service';

export type Surface = 'website' | 'customer' | 'merchant' | 'driver' | 'admin';

// ── Platform definitions ─────────────────────────────────────────────────────────
// Targeting configuration (not content): who a rule applies to. Editable from the Admin
// Experience Center at runtime; these are the shipped defaults.
export const PLATFORM_AUDIENCES: Audience[] = [
  { metadata: { id: 'aud.mobile', name: 'Mobile visitors', version: '1.0.0', priority: 10, description: 'Phones and tablets' },
    segments: [{ id: 's', rules: [{ criteria: { devices: ['mobile', 'tablet'] } }] }] },
  { metadata: { id: 'aud.desktop', name: 'Desktop visitors', version: '1.0.0', priority: 10, description: 'Laptop and desktop' },
    segments: [{ id: 's', rules: [{ criteria: { devices: ['desktop'] } }] }] },
  { metadata: { id: 'aud.arabic', name: 'Arabic speakers', version: '1.0.0', priority: 20, description: 'Locale is Arabic (RTL)' },
    segments: [{ id: 's', rules: [{ criteria: { locales: ['ar'] } }] }] },
  { metadata: { id: 'aud.gcc', name: 'GCC region', version: '1.0.0', priority: 30, description: 'Saudi, UAE, Kuwait, Qatar, Bahrain, Oman' },
    segments: [{ id: 's', rules: [{ criteria: { countries: ['SA', 'AE', 'KW', 'QA', 'BH', 'OM'] } }] }] },
  { metadata: { id: 'aud.egypt', name: 'Egypt', version: '1.0.0', priority: 30, description: 'Visitors in Egypt' },
    segments: [{ id: 's', rules: [{ criteria: { countries: ['EG'] } }] }] },
  { metadata: { id: 'aud.merchants', name: 'Merchant users', version: '1.0.0', priority: 40, description: 'Signed-in merchant role' },
    segments: [{ id: 's', rules: [{ criteria: { roles: ['merchant'] } }] }] },
  { metadata: { id: 'aud.drivers', name: 'Driver users', version: '1.0.0', priority: 40, description: 'Signed-in driver role' },
    segments: [{ id: 's', rules: [{ criteria: { roles: ['driver'] } }] }] },
];

/** Feature switches the product reads. `default.enabled` is the shipped state. */
export const PLATFORM_FLAGS: FeatureFlag[] = [
  { metadata: { id: 'flag.customer_welcome', name: 'Customer welcome banner', version: '1.0.0', priority: 10, description: 'Personalised greeting on the customer home' },
    enabled: true, default: { enabled: true } },
  { metadata: { id: 'flag.customer_offers', name: 'Offers & coupons rail', version: '1.0.0', priority: 10, description: 'Offer discovery card on home' },
    enabled: true, default: { enabled: false },
    rules: [{ id: 'gcc-on', criteria: { audiences: ['aud.gcc'] }, enabled: true }] },
  { metadata: { id: 'flag.customer_feature_tour', name: 'Feature discovery', version: '1.0.0', priority: 5, description: 'First-run feature discovery hint' },
    enabled: true, default: { enabled: false }, rules: [{ id: 'mobile', criteria: { audiences: ['aud.mobile'] }, enabled: true }] },
  { metadata: { id: 'flag.merchant_beta_dashboard', name: 'Merchant beta dashboard', version: '1.0.0', priority: 10, description: 'Next-generation merchant analytics' },
    enabled: true, default: { enabled: false } },
  { metadata: { id: 'flag.merchant_announcements', name: 'Merchant announcements', version: '1.0.0', priority: 10, description: 'Portal announcement strip' },
    enabled: true, default: { enabled: true } },
  { metadata: { id: 'flag.driver_beta_tools', name: 'Driver beta tools', version: '1.0.0', priority: 10, description: 'Experimental driver utilities' },
    enabled: true, default: { enabled: false } },
  // Wave 20.1 · additional candidates so each portal has a real set for personalization to rank.
  { metadata: { id: 'flag.merchant_education', name: 'Merchant education card', version: '1.0.0', priority: 5, description: 'How-to guidance for portal features' },
    enabled: true, default: { enabled: true } },
  { metadata: { id: 'flag.driver_training', name: 'Driver training card', version: '1.0.0', priority: 5, description: 'Delivery quality and app training' },
    enabled: true, default: { enabled: true } },
  { metadata: { id: 'flag.driver_safety', name: 'Driver safety notice', version: '1.0.0', priority: 20, description: 'Road-safety announcement' },
    enabled: true, default: { enabled: true } },
];

/** Live experiments. Allocation is per-visitor via the Decision Context (Wave 18). */
export const PLATFORM_EXPERIMENTS: Experiment[] = [
  { metadata: { id: 'exp.welcome_tone', name: 'Welcome message tone', version: '1.0.0', description: 'Friendly vs. direct greeting', hypothesis: 'A warmer greeting increases first-session engagement' },
    status: 'running',
    variants: [{ key: 'control', weight: 50, control: true }, { key: 'warm', weight: 50 }],
    allocation: { unit: 'visitor' } },
  { metadata: { id: 'exp.offer_emphasis', name: 'Offer card emphasis', version: '1.0.0', description: 'Standard vs. highlighted offers card' },
    status: 'running',
    variants: [{ key: 'standard', weight: 50, control: true }, { key: 'highlight', weight: 50 }],
    allocation: { unit: 'visitor', traffic: 50 } },
];

/** Render-plan rollout (Wave 15/16). Scoped, never a blanket global rollout. */
export const PLATFORM_ROLLOUT: RolloutConfig = { enabled: true, experiences: ['/'], tripAfterFailures: 3 };

// ── The singleton ────────────────────────────────────────────────────────────────
export interface ExperiencePlatform {
  engine: ExperienceEngine;
  experiments: ExperimentRegistry;
  tracker: ExperimentTracker;
  targets: TargetResolver;
  flags: FeatureFlagResolver;
  /** Wave 19 · the Experience Events Platform (observe-only). */
  events: ExperienceEventStore;
  collector: ExperienceEventCollector;
}

/** ISO timestamp source for events. The engine stays clock-free; the host supplies time. */
const nowIso = (): string => { try { return new Date().toISOString(); } catch { return ''; } };

let platform: ExperiencePlatform | null = null;

export function experiencePlatform(): ExperiencePlatform {
  if (platform) return platform;

  const engine = createExperienceEngine({
    rollout: PLATFORM_ROLLOUT,
    contextProviders: [{
      id: 'platform.attributes',
      priority: 10,
      contribute: (ctx) => ({ attributes: { surface: String(ctx.attributes.surface ?? 'website') } }),
    }],
  });

  PLATFORM_AUDIENCES.forEach(a => engine.audiences.register(a));
  PLATFORM_FLAGS.forEach(f => engine.flags.register(f));

  const experiments = createExperimentRegistry();
  PLATFORM_EXPERIMENTS.forEach(e => experiments.register(e));

  const tracker = createExperimentTracker({
    onEvent: (event, payload) => { if (event !== 'exposure') monitoring.track(`experiment.${event}`, payload); },
  });

  engine.policies.register(createExperimentPolicy(experiments, {
    tracker,
    resolveUnit: (ctx) => (ctx.decision ? decisionUnitId(ctx.decision) : `${ctx.tenantId}:${ctx.experienceId ?? '-'}`),
  }));

  // Wave 19 · the event store observes the runtime through the sinks it already exposes.
  const events = createExperienceEventStore({ max: 1000, now: nowIso, idPrefix: 'xev' });
  const collector = createExperienceEventCollector(events);

  platform = {
    engine, experiments, tracker,
    targets: createTargetResolver(engine.audiences),
    flags: createFeatureFlagResolver(engine.flags),
    events, collector,
  };

  // Apply persisted operator overrides (Sprint 1 · Part 7). Hydration is async, so the shipped
  // defaults render first and the operator's saved state is applied as soon as it arrives.
  void hydrateExperienceState().then(() => applyPersistedState());
  // Wave 20.1 · restore this visitor's history so personalization treats a reload as a return
  // visit rather than a first visit.
  void restoreVisitorHistory(events);
  return platform;
}

// ── Wave 20.1 · visitor history round-trip ──────────────────────────────────────
// Replayed events are marked so they are never persisted a second time (which would double a
// returning visitor's counts on every reload).
const REPLAYED = '__replayed';

async function restoreVisitorHistory(events: ExperienceEventStore): Promise<void> {
  let visitorId = '';
  try { visitorId = resolveWebsiteVisitor().visitorId; } catch { return; }
  await hydrateVisitorHistory();
  const stored = persistedVisitorHistory(visitorId);
  for (const raw of stored) {
    const e = raw as Partial<ExperienceTelemetryEvent>;
    if (!e || !e.type || !e.context) continue;
    try {
      events.emit({ type: e.type, at: e.at ?? '', context: e.context, payload: { ...(e.payload ?? {}), [REPLAYED]: true } });
    } catch { /* one unusable row must not abort the restore */ }
  }
  // Persist everything emitted from here on, batched so storage is written once per idle turn.
  let pending: ExperienceTelemetryEvent[] = [];
  let scheduled = false;
  events.subscribe(e => {
    if (e.payload?.[REPLAYED] === true) return;
    if (e.context.visitorId !== visitorId) return;
    pending.push(e);
    if (scheduled) return;
    scheduled = true;
    const flush = () => {
      scheduled = false;
      const batch = pending; pending = [];
      void saveVisitorHistory(visitorId, batch);
    };
    try { setTimeout(flush, 1000); } catch { flush(); }
  });
  notifyExperienceChange();
}

// ── Change notification ──────────────────────────────────────────────────────────
// Persisted overrides hydrate asynchronously and operators toggle flags at runtime, so mounted
// surfaces must be told to re-decide. Without this, a saved override only took effect on reload.
const listeners = new Set<() => void>();

/** Subscribe to experience-state changes (used by `useExperience`). Returns an unsubscribe. */
export function onExperienceChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Tell every mounted surface to re-evaluate its decision. */
export function notifyExperienceChange(): void {
  listeners.forEach(fn => { try { fn(); } catch { /* a bad listener must not break others */ } });
}

/** Overlay persisted operator decisions onto the live engine. Idempotent. */
export function applyPersistedState(): void {
  if (!platform) return;
  for (const flag of platform.engine.flags.list()) {
    const saved = persistedFlag(flag.metadata.id);
    if (saved !== undefined && !!flag.default?.enabled !== saved) {
      platform.engine.flags.register({ ...flag, default: { ...flag.default, enabled: saved } });
    }
  }
  for (const experiment of platform.experiments.all()) {
    const saved = persistedExperimentStatus(experiment.metadata.id);
    if (saved && saved !== experiment.status) platform.experiments.setStatus(experiment.metadata.id, saved as never);
  }
  const rollout = persistedRollout();
  if (rollout) {
    platform.engine.rollout.update({ enabled: rollout.enabled, experiences: rollout.experiences, percentage: rollout.percentage });
  }
  notifyExperienceChange();
}

// ── Decision (synchronous — safe to call during render) ─────────────────────────
export interface SurfaceInput {
  surface: Surface;
  locale?: 'ar' | 'en';
  country?: string;
  role?: string;
  tenantId?: string;
  userId?: string | null;
  experienceId?: string;
}

const deviceKind = (): 'mobile' | 'tablet' | 'desktop' => {
  try {
    const w = window.innerWidth;
    return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
  } catch { return 'desktop'; }
};

const toExperienceContext = (input: SurfaceInput): ExperienceContext => ({
  tenantId: input.tenantId ?? 'haat',
  channel: input.surface === 'website' ? 'website' : (input.surface as never),
  role: (input.role ?? 'guest') as never,
  locale: input.locale ?? 'en',
  direction: input.locale === 'ar' ? 'rtl' : 'ltr',
  device: deviceKind(),
  platform: 'web',
  environment: { environment: 'production' },
  country: input.country,
  segments: [],
  flags: {},
  now: '',
});

export interface ExperienceDecision {
  context: DecisionContext;
  audiences: string[];
  flags: { [id: string]: { enabled: boolean; variant?: string } };
  experiments: { [id: string]: string };
  /** Is this feature on for this visitor? */
  isOn: (flagId: string) => boolean;
  /** Which experiment arm is this visitor in? */
  variantOf: (experimentId: string) => string | null;
  inAudience: (audienceId: string) => boolean;
}

/** Resolve the full decision for a surface. Pure w.r.t. the engine; safe during render. */
export function decideFor(input: SurfaceInput): ExperienceDecision {
  const p = experiencePlatform();
  const ctx = toExperienceContext(input);
  const identity = resolveWebsiteVisitor({ userId: input.userId ?? null });

  const audiences = p.targets.resolve(ctx, { experienceId: input.experienceId }).matched;
  const flagRes = p.flags.resolve(ctx, { audiences, experienceId: input.experienceId });

  const decision = createDecisionContextBuilder().build({
    context: ctx, identity, experienceId: input.experienceId ?? input.surface,
    audiences, flags: flagRes.flags,
  }, { attributes: { surface: input.surface } });

  const unit = decisionUnitId(decision);
  const experiments: { [id: string]: string } = {};
  for (const experiment of p.experiments.running()) {
    const a = allocateVariant(experiment, unit);
    if (a.variant) {
      experiments[experiment.metadata.id] = a.variant;
      p.tracker.exposure(experiment.metadata.id, a.variant, unit);
    }
  }

  const context = { ...decision, experiments };

  // Wave 19 · every decision emits its events automatically — no call site creates events by hand.
  const rollout = p.engine.rollout.shouldExecute({ tenantId: ctx.tenantId, experienceId: input.experienceId ?? input.surface, channel: ctx.channel });
  p.collector.recordDecision({
    decision: context,
    surface: input.surface,
    rollout: { execute: rollout.execute, reason: rollout.reason, bucket: rollout.bucket },
  });

  return {
    context,
    audiences,
    flags: flagRes.flags,
    experiments,
    isOn: (id) => !!flagRes.flags[id]?.enabled,
    variantOf: (id) => experiments[id] ?? null,
    inAudience: (id) => audiences.includes(id),
  };
}

// ── Surface telemetry (Wave 19) ─────────────────────────────────────────────────
// The shared Experience surfaces call these; product screens never build an event themselves.
const eventCtx = (decision: DecisionContext, surface?: string): EventContext => eventContextFrom(decision, { surface });

// Wave 20.1 · `signals` describe what the interaction was ABOUT (category, merchant, campaign,
// offer, cuisine, store type). They flow into the event payload, where `deriveVisitorProfile`
// already reads them to build preferred categories and favourite merchants.
export function trackExperienceRendered(decision: DecisionContext, experienceId: string, surface?: string, signals?: InteractionSignals): void {
  experiencePlatform().collector.recordRendered(eventCtx(decision, surface), { experienceId, surface, ...signals });
}
export function trackExperienceDismissed(decision: DecisionContext, experienceId: string, surface?: string, signals?: InteractionSignals): void {
  experiencePlatform().collector.recordDismissed(eventCtx(decision, surface), { experienceId, surface, ...signals });
}
export function trackExperienceClicked(decision: DecisionContext, experienceId: string, element?: string, surface?: string, signals?: InteractionSignals): void {
  experiencePlatform().collector.recordClicked(eventCtx(decision, surface), { experienceId, surface, element, ...signals });
}
export function trackExperienceConverted(decision: DecisionContext, experienceId: string, metric = 'default', value = 1, surface?: string, signals?: InteractionSignals): void {
  experiencePlatform().collector.recordConverted(eventCtx(decision, surface), { experienceId, surface, metric, value, ...signals });
}

/**
 * A product interaction that is not an experience surface — choosing a category, opening a
 * merchant, tapping an offer. These are the signals that make a profile mean something: without
 * them `preferredCategories` and `favouriteMerchants` stay empty no matter how much a visitor
 * browses. `element` identifies the interaction (e.g. 'merchant.open'), never invented content.
 */
export function trackInteraction(decision: DecisionContext, element: string, signals: InteractionSignals, surface?: string): void {
  try {
    experiencePlatform().collector.recordClicked(eventCtx(decision, surface), {
      experienceId: `interaction.${element}`, surface, element, ...signals,
    });
  } catch { /* telemetry must never break a product action */ }
}

/** The live event store, for the Experience Center dashboards. */
export function experienceEvents(): ExperienceEventStore { return experiencePlatform().events; }

// ── React binding ────────────────────────────────────────────────────────────────
/**
 * The one hook every screen uses. Recomputes on viewport change (device class) so a rotate or
 * resize re-evaluates device-targeted audiences.
 */
export function useExperience(input: SurfaceInput): ExperienceDecision {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    try { window.addEventListener('resize', bump); } catch { /* ignore */ }
    // Re-decide when persisted overrides hydrate or an operator toggles a flag.
    const off = onExperienceChange(bump);
    // Hydration resolves in a microtask, which can complete BEFORE this effect subscribes — so
    // re-decide once on mount to pick up state that landed before the subscription existed.
    bump();
    return () => {
      try { window.removeEventListener('resize', bump); } catch { /* ignore */ }
      off();
    };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => decideFor(input), [input.surface, input.locale, input.country, input.role, input.tenantId, input.userId, input.experienceId, tick]);
}

/** Record a conversion for an experiment arm the visitor is in (used by product surfaces). */
export function recordExperimentConversion(experimentId: string, unitOrContext: string | DecisionContext, metric = 'default'): void {
  const p = experiencePlatform();
  const unit = typeof unitOrContext === 'string' ? unitOrContext : decisionUnitId(unitOrContext);
  const experiment = p.experiments.get(experimentId);
  if (!experiment) return;
  const a = allocateVariant(experiment, unit);
  if (a.variant) {
    p.tracker.conversion(experimentId, a.variant, unit, metric);
    if (typeof unitOrContext !== 'string') {
      p.collector.recordConverted(eventContextFrom(unitOrContext), { experienceId: experimentId, metric });
    }
  }
}

/** Experiment reports for the Admin analytics dashboards. */
export function experimentReports(): ExperimentReport[] {
  const p = experiencePlatform();
  return p.experiments.all().map(e => p.tracker.report(e.metadata.id));
}

/** A neutral base context for admin previews (no visitor identity involved). */
export function previewContext(input: SurfaceInput): DecisionContext {
  return baseDecisionContext({ context: toExperienceContext(input), experienceId: input.experienceId });
}

// ── Wave 20 · Personalization (deterministic; derived from the event log) ────────
/** The visitor's profile, rebuilt from the Experience Event stream. Pure. */
export function visitorProfile(visitorId?: string): VisitorProfile {
  const p = experiencePlatform();
  const id = visitorId ?? resolveWebsiteVisitor().visitorId;
  return deriveVisitorProfile(p.events.all(), id);
}

/** Behavioural segments for a visitor, derived from that profile. */
export function visitorSegments(visitorId?: string): BehaviouralSegment[] {
  return deriveSegments(visitorProfile(visitorId), nowIso());
}

/**
 * Rank, cap and de-fatigue a candidate set for the current visitor. Surfaces ask this instead of
 * deciding for themselves which of several eligible experiences to show.
 */
/**
 * The hook product surfaces use to pick which experiences to show.
 *
 * It LATCHES the decision for as long as the exposure lasts. That is not an optimisation — it is
 * required for correctness. A surface emits `experience.rendered` when it mounts, which lands in
 * the very profile the next decision reads; with `minGapMinutes` in the default frequency cap, a
 * surface that re-decided on every render would immediately cap itself and disappear the instant
 * it appeared. One exposure means one decision.
 *
 * The decision is recomputed only when the candidate set genuinely changes — a dismissal, a flag
 * toggle, or a different visitor — which is exactly when a new exposure begins.
 */
export function usePersonalizedExperiences(candidates: ExperienceCandidate[], limit: number): string[] {
  const key = candidates.map(c => `${c.experienceId}:${c.priority ?? 0}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => (candidates.length === 0 ? [] : personalizeExperiences(candidates, { limit }).selected.map(r => r.experienceId)),
    [key, limit],
  );
}

export function personalizeExperiences(candidates: ExperienceCandidate[], opts: { visitorId?: string; limit?: number } = {}): PersonalizationDecision {
  const profile = visitorProfile(opts.visitorId);
  return personalize(profile, candidates, { now: nowIso(), limit: opts.limit });
}
