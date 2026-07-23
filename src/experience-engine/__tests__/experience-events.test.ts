// Experience Engine · Experience Events Platform tests (Wave 19).
// Verifies the required chains — Decision → Event, Render → Event, Dismiss → Event,
// Click → Event, Conversion → Event — plus context attachment, filtering, replay,
// aggregation, retention and export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createExperienceEventStore, createExperienceEventCollector, eventContextFrom, TELEMETRY_TYPES,
  createDecisionContextBuilder, anonymousVisitor, withExperiments,
  type DecisionContext, type EventContext, type ExperienceContext, type ExperienceTelemetryEvent,
} from '../index';

const ectx = (over: Partial<ExperienceContext> = {}): ExperienceContext => ({
  tenantId: 'haat', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr',
  device: 'mobile', platform: 'web', environment: { environment: 'production' },
  country: 'SA', segments: ['early'], flags: {}, now: '2026-01-01T00:00:00.000Z', ...over,
});

const decisionFor = (over: { audiences?: string[]; flags?: Record<string, boolean>; experiments?: Record<string, string> } = {}): DecisionContext => {
  const flags: DecisionContext['flags'] = {};
  for (const [k, v] of Object.entries(over.flags ?? { 'flag.welcome': true, 'flag.offers': false })) flags[k] = { enabled: v };
  const base = createDecisionContextBuilder().build({
    context: ectx(), identity: anonymousVisitor('seed-1', { sessionId: 'sess-1' }),
    experienceId: 'home', audiences: over.audiences ?? ['aud.gcc', 'aud.mobile'], flags,
  });
  return withExperiments(base, over.experiments ?? { 'exp.tone': 'warm' });
};

const seq = () => { let n = 0; return () => `2026-01-01T00:00:${String(n++).padStart(2, '0')}.000Z`; };
const newStore = (max?: number) => createExperienceEventStore({ max, now: seq(), idPrefix: 'evt' });

// ── PART 1 · model ───────────────────────────────────────────────────────────────
test('the model declares every required event type', () => {
  for (const t of [
    'decision.evaluated', 'audience.matched', 'flag.evaluated', 'experiment.assigned',
    'rollout.decision', 'experience.rendered', 'experience.dismissed', 'experience.clicked',
    'experience.converted',
  ]) assert.ok(TELEMETRY_TYPES.includes(t as never), `${t} missing`);
});

// ── PART 3 · context attachment ─────────────────────────────────────────────────
test('every required context field is attached', () => {
  const ctx = eventContextFrom(decisionFor(), { surface: 'customer', rollout: { execute: true, reason: 'experience-allowlist' } });
  assert.ok(ctx.visitorId.startsWith('vis_'));
  assert.equal(ctx.sessionId, 'sess-1');
  assert.equal(ctx.tenantId, 'haat');
  assert.equal(ctx.country, 'SA');
  assert.equal(ctx.locale, 'en');
  assert.equal(ctx.direction, 'ltr');
  assert.equal(ctx.device, 'mobile');
  assert.equal(ctx.platform, 'web');
  assert.equal(ctx.channel, 'website');
  assert.equal(ctx.surface, 'customer');
  assert.deepEqual(ctx.audiences, ['aud.gcc', 'aud.mobile']);
  assert.equal(ctx.flags['flag.welcome'], true);
  assert.equal(ctx.experiments['exp.tone'], 'warm');
  assert.deepEqual(ctx.rollout, { execute: true, reason: 'experience-allowlist' });
});

test('every emitted event carries a timestamp, id and the full context', () => {
  const store = newStore();
  const collector = createExperienceEventCollector(store);
  collector.recordDecision({ decision: decisionFor(), surface: 'customer' });
  for (const e of store.all()) {
    assert.ok(e.id, 'id');
    assert.ok(e.at, 'timestamp');
    assert.equal(typeof e.seq, 'number');
    assert.equal(e.context.tenantId, 'haat');
    assert.ok(e.context.visitorId);
  }
});

