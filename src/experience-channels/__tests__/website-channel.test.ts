// Website Channel · integration tests (STEP 8).
// Demonstrates the full flow end-to-end using the REAL engine + REAL adapter/resolvers,
// with a FAKE WebsiteContentSource (so no localStorage / website.service runtime is touched):
//
//   Request → Context Resolution → Rule Resolution → Version Resolution → Website Adapter
//           → Website Schema → Experience Response
//
// It also pins that the adapter WRAPS (never mutates) the content, and that a resolver still
// reports honestly when content/version is missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExperienceEngine, type ExperienceContext, type ExperienceRequest } from '../../experience-engine';
// Import the PURE files directly (not the barrel) so this test never loads website.service —
// contentSource.ts (the only website.service consumer) is excluded, keeping the test isolated.
import { registerWebsiteChannel, websiteChannel } from '../website/channel';
import { mapSiteToSchema, mapSiteToMetadata } from '../website/mapper';
import {
  createWebsiteContextResolver, createWebsiteRuleResolver, createWebsiteVersionResolver, createWebsiteExperienceResolver,
} from '../website/resolvers';
import type { WebsiteContentSource } from '../website/types';

// ── a fake website, standing in for what website.service would return ──────────
const sampleSite = (): any => ({
  tenantId: 'tenant-1', slug: 'acme', siteName: 'Acme Foods',
  status: 'published', maintenance: false,
  navigation: [{ label: 'Home', path: '/' }, { label: 'Offers', path: '/offers' }],
  footer: {}, blog: [{ id: 'b1' }],
  pages: [
    { id: 'p_home', path: '/', kind: 'landing', title: 'Home', nav: true, navOrder: 0, seo: { title: 'Home' },
      sections: [{ type: 'hero', title: 'Welcome' }, { type: 'richtext', body: 'Hello' }] },
    { id: 'p_offers', path: '/offers', kind: 'custom', title: 'Offers', nav: true, navOrder: 1, seo: { title: 'Offers' },
      sections: [{ type: 'cards', heading: 'Deals', items: [] }] },
  ],
  seoDefaults: { title: 'Acme' }, analytics: {}, cookie: { enabled: false, policyPath: '/legal' }, updatedAt: 'now', schemaVersion: 3,
});

const fakeSource = (site = sampleSite()): WebsiteContentSource => ({
  getPublishedSite: (id) => (id === site.tenantId ? site : null),
  getDraftSite: (id) => (id === site.tenantId ? { ...site, status: 'draft', siteName: site.siteName + ' (draft)' } : null),
  getVersion: (id) => (id === site.tenantId ? 7 : null),
  listSiteIds: () => [site.tenantId],
});

const context = (over: Partial<ExperienceContext> = {}): ExperienceContext => ({
  tenantId: 'tenant-1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr',
  device: 'desktop', platform: 'web', environment: { environment: 'production' }, country: 'SA',
  flags: {}, now: '2026-01-01T00:00:00.000Z', ...over,
});

// ── registration (STEP 1 + STEP 7) ─────────────────────────────────────────────
test('registerWebsiteChannel populates ONLY website registries + installs the resolver', () => {
  const engine = createExperienceEngine();
  const result = registerWebsiteChannel(engine, fakeSource());
  assert.equal(result.channelId, 'website');
  assert.equal(result.experiencesRegistered, 1);

  assert.equal(engine.registries.channels.has('website'), true);
  assert.equal(engine.registries.channels.get('website'), websiteChannel);
  assert.equal(engine.registries.renderers.size, 2, 'html-string + react-dom, both existing renderers');
  assert.equal(engine.registries.themes.has('website:default'), true);
  assert.equal(engine.registries.experiences.has('tenant-1'), true);
  // Nothing else was populated — this is the Website channel only.
  assert.equal(engine.registries.components.size, 0);
  assert.equal(engine.registries.plugins.size, 0);
  assert.ok(engine.services.experience, 'the experience resolver is installed');
});

