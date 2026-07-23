// Experience Engine · Personalization Engine tests (Wave 20).
// Deterministic only — no AI, no model, no randomness. Verifies profile updates, segment
// calculation, ranking, frequency caps, fatigue and decision consistency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveVisitorProfile, deriveSegments, engagementScore, rankExperiences, selectExperiences,
  personalize, checkFrequencyCap, assessFatigue, createPersonalizationPolicy,
  DEFAULT_FREQUENCY_CAP, DEFAULT_FATIGUE,
  createExperienceEventStore, createExperienceEventCollector, eventContextFrom,
  createDecisionContextBuilder, anonymousVisitor, withExperiments,
  type ExperienceCandidate, type ExperienceContext, type ExperienceTelemetryEvent,
  type PolicyContext, type VisitorProfile,
} from '../index';

const VISITOR = anonymousVisitor('seed-1', { sessionId: 'sess-1' });

const ectx = (over: Partial<ExperienceContext> = {}): ExperienceContext => ({
  tenantId: 'haat', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr',
  device: 'mobile', platform: 'web', environment: { environment: 'production' },
  country: 'SA', segments: [], flags: {}, now: '2026-03-01T12:00:00.000Z', ...over,
});

const decisionFor = (sessionId = 'sess-1') => withExperiments(
  createDecisionContextBuilder().build({
    context: ectx(), identity: anonymousVisitor('seed-1', { sessionId }),
    experienceId: 'home', audiences: ['aud.gcc'], flags: { 'flag.welcome': { enabled: true } },
  }),
  { 'exp.tone': 'warm' },
);

/** Build an event log at controlled timestamps — the whole engine is a function of this. */
function log(entries: Array<{ type: 'view' | 'click' | 'dismiss' | 'convert'; id: string; at: string; session?: string; payload?: Record<string, unknown> }>): ExperienceTelemetryEvent[] {
  const store = createExperienceEventStore({ now: () => '' });
  const collector = createExperienceEventCollector(store);
  for (const e of entries) {
    const ctx = { ...eventContextFrom(decisionFor(e.session ?? 'sess-1'), { surface: 'customer' }), sessionId: e.session ?? 'sess-1' };
    const rec = { experienceId: e.id, surface: 'customer' };
    const fn = e.type === 'view' ? collector.recordRendered
      : e.type === 'click' ? collector.recordClicked
      : e.type === 'dismiss' ? collector.recordDismissed
      : collector.recordConverted;
    const ev = fn(ctx, rec);
    ev.at = e.at;                                    // deterministic timeline
    if (e.payload) ev.payload = { ...ev.payload, ...(e.payload as Record<string, never>) };
  }
  return store.all();
}

const profileFrom = (entries: Parameters<typeof log>[0]): VisitorProfile =>
  deriveVisitorProfile(log(entries), VISITOR.visitorId);

const NOW = '2026-03-01T12:00:00.000Z';

// ── PART 1 · profile ────────────────────────────────────────────────────────────
test('PROFILE · derives counters, totals, sessions and identity from the event log', () => {
  const p = profileFrom([
    { type: 'view', id: 'banner', at: '2026-03-01T09:00:00.000Z' },
    { type: 'view', id: 'banner', at: '2026-03-01T10:00:00.000Z' },
    { type: 'click', id: 'banner', at: '2026-03-01T10:00:05.000Z' },
    { type: 'convert', id: 'banner', at: '2026-03-01T10:01:00.000Z' },
    { type: 'view', id: 'hint', at: '2026-03-01T11:00:00.000Z', session: 'sess-2' },
    { type: 'dismiss', id: 'hint', at: '2026-03-01T11:00:30.000Z', session: 'sess-2' },
  ]);

  assert.equal(p.visitorId, VISITOR.visitorId);
  assert.equal(p.totals.views, 3);
  assert.equal(p.totals.clicks, 1);
  assert.equal(p.totals.conversions, 1);
  assert.equal(p.totals.dismisses, 1);
  assert.equal(p.viewed.banner.count, 2);
  assert.equal(p.viewed.banner.firstAt, '2026-03-01T09:00:00.000Z');
  assert.equal(p.viewed.banner.lastAt, '2026-03-01T10:00:00.000Z');
  assert.equal(p.dismissed.hint.count, 1);
  assert.equal(p.sessions, 2, 'two distinct sessions');
  assert.equal(p.country, 'SA');
  assert.equal(p.device, 'mobile');
  assert.equal(p.locale, 'en');
});

