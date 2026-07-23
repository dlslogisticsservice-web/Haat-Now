// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Personalization Engine (Wave 20).
//
// DETERMINISTIC personalization — no AI, no LLM, no machine learning, no inference. Every output
// is a pure function of the Experience Event stream (Wave 19) and the Decision Context (Wave 18):
//
//   events → VisitorProfile → Segments → Ranking → Frequency caps → Fatigue → decision
//
// It REUSES the platform rather than extending it: the profile is derived from the existing event
// log, personalization reaches the runtime through the `PersonalizationPolicy` contract that
// policy.ts has declared since Wave 7, and nothing here mutates the Runtime, Decision Engine,
// Flags, Experiments, Rollouts, Decision Context or the Event store.
//
// PURE: no clock, no randomness, no storage — `now` is injected, so the same events always yield
// the same profile, the same segments and the same ranking, in every process.
// ─────────────────────────────────────────────────────────────────────────────
import type { DeviceKind, Json, LocaleCode, Timestamp } from './types';
import type { PolicyContext, PolicyResult, Policy } from './policy';
import type { ExperienceTelemetryEvent } from './experience-events';

// ── PART 1 · Visitor Profile ────────────────────────────────────────────────────
export interface ExperienceCounter { count: number; firstAt: Timestamp; lastAt: Timestamp }
export type ExperienceCounters = { [experienceId: string]: ExperienceCounter };
export interface WeightedInterest { key: string; count: number }

export interface VisitorProfile {
  visitorId: string;
  firstSeen: Timestamp;
  lastSeen: Timestamp;
  /** Distinct session ids observed. */
  sessions: number;
  sessionIds: string[];
  country?: string;
  locale?: LocaleCode;
  device?: DeviceKind;
  /** Derived from `category` payloads on events — empty until surfaces emit them. */
  preferredCategories: WeightedInterest[];
  /** Derived from `merchant` payloads on events — empty until surfaces emit them. */
  favouriteMerchants: WeightedInterest[];
  viewed: ExperienceCounters;
  dismissed: ExperienceCounters;
  clicked: ExperienceCounters;
  converted: ExperienceCounters;
  totals: { views: number; clicks: number; dismisses: number; conversions: number; events: number };
  /** Hour-of-day histogram (0–23) from event timestamps — powers the late-night segment. */
  activeHours: number[];
}

const emptyProfile = (visitorId: string): VisitorProfile => ({
  visitorId, firstSeen: '', lastSeen: '', sessions: 0, sessionIds: [],
  preferredCategories: [], favouriteMerchants: [],
  viewed: {}, dismissed: {}, clicked: {}, converted: {},
  totals: { views: 0, clicks: 0, dismisses: 0, conversions: 0, events: 0 },
  activeHours: Array.from({ length: 24 }, () => 0),
});

const bump = (counters: ExperienceCounters, id: string, at: Timestamp): void => {
  const row = counters[id];
  if (row) { row.count++; row.lastAt = at || row.lastAt; }
  else counters[id] = { count: 1, firstAt: at, lastAt: at };
};

