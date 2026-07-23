// Experience Engine · Personalization ACTIVATION tests (Wave 20.1).
//
// Wave 20 proved the engine ranks correctly in isolation. These tests prove the thing the product
// actually depends on: that DIFFERENT VISITORS GET DIFFERENT EXPERIENCES, driven only by their own
// behaviour, and that the interaction signals the surfaces now emit reach the profile.
//
// Each scenario builds a real event log, derives a real profile, and asserts on the selection a
// product surface would make. No mocks of the engine itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveVisitorProfile, deriveSegments, personalize, signalPayload,
  createExperienceEventStore, createExperienceEventCollector, eventContextFrom,
  createDecisionContextBuilder, anonymousVisitor,
  type ExperienceCandidate, type ExperienceContext, type ExperienceTelemetryEvent,
} from '../index';

const ectx = (over: Partial<ExperienceContext> = {}): ExperienceContext => ({
  tenantId: 'haat', channel: 'customer', role: 'guest', locale: 'en', direction: 'ltr',
  device: 'mobile', platform: 'web', environment: { environment: 'production' },
  country: 'SA', segments: [], flags: {}, now: '2026-03-01T12:00:00.000Z', ...over,
});

const decisionFor = (visitorSeed: string, sessionId: string) =>
  createDecisionContextBuilder().build({
    context: ectx(), identity: anonymousVisitor(visitorSeed, { sessionId }),
    experienceId: 'home', audiences: [], flags: {},
  });

interface Entry {
  type: 'view' | 'click' | 'dismiss' | 'convert';
  id: string;
  at: string;
  session?: string;
  signals?: { category?: string; merchant?: string; campaign?: string; offer?: string; cuisine?: string; storeType?: string };
}

/** Build one visitor's event log at controlled timestamps. */
function logFor(visitorSeed: string, entries: Entry[]): { events: ExperienceTelemetryEvent[]; visitorId: string } {
  const store = createExperienceEventStore({ now: () => '' });
  const collector = createExperienceEventCollector(store);
  let visitorId = '';
  for (const e of entries) {
    const decision = decisionFor(visitorSeed, e.session ?? 'sess-1');
    visitorId = decision.identity.visitorId;
    const ctx = { ...eventContextFrom(decision, { surface: 'customer' }), sessionId: e.session ?? 'sess-1' };
    const rec = { experienceId: e.id, surface: 'customer', ...e.signals };
    const fn = e.type === 'view' ? collector.recordRendered
      : e.type === 'click' ? collector.recordClicked
      : e.type === 'dismiss' ? collector.recordDismissed
      : collector.recordConverted;
    const emitted = fn(ctx, rec);
    emitted.at = e.at; // control time explicitly; the engine never reads a clock
  }
  return { events: store.all(), visitorId };
}

const CUSTOMER_CANDIDATES: ExperienceCandidate[] = [
  { experienceId: 'flag.customer_welcome', priority: 30 },
  { experienceId: 'flag.customer_offers', priority: 20 },
  { experienceId: 'flag.customer_feature_tour', priority: 10 },
];

const NOW = '2026-03-05T13:00:00.000Z';

/** What the Customer home would show this visitor, given the whole candidate set. */
function customerChoice(events: ExperienceTelemetryEvent[], visitorId: string, now = NOW): string {
  const profile = deriveVisitorProfile(events, visitorId);
  const segments = deriveSegments(profile, now);
  return personalize(profile, CUSTOMER_CANDIDATES, { now, segments, limit: 1 }).selected[0]?.experienceId ?? '';
}

// ── PART 1 · signals actually reach the profile ─────────────────────────────────
test('signalPayload copies only the signals a surface supplied — it never invents one', () => {
  assert.deepEqual(signalPayload({ category: 'restaurant' }), { category: 'restaurant' });
  assert.deepEqual(signalPayload({}), {});
  // An explicitly-undefined signal is the same as an absent one.
  assert.deepEqual(signalPayload({ merchant: undefined, cuisine: 'pizza' }), { cuisine: 'pizza' });
});

