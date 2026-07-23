// Website Channel · rendering pipeline integration.
// The FULL Wave-3 flow through the REAL SnapshotRenderer (renderer.ts):
//
//   Request → resolve (schema) → renderer resolution → HTML RenderingPort → HTML → Response
//
// Uses a fake content source (no localStorage) but the REAL html renderer adapter, so it
// proves the engine renders a Website experience with the existing block renderers unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExperienceEngine, type ExperienceContext } from '../../experience-engine';
import { registerWebsiteChannel } from '../website/channel';
import { createWebsiteHtmlRenderingPort } from '../website/htmlRenderer';
import type { WebsiteContentSource } from '../website/types';

const sampleSite = (): any => ({
  tenantId: 'tenant-1', slug: 'acme', siteName: 'Acme Foods', status: 'published', maintenance: false,
  navigation: [{ label: 'Home', path: '/' }], footer: {}, blog: [],
  pages: [{
    id: 'p_home', path: '/', kind: 'landing', title: 'Home', nav: true, navOrder: 0, seo: { title: 'Home' },
    sections: [
      { type: 'hero', title: 'Welcome to Acme', subtitle: 'Fast delivery' },
      { type: 'richtext', body: 'Fresh food, on time.' },
    ],
  }],
  seoDefaults: {}, analytics: {}, cookie: { enabled: false, policyPath: '/legal' }, updatedAt: 'now', schemaVersion: 1,
});

const fakeSource = (site = sampleSite()): WebsiteContentSource => ({
  getPublishedSite: (id) => (id === site.tenantId ? site : null),
  getDraftSite: (id) => (id === site.tenantId ? site : null),
  getVersion: (id) => (id === site.tenantId ? 4 : null),
  listSiteIds: () => [site.tenantId],
});

const ctx = (): ExperienceContext => ({
  tenantId: 'tenant-1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr',
  device: 'desktop', platform: 'web', environment: { environment: 'production' }, flags: {}, now: '2026-01-01T00:00:00.000Z',
});

test('registerWebsiteChannel installs an executable html-string RenderingPort', () => {
  const engine = createExperienceEngine();
  registerWebsiteChannel(engine, fakeSource());
  assert.equal(engine.pipeline.hasPort('html-string'), true);
  assert.deepEqual(engine.pipeline.targets(), ['html-string']);
});

test('resolveAndRender produces real HTML from the existing SnapshotRenderer', async () => {
  const engine = createExperienceEngine();
  registerWebsiteChannel(engine, fakeSource());

  const res = await engine.resolveAndRender({ experienceId: 'tenant-1', context: ctx() });

  assert.equal(res.resolution.status, 'resolved');
  assert.equal(res.renderingResult?.status, 'rendered');
  assert.equal(res.renderingResult?.renderer, 'website:html-string');
  assert.equal(res.renderingResult?.target, 'html-string');
  assert.ok((res.renderingResult?.executionMs ?? -1) >= 0);

  const html = String(res.renderingResult?.output ?? '');
  // Produced by the EXISTING BLOCK_RENDERERS — not reimplemented here.
  assert.match(html, /wp-hero/);
  assert.match(html, /Welcome to Acme/);
  assert.match(html, /wp-richtext/);
  assert.match(html, /Fresh food, on time\./);
});

test('the html renderer escapes content (reuses renderer.ts XSS-safe output)', () => {
  const port = createWebsiteHtmlRenderingPort();
  const html = port.render({
    status: 'resolved', experienceId: 'x', channel: 'website',
    schema: { id: 'x', channel: 'website', schemaVersion: '1', locales: ['en'], defaultLocale: 'en', pages: [], nav: [],
      layout: { id: 'r', type: 'layout', layout: 'section', children: [
        { id: 'b0', type: 'component', componentId: 'hero', props: { type: 'hero', title: '<script>alert(1)</script>' } },
      ] } } as any,
  }, ctx());
  assert.ok(!html.includes('<script>alert(1)</script>'), 'variable content must be escaped by renderer.ts');
  assert.match(html, /&lt;script&gt;/);
});

test('rendering an unresolved experience is skipped, not fabricated', async () => {
  const engine = createExperienceEngine();
  registerWebsiteChannel(engine, fakeSource());
  const res = await engine.resolveAndRender({ experienceId: 'missing', context: { ...ctx(), tenantId: 'missing' } });
  assert.notEqual(res.resolution.status, 'resolved');
  assert.equal(res.renderingResult?.status, 'skipped');
  assert.equal(res.renderingResult?.output, null);
});