// ── PART 2 · Decision → Event (automatic, no manual creation) ───────────────────
test('DECISION → EVENT · one decision emits the whole event set', () => {
  const store = newStore();
  const collector = createExperienceEventCollector(store);
  collector.recordDecision({
    decision: decisionFor(),
    surface: 'customer',
    rollout: { execute: true, reason: 'percentage-in', bucket: 12 },
  });

  const types = store.all().map(e => e.type);
  assert.ok(types.includes('decision.evaluated'));
  assert.equal(types.filter(t => t === 'audience.matched').length, 2, 'one per matched audience');
  assert.equal(types.filter(t => t === 'flag.evaluated').length, 2, 'one per evaluated flag');
  assert.equal(types.filter(t => t === 'experiment.assigned').length, 1);
  assert.ok(types.includes('rollout.decision'));

  const flagEvent = store.query({ types: ['flag.evaluated'] }).find(e => e.payload?.flagId === 'flag.offers')!;
  assert.equal(flagEvent.payload?.enabled, false, 'flag state is recorded, not just the id');
  const rollout = store.query({ types: ['rollout.decision'] })[0];
  assert.equal(rollout.payload?.reason, 'percentage-in');
  assert.equal(rollout.payload?.bucket, 12);
});

// ── PART 7 · surface chains ─────────────────────────────────────────────────────
const surfaceStore = () => {
  const store = newStore();
  const collector = createExperienceEventCollector(store);
  const ctx: EventContext = eventContextFrom(decisionFor(), { surface: 'customer' });
  return { store, collector, ctx };
};

test('RENDER → EVENT', () => {
  const { store, collector, ctx } = surfaceStore();
  collector.recordRendered(ctx, { experienceId: 'flag.customer_welcome' });
  const e = store.query({ types: ['experience.rendered'] })[0];
  assert.ok(e);
  assert.equal(e.context.experienceId, 'flag.customer_welcome');
  assert.equal(e.context.surface, 'customer');
});

test('DISMISS → EVENT', () => {
  const { store, collector, ctx } = surfaceStore();
  collector.recordDismissed(ctx, { experienceId: 'flag.customer_welcome' });
  assert.equal(store.query({ types: ['experience.dismissed'] }).length, 1);
});

test('CLICK → EVENT (with the element that was clicked)', () => {
  const { store, collector, ctx } = surfaceStore();
  collector.recordClicked(ctx, { experienceId: 'flag.customer_offers', element: 'cta' });
  const e = store.query({ types: ['experience.clicked'] })[0];
  assert.equal(e.payload?.element, 'cta');
});

test('CONVERSION → EVENT (with metric and value)', () => {
  const { store, collector, ctx } = surfaceStore();
  collector.recordConverted(ctx, { experienceId: 'exp.offer_emphasis', metric: 'signup', value: 1 });
  const e = store.query({ types: ['experience.converted'] })[0];
  assert.equal(e.payload?.metric, 'signup');
  assert.equal(e.payload?.value, 1);
});

// ── PART 4 · filtering ──────────────────────────────────────────────────────────
test('FILTER · by type, surface, audience, flag, experiment, visitor and search', () => {
  const store = newStore();
  const collector = createExperienceEventCollector(store);
  const ctx = eventContextFrom(decisionFor(), { surface: 'customer' });
  collector.recordDecision({ decision: decisionFor(), surface: 'customer' });
  collector.recordRendered(ctx, { experienceId: 'flag.customer_welcome' });
  collector.recordClicked({ ...ctx, surface: 'merchant' }, { experienceId: 'flag.merchant_beta', element: 'cta', surface: 'merchant' });

  assert.equal(store.query({ types: ['experience.rendered'] }).length, 1);
  assert.equal(store.query({ surface: 'merchant' }).length, 1);
  assert.equal(store.query({ audience: 'aud.gcc' }).length, store.all().length, 'every event carries the audiences');
  assert.equal(store.query({ audience: 'aud.none' }).length, 0);
  assert.ok(store.query({ flag: 'flag.welcome' }).length > 0);
  assert.ok(store.query({ experiment: 'exp.tone' }).length > 0);
  assert.equal(store.query({ visitorId: 'nobody' }).length, 0);
  assert.equal(store.query({ search: 'merchant_beta' }).length, 1);
  assert.equal(store.query({ limit: 2 }).length, 2);
});

test('FILTER · by time window', () => {
  const store = newStore();
  const collector = createExperienceEventCollector(store);
  const ctx = eventContextFrom(decisionFor(), { surface: 'customer' });
  for (let i = 0; i < 4; i++) collector.recordRendered(ctx, { experienceId: `e${i}` });
  const all = store.all();
  const windowed = store.query({ since: all[1].at, until: all[2].at });
  assert.equal(windowed.length, 2);
});

