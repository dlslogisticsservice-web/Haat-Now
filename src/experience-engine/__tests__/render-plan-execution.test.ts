// Experience Engine · Render Plan Execution tests (Wave 14).
// Proves the executor's operations (hide/show/replace/override/redirect/metadata), pipeline
// integration through the EXISTING RenderingPort, immutability, and — most importantly — that the
// feature gate is OFF by default and gate-off behaviour is byte-identical to pre-Wave-14.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRenderPlanExecutor, createRenderPlanBuilder, createRenderDecisionAdapter,
  createRenderingPipeline, createRegistries, createExperienceEngine, createFeatureFlagPolicy,
  type EnforcedState, type RenderPlan, type ExperienceContext, type ExperienceResolution,
  type ExperienceRequest, type RenderingPort, type FeatureFlag,
} from '../index';

const builder = createRenderPlanBuilder({ clock: () => 0 });
const adapter = createRenderDecisionAdapter({ clock: () => 0 });
const state = (over: Partial<EnforcedState> = {}): EnforcedState => ({ enabled: [], disabled: [], overrides: {}, replacements: {}, annotations: {}, redirect: null, ...over });
const planFrom = (s: Partial<EnforcedState>): RenderPlan => builder.build(adapter.adapt(state(s)));

const ctx = (): ExperienceContext => ({ tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr', device: 'desktop', platform: 'web', environment: { environment: 'production' }, country: 'SA', segments: [], flags: {}, now: '2026-01-01T00:00:00.000Z' });

// A schema whose node ids match the plan keys.
const schema = () => ({
  id: 'home', channel: 'website', schemaVersion: '1', locales: ['en'], defaultLocale: 'en', nav: [],
  layout: {
    id: 'root', type: 'layout', layout: 'section',
    children: [
      { id: 'hero', type: 'component', componentId: 'hero', props: { title: 'Hi', theme: 'light' } },
      { id: 'legacy', type: 'component', componentId: 'banner', props: { text: 'old' } },
      { id: 'footer', type: 'component', componentId: 'footer', props: { theme: 'light' } },
    ],
  },
  pages: [{ path: '/', title: 'Home', layout: { id: 'p-root', type: 'layout', layout: 'section', children: [{ id: 'legacy', type: 'component', componentId: 'banner', props: { text: 'old' } }] } }],
} as any);

const resolved = (): ExperienceResolution => ({ status: 'resolved', experienceId: 'home', channel: 'website', version: '1', schema: schema(), diagnostics: [] });
const kids = (r: ExperienceResolution) => ((r.schema as any).layout.children as any[]).map(c => c.id);
const nodeById = (r: ExperienceResolution, id: string) => ((r.schema as any).layout.children as any[]).find(c => c.id === id);

// ── executor operations (STEP 2, STEP 7) ────────────────────────────────────────
test('hide removes the matching node from the tree (and from page layouts)', () => {
  const run = createRenderPlanExecutor(planFrom({ disabled: ['legacy'] }), { clock: () => 0 }).execute(resolved(), ctx());
  assert.deepEqual(kids(run.resolution), ['hero', 'footer'], 'legacy removed');
  assert.equal(((run.resolution.schema as any).pages[0].layout.children as any[]).length, 0, 'also removed from the page layout');
  assert.ok(run.applied.some(a => /hide legacy/.test(a)));
});

test('show is a no-op (visible is the default) and is reported as skipped', () => {
  const run = createRenderPlanExecutor(planFrom({ enabled: ['hero'] }), { clock: () => 0 }).execute(resolved(), ctx());
  assert.deepEqual(kids(run.resolution), ['hero', 'legacy', 'footer']);
  assert.ok(run.skipped.some(s => /show flag:hero.*no-op/.test(s)));
});

test('replace swaps the matched component node props', () => {
  const run = createRenderPlanExecutor(planFrom({ replacements: { hero: { title: 'NEW' } } }), { clock: () => 0 }).execute(resolved(), ctx());
  assert.deepEqual(nodeById(run.resolution, 'hero').props, { title: 'NEW' });
  assert.ok(run.applied.some(a => /replace hero/.test(a)));
});

test('override rewrites only props that already exist — it never invents one', () => {
  const run = createRenderPlanExecutor(planFrom({ overrides: { theme: 'dark', nonexistent: 'x' } }), { clock: () => 0 }).execute(resolved(), ctx());
  assert.equal(nodeById(run.resolution, 'hero').props.theme, 'dark');
  assert.equal(nodeById(run.resolution, 'footer').props.theme, 'dark');
  assert.equal('nonexistent' in nodeById(run.resolution, 'legacy').props, false, 'no new prop invented');
  assert.ok(run.applied.some(a => /override ×2/.test(a)));
});

test('redirect short-circuits and reports the target', () => {
  const run = createRenderPlanExecutor(planFrom({ redirect: '/go' }), { clock: () => 0 }).execute(resolved(), ctx());
  assert.equal(run.redirect, '/go');
  assert.ok(run.applied.some(a => /redirect/.test(a)));
});

test('metadata (annotations) is reported as diagnostics, never rendered into the tree', () => {
  const run = createRenderPlanExecutor(planFrom({ annotations: { exp: 'a' } }), { clock: () => 0 }).execute(resolved(), ctx());
  assert.ok(run.diagnostics.some(d => /metadata: exp/.test(d)));
  assert.deepEqual(kids(run.resolution), ['hero', 'legacy', 'footer'], 'tree untouched by metadata');
});

test('an operation with no matching node is skipped, not silently dropped', () => {
  const run = createRenderPlanExecutor(planFrom({ disabled: ['does-not-exist'] }), { clock: () => 0 }).execute(resolved(), ctx());
  assert.ok(run.skipped.some(s => /hide does-not-exist: no matching node/.test(s)));
});

// ── immutability ─────────────────────────────────────────────────────────────────
test('the input resolution and schema are never mutated (clone-on-write)', () => {
  const input = resolved();
  const before = JSON.stringify(input);
  const run = createRenderPlanExecutor(planFrom({ disabled: ['legacy'], overrides: { theme: 'dark' } }), { clock: () => 0 }).execute(input, ctx());
  assert.equal(JSON.stringify(input), before, 'input untouched');
  assert.notEqual(run.resolution, input, 'a new resolution is returned');
});

test('an empty plan returns the SAME resolution reference (zero-copy no-op)', () => {
  const input = resolved();
  const run = createRenderPlanExecutor(planFrom({}), { clock: () => 0 }).execute(input, ctx());
  assert.equal(run.resolution, input, 'no transformation → same object');
  assert.deepEqual(run.applied, []);
});

// ── pipeline integration through the EXISTING port (STEP 3, STEP 4) ─────────────
const buildPipeline = () => {
  const regs = createRegistries();
  regs.renderers.register('r', { id: 'r', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string' });
  const pipeline = createRenderingPipeline(regs.renderers);
  // The port is a normal RenderingPort — it receives a resolution, never a plan.
  const port: RenderingPort<string> = { target: 'html-string', render: (r) => ((r.schema as any).layout.children as any[]).map(c => c.id).join(',') };
  pipeline.registerPort(port);
  return pipeline;
};

test('GATE OFF: the pipeline ignores the plan entirely (identical to pre-Wave-14)', () => {
  const pipeline = buildPipeline();
  const executor = createRenderPlanExecutor(planFrom({ disabled: ['legacy'] }), { clock: () => 0 });

  const baseline = pipeline.render(resolved(), ctx(), { clock: () => 0 });
  const gateOffNoOpts = pipeline.render(resolved(), ctx(), { clock: () => 0 });
  const gateOffWithExecutor = pipeline.render(resolved(), ctx(), { clock: () => 0, planExecutor: executor }); // executePlan omitted

  assert.equal(baseline.output, 'hero,legacy,footer');
  assert.equal(gateOffNoOpts.output, baseline.output);
  assert.equal(gateOffWithExecutor.output, baseline.output, 'an executor alone does NOT enable execution');
  assert.deepEqual(gateOffWithExecutor.diagnostics, baseline.diagnostics, 'no plan diagnostics leak when gated off');
});

test('GATE ON: the plan is executed and the port renders the transformed resolution', () => {
  const pipeline = buildPipeline();
  const executor = createRenderPlanExecutor(planFrom({ disabled: ['legacy'] }), { clock: () => 0 });
  const res = pipeline.render(resolved(), ctx(), { clock: () => 0, executePlan: true, planExecutor: executor });

  assert.equal(res.status, 'rendered');
  assert.equal(res.output, 'hero,footer', 'the port rendered the plan-transformed tree');
  assert.ok(res.diagnostics.some(d => /plan applied: hide legacy/.test(d)));
  assert.ok(res.diagnostics.some(d => /plan execution/.test(d)));
});

test('GATE ON + redirect: the port is NOT called and status is redirected', () => {
  const regs = createRegistries();
  regs.renderers.register('r', { id: 'r', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string' });
  const pipeline = createRenderingPipeline(regs.renderers);
  let called = false;
  pipeline.registerPort({ target: 'html-string', render: () => { called = true; return 'x'; } } as RenderingPort<string>);

  const res = pipeline.render(resolved(), ctx(), { clock: () => 0, executePlan: true, planExecutor: createRenderPlanExecutor(planFrom({ redirect: '/go' }), { clock: () => 0 }) });
  assert.equal(res.status, 'redirected');
  assert.equal(res.output, null);
  assert.equal(called, false, 'the RenderingPort was never invoked');
  assert.ok(res.diagnostics.some(d => /redirected to \/go/.test(d)));
});

test('a throwing plan executor never breaks rendering (falls back to the untransformed resolution)', () => {
  const pipeline = buildPipeline();
  const boom = { execute() { throw new Error('exec boom'); } } as any;
  const res = pipeline.render(resolved(), ctx(), { clock: () => 0, executePlan: true, planExecutor: boom });
  assert.equal(res.status, 'rendered');
  assert.equal(res.output, 'hero,legacy,footer', 'rendered without the plan');
  assert.ok(res.warnings.some(w => /plan execution failed/.test(w)));
});

// ── runtime integration + gate default (STEP 5, STEP 7) ─────────────────────────
const req = (): ExperienceRequest => ({ experienceId: 'home', context: ctx() });
const flag = (id: string): FeatureFlag => ({ metadata: { id, name: id, version: '1', priority: 0 }, enabled: true });
const engineWith = () => {
  const engine = createExperienceEngine({ services: { experience: { async resolve() { return resolved(); } } } });
  engine.registries.renderers.register('r', { id: 'r', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string' });
  engine.pipeline.registerPort({ target: 'html-string', render: (r) => ((r.schema as any).layout.children as any[]).map((c: any) => c.id).join(',') } as RenderingPort<string>);
  // a flag whose key matches the 'legacy' node, disabled → hidden
  engine.flags.register({ ...flag('legacy'), enabled: true, default: { enabled: false } } as FeatureFlag);
  engine.policies.register(createFeatureFlagPolicy(engine.flags));
  return engine;
};

test('RUNTIME GATE IS OFF BY DEFAULT: execute() renders exactly as before', async () => {
  const exec = await engineWith().execute(req());
  assert.equal(exec.response.renderingResult?.output, 'hero,legacy,footer', 'plan exists but is not executed');
  assert.ok(exec.renderPlan!.hidden.includes('flag:legacy'), 'the plan did mark it hidden');
  assert.ok(exec.diagnostics.some(d => /render-plan execution: OFF/.test(d.message)), 'the gate reports itself as off');
});

test('RUNTIME GATE ON: executeRenderPlan applies the plan through the pipeline', async () => {
  const exec = await engineWith().execute(req(), { executeRenderPlan: true });
  assert.equal(exec.response.renderingResult?.output, 'hero,footer', 'the hidden node was removed before rendering');
  assert.equal(exec.response.renderingResult?.status, 'rendered');
  assert.ok(exec.diagnostics.some(d => /render-plan execution: ON/.test(d.message)));
});
