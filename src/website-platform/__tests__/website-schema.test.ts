import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadWebsite, validateSite, repairSite, WEBSITE_SCHEMA_VERSION } from '../../services/websiteSchema';

// The Website Schema Migration Framework must upgrade ANY stored website (old,
// partial, corrupt, future) to the latest schema before rendering — never throwing.
// websiteSchema imports only a TYPE from website.service, so it loads cleanly here.

const tenant = { id: 't-test', slug: 'haat-now', brand_name: 'HaaT' };
// The single source of truth (injected). A complete, valid latest-schema site.
const makeDefault = (): any => ({
  tenantId: 't-test', slug: 'haat-now', siteName: 'HaaT Now', status: 'published', maintenance: false,
  navigation: [{ label: 'Home', path: '/' }],
  footer: { columns: [{ title: 'Company', links: [] }], legalLinks: [{ label: 'Privacy', path: '/privacy' }], social: [{ label: 'X', href: 'https://x.com/haatnow' }], copyright: '© HaaT' },
  pages: [{ id: 'p_home', path: '/', kind: 'landing', title: 'Home', nav: true, navOrder: 0, seo: {}, sections: [{ type: 'hero', title: 'Welcome' }] }],
  blog: [], seoDefaults: { title: 'HaaT' }, analytics: {}, cookie: { enabled: true, policyPath: '/cookie-policy' },
  updatedAt: '2026-01-01T00:00:00Z', schemaVersion: WEBSITE_SCHEMA_VERSION,
});

test('corrupt JSON string recovers to defaults (never throws)', () => {
  const { site, report } = loadWebsite('this is not json', tenant, makeDefault);
  assert.equal(report.recovered, true);
  assert.equal(validateSite(site).valid, true);
});

test('null / undefined / empty recover to defaults', () => {
  for (const raw of [null, undefined, {}, '']) {
    const { site } = loadWebsite(raw, tenant, makeDefault);
    assert.equal(validateSite(site).valid, true, `raw=${JSON.stringify(raw)}`);
    assert.equal(site.schemaVersion, WEBSITE_SCHEMA_VERSION);
  }
});

test('the incident: a record missing `cookie` is repaired and validates', () => {
  const partial = { siteName: 'X', status: 'published', maintenance: false, pages: [{ path: '/', title: 'H', kind: 'landing', nav: true, navOrder: 0, seo: {}, sections: [] }], navigation: [{ label: 'H', path: '/' }], footer: { columns: [], legalLinks: [], social: [], copyright: 'x' }, seoDefaults: {}, blog: [], schemaVersion: 3 };
  const { site, report } = loadWebsite(partial, tenant, makeDefault);
  assert.ok(site.cookie && typeof site.cookie.enabled === 'boolean');
  assert.equal(validateSite(site).valid, true);
  assert.ok(report.created.includes('cookie') || report.repaired.includes('cookie'));
});

test('backward compatibility: legacy field remaps (v1→v2)', () => {
  const legacy: any = {
    siteName: 'Old', status: 'published', maintenance: false,
    pages: [{ path: '/', title: 'H', kind: 'landing', nav: true, navOrder: 0, seo: {}, sections: [{ type: 'hero' }] }],
    navigation: [{ label: 'H', path: '/' }], footer: { columns: [], copyright: 'x' },
    socialLinks: [{ label: 'FB', href: 'https://fb.com/x' }],   // legacy → footer.social
    legalLinks: [{ label: 'Terms', path: '/terms' }],           // legacy → footer.legalLinks
    heroTitle: 'Legacy Hero',                                   // legacy → first hero block
    analyticsId: 'G-123',                                       // legacy → analytics.measurementId
    seoDefaults: {}, blog: [],
  };
  const { site, report } = loadWebsite(legacy, tenant, makeDefault);
  assert.deepEqual((site as any).footer.social, [{ label: 'FB', href: 'https://fb.com/x' }]);
  assert.deepEqual((site as any).footer.legalLinks, [{ label: 'Terms', path: '/terms' }]);
  assert.equal((site as any).pages[0].sections[0].title, 'Legacy Hero');
  assert.equal((site as any).analytics.measurementId, 'G-123');
  assert.equal((site as any).socialLinks, undefined);          // legacy field removed after remap
  assert.ok(report.renamed.length >= 3);
});

test('migration chain runs from an inferred v1 all the way to latest', () => {
  const v1: any = { siteName: 'V1', status: 'published', maintenance: false, pages: [{ path: '/', title: 'H', kind: 'landing', nav: true, navOrder: 0, seo: {}, sections: [] }], navigation: [{ label: 'H', path: '/' }] };
  const { site } = loadWebsite(v1, tenant, makeDefault);
  assert.equal(site.schemaVersion, WEBSITE_SCHEMA_VERSION);
  assert.equal(validateSite(site).valid, true);
});

test('forward compatibility: unknown (future) fields are preserved, never deleted', () => {
  const future: any = { ...makeDefault(), schemaVersion: 99, experimentalWidget: { enabled: true }, futureBlockRegistry: [1, 2, 3] };
  const { site } = loadWebsite(future, tenant, makeDefault);
  assert.deepEqual((site as any).experimentalWidget, { enabled: true });
  assert.deepEqual((site as any).futureBlockRegistry, [1, 2, 3]);
  assert.equal(validateSite(site).valid, true);
});

test('non-destructive: existing valid content is never overwritten', () => {
  const custom: any = { ...makeDefault(), siteName: 'CustomBrand', cookie: { enabled: false, policyPath: '/my-cookies' } };
  custom.pages = [{ path: '/', title: 'MyHome', kind: 'landing', nav: true, navOrder: 0, seo: {}, sections: [{ type: 'hero', title: 'Mine' }] }];
  const { site } = loadWebsite(custom, tenant, makeDefault);
  assert.equal(site.siteName, 'CustomBrand');
  assert.equal((site as any).cookie.enabled, false);
  assert.equal((site as any).pages[0].title, 'MyHome');
});

test('stress: many fields missing at once still produces one valid site', () => {
  const { site } = loadWebsite({ siteName: 'Bare' }, tenant, makeDefault);
  const v = validateSite(site);
  assert.equal(v.valid, true, v.issues.join(', '));
});

test('repairSite reports what it created (audit trail for the health monitor)', () => {
  const { created } = repairSite({ siteName: 'x' }, tenant, makeDefault);
  assert.ok(created.length > 0);
});

test('an already-latest valid site needs no change (idempotent)', () => {
  const { report } = loadWebsite(makeDefault(), tenant, makeDefault);
  assert.equal(report.changed, false);
});