test('interaction signals build preferred categories and favourite merchants', () => {
  const { events, visitorId } = logFor('sig', [
    { type: 'click', id: 'interaction.merchant.open', at: '2026-03-01T12:00:00.000Z', signals: { merchant: 'Pizza Romano', cuisine: 'pizza', storeType: 'restaurant' } },
    { type: 'click', id: 'interaction.merchant.open', at: '2026-03-01T12:05:00.000Z', signals: { merchant: 'Pizza Romano', cuisine: 'pizza', storeType: 'restaurant' } },
    { type: 'click', id: 'interaction.category.select', at: '2026-03-01T12:10:00.000Z', signals: { category: 'restaurant' } },
    { type: 'click', id: 'interaction.merchant.open', at: '2026-03-01T12:20:00.000Z', signals: { merchant: 'Super Fresh', storeType: 'market' } },
  ]);
  const profile = deriveVisitorProfile(events, visitorId);

  assert.equal(profile.favouriteMerchants[0].key, 'Pizza Romano');
  assert.equal(profile.favouriteMerchants[0].count, 2);
  assert.equal(profile.preferredCategories[0].key, 'restaurant');
  // Without signals these lists would be empty — that was the pre-activation state.
  assert.ok(profile.favouriteMerchants.length > 0 && profile.preferredCategories.length > 0);
});

// ── PART 2 · the five product scenarios ─────────────────────────────────────────
test('SCENARIO · New Visitor sees the welcome experience', () => {
  const { events, visitorId } = logFor('new-visitor', []);
  const profile = deriveVisitorProfile(events, visitorId);
  assert.equal(profile.totals.events, 0);
  assert.equal(customerChoice(events, visitorId), 'flag.customer_welcome');
});

test('SCENARIO · Returning Visitor who keeps dismissing welcome stops being shown it', () => {
  // Three sessions, welcome shown and dismissed in each — the fatigue signal.
  const { events, visitorId } = logFor('returning', [
    { type: 'view', id: 'flag.customer_welcome', at: '2026-03-01T09:00:00.000Z', session: 's1' },
    { type: 'dismiss', id: 'flag.customer_welcome', at: '2026-03-01T09:00:30.000Z', session: 's1' },
    { type: 'view', id: 'flag.customer_welcome', at: '2026-03-02T09:00:00.000Z', session: 's2' },
    { type: 'dismiss', id: 'flag.customer_welcome', at: '2026-03-02T09:00:30.000Z', session: 's2' },
    { type: 'view', id: 'flag.customer_welcome', at: '2026-03-03T09:00:00.000Z', session: 's3' },
    { type: 'dismiss', id: 'flag.customer_welcome', at: '2026-03-03T09:00:30.000Z', session: 's3' },
  ]);
  const profile = deriveVisitorProfile(events, visitorId);
  assert.equal(profile.sessions, 3);
  assert.equal(profile.dismissed['flag.customer_welcome'].count, 3);

  const choice = customerChoice(events, visitorId);
  assert.notEqual(choice, 'flag.customer_welcome');
  // The visitor is not left with a blank surface — a different experience takes the slot.
  assert.ok(choice.length > 0);
});

test('SCENARIO · Coupon Seeker is shown offers, not the generic welcome', () => {
  const { events, visitorId } = logFor('coupons', [
    { type: 'view', id: 'flag.customer_offers', at: '2026-03-01T10:00:00.000Z', session: 's1' },
    { type: 'click', id: 'flag.customer_offers', at: '2026-03-01T10:00:20.000Z', session: 's1', signals: { campaign: 'offers' } },
    { type: 'convert', id: 'flag.customer_offers', at: '2026-03-01T10:02:00.000Z', session: 's1', signals: { campaign: 'offers' } },
    { type: 'view', id: 'flag.customer_welcome', at: '2026-03-02T10:00:00.000Z', session: 's2' },
    { type: 'dismiss', id: 'flag.customer_welcome', at: '2026-03-02T10:00:05.000Z', session: 's2' },
    { type: 'view', id: 'flag.customer_offers', at: '2026-03-02T10:01:00.000Z', session: 's2' },
    { type: 'click', id: 'flag.customer_offers', at: '2026-03-02T10:01:15.000Z', session: 's2', signals: { campaign: 'offers' } },
  ]);
  const profile = deriveVisitorProfile(events, visitorId);
  assert.ok(profile.clicked['flag.customer_offers'].count >= 2);
  assert.equal(customerChoice(events, visitorId), 'flag.customer_offers');
});

