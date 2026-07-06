// Child-collection + child-service coverage (settings, revisions, media usage, nav reorder,
// restore, collection CRUD).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryCollection } from '../repositories/collection';
import { createRepositoryBundle } from '../repositories/registry';
import { createPlatformContext } from '../services/context';
import { createServices } from '../services/services';
import { testUuid } from '../testing/factories';
import { isOk } from '../shared/types';

const op = { tenantId: testUuid(1), actorId: testUuid(2), correlationId: 'c' };

test('MemoryCollection insert/upsert/find/findOne/remove', async () => {
  const c = new MemoryCollection<{ id: string; k: string; v: number }>();
  await c.insert({ id: '1', k: 'a', v: 1 });
  await c.upsert({ id: '1', k: 'a', v: 2 }, ['id']); // update
  await c.upsert({ id: '2', k: 'b', v: 3 }, ['id']); // insert
  const all = await c.find();
  assert.ok(isOk(all));
  assert.equal(all.value.length, 2);
  const one = await c.findOne({ k: 'a' });
  assert.ok(isOk(one));
  assert.equal(one.value?.v, 2);
  const removed = await c.remove({ k: 'b' });
  assert.ok(isOk(removed));
  assert.equal(removed.value, 1);
});

test('SettingsService set/get/list (upsert semantics)', async () => {
  const ctx = createPlatformContext({ backend: 'memory' });
  const services = createServices(ctx);
  const siteId = testUuid(5);
  await services.settings.set(op, siteId, 'cookie', { enabled: true });
  await services.settings.set(op, siteId, 'cookie', { enabled: false }); // overwrite
  const got = await services.settings.get(op, siteId, 'cookie');
  assert.ok(isOk(got));
  assert.deepEqual(got.value?.value, { enabled: false });
  const list = await services.settings.list(op, siteId);
  assert.ok(isOk(list));
  assert.equal(list.value.length, 1);
});

test('RevisionService append + list by entity', async () => {
  const ctx = createPlatformContext({ backend: 'memory' });
  const services = createServices(ctx);
  const siteId = testUuid(5); const pageId = testUuid(6);
  await services.revisions.record(op, siteId, 'page', pageId, { title: 'v1' }, 'edit');
  await services.revisions.record(op, siteId, 'page', pageId, { title: 'v2' });
  const revs = await services.revisions.list(op, 'page', pageId);
  assert.ok(isOk(revs));
  assert.equal(revs.value.length, 2);
});

test('MediaMetadataService records + counts usage (delete safety)', async () => {
  const ctx = createPlatformContext({ backend: 'memory' });
  const services = createServices(ctx);
  const assetId = testUuid(7);
  await services.media.recordUsage(op.tenantId, assetId, testUuid(8), 'props.image');
  const count = await services.media.usageCount(op.tenantId, assetId);
  assert.ok(isOk(count));
  assert.equal(count.value, 1);
});

test('NavigationService reorder is transactional', async () => {
  const ctx = createPlatformContext({ backend: 'memory' });
  const services = createServices(ctx);
  const siteId = testUuid(5);
  const menu = await services.navigation.menus.create(op, { tenantId: op.tenantId, siteId, key: 'header', name: 'Header' });
  assert.ok(isOk(menu));
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await services.navigation.items.create(op, { tenantId: op.tenantId, siteId, menuId: menu.value.id, label: `L${i}`, position: i });
    if (isOk(r)) ids.push(r.value.id);
  }
  const reordered = await services.navigation.reorder(op, [ids[2], ids[0], ids[1]]);
  assert.ok(isOk(reordered));
  assert.equal(reordered.value, 3);
});

test('soft delete then restore round-trips', async () => {
  const repos = createRepositoryBundle('memory');
  const created = await repos.themes.create({ tenantId: op.tenantId, name: 'T' });
  assert.ok(isOk(created));
  await repos.themes.softDelete(op.tenantId, created.value.id);
  const restored = await repos.themes.restore(op.tenantId, created.value.id);
  assert.ok(isOk(restored));
  const got = await repos.themes.getById(op.tenantId, created.value.id);
  assert.ok(isOk(got));
});
