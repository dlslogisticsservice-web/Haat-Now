// Renderer + SEO tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRenderer, buildCacheManifest, fingerprintAsset, renderStatic } from '../rendering/renderer';
import { generateSeo, generateSitemap, generateRobots, validateSeo } from '../seo/seo';
import { compileHaatSnapshot } from '../haat-site/site-definition';
import { testUuid } from '../testing/factories';
import { isOk } from '../shared/types';

const snapshot = compileHaatSnapshot(testUuid(1), '2026-07-05T00:00:00.000Z');
const home = snapshot.pages.find(p => p.path === '/')!;

test('renderer produces static HTML with title, lang/dir and hero', () => {
  const renderer = createRenderer();
  const html = renderer.renderDocument(snapshot, home);
  assert.match(html, /<!doctype html>/);
  assert.match(html, /lang="en" dir="ltr"/);
  assert.match(html, /<title>/);
  assert.match(html, /wp-hero/);
  assert.match(html, /Everything you need/);
});

test('render() returns 200 + etag for a known path and 404 otherwise', async () => {
  const renderer = createRenderer();
  const ok200 = await renderer.render(snapshot, { host: 'haatnow.app', path: '/pricing', locale: 'en', variantKey: 'default', deviceClass: 'desktop' });
  assert.ok(isOk(ok200));
  assert.equal(ok200.value.status, 200);
  assert.ok(ok200.value.headers.etag);
  const nf = await renderer.render(snapshot, { host: 'haatnow.app', path: '/nope', locale: 'en', variantKey: 'default', deviceClass: 'desktop' });
  assert.ok(isOk(nf));
  assert.equal(nf.value.status, 404);
});

test('asset fingerprinting + cache manifest', () => {
  const fp = fingerprintAsset('/assets/logo.png');
  assert.match(fp, /logo\.[0-9a-f]{8}\.png/);
  const manifest = buildCacheManifest(snapshot, 'haatnow.app');
  assert.equal(manifest.entries.length, 19);
  assert.equal(manifest.entries[0].key, 'haatnow.app:/:en');
});

test('static generation renders every page', () => {
  const result = renderStatic(snapshot, createRenderer(), '2026-07-05T00:00:00.000Z');
  assert.equal(result.pages.length, 19);
  assert.ok(result.pages.every(p => p.html.includes('<!doctype html>')));
});

test('SEO generates meta/OG/Twitter/JSON-LD + head tags', () => {
  const out = generateSeo({ origin: 'https://haatnow.app', siteName: 'HaaT Now', page: home });
  assert.ok(out.title.length > 0);
  assert.equal(out.openGraph['og:type'], 'website');
  assert.equal(out.twitter['twitter:card'], 'summary_large_image');
  assert.ok(out.jsonLd.some(ld => ld['@type'] === 'Organization'));
  assert.ok(out.jsonLd.some(ld => ld['@type'] === 'BreadcrumbList'));
  assert.ok(out.headTags.some(t => t.includes('<title>')));
  assert.ok(out.headTags.some(t => t.includes('application/ld+json')));
});

test('FAQ page emits FAQ JSON-LD', () => {
  const faq = snapshot.pages.find(p => p.path === '/faq')!;
  const out = generateSeo({ origin: 'https://haatnow.app', siteName: 'HaaT Now', page: faq });
  assert.ok(out.jsonLd.some(ld => ld['@type'] === 'FAQPage'));
});

test('sitemap, robots, and SEO validation pass for launch', () => {
  const sitemap = generateSitemap(snapshot, 'https://haatnow.app');
  assert.match(sitemap, /<urlset/);
  assert.match(sitemap, /haatnow\.app\/pricing/);
  assert.match(generateRobots('https://haatnow.app', true), /Sitemap:/);
  assert.match(generateRobots('https://haatnow.app', false), /Disallow: \//);
  const issues = validateSeo(snapshot, 'HaaT Now', 'https://haatnow.app');
  assert.equal(issues.length, 0, `SEO issues: ${JSON.stringify(issues)}`);
});
