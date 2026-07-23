// Experience Engine · Experiment Engine tests (Wave 17).
// Proves deterministic/stable allocation, A/B + multi-variant splits, traffic gating, scope,
// exposure de-duplication, CTR/conversion metrics, the conservative winner heuristic, and the
// integration through the EXISTING decision pipeline (policy → enforcement → plan).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createExperimentRegistry, createExperimentTracker, createExperimentPolicy,
  allocateVariant, experimentBucket, experimentInScope, decideWinner,
  createExperienceEngine,
  type Experiment, type PolicyContext, type VariantStats,
  type ExperienceContext, type ExperienceRequest, type RenderingPort,
} from '../index';

const ab = (over: Partial<Experiment> = {}): Experiment => ({
  metadata: { id: 'exp.hero', name: 'Hero copy', version: '1.0.0' },
  status: 'running',
  variants: [{ key: 'A', weight: 50, control: true }, { key: 'B', weight: 50 }],
  allocation: { unit: 'visitor' },
  ...over,
});
const pctx = (over: Partial<PolicyContext> = {}): PolicyContext => ({ tenantId: 't1', channel: 'website', environment: 'production', experienceId: '/', ...over });

// ── STEP 2 · deterministic, stable allocation ───────────────────────────────────
test('bucketing is deterministic and salt-sensitive', () => {
  assert.equal(experimentBucket('u1'), experimentBucket('u1'), 'same input → same bucket');
  assert.notEqual(experimentBucket('u1'), experimentBucket('u2'));
  assert.notEqual(experimentBucket('u1', 's1'), experimentBucket('u1', 's2'), 'salt re-randomises');
  for (const u of ['u1', 'u2', 'u3']) {
    const b = experimentBucket(u);
    assert.ok(b >= 0 && b < 10000);
  }
});

test('a unit always gets the SAME variant across repeated allocations', () => {
  const exp = ab();
  const first = allocateVariant(exp, 'visitor-42').variant;
  for (let i = 0; i < 50; i++) assert.equal(allocateVariant(exp, 'visitor-42').variant, first);
});

test('allocation spreads roughly evenly across a 50/50 split', () => {
  const exp = ab();
  let a = 0, b = 0;
  for (let i = 0; i < 4000; i++) (allocateVariant(exp, `u${i}`).variant === 'A' ? a++ : b++);
  const share = a / (a + b);
  assert.ok(share > 0.45 && share < 0.55, `expected ~50/50, got ${(share * 100).toFixed(1)}% A`);
});

test('raising traffic admits new units WITHOUT reshuffling existing assignments', () => {
  const at20 = ab({ allocation: { unit: 'visitor', traffic: 20 } });
  const at60 = ab({ allocation: { unit: 'visitor', traffic: 60 } });
  let checked = 0;
  for (let i = 0; i < 500; i++) {
    const before = allocateVariant(at20, `u${i}`);
    if (before.variant === null) continue;
    const after = allocateVariant(at60, `u${i}`);
    assert.equal(after.variant, before.variant, 'a unit already in the test keeps its variant');
    checked++;
  }
  assert.ok(checked > 20, 'sanity: some units were in at 20%');
});

// ── STEP 3 · variants ────────────────────────────────────────────────────────────
test('A/B assigns only the declared keys and marks the control arm', () => {
  const exp = ab();
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const a = allocateVariant(exp, `u${i}`);
    seen.add(a.variant!);
    if (a.variant === 'A') assert.equal(a.control, true);
  }
  assert.deepEqual([...seen].sort(), ['A', 'B']);
});

test('multi-variant splits by weight and carries the variant value', () => {
  const exp = ab({ variants: [
    { key: 'A', weight: 1, control: true }, { key: 'B', weight: 1, value: { copy: 'b' } }, { key: 'C', weight: 2 },
  ] });
  const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
  for (let i = 0; i < 4000; i++) counts[allocateVariant(exp, `u${i}`).variant!]++;
  assert.ok(counts.C > counts.A * 1.6, 'the double-weighted arm gets ~2x the traffic');
  const bUnit = Array.from({ length: 500 }, (_, i) => `u${i}`).find(u => allocateVariant(exp, u).variant === 'B')!;
  assert.deepEqual(allocateVariant(exp, bUnit).value, { copy: 'b' });
});

test('non-running, empty and zero-weight experiments allocate nobody', () => {
  assert.equal(allocateVariant(ab({ status: 'paused' }), 'u1').reason, 'not-running');
  assert.equal(allocateVariant(ab({ status: 'draft' }), 'u1').variant, null);
  assert.equal(allocateVariant(ab({ variants: [] }), 'u1').reason, 'no-variants');
  assert.equal(allocateVariant(ab({ variants: [{ key: 'A', weight: 0 }] }), 'u1').reason, 'invalid-weights');
  assert.equal(allocateVariant(ab({ allocation: { unit: 'visitor', traffic: 0 } }), 'u1').reason, 'out-of-traffic');
});

