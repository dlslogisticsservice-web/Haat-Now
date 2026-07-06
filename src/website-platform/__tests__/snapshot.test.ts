// Snapshot storage tests — hashing determinism, integrity, versioned retrieval.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSnapshotStore, contentHash, checksum } from '../snapshot/snapshot';
import { testUuid } from '../testing/factories';
import { isOk } from '../shared/types';

const tenantId = testUuid(1);
const siteId = testUuid(2);

test('contentHash is deterministic and order-independent', () => {
  const a = { x: 1, y: [1, 2], z: { b: 2, a: 1 } };
  const b = { z: { a: 1, b: 2 }, y: [1, 2], x: 1 };
  assert.equal(contentHash(a), contentHash(b));
  assert.notEqual(contentHash(a), contentHash({ x: 2 }));
  assert.match(checksum(a), /^[0-9a-f]+:[0-9a-f]{8}$/);
});

test('save stores hash + checksum and verify() confirms integrity', async () => {
  const store = createSnapshotStore('memory');
  const r = await store.save({ tenantId, siteId, kind: 'draft', version: 1, snapshot: { pages: [] } });
  assert.ok(isOk(r));
  assert.equal(r.value.hash, contentHash({ pages: [] }));
  assert.equal(store.verify(r.value), true);
  const tampered = { ...r.value, snapshot: { pages: [{ p: 1 }] } };
  assert.equal(store.verify(tampered), false);
});

test('latest returns the highest version; getByVersion is exact', async () => {
  const store = createSnapshotStore('memory');
  await store.save({ tenantId, siteId, kind: 'published', version: 1, snapshot: { v: 1 } });
  await store.save({ tenantId, siteId, kind: 'published', version: 2, snapshot: { v: 2 } });
  const latest = await store.latest(tenantId, siteId, 'published');
  assert.ok(isOk(latest));
  assert.equal(latest.value?.version, 2);
  const v1 = await store.getByVersion(tenantId, siteId, 'published', 1);
  assert.ok(isOk(v1));
  assert.equal(v1.value?.version, 1);
});

test('draft and published snapshots are separate streams', async () => {
  const store = createSnapshotStore('memory');
  await store.save({ tenantId, siteId, kind: 'draft', version: 5, snapshot: {} });
  const pub = await store.latest(tenantId, siteId, 'published');
  assert.ok(isOk(pub));
  assert.equal(pub.value, null);
});
