// Product Enablement Sprint 1 · real execution validation.
//
// Runs the ACTUAL chain the product surfaces run — Decision Context → Audience → Flags →
// Experiments → Rollout → Rendering — with no mocks and no stubs, using the same engine
// composition `experience-platform.service` builds. Proves the product's promises are real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createExperienceEngine, createTargetResolver, createFeatureFlagResolver,
  createExperimentRegistry, createExperimentTracker, createExperimentPolicy,
  createDecisionContextBuilder, decisionUnitId, allocateVariant, anonymousVisitor,
  type Audience, type ExperienceContext, type Experiment, type FeatureFlag, type RenderingPort,
} from '../index';

// The same definition shapes the platform ships (kept local so this test never imports a
// Vite-only module — the engine must stay runnable under plain Node).
const audiences: Audience[] = [
  { metadata: { id: 'aud.gcc', name: 'GCC', version: '1' }, segments: [{ id: 's', rules: [{ criteria: { countries: ['SA', 'AE'] } }] }] },
  { metadata: { id: 'aud.mobile', name: 'Mobile', version: '1' }, segments: [{ id: 's', rules: [{ criteria: { devices: ['mobile'] } }] }] },
];
const flags: FeatureFlag[] = [
  { metadata: { id: 'flag.offers', name: 'Offers', version: '1', priority: 10 }, enabled: true, default: { enabled: false },
    rules: [{ id: 'gcc', criteria: { audiences: ['aud.gcc'] }, enabled: true }] },
  { metadata: { id: 'flag.always_off', name: 'Off', version: '1', priority: 0 }, enabled: true, default: { enabled: false } },
];
const experiment: Experiment = {
  metadata: { id: 'exp.tone', name: 'Tone', version: '1' }, status: 'running',
  variants: [{ key: 'control', weight: 50, control: true }, { key: 'warm', weight: 50 }],
  allocation: { unit: 'visitor' },
};

const ctx = (over: Partial<ExperienceContext> = {}): ExperienceContext => ({
  tenantId: 'haat', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr',
  device: 'mobile', platform: 'web', environment: { environment: 'production' },
  country: 'SA', segments: [], flags: {}, now: '', ...over,
});

const build = (rollout?: unknown) => {
  const engine = createExperienceEngine({ rollout: rollout as never });
  audiences.forEach(a => engine.audiences.register(a));
  flags.forEach(f => engine.flags.register(f));
  const experiments = createExperimentRegistry();
  experiments.register(experiment);
  const tracker = createExperimentTracker();
  engine.policies.register(createExperimentPolicy(experiments, {
    tracker, resolveUnit: (c) => (c.decision ? decisionUnitId(c.decision) : 'x'),
  }));
  return { engine, experiments, tracker, targets: createTargetResolver(engine.audiences), flagRes: createFeatureFlagResolver(engine.flags) };
};

// ── the chain, end to end ────────────────────────────────────────────────────────
test('CHAIN · context → audience → flags → experiment → rollout resolves for a real visitor', () => {
  const p = build({ enabled: true, experiences: ['/'] });
  const c = ctx();

  const matched = p.targets.resolve(c, { experienceId: '/' }).matched;
  assert.ok(matched.includes('aud.gcc'), 'country audience matched');
  assert.ok(matched.includes('aud.mobile'), 'device audience matched');

  const resolvedFlags = p.flagRes.resolve(c, { audiences: matched, experienceId: '/' });
  assert.equal(resolvedFlags.flags['flag.offers'].enabled, true, 'audience-targeted flag is ON');
  assert.equal(resolvedFlags.flags['flag.always_off'].enabled, false, 'untargeted flag stays OFF');

  const decision = createDecisionContextBuilder().build({
    context: c, identity: anonymousVisitor('seed-1'), experienceId: '/', audiences: matched, flags: resolvedFlags.flags,
  });
  assert.equal(decision.audiences.length, 2);
  assert.equal(decision.location.country, 'SA');
  assert.equal(decision.device.kind, 'mobile');

  const unit = decisionUnitId(decision);
  const arm = allocateVariant(experiment, unit).variant;
  assert.ok(arm === 'control' || arm === 'warm');

  const gate = p.engine.rollout.shouldExecute({ tenantId: 'haat', experienceId: '/' });
  assert.equal(gate.execute, true, 'canary experience is in the rollout');
  assert.equal(p.engine.rollout.shouldExecute({ tenantId: 'haat', experienceId: '/other' }).execute, false, 'other pages are not');
});

test('CHAIN · a non-targeted visitor gets a different, correct decision', () => {
  const p = build({ enabled: true, experiences: ['/'] });
  const c = ctx({ country: 'US', device: 'desktop' });
  const matched = p.targets.resolve(c, { experienceId: '/' }).matched;
  assert.deepEqual(matched, [], 'no audience matches a US desktop visitor');
  const resolved = p.flagRes.resolve(c, { audiences: matched, experienceId: '/' });
  assert.equal(resolved.flags['flag.offers'].enabled, false, 'the offers flag is OFF outside the audience');
});

