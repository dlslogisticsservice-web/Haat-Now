import { test } from 'node:test';
import assert from 'node:assert/strict';
// routes.ts is dependency-free (no service graph), so it imports cleanly under node:test.
import { isConsoleRoute, isAppRoute, resolvePublicRequest, CONSOLE_ROUTES } from '../../features/website/routes';

// Auth routing guards: the public website, the role app, and the internal console
// must resolve to the correct runtime — with no way for a public path to leak into
// an internal entry and no way for an internal path to render as the public site.

test('console routes are recognised (and trailing slashes tolerated)', () => {
  for (const r of CONSOLE_ROUTES) {
    assert.equal(isConsoleRoute(r), true, r);
    assert.equal(isConsoleRoute(r + '/'), true, r + '/');
    assert.equal(isConsoleRoute(r + '/login'), true, r + '/login');
  }
});

test('public paths are NOT console routes', () => {
  for (const p of ['/', '/about', '/partners', '/partners/merchant', '/restaurants', '/help', '/consoles-of-fun', '/administrator-bio']) {
    assert.equal(isConsoleRoute(p), false, p);
  }
});

test('console routes are not app (/app) routes and vice-versa', () => {
  assert.equal(isAppRoute('/console'), false);
  assert.equal(isConsoleRoute('/app'), false);
  assert.equal(isAppRoute('/app'), true);
});

test('resolvePublicRequest: internal console mounts the APP (never the public website) on the app host', () => {
  const req = resolvePublicRequest({ hostname: 'haat-now.vercel.app', pathname: '/console', search: '' } as unknown as Location);
  assert.equal(req.isPublicSite, false);
  const req2 = resolvePublicRequest({ hostname: 'localhost', pathname: '/admin/login', search: '' } as unknown as Location);
  assert.equal(req2.isPublicSite, false);
});

test('resolvePublicRequest: public paths still resolve to the public website', () => {
  const home = resolvePublicRequest({ hostname: 'haat-now.vercel.app', pathname: '/', search: '' } as unknown as Location);
  assert.equal(home.isPublicSite, true);
  const partners = resolvePublicRequest({ hostname: 'haat-now.vercel.app', pathname: '/partners', search: '' } as unknown as Location);
  assert.equal(partners.isPublicSite, true);
});

test('resolvePublicRequest: /app is the role app, not the website', () => {
  const app = resolvePublicRequest({ hostname: 'haat-now.vercel.app', pathname: '/app', search: '' } as unknown as Location);
  assert.equal(app.isPublicSite, false);
});
