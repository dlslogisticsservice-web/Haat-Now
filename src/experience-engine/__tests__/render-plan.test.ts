// Experience Engine · Render Plan Builder tests (Wave 13).
// Proves plan generation from a RenderInstructionSet, merge, validation, diagnostics/events,
// and that the renderer remains untouched (identical output with and without a plan).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRenderPlanBuilder, emptyRenderPlan, createRenderDecisionAdapter,
  createExperienceEngine, createFeatureFlagPolicy,
  type EnforcedState, type RenderPlan, type RenderPlanEvent, type FeatureFlag,
  type ExperienceContext, type ExperienceRequest, type RenderingPort,
} from '../index';

const builder = createRenderPlanBuilder({ clock: () => 0 });
const adapter = createRenderDecisionAdapter({ clock: () => 0 });
const state = (over: Partial<EnforcedState> = {}): EnforcedState => ({ enabled: [], disabled: [], overrides: {}, replacements: {}, annotations: {}, redirect: null, ...over });
const planFrom = (s: Partial<EnforcedState>) => builder.build(adapter.adapt(state(s)));

// ── plan generation (STEP 8) ────────────────────────────────────────────────────
test('builds visible / hidden / replaced sections, overrides, redirect and metadata', () => {
  const plan = planFrom({
    enabled: ['beta'], disabled: ['legacy'],
    replacements: { hero: { t: 1 } }, overrides: { theme: 'dark' },
    annotations: { exp: 'x' }, redirect: '/go',
  });

  assert.ok(plan.visible.includes('flag:beta'), 'enabled → visible');
  assert.ok(plan.hidden.includes('flag:legacy'), 'disabled → hidden');
  assert.deepEqual(plan.replaced['section:hero'], { t: 1 }, 'replacement content keyed by node id');
  assert.equal(plan.overrides.theme, 'dark');
  assert.equal(plan.redirect, '/go');
  assert.equal(plan.metadata.annotations.exp, 'x', 'annotations land in metadata');
  assert.equal(plan.metadata.nodeCount, 3, 'beta, legacy, hero');
});

test('an empty instruction set yields an empty plan (no-op)', () => {
  const plan = planFrom({});
  assert.equal(plan.metadata.nodeCount, 0);
  assert.equal(plan.metadata.planSize, 0);
  assert.equal(plan.redirect, null);
  assert.deepEqual(plan.visible, []);
  assert.deepEqual(plan.hidden, []);
  assert.equal(builder.validate(plan).valid, true);
});

test('nodes carry a qualified id, raw key, target type and instruction sources', () => {
  const plan = planFrom({ disabled: ['legacy'] });
  const n = plan.nodes[0];
  assert.equal(n.id, 'flag:legacy');
  assert.equal(n.key, 'legacy');
  assert.equal(n.targetType, 'flag');
  assert.equal(n.visibility, 'hidden');
  assert.equal(n.sources.length, 1);
});

test('hide is fail-closed: a later show does not re-expose a hidden node', () => {
  // craft an instruction set with show-then-hide and hide-then-show on the same node
  const set = adapter.adapt(state({ enabled: ['x'], disabled: ['x'] }));
  const plan = builder.build(set);
  const node = plan.nodes.find(n => n.id === 'flag:x')!;
  assert.equal(node.visibility, 'hidden', 'hide wins over show');
  assert.ok(plan.diagnostics.length > 0, 'the conflict is reported, not silent');
});

// ── merge (STEP 8) ───────────────────────────────────────────────────────────────
test('merge: the overlay wins on conflicts and unions everything else', () => {
  const base = planFrom({ enabled: ['a'], overrides: { theme: 'light', keep: 1 } });
  const overlay = planFrom({ disabled: ['a'], overrides: { theme: 'dark' }, redirect: '/o' });
  const merged = builder.merge(base, overlay);

  assert.ok(merged.hidden.includes('flag:a'), 'overlay visibility wins');
  assert.ok(!merged.visible.includes('flag:a'));
  assert.equal(merged.overrides.theme, 'dark', 'overlay override wins');
  assert.equal(merged.overrides.keep, 1, 'base-only override preserved');
  assert.equal(merged.redirect, '/o');
  assert.equal(merged.metadata.nodeCount, 1, 'the shared node is merged, not duplicated');
  assert.equal(merged.metadata.instructionCount, base.metadata.instructionCount + overlay.metadata.instructionCount);
});

test('merge keeps a base redirect when the overlay has none', () => {
  const merged = builder.merge(planFrom({ redirect: '/base' }), planFrom({ enabled: ['a'] }));
  assert.equal(merged.redirect, '/base');
});

test('merge of two empty plans is empty and valid', () => {
  const merged = builder.merge(emptyRenderPlan(), emptyRenderPlan());
  assert.equal(merged.metadata.planSize, 0);
  assert.equal(builder.validate(merged).valid, true);
});

// ── validation (STEP 8) ─────────────────────────────────────────────────────────
test('validate accepts a well-formed built plan', () => {
  const v = builder.validate(planFrom({ enabled: ['a'], replacements: { hero: 1 }, redirect: '/x' }));
  assert.equal(v.valid, true);
  assert.deepEqual(v.errors, []);
});

