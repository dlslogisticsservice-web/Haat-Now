// App Conversion Engine tests — config-driven evaluation, targeting, triggers, frequency.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateConversion, emptySession, markShown, markDismissed, matchTargeting, triggersMatch,
  createConversionService, type ConversionRule, type ConversionRuntime,
} from '../conversion/conversion';
import { testUuid } from '../testing/factories';
import { isOk } from '../shared/types';

function rule(over: Partial<ConversionRule> = {}): ConversionRule {
  return {
    id: over.id ?? testUuid(), tenantId: testUuid(1), siteId: null, name: 'Install prompt',
    enabled: true, priority: 0, triggerMatch: 'all', targeting: {}, triggers: [],
    content: { title: 'Get the app', body: 'Faster checkout in the app', ctas: [] },
    frequency: { dismissible: true }, timing: {},
    version: 1, createdAt: '', updatedAt: '', deletedAt: null, ...over,
  };
}

const runtime: ConversionRuntime = { country: 'EG', language: 'ar', device: 'mobile', platform: 'mobile', visitor: 'returning', cartValue: 150, checkoutProgress: 60 };

test('targeting + triggers gate a rule', () => {
  assert.equal(matchTargeting({ countries: ['EG'], devices: ['mobile'] }, runtime), true);
  assert.equal(matchTargeting({ countries: ['SA'] }, runtime), false);
  assert.equal(triggersMatch(rule({ triggers: [{ type: 'cart_value', threshold: 100 }] }), runtime), true);
  assert.equal(triggersMatch(rule({ triggers: [{ type: 'cart_value', threshold: 500 }] }), runtime), false);
});

test('evaluate picks highest-priority eligible rule', () => {
  const low = rule({ id: testUuid(10), priority: 1, targeting: { countries: ['EG'] } });
  const high = rule({ id: testUuid(11), priority: 5, targeting: { countries: ['EG'] } });
  const other = rule({ id: testUuid(12), priority: 9, targeting: { countries: ['SA'] } });
  const match = evaluateConversion([low, high, other], runtime, emptySession(), Date.now());
  assert.ok(match);
  assert.equal(match!.rule.id, high.id);
});

test('frequency: showOnce suppresses after display; dismiss suppresses', () => {
  const r = rule({ id: testUuid(20), frequency: { dismissible: true, showOnce: true } });
  const session = emptySession();
  assert.ok(evaluateConversion([r], runtime, session, Date.now()));
  markShown(session, r.id, Date.now());
  assert.equal(evaluateConversion([r], runtime, session, Date.now()), null);

  const r2 = rule({ id: testUuid(21) });
  const s2 = emptySession();
  markDismissed(s2, r2.id);
  assert.equal(evaluateConversion([r2], runtime, s2, Date.now()), null);
});

test('deferred deep link is built when app + store config present', () => {
  const r = rule({ id: testUuid(30), targeting: { countries: ['EG'] }, content: {
    title: 'Continue in app', body: '', ctas: [], appScheme: 'haatnow', deepLinkPath: 'checkout',
    storeLinks: { android: 'https://play.google.com/x', ios: 'https://apps.apple.com/x', huawei: 'https://appgallery.huawei.com/x' },
  } });
  const match = evaluateConversion([r], runtime, emptySession(), Date.now(), 'android', { intent: 'checkout', issuedAt: 1 });
  assert.ok(match?.deferred);
  assert.match(match!.deferred!.deepLink, /^haatnow:\/\/checkout\?resume=/);
  assert.equal(match!.deferred!.storeUrl, 'https://play.google.com/x');
});

test('ConversionService (memory) create + resolve', async () => {
  const svc = createConversionService('memory');
  const created = await svc.create({ tenantId: testUuid(1), name: 'Cart nudge', priority: 3, targeting: { countries: ['EG'] }, triggers: [{ type: 'cart_value', threshold: 100 }], content: { title: 'Get the app', body: 'x', ctas: [] } });
  assert.ok(isOk(created));
  const resolved = await svc.resolve(testUuid(1), runtime, emptySession(), Date.now());
  assert.ok(isOk(resolved));
  assert.equal(resolved.value?.rule.name, 'Cart nudge');
});

test('validation rejects a rule without a title', async () => {
  const svc = createConversionService('memory');
  const bad = await svc.create({ tenantId: testUuid(1), name: 'x', content: { title: '', body: '', ctas: [] } });
  assert.equal(bad.ok, false);
});