test('scope restricts an experiment to audiences / experiences / channels', () => {
  const exp = ab({ scope: { audiences: ['vip'], experiences: ['/'] } });
  assert.equal(experimentInScope(exp, pctx({ audiences: ['vip'] })), true);
  assert.equal(experimentInScope(exp, pctx({ audiences: ['guest'] })), false);
  assert.equal(experimentInScope(exp, pctx({ audiences: ['vip'], experienceId: '/pricing' })), false);
  assert.equal(experimentInScope(ab(), pctx()), true, 'no scope → everywhere');
});

// ── STEP 4 · exposure ────────────────────────────────────────────────────────────
test('exposure is recorded once per unit — re-renders do not inflate it', () => {
  const t = createExperimentTracker();
  t.exposure('e1', 'A', 'u1');
  t.exposure('e1', 'A', 'u1');
  t.exposure('e1', 'A', 'u1');
  t.exposure('e1', 'B', 'u2');
  const r = t.report('e1');
  assert.equal(r.totals.exposures, 2, 'two units, not four events');
  assert.equal(t.exposures().length, 2);
});

test('clicks, conversions and completions are tracked per variant', () => {
  const t = createExperimentTracker();
  t.exposure('e1', 'A', 'u1'); t.click('e1', 'A', 'u1'); t.conversion('e1', 'A', 'u1', 'signup', 1); t.completion('e1', 'A', 'u1');
  const a = t.report('e1').variants.find(v => v.variant === 'A')!;
  assert.equal(a.exposures, 1);
  assert.equal(a.clicks, 1);
  assert.equal(a.conversions, 1);
  assert.equal(a.completions, 1);
  assert.equal(t.conversions()[0].metric, 'signup');
});

test('the tracker forwards events to an injected sink', () => {
  const seen: string[] = [];
  const t = createExperimentTracker({ onEvent: (e) => seen.push(e) });
  t.exposure('e1', 'A', 'u1'); t.click('e1', 'A', 'u1'); t.conversion('e1', 'A', 'u1'); t.completion('e1', 'A', 'u1');
  assert.deepEqual(seen, ['exposure', 'click', 'conversion', 'completion']);
});

// ── STEP 5 · metrics ─────────────────────────────────────────────────────────────
test('CTR and conversion rates are computed per variant', () => {
  const t = createExperimentTracker();
  for (let i = 0; i < 10; i++) t.exposure('e1', 'A', `a${i}`);
  for (let i = 0; i < 4; i++) t.click('e1', 'A', `a${i}`);
  for (let i = 0; i < 2; i++) t.conversion('e1', 'A', `a${i}`);
  const a = t.report('e1').variants[0];
  assert.equal(a.ctr, 0.4);
  assert.equal(a.conversionRate, 0.2);
});

test('WINNER · refuses to call a winner on thin data', () => {
  const thin: VariantStats[] = [
    { variant: 'B', exposures: 5, clicks: 3, conversions: 3, completions: 0, ctr: 0.6, conversionRate: 0.6, completionRate: 0 },
    { variant: 'A', exposures: 5, clicks: 1, conversions: 1, completions: 0, ctr: 0.2, conversionRate: 0.2, completionRate: 0 },
  ];
  const w = decideWinner(thin);
  assert.equal(w.confident, false);
  assert.equal(w.variant, null);
  assert.match(w.reason, /insufficient exposures/);
});

test('WINNER · refuses to call a winner on a narrow margin', () => {
  const narrow: VariantStats[] = [
    { variant: 'B', exposures: 1000, clicks: 0, conversions: 102, completions: 0, ctr: 0, conversionRate: 0.102, completionRate: 0 },
    { variant: 'A', exposures: 1000, clicks: 0, conversions: 100, completions: 0, ctr: 0, conversionRate: 0.100, completionRate: 0 },
  ];
  const w = decideWinner(narrow);
  assert.equal(w.confident, false);
  assert.match(w.reason, /no separation/);
});

test('WINNER · calls a clear, well-powered winner and reports the lift', () => {
  const clear: VariantStats[] = [
    { variant: 'B', exposures: 1000, clicks: 0, conversions: 150, completions: 0, ctr: 0, conversionRate: 0.15, completionRate: 0 },
    { variant: 'A', exposures: 1000, clicks: 0, conversions: 100, completions: 0, ctr: 0, conversionRate: 0.10, completionRate: 0 },
  ];
  const w = decideWinner(clear);
  assert.equal(w.confident, true);
  assert.equal(w.variant, 'B');
  assert.ok(Math.abs((w.lift ?? 0) - 0.5) < 1e-9, '50% relative lift');
});

