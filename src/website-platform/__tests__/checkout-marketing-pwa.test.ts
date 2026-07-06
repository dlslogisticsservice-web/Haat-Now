// Smart Checkout Migration + Marketing Platform + PWA tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCheckoutMigration, defaultCheckoutMigrationConfig } from '../growth/checkout-migration';
import { parseResumeToken } from '../conversion/deeplink';
import { buildMarketingBlocks, createMarketingService, MARKETING_KINDS, type MarketingPageSpec } from '../marketing/marketing';
import { buildManifest, buildServiceWorker, InstallPromptController, pwaCapabilities } from '../pwa/pwa';
import { createPlatformContext } from '../services/context';
import { seedHaatSite } from '../haat-site/site-definition';
import { testUuid } from '../testing/factories';
import { isOk } from '../shared/types';

// ── Checkout migration ─────────────────────────────────────────────────────────────
test('migration is eligible only at/after the configured threshold', () => {
  const config = { ...defaultCheckoutMigrationConfig(), enabled: true, thresholdPct: 50, couponCode: 'APP10', storeLinks: { android: 'a', ios: 'i', huawei: 'h' } };
  const below = buildCheckoutMigration(config, { cartValue: 80, progressPct: 30 }, 'android', Date.now());
  assert.equal(below.eligible, false);
  const at = buildCheckoutMigration(config, { cartId: 'cart-1', cartValue: 80, progressPct: 60 }, 'android', Date.now());
  assert.equal(at.eligible, true);
});

test('migration injects the coupon + cart into the resume token; never forces', () => {
  const config = { ...defaultCheckoutMigrationConfig(), enabled: true, couponCode: 'APP10', storeLinks: { android: 'a' } };
  const offer = buildCheckoutMigration(config, { cartId: 'cart-9', cartValue: 120, progressPct: 70 }, 'android', 1000);
  assert.ok(offer.continueInApp);
  assert.ok(offer.continueOnWebsite);           // never force
  assert.match(offer.continueInApp!.deepLink, /^haatnow:\/\/checkout\?resume=/);
  const token = offer.continueInApp!.resumeToken!;
  const payload = parseResumeToken(token);
  assert.equal(payload?.coupon, 'APP10');
  assert.equal(payload?.cartId, 'cart-9');
});

// ── Marketing ───────────────────────────────────────────────────────────────────────
test('marketing kinds build valid block sets', () => {
  assert.equal(MARKETING_KINDS.length, 8);
  const referral: MarketingPageSpec = { kind: 'referral', slug: 'refer', title: 'Refer a friend', heading: 'Give 10, get 10', couponCode: 'FRIEND10', seo: { title: 'Refer a friend — HaaT Now', description: 'Invite friends to HaaT Now and you both get a discount on your next order.' } };
  const blocks = buildMarketingBlocks(referral);
  assert.ok(blocks.some(b => b.type === 'hero'));
  assert.ok(blocks.some(b => b.type === 'features')); // "how it works"
  assert.ok(blocks.some(b => b.type === 'cta'));
});

test('MarketingService persists a city page via services', async () => {
  const ctx = createPlatformContext({ backend: 'memory' });
  const op = { tenantId: testUuid(1), actorId: null, correlationId: 'mkt' };
  const site = await seedHaatSite(ctx, op);
  assert.ok(isOk(site));
  const marketing = createMarketingService(ctx);
  const page = await marketing.createPage(op, site.value, { kind: 'city', slug: 'cairo', title: 'HaaT Now in Cairo', heading: 'Order in Cairo', city: 'Cairo', items: [{ title: 'Top restaurants', body: 'Discover the best in Cairo' }], seo: { title: 'HaaT Now Cairo — Food & Grocery Delivery', description: 'Order food, groceries and pharmacy in Cairo with HaaT Now, delivered fast.' } });
  assert.ok(isOk(page));
  assert.equal(page.value.kind, 'city');
});

// ── PWA ───────────────────────────────────────────────────────────────────────────────
test('manifest + service worker are well-formed', () => {
  const manifest = buildManifest({ name: 'HaaT Now', shortName: 'HaaT', themeColor: '#A3F95B', backgroundColor: '#0b0b0b', icons: [{ src: '/icons/192.png', sizes: '192x192', type: 'image/png' }] });
  assert.equal(manifest.name, 'HaaT Now');
  assert.equal(manifest.display, 'standalone');
  assert.equal((manifest.icons as unknown[]).length, 1);
  const sw = buildServiceWorker({ cacheName: 'haat-v1', precacheUrls: ['/', '/offline'], offlineUrl: '/offline' });
  for (const marker of ["addEventListener('install'", "addEventListener('fetch'", "addEventListener('push'", "addEventListener('sync'"]) {
    assert.ok(sw.includes(marker), `SW missing ${marker}`);
  }
});

test('install prompt controller respects config + eligibility', async () => {
  const ctrl = new InstallPromptController({ enabled: true, minVisits: 2, minSecondsOnSite: 10 });
  assert.equal(ctrl.shouldShow({ visits: 3, secondsOnSite: 20, alreadyInstalled: false }), false); // no captured event yet
  let prompted = false;
  ctrl.capture({ prompt: async () => { prompted = true; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  assert.equal(ctrl.shouldShow({ visits: 1, secondsOnSite: 20, alreadyInstalled: false }), false); // below minVisits
  assert.equal(ctrl.shouldShow({ visits: 3, secondsOnSite: 20, alreadyInstalled: false }), true);
  assert.equal(ctrl.shouldShow({ visits: 3, secondsOnSite: 20, alreadyInstalled: true }), false); // installed
  const outcome = await ctrl.prompt();
  assert.equal(outcome, 'accepted');
  assert.equal(prompted, true);
  assert.equal(await ctrl.prompt(), 'unavailable'); // consumed
});

test('pwa capability detection is Node-safe', () => {
  const caps = pwaCapabilities({ serviceWorker: {} }, { PushManager: {}, SyncManager: {} });
  assert.equal(caps.serviceWorker, true);
  assert.equal(caps.push, true);
  assert.equal(caps.backgroundSync, true);
});
