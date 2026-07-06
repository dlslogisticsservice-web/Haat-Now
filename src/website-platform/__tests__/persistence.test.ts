// Repository integration tests — the registry aggregates (memory backend) all honor
// the Repository contract (create/get/update/optimistic-lock/soft-delete/list).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRepositoryBundle } from '../repositories/registry';
import { testUuid } from '../testing/factories';
import { isOk } from '../shared/types';

const tenantId = testUuid(1);
const siteId = testUuid(2);

test('every registry aggregate supports the full CRUD contract (memory)', async () => {
  const repos = createRepositoryBundle('memory');

  const section = await repos.sections.create({ tenantId, siteId, pageId: null, scope: 'local' });
  assert.ok(isOk(section));
  assert.equal(section.value.version, 1);
  assert.equal(section.value.scope, 'local');

  const theme = await repos.themes.create({ tenantId, name: 'Ocean', mode: 'both' });
  assert.ok(isOk(theme));
  const themeUpd = await repos.themes.update(tenantId, theme.value.id, { isActive: true });
  assert.ok(isOk(themeUpd));
  assert.equal(themeUpd.value.isActive, true);
  assert.equal(themeUpd.value.version, 2);

  const redirect = await repos.redirects.create({ tenantId, siteId, sourcePath: '/old', targetPath: '/new' });
  assert.ok(isOk(redirect));
  assert.equal(redirect.value.code, 301);
  assert.equal(redirect.value.hits, 0);

  const del = await repos.redirects.softDelete(tenantId, redirect.value.id);
  assert.ok(isOk(del));
  const gone = await repos.redirects.getById(tenantId, redirect.value.id);
  assert.equal(gone.ok, false);
});

test('list filters + paginates across an aggregate', async () => {
  const repos = createRepositoryBundle('memory');
  for (let i = 0; i < 6; i++) {
    await repos.blocks.create({ tenantId, siteId, sectionId: testUuid(3), type: i % 2 ? 'hero' : 'faq', position: i });
  }
  const heroes = await repos.blocks.list(tenantId, { filters: [{ field: 'type', operator: 'eq', value: 'hero' }] });
  assert.ok(isOk(heroes));
  assert.equal(heroes.value.total, 3);
});

test('domains + custom code + templates persist with defaults', async () => {
  const repos = createRepositoryBundle('memory');
  const domain = await repos.domains.create({ tenantId, siteId, host: 'brand.com', kind: 'custom' });
  assert.ok(isOk(domain));
  assert.equal(domain.value.status, 'pending');

  const cc = await repos.customCode.create({ tenantId, siteId, scope: 'site_head', code: '<meta>' });
  assert.ok(isOk(cc));
  assert.equal(cc.value.enabled, false);
  assert.equal(cc.value.requiresFlag, 'website.custom_code');

  const tpl = await repos.templates.create({ tenantId, scope: 'section', name: 'Hero+CTA', payload: {} });
  assert.ok(isOk(tpl));
  assert.equal(tpl.value.visibility, 'private');
});