test('WINNER · a full report end-to-end picks the better arm', () => {
  const t = createExperimentTracker();
  for (let i = 0; i < 200; i++) { t.exposure('e1', 'A', `a${i}`); if (i < 20) t.conversion('e1', 'A', `a${i}`); }
  for (let i = 0; i < 200; i++) { t.exposure('e1', 'B', `b${i}`); if (i < 60) t.conversion('e1', 'B', `b${i}`); }
  const r = t.report('e1');
  assert.equal(r.totals.exposures, 400);
  assert.equal(r.winner.variant, 'B');
  assert.equal(r.winner.confident, true);
});

// ── STEP 6 · the EXISTING decision pipeline (no runtime change) ─────────────────
const ectx = (): ExperienceContext => ({ tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr', device: 'desktop', platform: 'web', environment: { environment: 'production' }, segments: [], flags: {}, now: '2026-01-01T00:00:00.000Z' });
const req = (): ExperienceRequest => ({ experienceId: 'home', context: ectx() });
const schema = () => ({ id: 'home', channel: 'website', schemaVersion: '1', locales: ['en'], defaultLocale: 'en', nav: [], pages: [], layout: { id: 'root', type: 'layout', layout: 'section', children: [] } } as any);

test('the ExperimentPolicy assigns a variant through the existing policy stage', async () => {
  const registry = createExperimentRegistry();
  registry.register(ab({ metadata: { id: 'exp.hero', name: 'Hero', version: '1' } }));
  const tracker = createExperimentTracker();

  const engine = createExperienceEngine({ services: { experience: { async resolve(r) { return { status: 'resolved', experienceId: r.experienceId, channel: 'website', version: '1', schema: schema(), diagnostics: [] }; } } } });
  engine.registries.renderers.register('r', { id: 'r', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string' });
  engine.pipeline.registerPort({ target: 'html-string', render: () => '<html/>' } as RenderingPort<string>);
  engine.policies.register(createExperimentPolicy(registry, { tracker }));

  const exec = await engine.execute(req());

  const variant = exec.policy?.decision.directives['experiment.exp.hero'];
  assert.ok(variant === 'A' || variant === 'B', 'a variant reached the effective decision');
  assert.equal(exec.policy?.matched.includes('policy.experiments'), true);
  assert.equal(tracker.report('exp.hero').totals.exposures, 1, 'exposure recorded once for the unit');
  assert.equal(exec.response.renderingResult?.status, 'rendered', 'rendering is unaffected');
});

test('the same request always yields the same variant (stable across executions)', async () => {
  const registry = createExperimentRegistry();
  registry.register(ab());
  const engine = createExperienceEngine({ services: { experience: { async resolve(r) { return { status: 'resolved', experienceId: r.experienceId, channel: 'website', version: '1', schema: schema(), diagnostics: [] }; } } } });
  engine.policies.register(createExperimentPolicy(registry));

  const a = await engine.execute(req());
  const b = await engine.execute(req());
  assert.equal(a.policy?.decision.directives['experiment.exp.hero'], b.policy?.decision.directives['experiment.exp.hero']);
});

test('a paused experiment emits no directive and records no exposure', async () => {
  const registry = createExperimentRegistry();
  registry.register(ab({ status: 'running' }));
  const tracker = createExperimentTracker();
  const engine = createExperienceEngine({ services: { experience: { async resolve(r) { return { status: 'resolved', experienceId: r.experienceId, channel: 'website', version: '1', schema: schema(), diagnostics: [] }; } } } });
  engine.policies.register(createExperimentPolicy(registry, { tracker }));

  registry.setStatus('exp.hero', 'paused');
  const exec = await engine.execute(req());
  assert.equal(exec.policy?.decision.directives['experiment.exp.hero'], undefined);
  assert.equal(tracker.report('exp.hero').totals.exposures, 0);
});

test('a custom resolveUnit gives visitor-level allocation instead of the coarse default', () => {
  const registry = createExperimentRegistry();
  registry.register(ab());
  const seen = new Set<string>();
  for (const visitor of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) {
    const policy = createExperimentPolicy(registry, { resolveUnit: () => visitor });
    const r = policy.evaluate(pctx()) as any;
    seen.add(r.directives[0].value);
  }
  assert.equal(seen.size, 2, 'different visitors land in different variants');
});