test('PROFILE · only the requested visitor is included', () => {
  const events = log([{ type: 'view', id: 'banner', at: NOW }]);
  const other = deriveVisitorProfile(events, 'vis_someone_else');
  assert.equal(other.totals.events, 0);
  assert.equal(other.totals.views, 0);
});

test('PROFILE · categories and merchants derive from event payloads', () => {
  const p = profileFrom([
    { type: 'click', id: 'card', at: NOW, payload: { category: 'restaurant', merchant: 'Pasha' } },
    { type: 'click', id: 'card', at: NOW, payload: { category: 'restaurant', merchant: 'Roma' } },
    { type: 'click', id: 'card', at: NOW, payload: { category: 'market' } },
  ]);
  assert.deepEqual(p.preferredCategories.map(c => c.key), ['restaurant', 'market']);
  assert.equal(p.preferredCategories[0].count, 2);
  assert.equal(p.favouriteMerchants.length, 2);
});

test('PROFILE · engagement score rewards conversions over clicks, and is 0 with no views', () => {
  assert.equal(engagementScore(profileFrom([])), 0);
  const p = profileFrom([
    { type: 'view', id: 'a', at: NOW }, { type: 'view', id: 'a', at: NOW },
    { type: 'click', id: 'a', at: NOW }, { type: 'convert', id: 'a', at: NOW },
  ]);
  assert.ok(Math.abs(engagementScore(p) - 1.5) < 1e-9, '(1 click + 2×1 conversion) / 2 views');
});

// ── PART 2 · segments ───────────────────────────────────────────────────────────
test('SEGMENT · new vs returning visitor are mutually exclusive', () => {
  const fresh = deriveSegments(profileFrom([{ type: 'view', id: 'a', at: NOW }]), NOW);
  assert.ok(fresh.includes('new-visitor'));
  assert.ok(!fresh.includes('returning-visitor'));

  const back = deriveSegments(profileFrom([
    { type: 'view', id: 'a', at: NOW, session: 's1' },
    { type: 'view', id: 'a', at: NOW, session: 's2' },
  ]), NOW);
  assert.ok(back.includes('returning-visitor'));
  assert.ok(!back.includes('new-visitor'));
});

test('SEGMENT · high vs low engagement', () => {
  const high = profileFrom([
    { type: 'view', id: 'a', at: NOW }, { type: 'view', id: 'a', at: NOW },
    { type: 'click', id: 'a', at: NOW },
  ]);
  assert.ok(deriveSegments(high, NOW).includes('high-engagement'));

  const low = profileFrom(Array.from({ length: 8 }, () => ({ type: 'view' as const, id: 'a', at: NOW })));
  const seg = deriveSegments(low, NOW);
  assert.ok(seg.includes('low-engagement'));
  assert.ok(!seg.includes('high-engagement'));
});

test('SEGMENT · frequent buyer, dormant user and coupon seeker', () => {
  const buyer = profileFrom(Array.from({ length: 3 }, () => ({ type: 'convert' as const, id: 'a', at: NOW })));
  assert.ok(deriveSegments(buyer, NOW).includes('frequent-buyer'));

  const old = profileFrom([{ type: 'view', id: 'a', at: '2026-01-01T00:00:00.000Z' }]);
  assert.ok(deriveSegments(old, NOW).includes('dormant-user'), 'inactive beyond the dormancy window');
  assert.ok(!deriveSegments(profileFrom([{ type: 'view', id: 'a', at: NOW }]), NOW).includes('dormant-user'));

  const coupons = profileFrom([
    { type: 'view', id: 'flag.customer_offers', at: NOW },
    { type: 'click', id: 'flag.customer_offers', at: NOW },
  ]);
  assert.ok(deriveSegments(coupons, NOW).includes('coupon-seeker'));
});

test('SEGMENT · category affinity and late-night activity', () => {
  const foodie = profileFrom([{ type: 'click', id: 'c', at: NOW, payload: { category: 'restaurant' } }]);
  assert.ok(deriveSegments(foodie, NOW).includes('restaurant-lover'));

  const shopper = profileFrom([{ type: 'click', id: 'c', at: NOW, payload: { category: 'grocery' } }]);
  assert.ok(deriveSegments(shopper, NOW).includes('retail-shopper'));

  const night = profileFrom([
    { type: 'view', id: 'a', at: '2026-03-01T23:10:00.000Z' },
    { type: 'view', id: 'a', at: '2026-03-01T02:20:00.000Z' },
  ]);
  assert.ok(deriveSegments(night, NOW).includes('late-night-user'));
  const day = profileFrom([{ type: 'view', id: 'a', at: '2026-03-01T13:00:00.000Z' }]);
  assert.ok(!deriveSegments(day, NOW).includes('late-night-user'));
});