// ── PART 4 · replay ─────────────────────────────────────────────────────────────
test('REPLAY · replays a filtered slice in original order, without mutating the log', () => {
  const store = newStore();
  const collector = createExperienceEventCollector(store);
  const ctx = eventContextFrom(decisionFor(), { surface: 'customer' });
  collector.recordRendered(ctx, { experienceId: 'a' });
  collector.recordClicked(ctx, { experienceId: 'a', element: 'cta' });
  collector.recordRendered(ctx, { experienceId: 'b' });

  const seen: string[] = [];
  const n = store.replay({ types: ['experience.rendered'] }, e => seen.push(String(e.context.experienceId)));
  assert.equal(n, 2);
  assert.deepEqual(seen, ['a', 'b'], 'original order preserved');
  assert.equal(store.size(), 3, 'replay does not add or remove events');
});

test('REPLAY · a throwing handler does not abort the replay', () => {
  const store = newStore();
  const collector = createExperienceEventCollector(store);
  const ctx = eventContextFrom(decisionFor());
  for (let i = 0; i < 3; i++) collector.recordRendered(ctx, { experienceId: `e${i}` });
  let count = 0;
  const n = store.replay(undefined, () => { count++; throw new Error('handler boom'); });
  assert.equal(n, 3);
  assert.equal(count, 3);
});

// ── PART 4 · retention + export ────────────────────────────────────────────────
test('RETENTION · the ring buffer keeps the newest events and counts drops', () => {
  const store = newStore(5);
  const collector = createExperienceEventCollector(store);
  const ctx = eventContextFrom(decisionFor());
  for (let i = 0; i < 9; i++) collector.recordRendered(ctx, { experienceId: `e${i}` });
  const r = store.retention();
  assert.equal(r.max, 5);
  assert.equal(r.stored, 5);
  assert.ok(r.dropped > 0);
  assert.equal(store.all()[0].context.experienceId, 'e4', 'oldest dropped first');
});

test('EXPORT · produces valid, filterable JSON', () => {
  const store = newStore();
  const collector = createExperienceEventCollector(store);
  const ctx = eventContextFrom(decisionFor(), { surface: 'customer' });
  collector.recordRendered(ctx, { experienceId: 'a' });
  collector.recordClicked(ctx, { experienceId: 'a', element: 'cta' });
  const parsed = JSON.parse(store.export({ types: ['experience.clicked'] })) as { count: number; events: ExperienceTelemetryEvent[] };
  assert.equal(parsed.count, 1);
  assert.equal(parsed.events[0].type, 'experience.clicked');
});

test('LIVE FEED · subscribers receive events as they are emitted', () => {
  const store = newStore();
  const collector = createExperienceEventCollector(store);
  const seen: string[] = [];
  const off = store.subscribe(e => seen.push(e.type));
  collector.recordRendered(eventContextFrom(decisionFor()), { experienceId: 'a' });
  off();
  collector.recordRendered(eventContextFrom(decisionFor()), { experienceId: 'b' });
  assert.deepEqual(seen, ['experience.rendered'], 'unsubscribe stops delivery');
});

test('LIVE FEED · a throwing subscriber cannot break emission', () => {
  const store = newStore();
  store.subscribe(() => { throw new Error('subscriber boom'); });
  const collector = createExperienceEventCollector(store);
  collector.recordRendered(eventContextFrom(decisionFor()), { experienceId: 'a' });
  assert.equal(store.size(), 1);
});

// ── PART 5 · aggregation ────────────────────────────────────────────────────────
test('AGGREGATE · views, CTR, dismiss rate and conversion rate', () => {
  const store = newStore();
  const collector = createExperienceEventCollector(store);
  const ctx = eventContextFrom(decisionFor(), { surface: 'customer' });
  for (let i = 0; i < 10; i++) collector.recordRendered(ctx, { experienceId: 'banner' });
  for (let i = 0; i < 3; i++) collector.recordClicked(ctx, { experienceId: 'banner', element: 'cta' });
  for (let i = 0; i < 2; i++) collector.recordDismissed(ctx, { experienceId: 'banner' });
  collector.recordConverted(ctx, { experienceId: 'banner', metric: 'signup' });

  const a = store.aggregate();
  assert.equal(a.totals.views, 10);
  assert.equal(a.totals.clicks, 3);
  assert.equal(a.totals.dismisses, 2);
  assert.equal(a.totals.conversions, 1);
  assert.ok(Math.abs(a.rates.ctr - 0.3) < 1e-9);
  assert.ok(Math.abs(a.rates.dismissRate - 0.2) < 1e-9);
  assert.ok(Math.abs(a.rates.conversionRate - 0.1) < 1e-9);
  assert.equal(a.byExperience[0].experienceId, 'banner');
  assert.equal(a.byExperience[0].views, 10);
});

