// Launch Sprint 2 tests — decision engine (Part 6), commerce hand-off (Part 7),
// launch validation funnel (Part 8).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { matchTargeting, type ConversionRuntime, type ConversionTargeting } from '../conversion/conversion';
import { encodeCommerceHandoff, decodeCommerceHandoff, buildCommerceHandoffLink, readAttributionFromQuery, type CommerceHandoff } from '../conversion/handoff';
import { computeLaunchMetrics, createFunnelRecorder, type FunnelEvent } from '../analytics/funnel';

const runtime = (over: Partial<ConversionRuntime> = {}): ConversionRuntime => ({
  country: 'SA', language: 'ar', device: 'mobile', platform: 'mobile', visitor: 'returning', ...over,
});

// ── Part 6 · Decision engine ─────────────────────────────────────────────────────
test('decision engine: unset targeting always matches (backward compatible)', () => {
  assert.equal(matchTargeting({}, runtime()), true);
  // Existing signals still work.
  assert.equal(matchTargeting({ countries: ['SA'] }, runtime()), true);
  assert.equal(matchTargeting({ countries: ['EG'] }, runtime()), false);
});

test('decision engine: loyalty / clv / visitCount audience signals', () => {
  assert.equal(matchTargeting({ loyaltyTiers: ['gold', 'platinum'] }, runtime({ loyaltyTier: 'gold' })), true);
  assert.equal(matchTargeting({ loyaltyTiers: ['platinum'] }, runtime({ loyaltyTier: 'gold' })), false);
  assert.equal(matchTargeting({ loyaltyTiers: ['gold'] }, runtime()), false); // rule targets tier, runtime has none
  assert.equal(matchTargeting({ minClv: 500 }, runtime({ clv: 800 })), true);
  assert.equal(matchTargeting({ minClv: 500 }, runtime({ clv: 200 })), false);
  assert.equal(matchTargeting({ minVisitCount: 3 }, runtime({ visitCount: 5 })), true);
  assert.equal(matchTargeting({ minVisitCount: 3 }, runtime({ visitCount: 1 })), false);
});

test('decision engine: attribution, merchant, category, geo signals', () => {
  assert.equal(matchTargeting({ utmSources: ['meta'], utmCampaigns: ['ramadan'] }, runtime({ utmSource: 'meta', utmCampaign: 'ramadan' })), true);
  assert.equal(matchTargeting({ utmSources: ['google'] }, runtime({ utmSource: 'meta' })), false);
  assert.equal(matchTargeting({ referrers: ['partner.com'] }, runtime({ referrer: 'partner.com' })), true);
  assert.equal(matchTargeting({ merchants: ['m1'] }, runtime({ merchantId: 'm1' })), true);
  assert.equal(matchTargeting({ merchants: ['m1'] }, runtime({ merchantId: 'm2' })), false);
  assert.equal(matchTargeting({ categories: ['pizza'] }, runtime({ categoryId: 'pizza' })), true);
  assert.equal(matchTargeting({ cities: ['Riyadh'] }, runtime({ city: 'Riyadh' })), true);
});

test('decision engine: time-of-day + day-of-week windows (incl. midnight wrap)', () => {
  assert.equal(matchTargeting({ daysOfWeek: [1, 2] }, runtime({ dayOfWeek: 1 })), true);
  assert.equal(matchTargeting({ daysOfWeek: [3] }, runtime({ dayOfWeek: 1 })), false);
  assert.equal(matchTargeting({ hourRange: { start: 9, end: 17 } }, runtime({ hourOfDay: 12 })), true);
  assert.equal(matchTargeting({ hourRange: { start: 9, end: 17 } }, runtime({ hourOfDay: 20 })), false);
  // wrap across midnight
  assert.equal(matchTargeting({ hourRange: { start: 22, end: 2 } }, runtime({ hourOfDay: 23 })), true);
  assert.equal(matchTargeting({ hourRange: { start: 22, end: 2 } }, runtime({ hourOfDay: 1 })), true);
  assert.equal(matchTargeting({ hourRange: { start: 22, end: 2 } }, runtime({ hourOfDay: 12 })), false);
});

test('decision engine: multiple signals combine with AND', () => {
  const t: ConversionTargeting = { countries: ['SA'], loyaltyTiers: ['gold'], merchants: ['m1'] };
  assert.equal(matchTargeting(t, runtime({ loyaltyTier: 'gold', merchantId: 'm1' })), true);
  assert.equal(matchTargeting(t, runtime({ loyaltyTier: 'gold', merchantId: 'm2' })), false);
});

// ── Part 7 · Commerce hand-off (zero information loss) ─────────────────────────────
const fullHandoff: CommerceHandoff = {
  merchantId: 'mer_1', branchId: 'br_9',
  cart: [
    { productId: 'p1', name: 'Pizza', quantity: 2, unitPrice: 25, variantId: 'v_large', modifiers: ['extra_cheese', 'stuffed_crust'], notes: 'well done' },
    { productId: 'p2', name: 'Cola', quantity: 1, unitPrice: 5, variantId: null, modifiers: [] },
  ],
  couponCode: 'RAMADAN20',
  address: { id: 'addr_3', label: 'Home', text: '12 King Rd', lat: 24.7, lng: 46.6 },
  paymentMethodId: 'pm_2',
  sessionToken: 'sess_abc.def',
  campaign: 'summer', referral: 'friend_42',
  utm: { source: 'meta', medium: 'cpc', campaign: 'ramadan', term: 'pizza', content: 'ad1' },
  locale: 'ar',
};

