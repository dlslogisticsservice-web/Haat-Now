// Row ↔ entity mapper (serialization) tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { siteFromRow, pageFromRow, siteInsert, pageInsert, type SiteRow, type PageRow } from '../repositories/rows';
import { makeCreateSiteDto, makeCreatePageDto } from '../testing/factories';

test('siteFromRow maps snake_case → camelCase and defaults nulls', () => {
  const row: SiteRow = {
    id: '00000000-0000-4000-8000-000000000001',
    tenant_id: '00000000-0000-4000-8000-000000000002',
    slug: 'acme', name: 'Acme', status: 'published',
    default_locale: 'ar', locales: null, primary_domain_id: null, active_theme_id: null,
    maintenance: false, published_version: 3, settings: null,
    version: 5, deleted_at: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z',
  };
  const site = siteFromRow(row);
  assert.equal(site.id, row.id);
  assert.equal(site.tenantId, row.tenant_id);
  assert.equal(site.defaultLocale, 'ar');
  assert.deepEqual(site.locales, []);
  assert.deepEqual(site.settings, {});
  assert.equal(site.publishedVersion, 3);
  assert.equal(site.version, 5);
});

test('siteInsert produces DB columns with defaults', () => {
  const row = siteInsert(makeCreateSiteDto());
  assert.equal(row.slug, 'acme-foods');
  assert.equal(row.status, 'draft');
  assert.equal(row.default_locale, 'ar');
  assert.deepEqual(row.locales, ['ar', 'en']);
});

test('pageFromRow maps and pageInsert defaults route_type', () => {
  const row: PageRow = {
    id: '00000000-0000-4000-8000-000000000010',
    tenant_id: '00000000-0000-4000-8000-000000000002',
    site_id: '00000000-0000-4000-8000-000000000003',
    parent_id: null, slug: 'pricing', title: 'Pricing', route_type: 'static',
    data_source: null, status: 'draft', publish_at: null, position: 2, in_nav: true, locale: 'ar',
    version: 1, deleted_at: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  };
  const page = pageFromRow(row);
  assert.equal(page.siteId, row.site_id);
  assert.equal(page.inNav, true);
  const insert = pageInsert(makeCreatePageDto(row.site_id));
  assert.equal(insert.route_type, 'static');
  assert.equal(insert.in_nav, true);
});
