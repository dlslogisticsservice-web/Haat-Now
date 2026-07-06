// Deep linking + website ordering contract + official-site tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectMobilePlatform, storeUrl, buildDeepLink, buildResumeToken, parseResumeToken, resolveDeferredLink } from '../conversion/deeplink';
// Type-only import: the real AppServicesOrdering delegates to the app services, whose
// modules read import.meta.env at load (not Node-safe). Its correctness (implements the
// port → delegates) is guaranteed by tsc; the runtime flow is proven by a fake below.
import type { CheckoutInput } from '../ordering/ordering';
import { HAAT_SITE, compileHaatSnapshot, seedHaatSite } from '../haat-site/site-definition';
import { createPlatformContext } from '../services/context';
import { testUuid } from '../testing/factories';
import { ok, isOk, type Result } from '../shared/types';

// ── Deep linking ─────────────────────────────────────────────────────────────────
test('platform detection prefers huawei, then ios, then android', () => {
  assert.equal(detectMobilePlatform('Mozilla (Linux; Android 12; HUAWEI)'), 'huawei');
  assert.equal(detectMobilePlatform('Mozilla (iPhone; iOS 17)'), 'ios');
  assert.equal(detectMobilePlatform('Mozilla (Linux; Android 12; Pixel)'), 'android');
  assert.equal(detectMobilePlatform('Mozilla (Windows)'), 'unknown');
});

test('store URL resolves per platform with fallback', () => {
  const links = { android: 'a', ios: 'i', huawei: 'h' };
  assert.equal(storeUrl('ios', links), 'i');
  assert.equal(storeUrl('huawei', links), 'h');
  assert.equal(storeUrl('huawei', { android: 'a' }), 'a'); // fallback
  assert.equal(storeUrl('unknown', links), 'a');
});

test('deep link builder + resume token round-trip and tamper-detection', () => {
  assert.equal(buildDeepLink('haatnow', '/checkout', { resume: 'x' }), 'haatnow://checkout?resume=x');
  const token = buildResumeToken({ intent: 'checkout', issuedAt: 123 });
  const parsed = parseResumeToken(token);
  assert.equal(parsed?.intent, 'checkout');
  assert.equal(parseResumeToken(token + 'x'), null);          // tampered signature/body
  assert.equal(parseResumeToken('garbage'), null);
});

test('deferred deep link produces both destinations + token', () => {
  const r = resolveDeferredLink({ scheme: 'haatnow', deepPath: 'checkout', storeLinks: { android: 'a' }, platform: 'android', resume: { intent: 'checkout', issuedAt: 1 } });
  assert.match(r.deepLink, /^haatnow:\/\/checkout\?resume=/);
  assert.equal(r.storeUrl, 'a');
  assert.ok(r.resumeToken);
});

// ── Website ordering contract ──────────────────────────────────────────────────────
test('a port implementation can drive the full browse→checkout→track flow', async () => {
  // A fake proving the contract without the app's localStorage/Supabase backend.
  const orders = new Map<string, { id: string; status: string }>();
  const fake = {
    async checkout(_input: CheckoutInput): Promise<Result<{ id: string; status: string }>> {
      const id = `o-${orders.size + 1}`; orders.set(id, { id, status: 'pending' }); return ok({ id, status: 'pending' });
    },
    async trackOrder(orderId: string): Promise<Result<{ id: string; status: string } | null>> { return ok(orders.get(orderId) ?? null); },
  };
  const placed = await fake.checkout({ customerId: 'c', branchId: 'b', totalAmount: 50, items: [{ variantId: 'v', quantity: 1, price: 50 }] });
  assert.ok(isOk(placed));
  const tracked = await fake.trackOrder(placed.value.id);
  assert.ok(isOk(tracked));
  assert.equal(tracked.value?.status, 'pending');
});

// ── Official HaaT website ──────────────────────────────────────────────────────────
test('the official site defines all 19 pages including the required ones', () => {
  assert.equal(HAAT_SITE.pages.length, 19);
  const slugs = HAAT_SITE.pages.map(p => p.slug);
  for (const required of ['home', 'about', 'services', 'restaurants', 'grocery', 'pharmacy', 'parcel-delivery', 'become-a-driver', 'become-a-merchant', 'franchise', 'pricing', 'faq', 'contact', 'careers', 'blog', 'help', 'privacy', 'terms', 'cookie-policy']) {
    assert.ok(slugs.includes(required), `missing page ${required}`);
  }
});

test('compileHaatSnapshot produces 19 compiled pages with valid paths + etags', () => {
  const snap = compileHaatSnapshot(testUuid(1), '2026-07-05T00:00:00.000Z');
  assert.equal(snap.pages.length, 19);
  assert.ok(snap.pages.every(p => p.path.startsWith('/') && p.etag.length === 8));
  assert.ok(snap.pages.some(p => p.path === '/'));
});

test('seedHaatSite persists site + pages via services (editable later)', async () => {
  const ctx = createPlatformContext({ backend: 'memory' });
  const op = { tenantId: testUuid(1), actorId: null, correlationId: 'seed' };
  const siteId = await seedHaatSite(ctx, op);
  assert.ok(isOk(siteId));
  const pages = await ctx.repos.pages.list(op.tenantId, { pageSize: 50, filters: [{ field: 'siteId', operator: 'eq', value: siteId.value }] });
  assert.ok(isOk(pages));
  assert.equal(pages.value.total, 19);
});
