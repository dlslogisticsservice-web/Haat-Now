// Experience Engine · Render Decision Adapter tests (Wave 12).
// Proves instruction generation from EnforcedState, adapter correctness, no-op behaviour,
// ignored (vacuous) entries, events, and — critically — that renderer behaviour is UNCHANGED.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRenderDecisionAdapter, createExperienceEngine, createFeatureFlagPolicy,
  type EnforcedState, type RenderInstructionEvent, type FeatureFlag,
  type ExperienceContext, type ExperienceRequest, type RenderingPort,
} from '../index';

const state = (over: Partial<EnforcedState> = {}): EnforcedState => ({
  enabled: [], disabled: [], overrides: {}, replacements: {}, annotations: {}, redirect: null, ...over,
});
const adapter = createRenderDecisionAdapter({ clock: () => 0 });

// ── instruction generation (STEP 8) ─────────────────────────────────────────────
test('every EnforcedState field maps to its instruction type', () => {
  const set = adapter.adapt(state({
    disabled: ['legacy'], enabled: ['beta'],
    overrides: { theme: 'dark' }, replacements: { hero: { t: 1 } },
    annotations: { exp: 'x' }, redirect: '/go',
  }));

  const byType = (t: string) => set.instructions.filter(i => i.type === t);
  assert.equal(byType('hide')[0].target.key, 'legacy');
  assert.equal(byType('show')[0].target.key, 'beta');
  assert.equal(byType('override')[0].target.key, 'theme');
  assert.equal(byType('override')[0].value, 'dark');
  assert.deepEqual(byType('replace')[0].value, { t: 1 });
  assert.equal(byType('annotate')[0].target.key, 'exp');
  assert.equal(byType('redirect')[0].value, '/go');
  assert.equal(set.produced, 6);
  assert.equal(set.redirect, '/go', 'redirect surfaced on the set');
});

test('instructions carry unique ids and a source tag', () => {
  const set = adapter.adapt(state({ disabled: ['a', 'b'], overrides: { k: 1 } }));
  const ids = set.instructions.map(i => i.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  assert.ok(set.instructions.every(i => i.source.startsWith('enforced-state.')));
});

test('target types are renderer-agnostic (no renderer concepts leak in)', () => {
  const set = adapter.adapt(state({ disabled: ['f'], replacements: { hero: 1 }, overrides: { c: 2 }, annotations: { a: 3 }, redirect: '/r' }));
  const types = set.instructions.map(i => i.target.type).sort();
  assert.deepEqual(types, ['annotation', 'configuration', 'flag', 'route', 'section']);
});

// ── no-op behaviour (STEP 8) ────────────────────────────────────────────────────
test('an empty EnforcedState produces no instructions (no-op)', () => {
  const set = adapter.adapt(state());
  assert.equal(set.produced, 0);
  assert.deepEqual(set.instructions, []);
  assert.equal(set.redirect, null);
  assert.deepEqual(set.ignored, []);
});

// ── ignored / diagnostics (STEP 6) ──────────────────────────────────────────────
test('a vacuous redirect is ignored, not turned into an instruction', () => {
  const set = adapter.adapt(state({ redirect: '' }));
  assert.equal(set.produced, 0);
  assert.equal(set.redirect, null);
  assert.equal(set.ignored.length, 1);
  assert.match(set.ignored[0].reason, /empty redirect/);
});

test('the set reports produced count, ignored list and execution time', () => {
  const set = adapter.adapt(state({ enabled: ['a'], redirect: '' }));
  assert.equal(set.produced, 1);
  assert.equal(set.ignored.length, 1);
  assert.ok(typeof set.executionMs === 'number');
});

// ── events (STEP 7) ──────────────────────────────────────────────────────────────
test('emits instruction.created and instruction.ignored', () => {
  const events: RenderInstructionEvent[] = [];
  adapter.adapt(state({ enabled: ['a'], redirect: '' }), { onEvent: (e) => events.push(e) });
  const types = events.map(e => e.type);
  assert.ok(types.includes('instruction.created'));
  assert.ok(types.includes('instruction.ignored'));
});

// ── adaptMany (STEP 2) ───────────────────────────────────────────────────────────
test('adaptMany adapts each state independently', () => {
  const sets = adapter.adaptMany([state({ enabled: ['a'] }), state({ disabled: ['b'] }), state()]);
  assert.equal(sets.length, 3);
  assert.equal(sets[0].instructions[0].type, 'show');
  assert.equal(sets[1].instructions[0].type, 'hide');
  assert.equal(sets[2].produced, 0);
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

test('the runtime surfaces render instructions produced from the enforced state', async () => {
  const engine = renderableEngine();
  engine.flags.register(flag('beta-ui'));
  engine.policies.register(createFeatureFlagPolicy(engine.flags));

  const events: RenderInstructionEvent[] = [];
  const exec = await engine.execute(req(), { onInstructionEvent: (e) => events.push(e) });

  assert.ok(exec.renderInstructions, 'instruction set surfaced on the execution');
  assert.ok(exec.renderInstructions!.instructions.some(i => i.type === 'show' && i.target.key === 'beta-ui'),
    'the enabled flag became a show instruction');
  assert.ok(exec.diagnostics.some(d => d.stage === 'enforcement' && /render-adapter/.test(d.message)));
  assert.ok(events.some(e => e.type === 'instruction.created'));
});

test('RENDERER BEHAVIOUR IS UNCHANGED: output is identical with and without instructions', async () => {
  const plain = renderableEngine();
  const withDecisions = renderableEngine();
  withDecisions.flags.register(flag('beta-ui'));
  withDecisions.policies.register(createFeatureFlagPolicy(withDecisions.flags));

  const a = await plain.execute(req());
  const b = await withDecisions.execute(req());

  assert.equal(a.response.renderingResult?.status, 'rendered');
  assert.equal(b.response.renderingResult?.status, 'rendered');
  assert.equal(b.response.renderingResult?.output, a.response.renderingResult?.output,
    'instructions are produced but the renderer ignores them — identical output');
  assert.equal(a.renderInstructions?.produced, 0, 'no decisions → no instructions');
  assert.ok((b.renderInstructions?.produced ?? 0) > 0, 'decisions → instructions produced');
});