test('SCENARIO · Restaurant Lover carries a restaurant interest into their profile', () => {
  const { events, visitorId } = logFor('restaurants', [
    { type: 'click', id: 'interaction.merchant.open', at: '2026-03-01T19:00:00.000Z', signals: { merchant: 'Al Basha', cuisine: 'grills', storeType: 'restaurant', category: 'restaurant' } },
    { type: 'click', id: 'interaction.merchant.open', at: '2026-03-02T19:00:00.000Z', session: 's2', signals: { merchant: 'Pizza Romano', cuisine: 'pizza', storeType: 'restaurant', category: 'restaurant' } },
    { type: 'click', id: 'interaction.category.select', at: '2026-03-03T19:00:00.000Z', session: 's3', signals: { category: 'restaurant' } },
    { type: 'click', id: 'interaction.merchant.open', at: '2026-03-03T19:05:00.000Z', session: 's3', signals: { merchant: 'Al Basha', cuisine: 'grills', storeType: 'restaurant', category: 'restaurant' } },
  ]);
  const profile = deriveVisitorProfile(events, visitorId);

  assert.equal(profile.preferredCategories[0].key, 'restaurant');
  assert.equal(profile.preferredCategories[0].count, 4);
  assert.equal(profile.favouriteMerchants[0].key, 'Al Basha');
  assert.equal(profile.sessions, 3);
});

test('SCENARIO · Late Night User is segmented from their own activity hours', () => {
  const lateEntries: Entry[] = [23, 1, 2, 23, 0].map((h, i) => ({
    type: 'view' as const,
    id: 'flag.customer_welcome',
    at: `2026-03-0${i + 1}T${String(h).padStart(2, '0')}:30:00.000Z`,
    session: `s${i + 1}`,
  }));
  const late = logFor('night-owl', lateEntries);
  const day = logFor('day-user', lateEntries.map(e => ({ ...e, at: e.at.replace(/T\d\d:/, 'T13:') })));

  const lateSegments = deriveSegments(deriveVisitorProfile(late.events, late.visitorId), NOW);
  const daySegments = deriveSegments(deriveVisitorProfile(day.events, day.visitorId), NOW);

  assert.ok(lateSegments.includes('late-night-user'), `expected late-night-user, got ${lateSegments.join(',')}`);
  assert.ok(!daySegments.includes('late-night-user'));
});

// ── PART 3 · the property the whole sprint rests on ─────────────────────────────
test('different visitors get different experiences from the SAME candidate set', () => {
  const newcomer = logFor('v-new', []);
  const seeker = logFor('v-seeker', [
    { type: 'view', id: 'flag.customer_offers', at: '2026-03-01T10:00:00.000Z' },
    { type: 'click', id: 'flag.customer_offers', at: '2026-03-01T10:00:10.000Z' },
    { type: 'convert', id: 'flag.customer_offers', at: '2026-03-01T10:01:00.000Z' },
    { type: 'view', id: 'flag.customer_welcome', at: '2026-03-02T10:00:00.000Z', session: 's2' },
    { type: 'dismiss', id: 'flag.customer_welcome', at: '2026-03-02T10:00:04.000Z', session: 's2' },
  ]);

  const a = customerChoice(newcomer.events, newcomer.visitorId);
  const b = customerChoice(seeker.events, seeker.visitorId);

  assert.notEqual(a, b, 'personalization must differentiate — identical output means it is not active');
  assert.equal(a, 'flag.customer_welcome');
  assert.equal(b, 'flag.customer_offers');
});

test('selection is deterministic — the same log always yields the same experience', () => {
  const { events, visitorId } = logFor('determinism', [
    { type: 'view', id: 'flag.customer_offers', at: '2026-03-01T10:00:00.000Z' },
    { type: 'click', id: 'flag.customer_offers', at: '2026-03-01T10:00:10.000Z' },
  ]);
  const runs = Array.from({ length: 5 }, () => customerChoice(events, visitorId));
  assert.equal(new Set(runs).size, 1, 'personalization must not vary between identical runs');
});

test('an empty candidate set selects nothing rather than inventing an experience', () => {
  const { events, visitorId } = logFor('empty', []);
  const profile = deriveVisitorProfile(events, visitorId);
  const decision = personalize(profile, [], { now: NOW, limit: 1 });
  assert.equal(decision.selected.length, 0);
  assert.equal(decision.ranked.length, 0);
});
