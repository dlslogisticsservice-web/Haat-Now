// Website Channel · LIVE runtime integration (Wave 16).
// Tests the REAL runtime path only: the exact `decide(sections, ctx)` call PublicSiteApp makes
// on real WebsiteBlock content — stable ids, canary scoping, load-bearing behaviour, metrics
// export, instant rollback and failure isolation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebsiteLiveRuntime, WEBSITE_CANARY } from '../website/liveRuntime';
import { assignBlockIds, stableBlockId, blockBaseId } from '../website/blockId';
import { mapSiteToSchema } from '../website/mapper';
import type { WebsiteBlock } from '../../services/website.service';
import type { ExperienceContext, FeatureFlag } from '../../experience-engine';

// Real-shaped authored sections (the same shape website.service produces).
const sections = (): WebsiteBlock[] => ([
  { type: 'hero', title: 'Welcome to HaaT', subtitle: 'Fast delivery' },
  { type: 'richtext', heading: 'Seasonal promo', body: 'Ends soon.' },
  { type: 'merchants', heading: 'Featured', layout: 'rail', items: [{ name: 'A' }] },
  { type: 'richtext', heading: 'About us', body: 'Fresh food, on time.' },
] as unknown as WebsiteBlock[]);

const ctx = (path = '/', tenantId = 'tenant-1') => ({ tenantId, path, locale: 'en', preview: false });
const collect = () => { const out: Array<{ e: string; p: any }> = []; return { out, report: (e: string, p: any) => out.push({ e, p }) }; };
const rt = (rollout?: any, report?: any) => createWebsiteLiveRuntime({ rollout, report, onError: () => {} });

// ── STEP 1 · stable block ids ────────────────────────────────────────────────────
test('block ids are stable when an unrelated block is inserted above', () => {
  const before = sections();
  const idsBefore = assignBlockIds(before);
  const after = [{ type: 'cta', title: 'New banner', button: { label: 'Go', href: '/' } } as unknown as WebsiteBlock, ...before];
  const idsAfter = assignBlockIds(after);

  assert.deepEqual(idsAfter.slice(1), idsBefore, 'every existing block keeps its id');
  assert.ok(!idsBefore.some(id => /^blk_\d+$/.test(id)), 'no positional blk_N ids remain');
});

test('ids ignore volatile content: live catalog hydration does not change a block id', () => {
  const authored = { type: 'merchants', heading: 'Featured', layout: 'rail', items: [{ name: 'A' }] } as unknown as WebsiteBlock;
  const hydrated = { ...(authored as any), items: [{ name: 'Live 1' }, { name: 'Live 2' }] } as unknown as WebsiteBlock;
  assert.equal(blockBaseId(hydrated), blockBaseId(authored), 'hydrateSections must not retarget a plan');
});

test('genuinely identical blocks are disambiguated by occurrence', () => {
  const dup = { type: 'richtext', heading: 'Same', body: 'Same' } as unknown as WebsiteBlock;
  const ids = assignBlockIds([dup, dup]);
  assert.notEqual(ids[0], ids[1]);
  assert.equal(ids[1], `${stableBlockId(dup)}~2`);
});

test('the engine mapper emits the SAME stable ids as the live runtime', () => {
  const site: any = { tenantId: 'tenant-1', slug: 's', siteName: 'S', status: 'published', navigation: [], blog: [],
    pages: [{ id: 'p_home', path: '/', kind: 'landing', title: 'Home', nav: true, navOrder: 0, seo: {}, sections: sections() }] };
  const schema = mapSiteToSchema(site, { tenantId: 'tenant-1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr', device: 'desktop', platform: 'web', environment: { environment: 'production' }, flags: {}, now: '' } as ExperienceContext, 1);
  const mapperIds = (schema.layout as any).children.map((n: any) => n.id);
  assert.deepEqual(mapperIds, assignBlockIds(sections()), 'one id scheme across both paths');
});

// ── STEP 3 + 4 · gate scoping ────────────────────────────────────────────────────
test('the shipped canary is scoped to exactly one experience, denied everywhere else', () => {
  assert.deepEqual(WEBSITE_CANARY.experiences, ['/'], 'exactly one website experience');
  const r = rt();
  assert.equal(r.rollout.shouldExecute({ tenantId: 't', experienceId: '/' }).execute, true);
  assert.equal(r.rollout.shouldExecute({ tenantId: 't', experienceId: '/pricing' }).execute, false);
  assert.equal(r.rollout.shouldExecute({ tenantId: 't', experienceId: '/contact' }).reason, 'no-criteria');
});

test('a non-canary page returns the IDENTICAL array reference (zero live impact)', () => {
  const input = sections();
  const d = rt().decide(input, ctx('/pricing'));
  assert.equal(d.sections, input, 'same reference — React sees no change at all');
  assert.equal(d.executed, false);
});

test('the canary page with NO flags registered returns the identical array reference', () => {
  const input = sections();
  const d = rt().decide(input, ctx('/'));
  assert.equal(d.executed, true, 'the engine DID run on the canary experience');
  assert.equal(d.sections, input, 'and decided nothing changes — byte-identical output');
  assert.equal(d.nodesModified, 0);
});

