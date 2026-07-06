// App Growth Engine + Experimentation tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGrowthEngine, selectCampaign, assignVariant, type GrowthCampaign, type GrowthRuntime } from '../growth/campaign';
import { emptySession } from '../conversion/conversion';
import { createExperimentTracker, detectWinner } from '../growth/experiments';
import { testUuid } from '../testing/factories';
import { isOk } from '../shared/types';

function campaign(over: Partial<GrowthCampaign> = {}): GrowthCampaign {
  return {
    id: over.id ?? testUuid(), tenantId: testUuid(1), siteId: null, name: 'Install', status: 'active',
    priority: 0, targeting: {}, utm: {}, triggerMatch: 'all', triggers: [], frequency: { dismissible: true }, timing: {},
    startsAt: null, expiresAt: null,
    variants: [
      { key: 'A', weight: 1, content: { title: 'Get 10% off', body: '', ctas: [] } },
      { key: 'B', weight: 1, content: { title: 'Free delivery', body: '', ctas: [] } },
    ],
    version: 1, createdAt: '', updatedAt: '', deletedAt: null, ...over,
  };
}
const runtime: GrowthRuntime = { country: 'EG', language: 'ar', device: 'mobile', platform: 'mobile', visitor: 'returning', cartValue: 150, checkoutProgress: 55, utm: { source: 'facebook' } };

test('selectCampaign gates by status, schedule, targeting, UTM, triggers, priority', () => {
  const active = campaign({ id: testUuid(10), priority: 1, targeting: { countries: ['EG'] } });
  const higher = campaign({ id: testUuid(11), priority: 5, targeting: { countries: ['EG'] }, utm: { source: ['facebook'] } });
  const paused = campaign({ id: testUuid(12), priority: 9, status: 'paused' });
  const expired = campaign({ id: testUuid(13), priority: 9, expiresAt: '2000-01-01T00:00:00.000Z' });
  const m = selectCampaign([active, higher, paused, expired], runtime, emptySession(), '2026-07-05T00:00:00.000Z', Date.now(), 'anon-1');
  assert.ok(m);
  assert.equal(m!.campaign.id, higher.id);
  assert.ok(['A', 'B'].includes(m!.variant.key));
});

test('UTM mismatch excludes a campaign', () => {
  const c = campaign({ id: testUuid(20), targeting: { countries: ['EG'] }, utm: { source: ['tiktok'] } });
  const m = selectCampaign([c], runtime, emptySession(), '2026-07-05T00:00:00.000Z', Date.now(), 'anon-1');
  assert.equal(m, null);
});

test('assignVariant is deterministic and covers both variants', () => {
  const c = campaign({ id: testUuid(30) });
  assert.equal(assignVariant(c, 'anon-x').key, assignVariant(c, 'anon-x').key); // stable
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) seen.add(assignVariant(c, `anon-${i}`).key);
  assert.equal(seen.size, 2); // both A and B assigned
});

test('GrowthEngine (memory) create + resolve', async () => {
  const engine = createGrowthEngine('memory');
  const created = await engine.create({ tenantId: testUuid(1), name: 'Cart nudge', status: 'active', priority: 3, targeting: { countries: ['EG'] }, triggers: [{ type: 'cart_value', threshold: 100 }], variants: [{ key: 'A', weight: 1, content: { title: 'Get the app', body: 'x', ctas: [] } }] });
  assert.ok(isOk(created));
  const r = await engine.resolve(testUuid(1), runtime, emptySession(), '2026-07-05T00:00:00.000Z', Date.now(), 'anon-1');
  assert.ok(isOk(r));
  assert.equal(r.value?.campaign.name, 'Cart nudge');
});

test('validation rejects a campaign with no variants', async () => {
  const engine = createGrowthEngine('memory');
  const bad = await engine.create({ tenantId: testUuid(1), name: 'x', variants: [] });
  assert.equal(bad.ok, false);
});

test('experiment tracker records + summarizes; winner needs sample + significance', async () => {
  const tracker = createExperimentTracker('memory');
  const t = testUuid(1); const c = testUuid(40);
  await tracker.recordExposure(t, c, 'A'); await tracker.recordConversion(t, c, 'A');
  await tracker.recordExposure(t, c, 'B');
  const sum = await tracker.summary(t, c);
  assert.ok(isOk(sum));
  assert.equal(sum.value.find(v => v.variantKey === 'A')?.conversionRate, 1);

  // small sample → not confident
  const small = detectWinner(sum.value, 100, 1.96);
  assert.equal(small?.confident, false);
  // large, clearly-separated sample → confident
  const big = detectWinner([
    { variantKey: 'A', exposures: 1000, conversions: 200, installs: 0, couponRedemptions: 0, conversionRate: 0.2 },
    { variantKey: 'B', exposures: 1000, conversions: 100, installs: 0, couponRedemptions: 0, conversionRate: 0.1 },
  ], 100, 1.96);
  assert.equal(big?.variantKey, 'A');
  assert.equal(big?.confident, true);
});
