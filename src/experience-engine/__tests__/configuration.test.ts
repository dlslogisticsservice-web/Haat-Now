// Experience Engine · Remote Configuration tests (Wave 8).
// Proves configuration loading, cache hit/miss (TTL), version change, provider selection,
// configuration-policy evaluation, signature verification, graceful failure, events, and the
// Runtime configuration-stage integration — all composed from the existing kernel pieces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRemoteConfiguration, createStaticConfigurationProvider, configurationCacheKey,
  createProviderRegistry, createPolicyRegistry, createPolicyEngine, InMemoryCache, createExperienceEngine,
  type ConfigurationBundle, type ConfigurationEvent, type ConfigurationProvider, type Policy,
  type ExperienceContext, type ExperienceRequest,
} from '../index';

const ectx = (over: Partial<ExperienceContext> = {}): ExperienceContext => ({ tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr', device: 'desktop', platform: 'web', environment: { environment: 'production' }, flags: {}, now: '2026-01-01T00:00:00.000Z', ...over });

const bundle = (over: Partial<ConfigurationBundle> = {}): ConfigurationBundle => ({
  id: 'b', tenantId: 't1', channel: 'website', environment: 'production', version: '1.0.0',
  config: { theme: 'light', maxItems: 10 }, metadata: { version: '1.0.0', generatedAt: '' }, ...over,
});

const cfgPolicy = (id: string, over: { priority?: number; directives?: Array<{ key: string; value: any }>; effect?: any } = {}): Policy => ({
  metadata: { id, name: id, type: 'configuration', version: '1.0.0', priority: over.priority ?? 0 },
  applies: () => true,
  evaluate: () => ({ effect: over.effect ?? 'override', directives: over.directives ?? [] }),
  health: () => ({ status: 'healthy' }),
});

// Coordinator harness over the real kernel pieces.
const makeCoord = (bundles: ConfigurationBundle[], o: { policies?: Policy[]; clock?: () => number; ttlMs?: number; verifier?: (p: string, s: string) => boolean; providerOpts?: any; onEvent?: (e: ConfigurationEvent) => void } = {}) => {
  const providers = createProviderRegistry();
  if (bundles.length) providers.register(createStaticConfigurationProvider(bundles, o.providerOpts));
  const polReg = createPolicyRegistry();
  (o.policies ?? []).forEach(p => polReg.register(p));
  const cache = new InMemoryCache<unknown>();
  const coord = createRemoteConfiguration({ providers, policyEngine: createPolicyEngine(polReg), cache }, { clock: o.clock, ttlMs: o.ttlMs, verifier: o.verifier, onEvent: o.onEvent });
  return { coord, providers };
};

// ── configuration loading + cache miss (STEP 8) ─────────────────────────────────
test('first resolve is a cache MISS: loads from the provider and returns effective config', async () => {
  const { coord } = makeCoord([bundle()], { clock: () => 0 });
  const eff = await coord.resolve(ectx());
  assert.equal(eff.source, 'provider');
  assert.equal(eff.fromCache, false);
  assert.equal(eff.version, '1.0.0');
  assert.equal(eff.rejected, false);
  assert.equal(eff.config.theme, 'light');
  assert.equal(eff.providerId, 'configuration.static');
  assert.ok(eff.metadata?.checksum, 'metadata carries a checksum');
});

// ── cache hit (STEP 8) ───────────────────────────────────────────────────────────
test('second resolve within TTL is a cache HIT: provider not re-consulted', async () => {
  let calls = 0;
  const counting: ConfigurationProvider = {
    metadata: { id: 'cfg.count', name: 'c', kind: 'configuration', version: '1', priority: 0 },
    supports: () => true, health: () => ({ status: 'healthy' }),
    async load() { calls++; return { config: { a: 1 }, version: '2.0.0', fromCache: false }; },
  };
  const providers = createProviderRegistry(); providers.register(counting);
  const coord = createRemoteConfiguration({ providers, policyEngine: createPolicyEngine(createPolicyRegistry()), cache: new InMemoryCache<unknown>() }, { clock: () => 100, ttlMs: 1000 });

  const first = await coord.resolve(ectx());
  const second = await coord.resolve(ectx());
  assert.equal(first.source, 'provider');
  assert.equal(second.source, 'cache');
  assert.equal(second.fromCache, true);
  assert.equal(calls, 1, 'provider consulted exactly once');
});

// ── cache miss on TTL expiry (STEP 8) ───────────────────────────────────────────
test('a resolve after TTL expiry is a cache MISS and reloads', async () => {
  let t = 0;
  const { coord } = makeCoord([bundle()], { clock: () => t, ttlMs: 1000 });
  await coord.resolve(ectx());     // stored at t=0
  t = 2000;                        // past TTL
  const eff = await coord.resolve(ectx());
  assert.equal(eff.source, 'provider');
  assert.ok(eff.diagnostics.some(d => /expired/.test(d)));
});

// ── version change (STEP 8) ──────────────────────────────────────────────────────
test('a pinned version mismatch invalidates the cached bundle (version validation)', async () => {
  const { coord } = makeCoord([bundle()], { clock: () => 0, ttlMs: 100000 });
  await coord.resolve(ectx());                                  // cache v1.0.0
  const same = await coord.resolve(ectx(), { version: '1.0.0' });
  assert.equal(same.source, 'cache', 'matching pin → hit');
  const diff = await coord.resolve(ectx(), { version: '9.9.9' });
  assert.equal(diff.source, 'provider', 'mismatched pin → miss');
  assert.ok(diff.diagnostics.some(d => /version mismatch/.test(d)));
});

// ── provider selection (STEP 8) ─────────────────────────────────────────────────
test('the highest-priority configuration provider is selected', async () => {
  const providers = createProviderRegistry();
  providers.register(createStaticConfigurationProvider([bundle({ config: { src: 'LOW' } })], { id: 'cfg.low', priority: 1 }));
  providers.register(createStaticConfigurationProvider([bundle({ config: { src: 'HIGH' } })], { id: 'cfg.high', priority: 10 }));
  const coord = createRemoteConfiguration({ providers, policyEngine: createPolicyEngine(createPolicyRegistry()), cache: new InMemoryCache<unknown>() }, { clock: () => 0 });
  const eff = await coord.resolve(ectx());
  assert.equal(eff.providerId, 'cfg.high');
  assert.equal(eff.config.src, 'HIGH');
});

// ── policy evaluation (STEP 8) ──────────────────────────────────────────────────
test('configuration policy directives override the bundle in the effective config', async () => {
  const { coord } = makeCoord([bundle()], { clock: () => 0, policies: [cfgPolicy('cfg.pol', { directives: [{ key: 'theme', value: 'dark' }] })] });
  const eff = await coord.resolve(ectx());
  assert.equal(eff.config.theme, 'dark', 'policy wins over bundle');
  assert.equal(eff.config.maxItems, 10, 'un-overridden bundle keys remain');
  assert.deepEqual(eff.policySummary.matched, ['cfg.pol']);
  assert.equal(eff.policySummary.directives, 1);
});

test('a configuration policy that DENIES blocks configuration (rejected)', async () => {
  const { coord } = makeCoord([bundle()], { clock: () => 0, policies: [cfgPolicy('cfg.deny', { effect: 'deny' })] });
  const eff = await coord.resolve(ectx());
  assert.equal(eff.rejected, true);
  assert.equal(eff.reason, 'denied by policy');
  assert.equal(eff.source, 'none');
});

// ── signature verification / security (STEP 1, STEP 6) ──────────────────────────
test('a valid signature is verified; an invalid signature is REJECTED', async () => {
  const signed = bundle({ signature: { algorithm: 'HMAC-SHA256', signature: 'sig-abc', signedAt: '' } });
  const okCoord = makeCoord([signed], { clock: () => 0, verifier: () => true }).coord;
  const good = await okCoord.resolve(ectx());
  assert.equal(good.signatureStatus, 'valid');
  assert.equal(good.rejected, false);

  const badCoord = makeCoord([signed], { clock: () => 0, verifier: () => false }).coord;
  const bad = await badCoord.resolve(ectx());
  assert.equal(bad.signatureStatus, 'invalid');
  assert.equal(bad.rejected, true);
  assert.equal(bad.reason, 'invalid signature');
});

test('a signed bundle with no verifier is accepted UNVERIFIED, never fabricated as valid', async () => {
  const signed = bundle({ signature: { algorithm: 'HMAC-SHA256', signature: 'sig-abc', signedAt: '' } });
  const { coord } = makeCoord([signed], { clock: () => 0 }); // no verifier
  const eff = await coord.resolve(ectx());
  assert.equal(eff.signatureStatus, 'unverified');
  assert.equal(eff.rejected, false);
});

// ── graceful failure (STEP 8) ────────────────────────────────────────────────────
test('no configuration provider → empty effective config, source none (graceful)', async () => {
  const { coord } = makeCoord([], { clock: () => 0 });
  const eff = await coord.resolve(ectx());
  assert.equal(eff.source, 'none');
  assert.equal(eff.rejected, false);
  assert.deepEqual(eff.config, {});
});

test('a throwing provider is rejected gracefully, never thrown', async () => {
  const throwing: ConfigurationProvider = {
    metadata: { id: 'cfg.throw', name: 'x', kind: 'configuration', version: '1', priority: 5 },
    supports: () => true, health: () => ({ status: 'healthy' }),
    async load() { throw new Error('load boom'); },
  };
  const providers = createProviderRegistry(); providers.register(throwing);
  const coord = createRemoteConfiguration({ providers, policyEngine: createPolicyEngine(createPolicyRegistry()), cache: new InMemoryCache<unknown>() }, { clock: () => 0 });
  const eff = await coord.resolve(ectx());
  assert.equal(eff.rejected, true);
  assert.equal(eff.reason, 'provider error');
});

// ── events (STEP 7) ──────────────────────────────────────────────────────────────
test('emits configuration.cached + configuration.loaded on a miss', async () => {
  const events: ConfigurationEvent[] = [];
  const { coord } = makeCoord([bundle()], { clock: () => 0, onEvent: (e) => events.push(e) });
  await coord.resolve(ectx());
  const types = events.map(e => e.type);
  assert.ok(types.includes('configuration.cached'));
  assert.ok(types.includes('configuration.loaded'));
});

test('invalidate() clears the cache and emits configuration.invalidated', async () => {
  const events: ConfigurationEvent[] = [];
  const { coord } = makeCoord([bundle()], { clock: () => 0, ttlMs: 100000, onEvent: (e) => events.push(e) });
  await coord.resolve(ectx());
  const n = coord.invalidate({ tenantId: 't1', channel: 'website', environment: 'production' });
  assert.equal(n, 1);
  assert.ok(events.some(e => e.type === 'configuration.invalidated'));
  const after = await coord.resolve(ectx());
  assert.equal(after.source, 'provider', 'reloads after invalidation');
});

test('configurationCacheKey is deterministic', () => {
  assert.equal(configurationCacheKey('t1', 'website', 'production'), 't1|website|production');
});

// ── Runtime integration (STEP 4) ────────────────────────────────────────────────
const req = (): ExperienceRequest => ({ experienceId: 'home', context: ectx() });
test('the runtime configuration stage loads through the coordinator and surfaces it on the execution', async () => {
  const engine = createExperienceEngine();
  engine.providers.register(createStaticConfigurationProvider([bundle({ config: { banner: 'welcome' } })], { id: 'cfg.website' }));
  engine.policies.register(cfgPolicy('cfg.rt', { directives: [{ key: 'maintenance', value: false }] }));

  const events: ConfigurationEvent[] = [];
  const exec = await engine.execute(req(), { onConfigurationEvent: (e) => events.push(e) });

  assert.equal(exec.configuration?.source, 'provider');
  assert.equal(exec.configuration?.config.banner, 'welcome');
  assert.equal(exec.configuration?.config.maintenance, false, 'config policy merged in the runtime stage');
  assert.ok(exec.diagnostics.some(d => d.stage === 'configuration' && /source=provider/.test(d.message)));
  assert.ok(events.some(e => e.type === 'configuration.loaded'));
});