// ── PART 5 · frequency capping ──────────────────────────────────────────────────
test('CAP · a never-shown experience is never capped', () => {
  assert.deepEqual(checkFrequencyCap(profileFrom([]), 'banner', NOW), { capped: false, reason: 'ok' });
});

test('CAP · minimum gap between showings', () => {
  const p = profileFrom([{ type: 'view', id: 'banner', at: '2026-03-01T11:50:00.000Z' }]);
  assert.equal(checkFrequencyCap(p, 'banner', NOW).reason, 'min-gap', '10 minutes < 30 minute gap');
  assert.equal(checkFrequencyCap(p, 'banner', '2026-03-01T13:00:00.000Z').capped, false, 'after the gap it may show');
});

test('CAP · lifetime and per-day ceilings', () => {
  const many = profileFrom(Array.from({ length: 12 }, () => ({ type: 'view' as const, id: 'banner', at: '2026-02-01T10:00:00.000Z' })));
  assert.equal(checkFrequencyCap(many, 'banner', NOW).reason, 'max-total');

  const today = profileFrom(Array.from({ length: 3 }, () => ({ type: 'view' as const, id: 'banner', at: '2026-03-01T08:00:00.000Z' })));
  assert.equal(checkFrequencyCap(today, 'banner', NOW, { maxPerDay: 3, minGapMinutes: 0 }).reason, 'max-per-day');
});

test('CAP · repeated dismissal stops the experience', () => {
  const p = profileFrom([
    { type: 'dismiss', id: 'banner', at: NOW }, { type: 'dismiss', id: 'banner', at: NOW },
  ]);
  assert.equal(checkFrequencyCap(p, 'banner', NOW).reason, 'dismissed');
});

// ── PART 6 · fatigue ────────────────────────────────────────────────────────────
test('FATIGUE · rises with unengaged views and suppresses at the threshold', () => {
  const twice = profileFrom(Array.from({ length: 2 }, () => ({ type: 'view' as const, id: 'b', at: NOW })));
  const partial = assessFatigue(twice, 'b');
  assert.equal(partial.fatigued, false);
  assert.ok(partial.score > 0 && partial.score < 1);

  const exhausted = profileFrom(Array.from({ length: 5 }, () => ({ type: 'view' as const, id: 'b', at: NOW })));
  assert.equal(assessFatigue(exhausted, 'b').fatigued, true);
});

test('FATIGUE · engagement resets fatigue entirely', () => {
  const engaged = profileFrom([
    ...Array.from({ length: 6 }, () => ({ type: 'view' as const, id: 'b', at: NOW })),
    { type: 'click', id: 'b', at: NOW },
  ]);
  const v = assessFatigue(engaged, 'b');
  assert.equal(v.fatigued, false);
  assert.equal(v.score, 0);
});

test('FATIGUE · a dismissal counts more heavily than a silent view', () => {
  const dismissed = profileFrom([
    { type: 'dismiss', id: 'b', at: NOW }, { type: 'dismiss', id: 'b', at: NOW },
  ]);
  assert.equal(assessFatigue(dismissed, 'b').fatigued, true);
});

// ── PART 4 · ranking ────────────────────────────────────────────────────────────
const candidates: ExperienceCandidate[] = [
  { experienceId: 'welcome', priority: 1 },
  { experienceId: 'offers', priority: 1, segments: ['coupon-seeker'] },
  { experienceId: 'tour', priority: 0 },
];

test('RANK · segment matches outrank equal author priority', () => {
  const p = profileFrom([]);
  const ranked = rankExperiences(candidates, p, { now: NOW, segments: ['coupon-seeker'] });
  assert.equal(ranked[0].experienceId, 'offers');
  assert.deepEqual(ranked[0].segmentMatches, ['coupon-seeker']);
});

test('RANK · capped and fatigued candidates are marked ineligible and sorted last', () => {
  const p = profileFrom([
    ...Array.from({ length: 5 }, () => ({ type: 'view' as const, id: 'welcome', at: '2026-02-01T10:00:00.000Z' })),
  ]);
  const ranked = rankExperiences(candidates, p, { now: NOW });
  const welcome = ranked.find(r => r.experienceId === 'welcome')!;
  assert.equal(welcome.eligible, false);
  assert.match(welcome.reason, /fatigued/);
  assert.equal(ranked[ranked.length - 1].experienceId, 'welcome', 'ineligible sinks to the bottom');
});

