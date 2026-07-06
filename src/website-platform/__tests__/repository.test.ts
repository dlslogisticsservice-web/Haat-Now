// Repository contract tests — exercised against the in-memory backend (the reference
// semantics the Supabase backend must match).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMemorySiteRepository, createMemoryPageRepository } from '../repositories/memory-config';
import { makeCreateSiteDto, makeCreatePageDto } from '../testing/factories';
import { isOk } from '../shared/types';

test('create → getById returns the created site', async () => {
  const repo = createMemorySiteRepository();
  const created = await repo.create(makeCreateSiteDto());
  assert.ok(isOk(created));
  const fetched = await repo.getById(created.value.tenantId, created.value.id);
  assert.ok(isOk(fetched));
  assert.equal(fetched.value.slug, 'acme-foods');
  assert.equal(fetched.value.version, 1);
});

test('update bumps version and applies the patch', async () => {
  const repo = createMemorySiteRepository();
  const created = await repo.create(makeCreateSiteDto());
  assert.ok(isOk(created));
  const updated = await repo.update(created.value.tenantId, created.value.id, { name: 'Renamed' });
  assert.ok(isOk(updated));
  assert.equal(updated.value.name, 'Renamed');
  assert.equal(updated.value.version, 2);
});

test('optimistic lock rejects a stale expectedVersion', async () => {
  const repo = createMemorySiteRepository();
  const created = await repo.create(makeCreateSiteDto());
  assert.ok(isOk(created));
  const stale = await repo.update(created.value.tenantId, created.value.id, { name: 'X' }, 99);
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.error.code, 'optimistic_lock');
});

test('soft delete hides from getById; restore brings it back', async () => {
  const repo = createMemorySiteRepository();
  const created = await repo.create(makeCreateSiteDto());
  assert.ok(isOk(created));
  const del = await repo.softDelete(created.value.tenantId, created.value.id);
  assert.ok(isOk(del));
  const gone = await repo.getById(created.value.tenantId, created.value.id);
  assert.equal(gone.ok, false);
  const restored = await repo.restore(created.value.tenantId, created.value.id);
  assert.ok(isOk(restored));
  const back = await repo.getById(created.value.tenantId, created.value.id);
  assert.ok(isOk(back));
});

test('tenant isolation: another tenant cannot read the row', async () => {
  const repo = createMemorySiteRepository();
  const created = await repo.create(makeCreateSiteDto());
  assert.ok(isOk(created));
  const other = await repo.getById('11111111-1111-4111-8111-111111111111', created.value.id);
  assert.equal(other.ok, false);
});

test('list paginates, filters and sorts', async () => {
  const repo = createMemoryPageRepository();
  const siteId = '00000000-0000-4000-8000-0000000000aa';
  const tenantId = makeCreatePageDto(siteId).tenantId;
  for (let i = 0; i < 5; i++) {
    await repo.create(makeCreatePageDto(siteId, { slug: `page-${i}`, title: `Page ${i}`, position: i }));
  }
  const page1 = await repo.list(tenantId, { page: 1, pageSize: 2, sort: [{ field: 'position', direction: 'desc' }] });
  assert.ok(isOk(page1));
  assert.equal(page1.value.total, 5);
  assert.equal(page1.value.items.length, 2);
  assert.equal(page1.value.hasMore, true);
  assert.equal(page1.value.items[0].position, 4);

  const filtered = await repo.list(tenantId, { filters: [{ field: 'slug', operator: 'eq', value: 'page-3' }] });
  assert.ok(isOk(filtered));
  assert.equal(filtered.value.total, 1);
  assert.equal(filtered.value.items[0].slug, 'page-3');
});