const topInterests = (m: Map<string, number>): WeightedInterest[] =>
  [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

/** ISO hour, or -1 when the timestamp is not a usable ISO string. */
const hourOf = (at: Timestamp): number => {
  const h = Number(String(at).slice(11, 13));
  return Number.isFinite(h) && String(at).length >= 13 ? h : -1;
};

/**
 * Build a visitor profile from the event log. Pure: same events ⇒ same profile.
 * Only events for `visitorId` are considered, so one log serves many visitors.
 */
export function deriveVisitorProfile(events: readonly ExperienceTelemetryEvent[], visitorId: string): VisitorProfile {
  const p = emptyProfile(visitorId);
  const sessions = new Set<string>();
  const categories = new Map<string, number>();
  const merchants = new Map<string, number>();

  for (const e of events) {
    if (e.context.visitorId !== visitorId) continue;
    p.totals.events++;
    if (!p.firstSeen) p.firstSeen = e.at;
    if (e.at) p.lastSeen = e.at;
    if (e.context.sessionId) sessions.add(e.context.sessionId);
    if (e.context.country) p.country = e.context.country;
    if (e.context.locale) p.locale = e.context.locale;
    if (e.context.device) p.device = e.context.device;

    const hour = hourOf(e.at);
    if (hour >= 0 && hour < 24) p.activeHours[hour]++;

    const category = e.payload?.category;
    if (typeof category === 'string') categories.set(category, (categories.get(category) ?? 0) + 1);
    const merchant = e.payload?.merchant;
    if (typeof merchant === 'string') merchants.set(merchant, (merchants.get(merchant) ?? 0) + 1);

    const id = e.context.experienceId ?? (e.payload?.experience as string | undefined);
    if (!id) continue;
    switch (e.type) {
      case 'experience.rendered': bump(p.viewed, id, e.at); p.totals.views++; break;
      case 'experience.dismissed': bump(p.dismissed, id, e.at); p.totals.dismisses++; break;
      case 'experience.clicked': bump(p.clicked, id, e.at); p.totals.clicks++; break;
      case 'experience.converted': bump(p.converted, id, e.at); p.totals.conversions++; break;
      default: break;
    }
  }

  p.sessionIds = [...sessions];
  p.sessions = sessions.size;
  p.preferredCategories = topInterests(categories);
  p.favouriteMerchants = topInterests(merchants);
  return p;
}

/** Engagement = rewarding actions per view, in [0, 1+]. 0 views ⇒ 0 (unknown, not "bad"). */
export function engagementScore(p: VisitorProfile): number {
  if (p.totals.views === 0) return 0;
  return (p.totals.clicks + p.totals.conversions * 2) / p.totals.views;
}

// ── PART 2 · Behavioural segments ───────────────────────────────────────────────
export type BehaviouralSegment =
  | 'new-visitor' | 'returning-visitor' | 'high-engagement' | 'low-engagement'
  | 'frequent-buyer' | 'dormant-user' | 'coupon-seeker' | 'restaurant-lover'
  | 'retail-shopper' | 'late-night-user';

export interface SegmentThresholds {
  returningSessions: number;
  highEngagement: number;
  lowEngagementMinViews: number;
  lowEngagement: number;
  frequentBuyerConversions: number;
  dormantDays: number;
  couponInteractions: number;
  lateNightShare: number;
}

export const DEFAULT_SEGMENT_THRESHOLDS: SegmentThresholds = {
  returningSessions: 2,
  highEngagement: 0.30,
  lowEngagementMinViews: 5,
  lowEngagement: 0.05,
  frequentBuyerConversions: 3,
  dormantDays: 14,
  couponInteractions: 2,
  lateNightShare: 0.5,
};

const DAY_MS = 86_400_000;
const daysBetween = (from: Timestamp, to: Timestamp): number => {
  const a = Date.parse(String(from)), b = Date.parse(String(to));
  return Number.isFinite(a) && Number.isFinite(b) ? (b - a) / DAY_MS : 0;
};

const interactionsMatching = (p: VisitorProfile, re: RegExp): number => {
  let n = 0;
  for (const map of [p.viewed, p.clicked, p.converted]) {
    for (const id of Object.keys(map)) if (re.test(id)) n += map[id].count;
  }
  return n;
};

const LATE_HOURS = [22, 23, 0, 1, 2, 3, 4];

/**
 * Derive segments. Every rule is an explicit, inspectable threshold — there is no model and no
 * inference. Segments are mutually consistent by construction (a visitor is never both new and
 * returning, nor both high and low engagement).
 */
export function deriveSegments(
  profile: VisitorProfile,
  now: Timestamp,
  thresholds: Partial<SegmentThresholds> = {},
): BehaviouralSegment[] {
  const t = { ...DEFAULT_SEGMENT_THRESHOLDS, ...thresholds };
  const out: BehaviouralSegment[] = [];
  const engagement = engagementScore(profile);

  if (profile.sessions >= t.returningSessions) out.push('returning-visitor');
  else out.push('new-visitor');

  if (profile.totals.views > 0 && engagement >= t.highEngagement) out.push('high-engagement');
  else if (profile.totals.views >= t.lowEngagementMinViews && engagement < t.lowEngagement) out.push('low-engagement');

  if (profile.totals.conversions >= t.frequentBuyerConversions) out.push('frequent-buyer');

  if (profile.lastSeen && daysBetween(profile.lastSeen, now) >= t.dormantDays) out.push('dormant-user');

  if (interactionsMatching(profile, /(offer|coupon|deal|promo)/i) >= t.couponInteractions) out.push('coupon-seeker');

  const top = profile.preferredCategories[0]?.key;
  if (top && /(restaurant|food|coffee|sweets)/i.test(top)) out.push('restaurant-lover');
  else if (top && /(market|grocery|retail|pharmacy|electronics)/i.test(top)) out.push('retail-shopper');

  const totalHours = profile.activeHours.reduce((s, n) => s + n, 0);
  if (totalHours > 0) {
    const late = LATE_HOURS.reduce((s, h) => s + profile.activeHours[h], 0);
    if (late / totalHours >= t.lateNightShare) out.push('late-night-user');
  }

  return out;
}

// ── PART 5 · Frequency capping ──────────────────────────────────────────────────
export interface FrequencyCap {
  /** Hard ceiling on lifetime views of this experience. */
  maxTotal?: number;
  /** Ceiling per session (uses the profile's session count as the denominator). */
  maxPerSession?: number;
  maxPerDay?: number;
  /** Minimum minutes between two showings. */
  minGapMinutes?: number;
  /** Stop showing after this many dismissals. */
  maxDismissals?: number;
}

export const DEFAULT_FREQUENCY_CAP: FrequencyCap = {
  maxTotal: 12,
  maxPerDay: 3,
  minGapMinutes: 30,
  maxDismissals: 2,
};

export type CapReason = 'ok' | 'max-total' | 'max-per-day' | 'max-per-session' | 'min-gap' | 'dismissed';

export interface CapVerdict { capped: boolean; reason: CapReason; detail?: string }

const minutesBetween = (from: Timestamp, to: Timestamp): number => {
  const a = Date.parse(String(from)), b = Date.parse(String(to));
  return Number.isFinite(a) && Number.isFinite(b) ? (b - a) / 60_000 : Number.POSITIVE_INFINITY;
};

const sameDayCount = (counter: ExperienceCounter | undefined, now: Timestamp): number => {
  if (!counter) return 0;
  // Without a per-view log we can only tell whether the most recent view was today; that is the
  // honest bound — it prevents same-day repeats without over-claiming per-day precision.
  return String(counter.lastAt).slice(0, 10) === String(now).slice(0, 10) ? counter.count : 0;
};

/** Deterministic cap check for one experience. */
export function checkFrequencyCap(
  profile: VisitorProfile,
  experienceId: string,
  now: Timestamp,
  cap: FrequencyCap = DEFAULT_FREQUENCY_CAP,
): CapVerdict {
  const viewed = profile.viewed[experienceId];
  const dismissed = profile.dismissed[experienceId];

  if (cap.maxDismissals !== undefined && (dismissed?.count ?? 0) >= cap.maxDismissals) {
    return { capped: true, reason: 'dismissed', detail: `${dismissed?.count} dismissals` };
  }
  if (!viewed) return { capped: false, reason: 'ok' };

  if (cap.maxTotal !== undefined && viewed.count >= cap.maxTotal) {
    return { capped: true, reason: 'max-total', detail: `${viewed.count}/${cap.maxTotal}` };
  }
  if (cap.maxPerSession !== undefined && profile.sessions > 0 && viewed.count / profile.sessions >= cap.maxPerSession) {
    return { capped: true, reason: 'max-per-session', detail: `${(viewed.count / profile.sessions).toFixed(1)} per session` };
  }
  if (cap.maxPerDay !== undefined && sameDayCount(viewed, now) >= cap.maxPerDay) {
    return { capped: true, reason: 'max-per-day', detail: `${sameDayCount(viewed, now)}/${cap.maxPerDay} today` };
  }
  if (cap.minGapMinutes !== undefined && minutesBetween(viewed.lastAt, now) < cap.minGapMinutes) {
    return { capped: true, reason: 'min-gap', detail: `${minutesBetween(viewed.lastAt, now).toFixed(0)}m ago` };
  }
  return { capped: false, reason: 'ok' };
}

// ── PART 6 · Fatigue management ─────────────────────────────────────────────────
export interface FatigueConfig {
  /** Views with zero engagement after which the experience is considered exhausted. */
  ignoredViews: number;
  /** Dismissals after which it is suppressed regardless of views. */
  dismissals: number;
}
export const DEFAULT_FATIGUE: FatigueConfig = { ignoredViews: 5, dismissals: 2 };

export interface FatigueVerdict { fatigued: boolean; score: number; reason: string }

/**
 * Over-exposure detection. `score` rises from 0 → 1 as an experience is shown repeatedly without
 * engagement; at 1 it is suppressed. Dismissals count double — an explicit "no" is stronger
 * evidence than silence.
 */
export function assessFatigue(
  profile: VisitorProfile,
  experienceId: string,
  config: FatigueConfig = DEFAULT_FATIGUE,
): FatigueVerdict {
  const views = profile.viewed[experienceId]?.count ?? 0;
  const dismissals = profile.dismissed[experienceId]?.count ?? 0;
  const engaged = (profile.clicked[experienceId]?.count ?? 0) + (profile.converted[experienceId]?.count ?? 0);

  if (dismissals >= config.dismissals) return { fatigued: true, score: 1, reason: `dismissed ${dismissals}×` };
  if (engaged > 0) return { fatigued: false, score: 0, reason: 'visitor engaged with it' };
  if (views === 0) return { fatigued: false, score: 0, reason: 'never shown' };

  const score = Math.min(1, (views + dismissals * 2) / config.ignoredViews);
  return {
    fatigued: score >= 1,
    score,
    reason: score >= 1 ? `shown ${views}× without engagement` : `${views}/${config.ignoredViews} views without engagement`,
  };
}

// ── PART 4 · Experience prioritisation ──────────────────────────────────────────
export interface ExperienceCandidate {
  experienceId: string;
  /** Author-assigned importance. Higher wins before behaviour is considered. */
  priority?: number;
  /** Segments this experience is meant for — matching them boosts the score. */
  segments?: BehaviouralSegment[];
  cap?: FrequencyCap;
  payload?: { [k: string]: Json };
}

export interface RankedExperience {
  experienceId: string;
  score: number;
  eligible: boolean;
  reason: string;
  segmentMatches: BehaviouralSegment[];
  fatigue: FatigueVerdict;
  cap: CapVerdict;
  candidate: ExperienceCandidate;
  /** Wave 20.1 · this visitor's affinity for this experience, in [-1, 1]. Explains the ranking. */
  affinity: number;
}

export interface RankingWeights {
  priority: number;
  segmentMatch: number;
  engagement: number;
  fatiguePenalty: number;
  noveltyBonus: number;
  /** Weight of this visitor's affinity for THIS experience (Wave 20.1). */
  affinity: number;
}
export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  priority: 1,
  segmentMatch: 2.5,
  engagement: 1.5,
  fatiguePenalty: 3,
  noveltyBonus: 1,
  affinity: 12,
};

