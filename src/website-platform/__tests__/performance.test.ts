// Performance smoke tests — the persistence path sustains meaningful throughput and
// the Wave 1 runtime migration declares the outbox/audit/snapshot/jobs tables + RPCs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { createMemorySiteRepository } from '../repositories/memory-config';
import { contentHash } from '../snapshot/snapshot';
import { makeCreateSiteDto } from '../testing/factories';
import { isOk } from '../shared/types';

test('repository sustains > 5k creates/sec in-memory', async () => {
  const repo = createMemorySiteRepository();
  const n = 2000;
  const start = performance.now();
  for (let i = 0; i < n; i++) {
    const r = await repo.create(makeCreateSiteDto({ slug: `s-${i}` }));
    assert.ok(isOk(r));
  }
  const opsPerSec = (n / (performance.now() - start)) * 1000;
  assert.ok(opsPerSec > 5000, `throughput too low: ${Math.round(opsPerSec)}/s`);
});

test('snapshot hashing sustains > 10k ops/sec', () => {
  const payload = { pages: Array.from({ length: 20 }, (_v, i) => ({ i })) };
  const m = 5000;
  const start = performance.now();
  for (let i = 0; i < m; i++) contentHash(payload);
  const opsPerSec = (m / (performance.now() - start)) * 1000;
  assert.ok(opsPerSec > 10000, `hash throughput too low: ${Math.round(opsPerSec)}/s`);
});

test('Wave 1 runtime migration declares runtime tables + RPCs (additive)', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20260705000200_website_persistence_runtime.sql'), 'utf8').toLowerCase();
  for (const t of ['website_event_outbox', 'website_audit_log', 'website_snapshots', 'website_jobs']) {
    assert.ok(sql.includes(`create table if not exists public.${t}`), `missing ${t}`);
  }
  for (const fn of ['website_next_publish_version', 'website_reorder_pages', 'website_outbox_append', 'website_refresh_tenant_stats']) {
    assert.ok(sql.includes(`function public.${fn}`), `missing rpc ${fn}`);
  }
  assert.ok(sql.includes('create or replace view public.website_published_current'), 'missing published view');
  assert.ok(sql.includes('materialized view'), 'missing materialized view');
  assert.ok(sql.includes('public.auth_tenant()'), 'RLS not tenant-scoped');
  assert.equal(sql.includes('to anon'), false, 'must not grant to anon');
  assert.equal(sql.includes('drop table'), false, 'must be additive');
});