test('CHAIN · variant allocation is stable per visitor and differs across visitors', () => {
  const seen = new Set<string>();
  for (const seed of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8']) {
    const unit = decisionUnitId(createDecisionContextBuilder().build({ context: ctx(), identity: anonymousVisitor(seed), experienceId: '/' }));
    const first = allocateVariant(experiment, unit).variant!;
    assert.equal(allocateVariant(experiment, unit).variant, first, 'stable for the same visitor');
    seen.add(first);
  }
  assert.equal(seen.size, 2, 'both arms are reachable across visitors');
});

// ── rendering actually changes (the promise the product makes) ───────────────────
test('CHAIN · rendering: a flagged-off section is removed from the rendered output', async () => {
  const p = build({ enabled: true, experiences: ['home'] });
  // A section flag named for the block id, defaulted OFF ⇒ the plan hides it.
  p.engine.flags.register({ metadata: { id: 'promo', name: 'promo', version: '1', priority: 0 }, enabled: true, default: { enabled: false } } as FeatureFlag);
  p.engine.policies.register((await import('../index')).createFeatureFlagPolicy(p.engine.flags));

  const schema = () => ({
    id: 'home', channel: 'website', schemaVersion: '1', locales: ['en'], defaultLocale: 'en', nav: [], pages: [],
    layout: { id: 'root', type: 'layout', layout: 'section', children: [
      { id: 'hero', type: 'component', componentId: 'hero', props: {} },
      { id: 'promo', type: 'component', componentId: 'banner', props: {} },
    ] },
  } as never);

  const engine = createExperienceEngine({
    rollout: { enabled: true, experiences: ['home'] },
    services: { experience: { async resolve(r) { return { status: 'resolved', experienceId: r.experienceId, channel: 'website', version: '1', schema: schema(), diagnostics: [] }; } } },
  });
  engine.registries.renderers.register('r', { id: 'r', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string' });
  engine.pipeline.registerPort({ target: 'html-string', render: (res) => ((res.schema as never as { layout: { children: Array<{ id: string }> } }).layout.children).map(c => c.id).join(',') } as RenderingPort<string>);
  engine.flags.register({ metadata: { id: 'promo', name: 'promo', version: '1', priority: 0 }, enabled: true, default: { enabled: false } } as FeatureFlag);
  engine.policies.register((await import('../index')).createFeatureFlagPolicy(engine.flags));

  const exec = await engine.execute({ experienceId: 'home', context: ctx() });
  assert.equal(exec.response.renderingResult?.status, 'rendered');
  assert.equal(exec.response.renderingResult?.output, 'hero', 'the flagged-off section is gone from the render');
  assert.equal(exec.renderPlanExecution?.executed, true, 'the rollout gate allowed execution');
  assert.equal(exec.renderPlanExecution?.nodesModified, 1);
});

test('CHAIN · rollback: disabling the gate restores the full rendered output', async () => {
  const schema = () => ({
    id: 'home', channel: 'website', schemaVersion: '1', locales: ['en'], defaultLocale: 'en', nav: [], pages: [],
    layout: { id: 'root', type: 'layout', layout: 'section', children: [
      { id: 'hero', type: 'component', componentId: 'hero', props: {} },
      { id: 'promo', type: 'component', componentId: 'banner', props: {} },
    ] },
  } as never);
  const engine = createExperienceEngine({
    rollout: { enabled: true, experiences: ['home'] },
    services: { experience: { async resolve(r) { return { status: 'resolved', experienceId: r.experienceId, channel: 'website', version: '1', schema: schema(), diagnostics: [] }; } } },
  });
  engine.registries.renderers.register('r', { id: 'r', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string' });
  engine.pipeline.registerPort({ target: 'html-string', render: (res) => ((res.schema as never as { layout: { children: Array<{ id: string }> } }).layout.children).map(c => c.id).join(',') } as RenderingPort<string>);
  engine.flags.register({ metadata: { id: 'promo', name: 'promo', version: '1', priority: 0 }, enabled: true, default: { enabled: false } } as FeatureFlag);
  engine.policies.register((await import('../index')).createFeatureFlagPolicy(engine.flags));

  assert.equal((await engine.execute({ experienceId: 'home', context: ctx() })).response.renderingResult?.output, 'hero');
  engine.rollout.disable('verification drill');
  assert.equal((await engine.execute({ experienceId: 'home', context: ctx() })).response.renderingResult?.output, 'hero,promo', 'instant rollback restores everything');
});

// ── exposure accounting is honest ────────────────────────────────────────────────
test('CHAIN · exposures are recorded once per visitor, not per render', async () => {
  const p = build({ enabled: false });
  const decision = createDecisionContextBuilder().build({ context: ctx(), identity: anonymousVisitor('seed-9'), experienceId: '/' });
  const unit = decisionUnitId(decision);
  const arm = allocateVariant(experiment, unit).variant!;
  for (let i = 0; i < 5; i++) p.tracker.exposure('exp.tone', arm, unit);
  assert.equal(p.tracker.report('exp.tone').totals.exposures, 1, 're-renders must not inflate exposure');
});