export interface RankingOptions {
  now: Timestamp;
  segments?: BehaviouralSegment[];
  weights?: Partial<RankingWeights>;
  fatigue?: FatigueConfig;
  defaultCap?: FrequencyCap;
  /** Return at most this many eligible experiences (PART 4: "only the highest priority set"). */
  limit?: number;
}

/**
 * How much THIS visitor likes THIS experience, in roughly [-1, 1].
 *
 * `engagementScore` is a single number for the whole visitor, so on its own it shifts every
 * candidate equally and can never change their order. Affinity is the per-experience counterpart:
 * it is what lets a coupon seeker who repeatedly clicks and redeems offers be shown offers ahead
 * of a higher-priority generic banner. Derived purely from counters the profile already keeps.
 *
 * Unseen experiences score 0 — absence of evidence is neutral, not negative; novelty is a separate
 * term so a brand-new experience is not judged as if it had been ignored.
 */
export function experienceAffinity(profile: VisitorProfile, experienceId: string): number {
  const views = profile.viewed[experienceId]?.count ?? 0;
  const clicks = profile.clicked[experienceId]?.count ?? 0;
  const conversions = profile.converted[experienceId]?.count ?? 0;
  const dismisses = profile.dismissed[experienceId]?.count ?? 0;
  const evidence = views + clicks + conversions + dismisses;
  if (evidence === 0) return 0;

  // A conversion is the strongest endorsement, a dismissal the clearest rejection.
  const raw = (clicks + conversions * 2 - dismisses) / evidence;
  return Math.max(-1, Math.min(1, raw));
}