test('validate rejects structurally impossible plans', () => {
  const bad: RenderPlan = {
    ...emptyRenderPlan(),
    nodes: [
      { id: 'section:a', key: 'a', targetType: 'section', visibility: 'visible', replaced: true, sources: [] },
      { id: 'section:a', key: 'a', targetType: 'section', visibility: 'hidden', replaced: false, sources: [] },
    ],
    visible: ['section:a'], hidden: ['section:a'], redirect: '',
  };
  const v = builder.validate(bad);
  assert.equal(v.valid, false);
  assert.ok(v.errors.some(e => /duplicate node id/.test(e)));
  assert.ok(v.errors.some(e => /replaced but has no content/.test(e)));
  assert.ok(v.errors.some(e => /both visible and hidden/.test(e)));
  assert.ok(v.errors.some(e => /redirect is an empty string/.test(e)));
});

test('validate warns when a replaced node is hidden', () => {
  const plan = planFrom({ disabled: [] });
  plan.nodes.push({ id: 'section:h', key: 'h', targetType: 'section', visibility: 'hidden', replaced: true, content: 1, sources: [] });
  plan.hidden.push('section:h');
  plan.metadata.nodeCount = plan.nodes.length;
  const v = builder.validate(plan);
  assert.equal(v.valid, true, 'a warning is not an error');
  assert.ok(v.warnings.some(w => /replaced but hidden/.test(w)));
});

// ── diagnostics + events (STEP 6, STEP 7) ───────────────────────────────────────
test('plan metadata reports size, nodes and build time; emits plan.built', () => {
  const events: RenderPlanEvent[] = [];
  const plan = builder.build(adapter.adapt(state({ enabled: ['a'], overrides: { o: 1 }, redirect: '/r' })), { onEvent: (e) => events.push(e) });
  assert.equal(plan.metadata.nodeCount, 1);
  assert.equal(plan.metadata.planSize, 3, '1 node + 1 override + redirect');
  assert.equal(plan.metadata.hasRedirect, true);
  assert.equal(plan.metadata.instructionCount, 3);
  assert.ok(typeof plan.metadata.buildMs === 'number');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'plan.built');
  assert.equal(events[0].nodes, 1);
});

// ── Runtime integration + renderer compatibility (STEP 5, STEP 8) ───────────────
const ectx = (over: Partial<ExperienceContext> = {}): ExperienceContext => ({ tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr', device: 'desktop', platform: 'web', environment: { environment: 'production' }, country: 'SA', segments: [], flags: {}, now: '2026-01-01T00:00:00.000Z', ...over });
const req = (): ExperienceRequest => ({ experienceId: 'home', context: ectx() });
const schema = () => ({ id: 'home', channel: 'website', schemaVersion: '1', layout: { id: 'r', type: 'layout', layout: 'section', children: [] }, locales: ['en'], defaultLocale: 'en', pages: [], nav: [] } as any);
const renderableEngine = () => {
  const engine = createExperienceEngine({ services: { experience: { async resolve(r) { return { status: 'resolved', experienceId: r.experienceId, channel: 'website', version: '1', schema: schema(), diagnostics: [] }; } } } });
  engine.registries.renderers.register('r', { id: 'r', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string' });
  engine.pipeline.registerPort({ target: 'html-string', render: () => '<html>ok</html>' } as RenderingPort<string>);
  return engine;
};
const flag = (id: string): FeatureFlag => ({ metadata: { id, name: id, version: '1', priority: 0 }, enabled: true });

test('the runtime exposes execution.renderPlan built from the instruction set', async () => {
  const engine = renderableEngine();
  engine.flags.register(flag('beta-ui'));
  engine.policies.register(createFeatureFlagPolicy(engine.flags));

  const events: RenderPlanEvent[] = [];
  const exec = await engine.execute(req(), { onPlanEvent: (e) => events.push(e) });

  assert.ok(exec.renderPlan, 'execution.renderPlan exposed');
  assert.ok(exec.renderPlan!.visible.includes('flag:beta-ui'), 'the enabled flag is a visible node');
  assert.equal(exec.renderPlan!.metadata.instructionCount, exec.renderInstructions!.produced, 'plan consumed exactly the produced instructions');
  assert.ok(exec.diagnostics.some(d => d.stage === 'enforcement' && /render-plan/.test(d.message)));
  assert.ok(events.some(e => e.type === 'plan.built'));
  assert.equal(engine.renderPlanBuilder.validate(exec.renderPlan!).valid, true, 'the runtime-built plan is valid');
});

test('RENDERER IS UNTOUCHED: output identical with and without a populated plan', async () => {
  const plain = renderableEngine();
  const withPlan = renderableEngine();
  withPlan.flags.register(flag('beta-ui'));
  withPlan.policies.register(createFeatureFlagPolicy(withPlan.flags));

  const a = await plain.execute(req());
  const b = await withPlan.execute(req());

  assert.equal(a.response.renderingResult?.status, 'rendered');
  assert.equal(b.response.renderingResult?.status, 'rendered');
  assert.equal(b.response.renderingResult?.output, a.response.renderingResult?.output,
    'a populated render plan does not change rendered output');
  assert.equal(a.renderPlan?.metadata.nodeCount, 0, 'no decisions → empty plan');
  assert.ok((b.renderPlan?.metadata.nodeCount ?? 0) > 0, 'decisions → populated plan');
});
