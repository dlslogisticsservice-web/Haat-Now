// Experience Engine · Delivery Layer tests (Wave 5).
// Proves the cache-aware gateway: cache miss → resolve source → cache + snapshot stored;
// cache hit → served from cache (source not re-consulted); deterministic keys; snapshot
// loading; version resolution; the full pipeline; graceful fallback; and the Runtime
// integration (execute() delivers through the layer, second call hits the cache).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createExperienceEngine, createExperienceDelivery, deliveryCacheKey, buildSnapshot,
  keyInScope, InMemoryCache,
  type DeliveryContext, type DeliveryEvent, type DeliverySource, type ExperienceContext,
  type ExperienceResolution, type ExperienceRequest, type EngineServices, type RenderingPort,
} from '../index';

const schema = () => ({ id: 'home', channel: 'website', schemaVersion: '1', layout: { id: 'r', type: 'layout', layout: 'section', children: [] }, locales: ['en'], defaultLocale: 'en', pages: [], nav: [] } as any);

const ctx = (over: Partial<ExperienceContext> = {}): ExperienceContext => ({ tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr', device: 'desktop', platform: 'web', environment: { environment: 'production' }, flags: {}, now: '2026-01-01T00:00:00.000Z', ...over });

const dctx = (over: Partial<DeliveryContext> = {}): DeliveryContext => ({ experienceId: 'home', context: ctx(), version: '3', ...over });

const resolved = (): ExperienceResolution => ({ status: 'resolved', experienceId: 'home', channel: 'website', version: '3', schema: schema(), diagnostics: ['from source'] });

// A counting source so we can prove the cache prevents a second source call.
const countingSource = (res: () => ExperienceResolution = resolved) => {
  let calls = 0;
  const source: DeliverySource = { async resolve() { calls += 1; return res(); } };
  return { source, calls: () => calls };
};

// ── deterministic cache keys (STEP 3) ────────────────────────────────────────────
test('deliveryCacheKey is deterministic and dimension-sensitive', () => {
  assert.equal(deliveryCacheKey(dctx()), deliveryCacheKey(dctx()), 'same inputs → same key');
  assert.notEqual(deliveryCacheKey(dctx()), deliveryCacheKey(dctx({ context: ctx({ locale: 'ar' }) })), 'locale changes the key');
  assert.notEqual(deliveryCacheKey(dctx()), deliveryCacheKey(dctx({ version: '4' })), 'version changes the key');
  assert.notEqual(deliveryCacheKey(dctx()), deliveryCacheKey(dctx({ preview: true })), 'preview changes the key');
  assert.equal(deliveryCacheKey(dctx()), 't1|website|home|en|production|3|published');
});

// ── cache miss → resolve → cache + snapshot stored (STEP 4, STEP 9) ───────────────
test('first deliver is a cache MISS: resolves the source and populates the caches', async () => {
  const { source, calls } = countingSource();
  const events: DeliveryEvent[] = [];
  const delivery = createExperienceDelivery(source, { onEvent: (e) => events.push(e) });

  const r = await delivery.deliver(dctx());

  assert.equal(r.status, 'miss-resolved');
  assert.equal(r.metadata.fromCache, false);
  assert.equal(r.metadata.sourceKind, 'source');
  assert.equal(r.resolution.status, 'resolved');
  assert.equal(calls(), 1);
  // caches now populated
  const key = deliveryCacheKey(dctx());
  assert.ok(delivery.caches.schema.has(key));
  assert.equal(delivery.caches.version.get(key), '3');
  assert.ok(delivery.caches.snapshot.has(key));
  // events: miss → updated → stored
  assert.deepEqual(events.map(e => e.type), ['cache.miss', 'cache.updated', 'snapshot.stored']);
});

// ── cache hit: served from cache, source NOT re-consulted (STEP 9) ────────────────
test('second deliver is a cache HIT: served from cache without re-resolving the source', async () => {
  const { source, calls } = countingSource();
  const events: DeliveryEvent[] = [];
  const delivery = createExperienceDelivery(source, { onEvent: (e) => events.push(e) });

  await delivery.deliver(dctx());          // miss → populates
  events.length = 0;
  const r = await delivery.deliver(dctx()); // hit

  assert.equal(r.status, 'hit');
  assert.equal(r.metadata.fromCache, true);
  assert.equal(r.metadata.sourceKind, 'cache');
  assert.equal(r.resolution.status, 'resolved');
  assert.equal(r.resolution.version, '3', 'version resolved from the cache');
  assert.equal(calls(), 1, 'the source was consulted exactly once');
  assert.deepEqual(events.map(e => e.type), ['cache.hit', 'snapshot.loaded']);
});

// ── snapshot model (STEP 6) ──────────────────────────────────────────────────────
test('buildSnapshot captures a signed-shaped, versioned snapshot of a resolution', () => {
  const snap = buildSnapshot(resolved(), '2026-01-01T00:00:00.000Z');
  assert.equal(snap.experienceId, 'home');
  assert.equal(snap.channel, 'website');
  assert.equal(snap.version, '3');
  assert.equal(snap.id, 'snap_home_3');
  assert.equal(snap.metadata.version, '3');
  assert.equal(snap.metadata.generatedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(snap.schema.id, 'home');
});

// ── graceful fallback: source not-found / throwing (STEP 9) ──────────────────────
test('a not-found source is delivered gracefully and NOT cached', async () => {
  const source: DeliverySource = { async resolve() { return { status: 'not-found', experienceId: 'home', channel: 'website', diagnostics: ['missing'] }; } };
  const delivery = createExperienceDelivery(source);
  const r = await delivery.deliver(dctx());
  assert.equal(r.status, 'not-found');
  assert.equal(r.resolution.status, 'not-found');
  assert.equal(delivery.caches.schema.has(deliveryCacheKey(dctx())), false, 'unresolved experiences are not cached');
});

test('a throwing source is caught: deliver returns an error result, never throws', async () => {
  const source: DeliverySource = { async resolve() { throw new Error('boom'); } };
  const delivery = createExperienceDelivery(source);
  const r = await delivery.deliver(dctx());
  assert.equal(r.status, 'error');
  assert.equal(r.resolution.status, 'error');
  assert.ok(r.resolution.diagnostics?.some(d => /boom/.test(d)));
});

// ── invalidation contract helper (STEP 5) ────────────────────────────────────────
test('keyInScope matches a delivery key against an invalidation scope', () => {
  const key = deliveryCacheKey(dctx());
  assert.equal(keyInScope(key, { tenantId: 't1' }), true);
  assert.equal(keyInScope(key, { tenantId: 't1', channel: 'website', experienceId: 'home' }), true);
  assert.equal(keyInScope(key, { tenantId: 't2' }), false);
  assert.equal(keyInScope(key, { experienceId: 'about' }), false);
});

// ── generic cache infra ──────────────────────────────────────────────────────────
test('InMemoryCache is a correct typed key/value store', () => {
  const c = new InMemoryCache<number>();
  assert.equal(c.has('a'), false);
  assert.equal(c.get('a'), null);
  c.set('a', 1);
  assert.equal(c.get('a'), 1);
  assert.equal(c.has('a'), true);
  c.delete('a');
  assert.equal(c.has('a'), false);
});

// ── Runtime integration: execute() delivers through the layer (STEP 8) ────────────
const buildEngine = (servicesOver: Partial<EngineServices> = {}) => {
  const engine = createExperienceEngine({
    services: {
      version: { async pick() { return '3'; } },
      experience: { async resolve(req) { return { status: 'resolved', experienceId: req.experienceId, channel: 'website', version: '3', schema: schema(), diagnostics: [`preview=${!!req.preview}`] }; } },
      ...servicesOver,
    },
  });
  engine.registries.renderers.register('r', { id: 'r', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string' });
  const port: RenderingPort<string> = { target: 'html-string', render: () => '<html>ok</html>' };
  engine.pipeline.registerPort(port);
  return engine;
};
const req = (): ExperienceRequest => ({ experienceId: 'home', context: ctx() });

test('the Runtime resolves through the Delivery Layer: first execute misses, second hits', async () => {
  let sourceCalls = 0;
  const engine = buildEngine({
    experience: { async resolve(r) { sourceCalls += 1; return { status: 'resolved', experienceId: r.experienceId, channel: 'website', version: '3', schema: schema(), diagnostics: [] }; } },
  });

  const first = await engine.execute(req());
  assert.equal(first.ok, true);
  assert.equal(first.response.resolution.status, 'resolved');
  assert.ok(first.diagnostics.some(d => d.stage === 'resolution' && /source/.test(d.message)), 'first is served from the source');

  const second = await engine.execute(req());
  assert.equal(second.response.resolution.status, 'resolved');
  assert.ok(second.diagnostics.some(d => d.stage === 'resolution' && /cache/.test(d.message)), 'second is served from the cache');
  assert.equal(sourceCalls, 1, 'the underlying resolver ran once; the cache served the rest');
});

test('a bare engine still delivers gracefully (not-found, no throw)', async () => {
  const engine = createExperienceEngine();
  const exec = await engine.execute(req());
  assert.equal(exec.response.resolution.status, 'not-found');
  assert.equal(exec.response.renderingResult?.status, 'skipped');
});
