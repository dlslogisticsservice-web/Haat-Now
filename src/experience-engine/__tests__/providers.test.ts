// Experience Engine · Provider Architecture tests (Wave 6).
// Proves registration, lookup, priority selection, capability matching, health filtering,
// graceful fallback, and the Delivery integration (Delivery resolves the experience source
// THROUGH the Provider Registry, and behaviour is unchanged).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProviderRegistry, createExperienceProvider, createExperienceProviderGateway, toProviderContext,
  providerMatches, createExperienceDelivery,
  type ProviderContext, type ProviderHealth, type DeliveryContext,
  type DeliverySource, type ExperienceContext, type ExperienceResolution,
} from '../index';

const schema = () => ({ id: 'home', channel: 'website', schemaVersion: '1', layout: { id: 'r', type: 'layout', layout: 'section', children: [] }, locales: ['en'], defaultLocale: 'en', pages: [], nav: [] } as any);
const ectx = (over: Partial<ExperienceContext> = {}): ExperienceContext => ({ tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr', device: 'desktop', platform: 'web', environment: { environment: 'production' }, flags: {}, now: '2026-01-01T00:00:00.000Z', ...over });
const dctx = (over: Partial<DeliveryContext> = {}): DeliveryContext => ({ experienceId: 'home', context: ectx(), version: '3', ...over });
const pctx = (over: Partial<ProviderContext> = {}): ProviderContext => ({ tenantId: 't1', channel: 'website', environment: 'production', ...over });

// A stub experience provider with a distinctive resolution tag, tunable priority/health/caps.
const stubProvider = (id: string, tag: string, over: Partial<Parameters<typeof createExperienceProvider>[1]> = {}) => {
  const source: DeliverySource = { async resolve() { return { status: 'resolved', experienceId: 'home', channel: 'website', version: '3', schema: schema(), diagnostics: [tag] } as ExperienceResolution; } };
  return createExperienceProvider(source, { id, ...over });
};

// ── registration + lookup (STEP 11) ─────────────────────────────────────────────
test('registry registers, looks up, lists, and unregisters providers', () => {
  const reg = createProviderRegistry();
  const p = stubProvider('experience.a', 'A');
  reg.register(p);
  assert.equal(reg.has('experience.a'), true);
  assert.equal(reg.get('experience.a'), p);
  assert.equal(reg.size(), 1);
  assert.deepEqual(reg.ids(), ['experience.a']);
  assert.deepEqual(reg.byKind('experience').map(x => x.metadata.id), ['experience.a']);
  reg.unregister('experience.a');
  assert.equal(reg.has('experience.a'), false);
  assert.equal(reg.get('experience.a'), null);
});

// ── priority selection (STEP 11) ────────────────────────────────────────────────
test('resolve() picks the highest-priority provider of a kind', () => {
  const reg = createProviderRegistry();
  reg.register(stubProvider('low', 'LOW', { priority: 1 }));
  reg.register(stubProvider('high', 'HIGH', { priority: 10 }));
  reg.register(stubProvider('mid', 'MID', { priority: 5 }));
  const picked = reg.resolve('experience', pctx());
  assert.equal(picked?.metadata.id, 'high');
  assert.deepEqual(reg.matching('experience', pctx()).map(p => p.metadata.id), ['high', 'mid', 'low']);
});

// ── capability matching (STEP 11) ───────────────────────────────────────────────
test('capability matching filters by channel, environment, preview and tags', () => {
  assert.equal(providerMatches({ id: 'x', name: 'x', kind: 'experience', version: '1', capabilities: { channels: ['website'] } }, pctx()), true);
  assert.equal(providerMatches({ id: 'x', name: 'x', kind: 'experience', version: '1', capabilities: { channels: ['customer'] } }, pctx()), false);
  assert.equal(providerMatches({ id: 'x', name: 'x', kind: 'experience', version: '1', capabilities: { environments: ['staging'] } }, pctx()), false);
  assert.equal(providerMatches({ id: 'x', name: 'x', kind: 'experience', version: '1', capabilities: { preview: false } }, pctx({ preview: true })), false);
  assert.equal(providerMatches({ id: 'x', name: 'x', kind: 'experience', version: '1', capabilities: { tags: ['signed'] } }, pctx({ capability: 'signed' })), true);
  assert.equal(providerMatches({ id: 'x', name: 'x', kind: 'experience', version: '1', capabilities: { tags: ['html'] } }, pctx({ capability: 'signed' })), false);
});

test('resolve() only returns a provider that supports the context', () => {
  const reg = createProviderRegistry();
  reg.register(stubProvider('website-only', 'W', { priority: 10, capabilities: { channels: ['website'] } }));
  reg.register(stubProvider('customer-only', 'C', { priority: 99, capabilities: { channels: ['customer'] } }));
  const picked = reg.resolve('experience', pctx({ channel: 'website' }));
  assert.equal(picked?.metadata.id, 'website-only', 'the higher-priority customer provider does not support website');
});

// ── health filtering + statuses (STEP 10, STEP 11) ──────────────────────────────
test('offline/unsupported providers are skipped; degraded is still usable', () => {
  const reg = createProviderRegistry();
  const offline: ProviderHealth = { status: 'offline' };
  const degraded: ProviderHealth = { status: 'degraded' };
  reg.register(stubProvider('offline-top', 'OFF', { priority: 100, health: () => offline }));
  reg.register(stubProvider('degraded-mid', 'DEG', { priority: 5, health: () => degraded }));
  const picked = reg.resolve('experience', pctx());
  assert.equal(picked?.metadata.id, 'degraded-mid', 'offline provider skipped despite higher priority');
  // health snapshot exposes every registered provider
  const health = reg.health();
  assert.equal(health['offline-top'].status, 'offline');
  assert.equal(health['degraded-mid'].status, 'degraded');
});

test('healthy is preferred over degraded at equal priority', () => {
  const reg = createProviderRegistry();
  reg.register(stubProvider('deg', 'DEG', { priority: 5, health: () => ({ status: 'degraded' }) }));
  reg.register(stubProvider('ok', 'OK', { priority: 5, health: () => ({ status: 'healthy' }) }));
  assert.equal(reg.resolve('experience', pctx())?.metadata.id, 'ok');
});

// ── graceful fallback (STEP 11) ─────────────────────────────────────────────────
test('resolve() returns null when no provider supports the context (graceful)', () => {
  const reg = createProviderRegistry();
  reg.register(stubProvider('customer', 'C', { capabilities: { channels: ['customer'] } }));
  assert.equal(reg.resolve('experience', pctx({ channel: 'website' })), null);
  assert.equal(reg.resolve('theme', pctx()), null, 'no provider of an unregistered kind');
});

test('a gateway that resolves nothing lets Delivery fall back to the direct source', async () => {
  // Registry with only a customer provider → no website provider → gateway returns null →
  // Delivery uses its direct source. Proves graceful fallback end to end.
  const reg = createProviderRegistry();
  reg.register(stubProvider('customer', 'CUSTOMER', { capabilities: { channels: ['customer'] } }));
  const directSource: DeliverySource = { async resolve() { return { status: 'resolved', experienceId: 'home', channel: 'website', version: '3', schema: schema(), diagnostics: ['DIRECT'] } as ExperienceResolution; } };
  const delivery = createExperienceDelivery(directSource, { providers: createExperienceProviderGateway(reg) });
  const r = await delivery.deliver(dctx());
  assert.equal(r.status, 'miss-resolved');
  assert.ok(r.resolution.diagnostics?.includes('DIRECT'), 'fell back to the direct source');
  assert.equal(r.metadata.providerId, undefined, 'no provider was selected');
});

// ── delivery integration (STEP 9, STEP 11) ──────────────────────────────────────
test('Delivery resolves the experience source THROUGH the registry-backed gateway', async () => {
  const reg = createProviderRegistry();
  reg.register(stubProvider('experience.selected', 'FROM_PROVIDER', { priority: 10 }));
  // A different direct source proves the provider (not the fallback) produced the result.
  const directSource: DeliverySource = { async resolve() { return { status: 'resolved', experienceId: 'home', channel: 'website', version: '3', schema: schema(), diagnostics: ['FROM_DIRECT'] } as ExperienceResolution; } };
  const delivery = createExperienceDelivery(directSource, { providers: createExperienceProviderGateway(reg) });

  const r = await delivery.deliver(dctx());
  assert.equal(r.resolution.status, 'resolved');
  assert.ok(r.resolution.diagnostics?.includes('FROM_PROVIDER'), 'resolved via the provider, not the direct source');
  assert.equal(r.metadata.providerId, 'experience.selected');
});

test('toProviderContext maps a DeliveryContext identity faithfully', () => {
  const p = toProviderContext(dctx({ preview: true, context: ectx({ locale: 'ar' }) }));
  assert.equal(p.tenantId, 't1');
  assert.equal(p.channel, 'website');
  assert.equal(p.environment, 'production');
  assert.equal(p.locale, 'ar');
  assert.equal(p.preview, true);
});

// ── engine wiring (STEP 9) ──────────────────────────────────────────────────────
test('the engine exposes a Provider Registry with the website experience provider registered', async () => {
  const { createExperienceEngine } = await import('../index');
  const engine = createExperienceEngine();
  assert.ok(engine.providers, 'engine.providers exists');
  assert.equal(engine.providers.has('experience.website'), true);
  assert.equal(engine.providers.resolve('experience', pctx())?.metadata.id, 'experience.website');
});