test('RANK · selection returns only the highest-priority eligible set', () => {
  const selected = selectExperiences(candidates, profileFrom([]), { now: NOW, segments: ['coupon-seeker'], limit: 1 });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].experienceId, 'offers');
  assert.equal(selected[0].eligible, true);
});

test('RANK · every candidate is explainable (score, segments, cap, fatigue)', () => {
  const ranked = rankExperiences(candidates, profileFrom([]), { now: NOW });
  for (const r of ranked) {
    assert.equal(typeof r.score, 'number');
    assert.ok(r.reason);
    assert.ok(r.cap);
    assert.ok(r.fatigue);
  }
});

test('RANK · ties break deterministically by experience id', () => {
  const tied: ExperienceCandidate[] = [{ experienceId: 'b', priority: 1 }, { experienceId: 'a', priority: 1 }];
  const p = profileFrom([]);
  assert.deepEqual(rankExperiences(tied, p, { now: NOW }).map(r => r.experienceId), ['a', 'b']);
});

// ── decision consistency ────────────────────────────────────────────────────────
test('CONSISTENCY · identical inputs always yield an identical decision', () => {
  const p = profileFrom([
    { type: 'view', id: 'welcome', at: '2026-03-01T09:00:00.000Z' },
    { type: 'click', id: 'offers', at: '2026-03-01T09:05:00.000Z' },
  ]);
  const run = () => personalize(p, candidates, { now: NOW, limit: 2 });
  assert.deepEqual(run(), run());
});

test('CONSISTENCY · the decision separates selected from suppressed with reasons', () => {
  const p = profileFrom(Array.from({ length: 5 }, () => ({ type: 'view' as const, id: 'welcome', at: '2026-02-01T10:00:00.000Z' })));
  const d = personalize(p, candidates, { now: NOW });
  assert.ok(d.selected.every(s => s.eligible));
  assert.ok(d.suppressed.every(s => !s.eligible));
  assert.equal(d.selected.length + d.suppressed.length, candidates.length);
  assert.ok(d.suppressed.some(s => s.experienceId === 'welcome' && /fatigued/.test(s.reason)));
  assert.ok(d.segments.includes('new-visitor'), 'segments are derived when not supplied');
});

// ── PART 3 · reaching the runtime through the existing Decision Engine ─────────
test('POLICY · emits segments and the selected set as directives', async () => {
  const p = profileFrom([{ type: 'click', id: 'offers', at: NOW }]);
  const policy = createPersonalizationPolicy({
    resolve: () => ({ profile: p, candidates, now: NOW }),
    limit: 2,
  });
  assert.equal(policy.metadata.type, 'personalization');

  const result = await policy.evaluate({ tenantId: 'haat', channel: 'website', environment: 'production', experienceId: 'home' } as PolicyContext);
  assert.equal(result.effect, 'annotate');
  const segments = result.directives?.find(d => d.key === 'personalization.segments');
  const selected = result.directives?.find(d => d.key === 'personalization.selected');
  assert.ok(segments && String(segments.value).includes('new-visitor'));
  assert.ok(selected && String(selected.value).length > 0);
});

test('POLICY · no profile ⇒ a clean no-op, never a fabricated decision', async () => {
  const policy = createPersonalizationPolicy({ resolve: () => null });
  const result = await policy.evaluate({ tenantId: 'haat', channel: 'website', environment: 'production' } as PolicyContext);
  assert.equal(result.effect, 'noop');
  assert.match(String(result.reason), /no visitor profile/);
});

test('POLICY · suppressed experiences are reported with their reason', async () => {
  const p = profileFrom(Array.from({ length: 5 }, () => ({ type: 'view' as const, id: 'welcome', at: '2026-02-01T10:00:00.000Z' })));
  const policy = createPersonalizationPolicy({ resolve: () => ({ profile: p, candidates, now: NOW }) });
  const result = await policy.evaluate({ tenantId: 'haat', channel: 'website', environment: 'production' } as PolicyContext);
  const suppressed = result.directives?.find(d => d.key === 'personalization.suppressed.welcome');
  assert.ok(suppressed, 'the suppression is visible in the decision');
  assert.match(String(suppressed!.value), /fatigued/);
});

// ── defaults are sane ───────────────────────────────────────────────────────────
test('defaults are conservative and explicit', () => {
  assert.equal(DEFAULT_FREQUENCY_CAP.maxDismissals, 2);
  assert.equal(DEFAULT_FATIGUE.ignoredViews, 5);
  assert.ok((DEFAULT_FREQUENCY_CAP.minGapMinutes ?? 0) > 0);
});