test('hand-off: encode → decode is lossless', () => {
  const token = encodeCommerceHandoff(fullHandoff, 1_700_000_000_000);
  const decoded = decodeCommerceHandoff(token);
  assert.deepEqual(decoded, fullHandoff);
});

test('hand-off: tampered or wrong token → null (integrity)', () => {
  const token = encodeCommerceHandoff(fullHandoff, 1_700_000_000_000);
  const tampered = token.slice(0, -3) + (token.endsWith('a') ? 'b' : 'a') + token.slice(-2);
  assert.equal(decodeCommerceHandoff(tampered), null);
  assert.equal(decodeCommerceHandoff('not-a-token'), null);
});

test('hand-off: deferred deep link carries the resume token + store fallback', () => {
  const res = buildCommerceHandoffLink({
    scheme: 'haatnow', deepPath: 'checkout',
    storeLinks: { android: 'https://play.google.com/x', ios: 'https://apps.apple.com/x' },
    platform: 'ios', handoff: fullHandoff, nowMs: 1_700_000_000_000,
  });
  assert.match(res.deepLink, /^haatnow:\/\/checkout\?resume=/);
  assert.equal(res.storeUrl, 'https://apps.apple.com/x');
  assert.ok(res.resumeToken && res.resumeToken.length > 0);
});

test('hand-off: reads UTM / campaign / referral from a query string', () => {
  const a = readAttributionFromQuery('?utm_source=meta&utm_medium=cpc&utm_campaign=eid&campaign=summer&ref=friend_1');
  assert.equal(a.utm.source, 'meta');
  assert.equal(a.utm.medium, 'cpc');
  assert.equal(a.utm.campaign, 'eid');
  assert.equal(a.campaign, 'summer');
  assert.equal(a.referral, 'friend_1');
});

// ── Part 8 · Launch validation funnel ─────────────────────────────────────────────
test('funnel: computes the seven launch metrics', () => {
  const ev = (type: FunnelEvent['type'], extra: Partial<FunnelEvent> = {}): FunnelEvent => ({ type, at: 0, ...extra });
  const events: FunnelEvent[] = [
    ev('discovery_view', { sessionId: 's1' }), ev('discovery_view', { sessionId: 's2' }), ev('discovery_view', { sessionId: 's3' }), ev('discovery_view', { sessionId: 's4' }),
    ev('add_to_cart', { sessionId: 's1' }), ev('add_to_cart', { sessionId: 's2' }), ev('add_to_cart', { sessionId: 's3' }), ev('add_to_cart', { sessionId: 's4' }),
    ev('checkout_started', { sessionId: 's1' }), ev('checkout_started', { sessionId: 's2' }), ev('checkout_started', { sessionId: 's3' }),
    ev('checkout_completed', { sessionId: 's1' }), ev('checkout_completed', { sessionId: 's2' }),
    ev('website_to_app', { sessionId: 's4' }),
    ev('order_success'), ev('order_success'), ev('order_success'), ev('order_failed'),
    ev('refund_requested'), ev('refund_requested'), ev('refund_completed'),
    ev('support_contacted'), ev('support_contacted'), ev('support_resolved'),
    ev('tracking_update', { latencyMs: 100 }), ev('tracking_update', { latencyMs: 200 }),
    ev('tracking_update', { latencyMs: 300 }), ev('tracking_update', { latencyMs: 900 }),
  ];
  const m = computeLaunchMetrics(events);
  assert.equal(Math.round(m.checkoutCompletionRate * 100), 67);   // 2/3
  assert.equal(Math.round(m.cartAbandonmentRate * 100), 25);      // 1 - 3/4
  assert.equal(Math.round(m.websiteToAppConversion * 100), 25);   // 1/4 sessions
  assert.equal(Math.round(m.orderSuccessRate * 100), 75);         // 3/4
  assert.equal(m.refundFlowCompletion, 0.5);                      // 1/2
  assert.equal(m.supportFlowCompletion, 0.5);                     // 1/2
  assert.equal(m.trackingLatencyP50Ms, 200);
  assert.equal(m.trackingLatencyP95Ms, 900);
  assert.equal(m.sampleSize, events.length);
});

test('funnel: recorder logs, emits, and aggregates', () => {
  const emitted: FunnelEvent[] = [];
  const rec = createFunnelRecorder(e => emitted.push(e));
  rec.record('discovery_view', 1, { sessionId: 's1' });
  rec.record('add_to_cart', 2, { sessionId: 's1' });
  rec.record('checkout_started', 3, { sessionId: 's1' });
  rec.record('checkout_completed', 4, { sessionId: 's1' });
  assert.equal(rec.events().length, 4);
  assert.equal(emitted.length, 4);
  assert.equal(rec.metrics().checkoutCompletionRate, 1);
  rec.reset();
  assert.equal(rec.events().length, 0);
});
