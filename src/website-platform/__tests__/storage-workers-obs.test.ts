// Storage gateway + workers + observability + mapping tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryStorageGateway, WEBSITE_MEDIA_BUCKET } from '../storage/storage';
import { MemoryJobQueue, WorkerRegistry, WorkerRunner } from '../workers/workers';
import { InMemoryMetrics, HealthRegistry, instrumentRepository, createDiagnostics } from '../observability/observability';
import { snakeToCamel, camelToSnake, rowToEntity, entityToRow } from '../repositories/mapping';
import { createMemorySiteRepository } from '../repositories/memory-config';
import { makeCreateSiteDto, testUuid } from '../testing/factories';
import { ok, isOk } from '../shared/types';

// ── Storage ──────────────────────────────────────────────────────────────────────
test('storage paths are tenant-namespaced and versioned by variant', async () => {
  const gw = new MemoryStorageGateway();
  const tenantId = testUuid(1); const assetId = testUuid(2);
  const path = gw.pathFor(tenantId, assetId, 'hero.png', 'webp');
  assert.equal(path, `${tenantId}/${assetId}/webp/hero.png`);
  const up = await gw.upload({ tenantId, assetId, filename: 'hero.png', contentType: 'image/png', body: new Uint8Array() });
  assert.ok(isOk(up));
  assert.equal(up.value.bucket, WEBSITE_MEDIA_BUCKET);
  assert.ok(up.value.publicUrl.includes(tenantId));
  const dup = await gw.upload({ tenantId, assetId, filename: 'hero.png', contentType: 'image/png', body: new Uint8Array() });
  assert.equal(dup.ok, false); // no upsert → conflict
});

// ── Workers ──────────────────────────────────────────────────────────────────────
test('job queue enqueue/claim/complete + runner dispatch', async () => {
  const queue = new MemoryJobQueue();
  const registry = new WorkerRegistry();
  let handled = 0;
  registry.register('seo', async () => { handled++; return ok(undefined); });
  const runner = new WorkerRunner(queue, registry);

  await queue.enqueue({ kind: 'seo', tenantId: testUuid(1), payload: {} });
  const first = await runner.processOnce('seo');
  assert.ok(isOk(first));
  assert.equal(first.value, 'processed');
  assert.equal(handled, 1);
  const idle = await runner.processOnce('seo');
  assert.ok(isOk(idle));
  assert.equal(idle.value, 'idle');
});

test('runner errors when no handler registered', async () => {
  const queue = new MemoryJobQueue();
  await queue.enqueue({ kind: 'cleanup', tenantId: testUuid(1), payload: {} });
  const runner = new WorkerRunner(queue, new WorkerRegistry());
  const r = await runner.processOnce('cleanup');
  assert.equal(r.ok, false);
});

// ── Observability ─────────────────────────────────────────────────────────────────
test('instrumented repository records latency + ok counters', async () => {
  const metrics = new InMemoryMetrics();
  const diag = createDiagnostics({ metrics, now: () => 0 });
  const repo = instrumentRepository(createMemorySiteRepository(), 'site', diag);
  const r = await repo.create(makeCreateSiteDto());
  assert.ok(isOk(r));
  assert.ok(metrics.counters.get('website.repo.ok{entity=site,op=create}')! >= 1);
  assert.ok(metrics.histograms.has('website.repo.latency_ms{entity=site,op=create}'));
});

test('health registry aggregates check status', async () => {
  const reg = new HealthRegistry()
    .register({ name: 'db', check: async () => ({ name: 'db', status: 'up' }) })
    .register({ name: 'cache', check: async () => ({ name: 'cache', status: 'degraded' }) });
  const res = await reg.run();
  assert.equal(res.status, 'degraded');
  assert.equal(res.checks.length, 2);
});

// ── Mapping ────────────────────────────────────────────────────────────────────────
test('snake/camel mappers round-trip and drop control keys', () => {
  assert.equal(snakeToCamel('tenant_id'), 'tenantId');
  assert.equal(camelToSnake('tenantId'), 'tenant_id');
  const row = rowToEntity<{ tenantId: string; siteId: string }>({ tenant_id: 'a', site_id: 'b' });
  assert.deepEqual(row, { tenantId: 'a', siteId: 'b' });
  const back = entityToRow({ tenantId: 'a', siteId: 'b', expectedVersion: 3, undef: undefined });
  assert.deepEqual(back, { tenant_id: 'a', site_id: 'b' }); // control + undefined dropped
});