// ── STEP 2 · load-bearing behaviour on the real path ────────────────────────────
test('LOAD-BEARING · a registered flag hides exactly the targeted authored block', () => {
  const runtime = rt();
  const promoId = stableBlockId(sections()[1]); // the 'Seasonal promo' richtext
  runtime.engine.flags.register({ metadata: { id: promoId, name: 'promo', version: '1', priority: 0 }, enabled: true, default: { enabled: false } } as FeatureFlag);

  const d = runtime.decide(sections(), ctx('/'));
  assert.equal(d.executed, true);
  assert.equal(d.nodesModified, 1);
  assert.deepEqual(d.hidden, [promoId]);

  const kept = d.sections.map(b => (b as any).heading ?? (b as any).title);
  assert.deepEqual(kept, ['Welcome to HaaT', 'Featured', 'About us'], 'only the promo block is gone');
});

test('LOAD-BEARING · turning the flag on restores the block', () => {
  const runtime = rt();
  const promoId = stableBlockId(sections()[1]);
  runtime.engine.flags.register({ metadata: { id: promoId, name: 'promo', version: '1', priority: 0 }, enabled: true, default: { enabled: true } } as FeatureFlag);
  const d = runtime.decide(sections(), ctx('/'));
  assert.equal(d.nodesModified, 0);
  assert.equal(d.sections.length, 4);
});

test('the canary does not leak to another page even with a flag registered', () => {
  const runtime = rt();
  const promoId = stableBlockId(sections()[1]);
  runtime.engine.flags.register({ metadata: { id: promoId, name: 'promo', version: '1', priority: 0 }, enabled: true, default: { enabled: false } } as FeatureFlag);
  const input = sections();
  const other = runtime.decide(input, ctx('/pricing'));
  assert.equal(other.sections, input, '/pricing is untouched');
});

// ── STEP 5 · metrics export ──────────────────────────────────────────────────────
test('METRICS · an applied plan is exported to the monitoring seam and aggregated', () => {
  const { out, report } = collect();
  const runtime = rt(undefined, report);
  const promoId = stableBlockId(sections()[1]);
  runtime.engine.flags.register({ metadata: { id: promoId, name: 'promo', version: '1', priority: 0 }, enabled: true, default: { enabled: false } } as FeatureFlag);

  runtime.decide(sections(), ctx('/'));

  const ev = out.find(x => x.e === 'experience.plan_applied');
  assert.ok(ev, 'exported to monitoring.track');
  assert.equal(ev!.p.path, '/');
  assert.equal(ev!.p.nodesModified, 1);
  assert.deepEqual(ev!.p.hidden, [promoId]);

  const snap = runtime.metrics.snapshot();
  assert.equal(snap.executions, 1);
  assert.equal(snap.nodesModified, 1);
  assert.equal(snap.failures, 0);
});

test('METRICS · a no-change decision is not reported as noise', () => {
  const { out, report } = collect();
  rt(undefined, report).decide(sections(), ctx('/'));
  assert.equal(out.filter(x => x.e === 'experience.plan_applied').length, 0, 'nothing applied → nothing exported');
});

// ── STEP 6 · rollback + failure isolation ───────────────────────────────────────
test('ROLLBACK · disable() instantly restores authored content on the next render', () => {
  const runtime = rt();
  const promoId = stableBlockId(sections()[1]);
  runtime.engine.flags.register({ metadata: { id: promoId, name: 'promo', version: '1', priority: 0 }, enabled: true, default: { enabled: false } } as FeatureFlag);

  assert.equal(runtime.decide(sections(), ctx('/')).sections.length, 3, 'canary live');
  runtime.rollout.disable('incident');
  const input = sections();
  const after = runtime.decide(input, ctx('/'));
  assert.equal(after.sections, input, 'identical reference — full authored content restored');
  assert.equal(after.executed, false);
});

test('FAILURE ISOLATION · a broken decision chain still renders the authored sections', () => {
  const errors: unknown[] = [];
  const runtime = createWebsiteLiveRuntime({ report: () => {}, onError: (e) => errors.push(e) });
  // Break the plan builder the chain depends on.
  (runtime.engine.renderPlanBuilder as any).build = () => { throw new Error('builder boom'); };

  const input = sections();
  const d = runtime.decide(input, ctx('/'));
  assert.equal(d.sections, input, 'authored content rendered unchanged');
  assert.equal(d.failed, true);
  assert.equal(errors.length, 1, 'reported to the monitoring seam');
  assert.equal(runtime.metrics.snapshot().failures, 1);
});

test('FAILURE ISOLATION · repeated failures trip the breaker and stop trying', () => {
  const runtime = createWebsiteLiveRuntime({ report: () => {}, onError: () => {} });
  (runtime.engine.renderPlanBuilder as any).build = () => { throw new Error('boom'); };
  for (let i = 0; i < 3; i++) runtime.decide(sections(), ctx('/'));
  assert.equal(runtime.rollout.tripped(), true);
  const input = sections();
  const after = runtime.decide(input, ctx('/'));
  assert.equal(after.reason, 'tripped');
  assert.equal(after.sections, input);
});