// ── the required end-to-end flow (STEP 8) ──────────────────────────────────────
test('Request → Context → Rules → Version → Adapter → Schema → Response, end-to-end', async () => {
  const engine = createExperienceEngine();
  registerWebsiteChannel(engine, fakeSource());

  // Context Resolution
  const ctxResolver = createWebsiteContextResolver();
  const ctx = await ctxResolver.resolve({ host: 'tenant-1', role: 'guest', locale: 'ar', env: 'production', country: 'SA' } as any);
  assert.equal(ctx.channel, 'website');
  assert.equal(ctx.direction, 'rtl', 'ar → rtl');
  assert.equal(ctx.country, 'SA');

  // Full resolution through the engine
  const req: ExperienceRequest = { experienceId: 'tenant-1', context: { ...ctx, tenantId: 'tenant-1' } };
  const res = await engine.resolve(req);

  assert.equal(res.resolution.status, 'resolved');
  assert.equal(res.resolution.channel, 'website');
  assert.equal(res.resolution.version, '7', 'wraps website.service version model');
  assert.deepEqual(res.resolution.appliedRules, ['locale', 'country', 'theme', 'feature-flags']);

  // Website Schema returned
  const schema = res.resolution.schema as any;
  assert.equal(schema.channel, 'website');
  assert.equal(schema.tenantId, 'tenant-1');
  assert.equal(schema.pages.length, 2);
  assert.equal(schema.pages[0].path, '/');
  assert.equal(schema.nav.length, 2);
  assert.equal(schema.defaultLocale, 'rtl' === ctx.direction ? 'ar' : 'en');
  // block → component-node projection preserved the block types
  assert.equal(schema.layout.children[0].componentId, 'hero');
  assert.equal(schema.layout.children[1].componentId, 'richtext');
});

test('preview resolves the DRAFT via the adapter, not the published site', async () => {
  const engine = createExperienceEngine();
  registerWebsiteChannel(engine, fakeSource());
  const res = await engine.resolve({ experienceId: 'tenant-1', context: context(), preview: true });
  assert.equal(res.resolution.status, 'resolved');
  assert.ok((res.resolution.schema as any).meta.title.includes('(draft)'));
  assert.ok((res.resolution.diagnostics ?? []).includes('preview(draft)'));
});

// ── honesty: missing content / version reported, never fabricated ──────────────
test('an unknown experience resolves to not-found, not a fabricated schema', async () => {
  const engine = createExperienceEngine();
  registerWebsiteChannel(engine, fakeSource());
  const res = await engine.resolve({ experienceId: 'does-not-exist', context: context({ tenantId: 'does-not-exist' }) });
  assert.equal(res.resolution.status, 'no-version');
  assert.equal(res.resolution.schema, undefined);
});

// ── unit checks on the pure pieces ─────────────────────────────────────────────
test('the mapper is a pure projection — the source site is never mutated', () => {
  const site = sampleSite();
  const before = JSON.stringify(site);
  mapSiteToSchema(site, context(), 3);
  mapSiteToMetadata(site, 3);
  assert.equal(JSON.stringify(site), before, 'mapping must not mutate the content');
});

test('version resolver wraps the source version; rule resolver lists supported dimensions', async () => {
  const source = fakeSource();
  const versions = createWebsiteVersionResolver(source);
  assert.equal(await versions.pick('tenant-1', context()), '7');
  assert.equal(await versions.pick('nope', context()), null);

  const rules = createWebsiteRuleResolver();
  const decision = await rules.decide(context(), ['tenant-1']);
  assert.equal(decision.experienceId, 'tenant-1');
  assert.deepEqual(decision.appliedRules, ['locale', 'country', 'theme', 'feature-flags']);
});

test('the experience resolver can be composed directly from its factories', async () => {
  const source = fakeSource();
  const resolver = createWebsiteExperienceResolver(source, createWebsiteRuleResolver(), createWebsiteVersionResolver(source));
  const resolution = await resolver.resolve({ experienceId: 'tenant-1', context: context() });
  assert.equal(resolution.status, 'resolved');
  assert.equal(resolution.version, '7');
});
