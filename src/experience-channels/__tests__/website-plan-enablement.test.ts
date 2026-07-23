// Website Channel · Render Plan production enablement (Wave 15).
//
// Enables Render Plan execution for ONE real website experience and proves the whole chain
// against the REAL mapper and the REAL SnapshotRenderer (renderer.ts):
//
//   flags → policy → enforcement → instructions → plan → rollout gate → pipeline → HTML
//
// PARITY is the point: with the canary OFF the HTML must be byte-identical to today's output,
// and with it ON only the targeted block may disappear — everything else stays untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExperienceEngine, createFeatureFlagPolicy, type ExperienceContext, type FeatureFlag } from '../../experience-engine';
import { registerWebsiteChannel } from '../website/channel';
import { stableBlockId } from '../website/blockId';
import type { WebsiteContentSource } from '../website/types';

const sampleSite = (): any => ({
  tenantId: 'tenant-1', slug: 'acme', siteName: 'Acme Foods', status: 'published', maintenance: false,
  navigation: [{ label: 'Home', path: '/' }], footer: {}, blog: [],
  pages: [{
    id: 'p_home', path: '/', kind: 'landing', title: 'Home', nav: true, navOrder: 0, seo: { title: 'Home' },
    sections: [
      { type: 'hero', title: 'Welcome to Acme', subtitle: 'Fast delivery' },
      { type: 'richtext', body: 'Seasonal promo — ends soon.' },
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

const ctx = (tenantId = 'tenant-1'): ExperienceContext => ({
  tenantId, channel: 'website', role: 'guest', locale: 'en', direction: 'ltr',
  device: 'desktop', platform: 'web', environment: { environment: 'production' }, segments: [], flags: {}, now: '2026-01-01T00:00:00.000Z',
});

/**
 * The canary targets the promo block by its STABLE id (Wave 16) — derived from the block's authored
 * identity, not its position, so inserting a section above it no longer retargets the plan.
 */
const PROMO_NODE = stableBlockId({ type: 'richtext', body: 'Seasonal promo — ends soon.' } as any);
const promoFlag = (): FeatureFlag => ({ metadata: { id: PROMO_NODE, name: 'seasonal-promo', version: '1', priority: 0 }, enabled: true, default: { enabled: false } });

const buildEngine = (rollout?: any) => {
  const engine = createExperienceEngine({ rollout });
  registerWebsiteChannel(engine, fakeSource());
  engine.flags.register(promoFlag());
  engine.policies.register(createFeatureFlagPolicy(engine.flags));
  return engine;
};

const htmlOf = (exec: any) => String(exec.response.renderingResult?.output ?? '');

// ── PARITY: the canary OFF must not change a single byte ────────────────────────
test('PARITY · canary OFF: HTML is byte-identical to an engine with no rollout at all', async () => {
  const baseline = await buildEngine().execute({ experienceId: 'tenant-1', context: ctx() });
  const gatedOff = await buildEngine({ enabled: false, experiences: ['tenant-1'] }).execute({ experienceId: 'tenant-1', context: ctx() });

  assert.equal(baseline.response.renderingResult?.status, 'rendered');
  assert.equal(htmlOf(gatedOff), htmlOf(baseline), 'a configured-but-disabled canary changes nothing');
  assert.equal(baseline.renderPlanExecution?.executed, false);
  // and the untouched baseline still contains every block
  assert.match(htmlOf(baseline), /Welcome to Acme/);
  assert.match(htmlOf(baseline), /Seasonal promo/);
  assert.match(htmlOf(baseline), /Fresh food, on time\./);
});

// ── ENABLEMENT: one experience, real renderer ───────────────────────────────────
test('ENABLEMENT · canary ON for one experience removes only the targeted block', async () => {
  const engine = buildEngine({ enabled: true, experiences: ['tenant-1'] });
  const exec = await engine.execute({ experienceId: 'tenant-1', context: ctx() });

  assert.equal(exec.response.renderingResult?.status, 'rendered');
  assert.equal(exec.response.renderingResult?.renderer, 'website:html-string', 'the REAL website renderer ran');
  assert.equal(exec.renderPlanExecution?.executed, true);
  assert.equal(exec.renderPlanExecution?.reason, 'experience-allowlist');
  assert.equal(exec.renderPlanExecution?.nodesModified, 1);

  const html = htmlOf(exec);
  assert.ok(!html.includes('Seasonal promo'), 'the flagged-off promo block is gone');
  assert.match(html, /Welcome to Acme/, 'the hero is untouched');
  assert.match(html, /Fresh food, on time\./, 'the other richtext is untouched');
  assert.match(html, /wp-hero/, 'real block renderers still produced the markup');
});

test('ENABLEMENT · turning the flag ON restores the block (the flag actually drives it)', async () => {
  const engine = buildEngine({ enabled: true, experiences: ['tenant-1'] });
  engine.flags.register({ ...promoFlag(), default: { enabled: true } } as FeatureFlag);
  const exec = await engine.execute({ experienceId: 'tenant-1', context: ctx() });
  assert.match(htmlOf(exec), /Seasonal promo/);
  assert.equal(exec.renderPlanExecution?.nodesModified, 0, 'nothing hidden when the flag is on');
});

// ── CANARY ISOLATION ─────────────────────────────────────────────────────────────
test('CANARY · a different tenant on the same engine is unaffected', async () => {
  const site2 = sampleSite(); site2.tenantId = 'tenant-2';
  const engine = createExperienceEngine({ rollout: { enabled: true, experiences: ['tenant-1'] } });
  registerWebsiteChannel(engine, {
    getPublishedSite: (id) => (id === 'tenant-1' ? sampleSite() : id === 'tenant-2' ? site2 : null),
    getDraftSite: (id) => (id === 'tenant-1' ? sampleSite() : id === 'tenant-2' ? site2 : null),
    getVersion: () => 4,
    listSiteIds: () => ['tenant-1', 'tenant-2'],
  });
  engine.flags.register(promoFlag());
  engine.policies.register(createFeatureFlagPolicy(engine.flags));

  const canary = await engine.execute({ experienceId: 'tenant-1', context: ctx('tenant-1') });
  const other = await engine.execute({ experienceId: 'tenant-2', context: ctx('tenant-2') });

  assert.ok(!htmlOf(canary).includes('Seasonal promo'), 'canary experience is modified');
  assert.match(htmlOf(other), /Seasonal promo/, 'the non-canary experience is untouched');
  assert.equal(other.renderPlanExecution?.executed, false);
});

// ── ROLLBACK against the real renderer ──────────────────────────────────────────
test('ROLLBACK · disable() instantly restores the original HTML', async () => {
  const engine = buildEngine({ enabled: true, experiences: ['tenant-1'] });
  const on = await engine.execute({ experienceId: 'tenant-1', context: ctx() });
  assert.ok(!htmlOf(on).includes('Seasonal promo'));

  engine.rollout.disable('rollback drill');
  const off = await engine.execute({ experienceId: 'tenant-1', context: ctx() });
  assert.match(htmlOf(off), /Seasonal promo/, 'original HTML restored on the next request');

  // and it matches the never-enabled baseline exactly
  const baseline = await buildEngine().execute({ experienceId: 'tenant-1', context: ctx() });
  assert.equal(htmlOf(off), htmlOf(baseline), 'post-rollback HTML is byte-identical to baseline');
});

// ── METRICS from a real render ───────────────────────────────────────────────────
test('METRICS · a real website execution records latency, plan size and nodes modified', async () => {
  const engine = buildEngine({ enabled: true, experiences: ['tenant-1'] });
  await engine.execute({ experienceId: 'tenant-1', context: ctx() });
  const s = engine.renderPlanMetrics.snapshot();
  assert.equal(s.executions, 1);
  assert.equal(s.failures, 0);
  assert.equal(s.nodesModified, 1);
  assert.ok(s.planSize.max >= 1);
  assert.ok(s.latencyMs.max >= 0);
});