/**
 * Score, rank and filter. Deterministic and fully explainable: every candidate comes back with its
 * score, its segment matches, its fatigue verdict and its cap verdict, so an operator can always
 * answer "why did this visitor see that?".
 *
 * Ties break on experienceId so the order is stable across runs.
 */
export function rankExperiences(
  candidates: readonly ExperienceCandidate[],
  profile: VisitorProfile,
  opts: RankingOptions,
): RankedExperience[] {
  const w = { ...DEFAULT_RANKING_WEIGHTS, ...opts.weights };
  const segments = opts.segments ?? [];
  const engagement = engagementScore(profile);

  const scored = candidates.map<RankedExperience>(candidate => {
    const cap = checkFrequencyCap(profile, candidate.experienceId, opts.now, candidate.cap ?? opts.defaultCap ?? DEFAULT_FREQUENCY_CAP);
    const fatigue = assessFatigue(profile, candidate.experienceId, opts.fatigue);
    const segmentMatches = (candidate.segments ?? []).filter(s => segments.includes(s));

    const seen = profile.viewed[candidate.experienceId]?.count ?? 0;
    const novelty = seen === 0 ? w.noveltyBonus : 0;

    const affinity = experienceAffinity(profile, candidate.experienceId);

    const score =
      (candidate.priority ?? 0) * w.priority
      + segmentMatches.length * w.segmentMatch
      + engagement * w.engagement
      + affinity * w.affinity
      + novelty
      - fatigue.score * w.fatiguePenalty;

    const eligible = !cap.capped && !fatigue.fatigued;
    const reason = cap.capped ? `capped: ${cap.reason}` : fatigue.fatigued ? `fatigued: ${fatigue.reason}` : 'eligible';

    return { experienceId: candidate.experienceId, score, eligible, reason, segmentMatches, fatigue, cap, candidate, affinity };
  });

  return scored.sort((a, b) =>
    Number(b.eligible) - Number(a.eligible)
    || b.score - a.score
    || a.experienceId.localeCompare(b.experienceId));
}

