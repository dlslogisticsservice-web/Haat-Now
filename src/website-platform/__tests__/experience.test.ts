// Wave 4 experience tests — homepage builder, navigation, search, collections,
// promotions, invoices, realtime polling.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHomepageService, resolveHomepage, type HomepageSection, type HomepageRuntime } from '../homepage/homepage';
import { buildNavTree, buildBreadcrumbs } from '../navigation/navigation';
import { searchItems, autocomplete, nearbyItems, addRecentSearch, sortItems, type SearchableItem } from '../search/search';
import { createCollectionsService, resolveCollection, type Collection } from '../collections/collections';
import { createPromotionService, resolveBanners, type PromotionBanner } from '../promotions/promotions';
import { buildInvoice, renderInvoiceHtml } from '../invoices/invoice';
import { createPollingSubscription, type PollTimer } from '../realtime/polling';
import { testUuid } from '../testing/factories';
import { isOk } from '../shared/types';

const t = testUuid(1); const site = testUuid(2);
const nowIso = '2026-07-05T12:00:00.000Z';
const runtime: HomepageRuntime = { country: 'EG', language: 'ar', device: 'mobile', platform: 'mobile', visitor: 'returning', flags: { beta: true } };

// ── Homepage builder ─────────────────────────────────────────────────────────────
test('homepage resolver honors enabled/schedule/personalization/flag/order', () => {
  const base = (over: Partial<HomepageSection>): HomepageSection => ({ id: testUuid(), tenantId: t, siteId: site, key: 'k', type: 'hero', title: null, enabled: true, position: 0, schedule: {}, personalization: {}, featureFlag: null, config: {}, version: 1, createdAt: '', updatedAt: '', deletedAt: null, ...over });
  const sections: HomepageSection[] = [
    base({ id: testUuid(10), key: 'hero', position: 1 }),
    base({ id: testUuid(11), key: 'hidden', enabled: false, position: 0 }),
    base({ id: testUuid(12), key: 'sa-only', personalization: { countries: ['SA'] }, position: 2 }),
    base({ id: testUuid(13), key: 'expired', schedule: { endsAt: '2000-01-01T00:00:00.000Z' }, position: 3 }),
    base({ id: testUuid(14), key: 'flagged-off', featureFlag: 'missing', position: 4 }),
    base({ id: testUuid(15), key: 'promo', position: 0, featureFlag: 'beta' }),
  ];
  const resolved = resolveHomepage(sections, runtime, nowIso);
  assert.deepEqual(resolved.map(s => s.key), ['promo', 'hero']); // ordered; SA/expired/hidden/flagged-off excluded
});

test('HomepageService (memory) create/hide/reorder/resolve', async () => {
  const svc = createHomepageService('memory');
  const a = await svc.create({ tenantId: t, siteId: site, key: 'hero', type: 'hero', position: 0 });
  const b = await svc.create({ tenantId: t, siteId: site, key: 'collections', type: 'collections', position: 1 });
  assert.ok(isOk(a) && isOk(b));
  await svc.hide(t, b.value.id);
  const shown = await svc.resolve(t, site, runtime, nowIso);
  assert.ok(isOk(shown));
  assert.equal(shown.value.length, 1);
  const re = await svc.reorder(t, [b.value.id, a.value.id]);
  assert.ok(isOk(re));
});

// ── Navigation ─────────────────────────────────────────────────────────────────────
test('nav tree + breadcrumbs', () => {
  const mk = (id: string, label: string, parentId: string | null, position: number) => ({ id, tenantId: t, siteId: site, menuId: testUuid(9), parentId, label, pageId: null, externalUrl: `/${label.toLowerCase()}`, position, visibility: {}, version: 1, createdAt: '', updatedAt: '', deletedAt: null });
  const tree = buildNavTree([mk('a', 'Food', null, 0), mk('b', 'Pizza', 'a', 0), mk('c', 'Grocery', null, 1)], (_p, url) => url ?? '#');
  assert.equal(tree.length, 2);
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].label, 'Pizza');

  const pages = [{ id: 'p1', tenantId: t, siteId: site, parentId: null, slug: 'restaurants', title: 'Restaurants', routeType: 'static' as const, dataSource: null, status: 'published' as const, publishAt: null, position: 0, inNav: true, locale: 'en', version: 1, deletedAt: null, createdAt: '', updatedAt: '' }];
  const crumbs = buildBreadcrumbs('/restaurants', pages);
  assert.deepEqual(crumbs.map(c => c.label), ['Home', 'Restaurants']);
});

