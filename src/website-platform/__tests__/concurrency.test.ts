// Optimistic-concurrency tests — version-guarded updates detect conflicts.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRepositoryBundle } from '../repositories/registry';
import { testUuid } from '../testing/factories';
import { isOk } from '../shared/types';

const tenantId = testUuid(1);

test('two writers with the same expectedVersion: second is rejected', async () => {
  const repos = createRepositoryBundle('memory');
  const created = await repos.themes.create({ tenantId, name: 'Base' });
  assert.ok(isOk(created));
  const v1 = created.value.version;

  const a = await repos.themes.update(tenantId, created.value.id, { name: 'A' }, v1);
  assert.ok(isOk(a));
  assert.equal(a.value.version, v1 + 1);

  // Second writer still holds v1 → stale → optimistic_lock.
  const b = await repos.themes.update(tenantId, created.value.id, { name: 'B' }, v1);
  assert.equal(b.ok, false);
  if (!b.ok) assert.equal(b.error.code, 'optimistic_lock');
});

test('unversioned update reads current version and succeeds', async () => {
  const repos = createRepositoryBundle('memory');
  const created = await repos.sections.create({ tenantId, siteId: testUuid(2), pageId: null });
  assert.ok(isOk(created));
  const upd = await repos.sections.update(tenantId, created.value.id, { position: 5 });
  assert.ok(isOk(upd));
  assert.equal(upd.value.position, 5);
});