test('AGGREGATE · flag usage, audience performance and rollout adoption', () => {
  const store = newStore();
  const collector = createExperienceEventCollector(store);
  collector.recordDecision({ decision: decisionFor(), surface: 'customer', rollout: { execute: true, reason: 'experience-allowlist' } });
  collector.recordDecision({ decision: decisionFor(), surface: 'customer', rollout: { execute: false, reason: 'no-criteria' } });
  collector.recordRendered(eventContextFrom(decisionFor(), { surface: 'customer' }), { experienceId: 'banner' });

  const a = store.aggregate();
  const welcome = a.flags.find(f => f.flagId === 'flag.welcome')!;
  assert.equal(welcome.evaluations, 2);
  assert.equal(welcome.on, 2);
  assert.equal(welcome.onRate, 1);
  const offers = a.flags.find(f => f.flagId === 'flag.offers')!;
  assert.equal(offers.off, 2, 'an off flag is still an evaluation');

  const gcc = a.audiences.find(x => x.audienceId === 'aud.gcc')!;
  assert.equal(gcc.matches, 2);
  assert.equal(gcc.views, 1);

  assert.equal(a.rollout.evaluated, 2);
  assert.equal(a.rollout.executed, 1);
  assert.ok(Math.abs(a.rollout.adoptionRate - 0.5) < 1e-9);
  assert.deepEqual(a.rollout.reasons.map(r => r.reason).sort(), ['experience-allowlist', 'no-criteria']);
});

test('AGGREGATE · experiment results attribute views/clicks/conversions to the assigned arm', () => {
  const store = newStore();
  const collector = createExperienceEventCollector(store);
  const warm = eventContextFrom(decisionFor({ experiments: { 'exp.tone': 'warm' } }), { surface: 'customer' });
  const control = eventContextFrom(decisionFor({ experiments: { 'exp.tone': 'control' } }), { surface: 'customer' });

  collector.recordDecision({ decision: decisionFor({ experiments: { 'exp.tone': 'warm' } }) });
  for (let i = 0; i < 4; i++) collector.recordRendered(warm, { experienceId: 'banner' });
  collector.recordClicked(warm, { experienceId: 'banner' });
  collector.recordConverted(warm, { experienceId: 'banner' });
  for (let i = 0; i < 4; i++) collector.recordRendered(control, { experienceId: 'banner' });

  const exp = store.aggregate().experiments.find(x => x.experimentId === 'exp.tone')!;
  const warmRow = exp.variants.find(v => v.variant === 'warm')!;
  const controlRow = exp.variants.find(v => v.variant === 'control')!;
  assert.equal(warmRow.views, 4);
  assert.equal(warmRow.clicks, 1);
  assert.equal(warmRow.conversions, 1);
  assert.equal(controlRow.views, 4);
  assert.equal(controlRow.conversions, 0);
  assert.ok(warmRow.conversionRate > controlRow.conversionRate);
});

test('AGGREGATE · respects the active filter', () => {
  const store = newStore();
  const collector = createExperienceEventCollector(store);
  const customer = eventContextFrom(decisionFor(), { surface: 'customer' });
  const merchant = eventContextFrom(decisionFor(), { surface: 'merchant' });
  collector.recordRendered(customer, { experienceId: 'a', surface: 'customer' });
  collector.recordRendered(merchant, { experienceId: 'b', surface: 'merchant' });
  assert.equal(store.aggregate().totals.views, 2);
  assert.equal(store.aggregate({ surface: 'merchant' }).totals.views, 1);
});

// ── determinism (what makes replay meaningful) ──────────────────────────────────
test('the stream is deterministic — identical input produces an identical stream', () => {
  const run = () => {
    const store = newStore();
    const collector = createExperienceEventCollector(store);
    collector.recordDecision({ decision: decisionFor(), surface: 'customer', rollout: { execute: true, reason: 'percentage-in', bucket: 7 } });
    collector.recordRendered(eventContextFrom(decisionFor(), { surface: 'customer' }), { experienceId: 'banner' });
    return store.all();
  };
  assert.deepEqual(run(), run());
});