/** The highest-priority eligible set — what a surface should actually show. */
export function selectExperiences(
  candidates: readonly ExperienceCandidate[],
  profile: VisitorProfile,
  opts: RankingOptions,
): RankedExperience[] {
  const eligible = rankExperiences(candidates, profile, opts).filter(r => r.eligible);
  return typeof opts.limit === 'number' ? eligible.slice(0, opts.limit) : eligible;
}

// ── PART 3 · reaching the runtime through the EXISTING Decision Engine ──────────
export interface PersonalizationDecision {
  visitorId: string;
  segments: BehaviouralSegment[];
  ranked: RankedExperience[];
  selected: RankedExperience[];
  suppressed: RankedExperience[];
}

export function personalize(
  profile: VisitorProfile,
  candidates: readonly ExperienceCandidate[],
  opts: RankingOptions,
): PersonalizationDecision {
  const segments = opts.segments ?? deriveSegments(profile, opts.now);
  const ranked = rankExperiences(candidates, profile, { ...opts, segments });
  const selected = typeof opts.limit === 'number'
    ? ranked.filter(r => r.eligible).slice(0, opts.limit)
    : ranked.filter(r => r.eligible);
  return {
    visitorId: profile.visitorId,
    segments,
    ranked,
    selected,
    suppressed: ranked.filter(r => !r.eligible),
  };
}

export interface PersonalizationPolicyOptions {
  id?: string;
  priority?: number;
  /** Supplies the current profile + candidates for the request being evaluated. */
  resolve: (ctx: PolicyContext) => { profile: VisitorProfile; candidates: ExperienceCandidate[]; now: Timestamp } | null;
  limit?: number;
}

/**
 * A `personalization`-typed Policy. It emits the selected experiences and the visitor's segments
 * as directives, so personalization travels the SAME policy → enforcement → plan path as flags and
 * experiments. Registering it on `engine.policies` is the whole integration — no runtime change.
 */
export function createPersonalizationPolicy(opts: PersonalizationPolicyOptions): Policy {
  const metadata = {
    id: opts.id ?? 'policy.personalization',
    name: 'Personalization Policy',
    type: 'personalization' as const,
    version: '1.0.0',
    priority: opts.priority ?? 0,
  };
  return {
    metadata,
    applies: () => true,
    health: () => ({ status: 'healthy' as const }),
    evaluate(ctx: PolicyContext): PolicyResult {
      const input = opts.resolve(ctx);
      if (!input) return { effect: 'noop', reason: 'no visitor profile available' };
      const decision = personalize(input.profile, input.candidates, { now: input.now, limit: opts.limit });
      const directives = [
        { key: 'personalization.segments', value: decision.segments.join(',') },
        { key: 'personalization.selected', value: decision.selected.map(s => s.experienceId).join(',') },
        ...decision.suppressed.map(s => ({ key: `personalization.suppressed.${s.experienceId}`, value: s.reason })),
      ];
      return { effect: 'annotate', directives, reason: `personalized ${decision.selected.length}/${decision.ranked.length}` };
    },
  };
}