// ── Search ───────────────────────────────────────────────────────────────────────
const items: SearchableItem[] = [
  { id: '1', name: 'Pizza Palace', type: 'restaurant', rating: 4.8, deliveryMinutes: 25, popularity: 90, city: 'Cairo', keywords: ['pizza', 'offer'], lat: 30.0, lng: 31.2 },
  { id: '2', name: 'Burger Barn', type: 'restaurant', rating: 4.2, deliveryMinutes: 15, popularity: 70, city: 'Cairo', lat: 30.01, lng: 31.21 },
  { id: '3', name: 'Green Grocer', type: 'grocery', rating: 4.5, deliveryMinutes: 40, popularity: 50, city: 'Giza', lat: 29.9, lng: 31.1 },
];
test('search filters, ranks, autocompletes, nearby, recent', () => {
  const r = searchItems(items, { q: 'pizza' });
  assert.equal(r[0].id, '1');
  assert.deepEqual(autocomplete(items, 'bur'), ['Burger Barn']);
  const fast = sortItems(items, 'delivery_time');
  assert.equal(fast[0].id, '2');
  const near = nearbyItems(items, 30.0, 31.2, 5);
  assert.equal(near[0].id, '1');
  const restaurants = searchItems(items, { q: '', filters: { type: 'restaurant', minRating: 4.5 } });
  assert.equal(restaurants.length, 1);
  assert.deepEqual(addRecentSearch(['pizza'], 'PIZZA'), ['PIZZA']); // dedup case-insensitive
});

// ── Collections ────────────────────────────────────────────────────────────────────
test('collections resolve per kind + service', async () => {
  const def = (kind: Collection['kind'], params = {}): Collection => ({ id: testUuid(), tenantId: t, siteId: site, key: kind, kind, title: kind, enabled: true, position: 0, params, version: 1, createdAt: '', updatedAt: '', deletedAt: null });
  assert.equal(resolveCollection(def('top_rated'), items)[0].id, '1');
  assert.equal(resolveCollection(def('fast_delivery'), items)[0].id, '2');
  assert.equal(resolveCollection(def('city', { city: 'Giza' }), items).length, 1);
  assert.equal(resolveCollection(def('best_offers'), items)[0].id, '1'); // keyword 'offer'

  const svc = createCollectionsService('memory');
  const c = await svc.create({ tenantId: t, siteId: site, key: 'popular', kind: 'popular', title: 'Popular' });
  assert.ok(isOk(c));
  const list = await svc.listEnabled(t, site);
  assert.ok(isOk(list));
  assert.equal(list.value.length, 1);
});

// ── Promotions ─────────────────────────────────────────────────────────────────────
test('promotions resolve by placement/schedule/targeting/category/priority', async () => {
  const banner = (over: Partial<PromotionBanner>): PromotionBanner => ({ id: testUuid(), tenantId: t, siteId: site, name: 'B', enabled: true, priority: 0, placement: 'homepage', category: null, targeting: {}, schedule: {}, content: { title: 'Deal' }, version: 1, createdAt: '', updatedAt: '', deletedAt: null, ...over });
  const banners = [
    banner({ id: testUuid(30), priority: 1, targeting: { countries: ['EG'] } }),
    banner({ id: testUuid(31), priority: 5, targeting: { countries: ['EG'] } }),
    banner({ id: testUuid(32), placement: 'checkout' }),
    banner({ id: testUuid(33), schedule: { endsAt: '2000-01-01T00:00:00.000Z' } }),
  ];
  const resolved = resolveBanners(banners, 'homepage', { ...runtime }, nowIso);
  assert.equal(resolved[0].id, testUuid(31)); // highest priority; checkout + expired excluded

  const svc = createPromotionService('memory');
  const created = await svc.create({ tenantId: t, siteId: site, name: 'Ramadan', placement: 'homepage', content: { title: 'Ramadan offer', couponCode: 'RAM20' } });
  assert.ok(isOk(created));
  const live = await svc.resolve(t, site, 'homepage', { ...runtime }, nowIso);
  assert.ok(isOk(live));
  assert.equal(live.value.length, 1);
});

// ── Invoices ─────────────────────────────────────────────────────────────────────
test('invoice generation + HTML', () => {
  const inv = buildInvoice({ id: 'order-abcdef12', totalAmount: 55, deliveryFee: 5, items: [{ name: 'Pizza', quantity: 2, price: 25 }] }, { name: 'HaaT Now', currency: 'EGP' });
  assert.equal(inv.subtotal, 50);
  assert.equal(inv.total, 55);
  assert.match(inv.number, /^INV-/);
  const html = renderInvoiceHtml(inv, { name: 'HaaT Now', currency: 'EGP' });
  assert.match(html, /Invoice INV-/);
  assert.match(html, /EGP 55.00/);
});

// ── Realtime polling ─────────────────────────────────────────────────────────────
test('polling subscription fetches immediately + on tick, and unsubscribes', async () => {
  let ticks: (() => void)[] = [];
  const timer: PollTimer = { set: fn => { ticks.push(fn); return 1; }, clear: () => { ticks = []; } };
  const values: number[] = [];
  let n = 0;
  const unsub = createPollingSubscription(async () => ++n, 1000, v => values.push(v), timer);
  await new Promise(r => setImmediate(r)); // let the immediate fetch resolve
  assert.deepEqual(values, [1]);
  ticks[0]();
  await new Promise(r => setImmediate(r));
  assert.deepEqual(values, [1, 2]);
  unsub();
  assert.equal(ticks.length, 0);
});
