// Compatibility layer tests — flag-gated backend selection + legacy mapping.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectWebsiteBackend, legacySiteToCreateDto, planLegacyImport } from '../compat/legacy-adapter';
import { StaticFlagResolver, WEBSITE_FLAGS } from '../flags/flags';
import type { WebsiteSite as LegacySite } from '../../services/website.service';

const legacy: LegacySite = {
  tenantId: '00000000-0000-4000-8000-000000000002',
  slug: 'acme', siteName: 'Acme', status: 'published', maintenance: false,
  navigation: [], footer: { columns: [], social: [], legalLinks: [], copyright: '' },
  pages: [
    { id: 'p_home', path: '/', kind: 'landing', title: 'Home', nav: true, navOrder: 0, seo: {}, sections: [] },
    { id: 'p_about', path: '/about', kind: 'about', title: 'About', nav: true, navOrder: 1, seo: {}, sections: [] },
  ],
  blog: [], seoDefaults: {}, analytics: {}, cookie: { enabled: true, policyPath: '/privacy' },
  updatedAt: '2026-01-01T00:00:00.000Z',
};

test('Wave 0 default: backend is always legacy (DB_BACKEND disabled)', () => {
  assert.equal(selectWebsiteBackend({ environment: 'sandbox' }), 'legacy');
  assert.equal(selectWebsiteBackend({ environment: 'production', tenantId: 'x' }), 'legacy');
});

test('backend flips to platform only when DB_BACKEND is enabled for the tenant', () => {
  const resolver = new StaticFlagResolver([
    { flag: WEBSITE_FLAGS.DB_BACKEND, state: 'enabled', tenants: ['tenant-a'] },
  ]);
  assert.equal(selectWebsiteBackend({ environment: 'production', tenantId: 'tenant-a' }, resolver), 'platform');
  assert.equal(selectWebsiteBackend({ environment: 'production', tenantId: 'tenant-b' }, resolver), 'legacy');
});

test('legacySiteToCreateDto maps name/slug/status and preserves settings', () => {
  const dto = legacySiteToCreateDto(legacy.tenantId, legacy);
  assert.equal(dto.name, 'Acme');
  assert.equal(dto.slug, 'acme');
  assert.equal(dto.status, 'published');
  assert.equal(dto.settings?.importedFrom, 'legacy_website_center');
});

test('planLegacyImport produces one site + a page per legacy page', () => {
  const plan = planLegacyImport(legacy.tenantId, legacy);
  assert.equal(plan.pages.length, 2);
  assert.equal(plan.pages[0].slug, 'home'); // '/' → 'home'
  assert.equal(plan.pages[1].slug, 'about');
});
