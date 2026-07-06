// Publishing Engine tests — compile, atomic+idempotent publish, rollback, history, integrity.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPlatformContext } from '../services/context';
import { createPublishingEngine, buildSnapshotManifest, validateSnapshotIntegrity } from '../publishing/engine';
import { seedHaatSite, compileHaatSnapshot } from '../haat-site/site-definition';
import { testUuid } from '../testing/factories';
import { isOk } from '../shared/types';

async function seeded() {
  const ctx = createPlatformContext({ backend: 'memory' });
  const op = { tenantId: testUuid(1), actorId: null, correlationId: 'pub' };
  const site = await seedHaatSite(ctx, op);
  assert.ok(isOk(site));
  return { ctx, op, siteId: site.value };
}

test('publish compiles the draft into a versioned snapshot', async () => {
  const { ctx, op, siteId } = await seeded();
  const engine = createPublishingEngine(ctx);
  const r = await engine.publish({ tenantId: op.tenantId, siteId, scope: 'full', publishedBy: null, idempotencyKey: 'k1' });
  assert.ok(isOk(r));
  assert.equal(r.value.version, 1);
  assert.ok(r.value.invalidatedKeys.length >= 19); // 19 pages
});

test('publish is idempotent on idempotencyKey; new keys advance the version', async () => {
  const { ctx, op, siteId } = await seeded();
  const engine = createPublishingEngine(ctx);
  const a = await engine.publish({ tenantId: op.tenantId, siteId, scope: 'full', publishedBy: null, idempotencyKey: 'k1' });
  const dup = await engine.publish({ tenantId: op.tenantId, siteId, scope: 'full', publishedBy: null, idempotencyKey: 'k1' });
  assert.ok(isOk(a) && isOk(dup));
  assert.equal(dup.value.version, a.value.version); // no double publish
  const b = await engine.publish({ tenantId: op.tenantId, siteId, scope: 'full', publishedBy: null, idempotencyKey: 'k2' });
  assert.ok(isOk(b));
  assert.equal(b.value.version, 2);
});

test('rollback re-points live to an earlier version (new version, immutable history)', async () => {
  const { ctx, op, siteId } = await seeded();
  const engine = createPublishingEngine(ctx);
  await engine.publish({ tenantId: op.tenantId, siteId, scope: 'full', publishedBy: null, idempotencyKey: 'k1' });
  await engine.publish({ tenantId: op.tenantId, siteId, scope: 'full', publishedBy: null, idempotencyKey: 'k2' });
  const rb = await engine.rollback(op.tenantId, siteId, 1);
  assert.ok(isOk(rb));
  assert.equal(rb.value.version, 3);
  const hist = await engine.history(op.tenantId, siteId);
  assert.ok(isOk(hist));
  assert.equal(hist.value.current, 3);
  assert.equal(hist.value.history.length, 3);
});

test('scheduled publish enqueues a publishing job', async () => {
  const { ctx, op, siteId } = await seeded();
  const engine = createPublishingEngine(ctx);
  const jobId = await engine.schedule({ tenantId: op.tenantId, siteId, scope: 'full', publishedBy: null, idempotencyKey: 'k9' }, new Date().toISOString());
  assert.ok(isOk(jobId));
  const jobs = await ctx.jobs.list('publishing');
  assert.ok(isOk(jobs));
  assert.equal(jobs.value.length, 1);
});

test('preview URL is signed and marked preview', async () => {
  const { ctx, op } = await seeded();
  const engine = createPublishingEngine(ctx);
  const url = engine.previewUrl(op, 'haatnow', '/pricing');
  assert.match(url, /preview=1/);
  assert.match(url, /haatnow\.app\/pricing/);
});

test('snapshot integrity validation + manifest', () => {
  const snap = compileHaatSnapshot(testUuid(2), '2026-07-05T00:00:00.000Z');
  assert.ok(isOk(validateSnapshotIntegrity(snap)));
  const manifest = buildSnapshotManifest(snap);
  assert.equal(manifest.pageCount, 19);
  assert.equal(manifest.paths[0], '/');
  assert.match(manifest.checksum, /^[0-9a-f]+:[0-9a-f]{8}$/);

  const broken = { ...snap, pages: [] };
  assert.equal(validateSnapshotIntegrity(broken).ok, false);
});
