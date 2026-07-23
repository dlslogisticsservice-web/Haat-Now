// Experience Engine · Decision Enforcement Engine tests (Wave 11).
// Proves decision resolution from policy + flags, the supported actions, deterministic conflict
// resolution, no-op execution, diagnostics/events, and the Runtime enforcement-stage integration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDecisionResolver, createDecisionEnforcer, createDecisionEnforcement,
  createExperienceEngine, createStaticConfigurationProvider, createFeatureFlagPolicy, EXECUTION_STAGES,
  type Decision, type DecisionEvent, type EffectivePolicyDecision, type EffectiveFlags,
  type FeatureFlag, type ExperienceContext, type ExperienceRequest, type ConfigurationBundle, type RenderingPort,
} from '../index';

const decision = (over: Partial<Decision> = {}): Decision => ({ id: over.id ?? 'd', action: over.action ?? 'annotate', target: over.target ?? { type: 'annotation', key: 'k' }, value: over.value, priority: over.priority ?? 0, source: over.source ?? 'policy', reason: over.reason });

// ── decision resolution from policy + flags (STEP 4, STEP 5) ────────────────────
test('resolver maps policy deny, directives and flags to decisions', () => {
  const policy: EffectivePolicyDecision = { effect: 'deny', directives: { redirect: '/blocked', 'override.theme': 'dark', note: 'hi', 'flag.x': true }, contributors: [], conflicts: [] };
  const flags: EffectiveFlags = { promo: { enabled: true, variant: 'B' }, legacy: { enabled: false } };
  const decisions = createDecisionResolver().resolve({ policy, flags, experienceId: 'home' });

  assert.ok(decisions.some(d => d.action === 'disable' && d.target.type === 'experience'), 'deny → disable experience');
  assert.ok(decisions.some(d => d.action === 'redirect' && d.value === '/blocked'));
  assert.ok(decisions.some(d => d.action === 'override' && d.target.key === 'theme' && d.value === 'dark'));
  assert.ok(decisions.some(d => d.action === 'annotate' && d.target.key === 'note'));
  assert.ok(!decisions.some(d => d.target.key === 'flag.x'), 'flag.* directives are ignored (flags are authoritative)');
  assert.ok(decisions.some(d => d.action === 'enable' && d.target.type === 'flag' && d.target.key === 'promo'));
  assert.ok(decisions.some(d => d.action === 'disable' && d.target.type === 'flag' && d.target.key === 'legacy'));
});

// ── supported actions applied to the enforced state (STEP 3) ────────────────────
test('every supported action is applied to the enforced state', () => {
  const decisions: Decision[] = [
    decision({ id: 'a', action: 'enable', target: { type: 'flag', key: 'f1' }, priority: 5 }),
    decision({ id: 'b', action: 'disable', target: { type: 'flag', key: 'f2' }, priority: 5 }),
    decision({ id: 'c', action: 'override', target: { type: 'configuration', key: 'theme' }, value: 'dark', priority: 5 }),
    decision({ id: 'd', action: 'replace', target: { type: 'section', key: 'hero' }, value: { t: 1 }, priority: 5 }),
    decision({ id: 'e', action: 'annotate', target: { type: 'annotation', key: 'exp' }, value: 'x', priority: 5 }),
    decision({ id: 'f', action: 'redirect', target: { type: 'route' }, value: '/go', priority: 5 }),
  ];
  const out = createDecisionEnforcer({ clock: () => 0 }).applyMany(decisions);
  assert.deepEqual(out.state.enabled, ['f1']);
  assert.deepEqual(out.state.disabled, ['f2']);
  assert.equal(out.state.overrides.theme, 'dark');
  assert.deepEqual(out.state.replacements.hero, { t: 1 });
  assert.equal(out.state.annotations.exp, 'x');
  assert.equal(out.state.redirect, '/go');
  assert.equal(out.applied.length, 6);
});

// ── conflict resolution (STEP 9) ────────────────────────────────────────────────
test('conflicting decisions on one target: higher priority wins, loser is a recorded conflict', () => {
  const decisions: Decision[] = [
    decision({ id: 'win', action: 'enable', target: { type: 'flag', key: 'f' }, priority: 10, source: 'policy' }),
    decision({ id: 'lose', action: 'disable', target: { type: 'flag', key: 'f' }, priority: 1, source: 'feature-flag' }),
  ];
  const out = createDecisionEnforcer({ clock: () => 0 }).applyMany(decisions);
  assert.deepEqual(out.state.enabled, ['f']);
  assert.deepEqual(out.state.disabled, []);
  assert.equal(out.conflicts.length, 1);
  assert.deepEqual(out.conflicts[0], { target: 'flag:f', winner: 'win', loser: 'lose', winningAction: 'enable', losingAction: 'disable' });
  assert.equal(out.applied.length, 1);
  assert.equal(out.skipped.length, 1);
});

test('a redundant decision (same effect) is skipped, not a conflict', () => {
  const decisions: Decision[] = [
    decision({ id: 'a', action: 'enable', target: { type: 'flag', key: 'f' }, priority: 10 }),
    decision({ id: 'b', action: 'enable', target: { type: 'flag', key: 'f' }, priority: 1 }),
  ];
  const out = createDecisionEnforcer({ clock: () => 0 }).applyMany(decisions);
  assert.equal(out.conflicts.length, 0);
  assert.equal(out.skipped.length, 1);
  assert.deepEqual(out.state.enabled, ['f']);
});

// ── no-op execution (STEP 9) ─────────────────────────────────────────────────────
test('no decisions → an empty outcome (no-op)', () => {
  const out = createDecisionEnforcement({ clock: () => 0 }).enforce({});
  assert.equal(out.applied.length, 0);
  assert.equal(out.skipped.length, 0);
  assert.equal(out.conflicts.length, 0);
  assert.equal(out.state.redirect, null);
});

// ── diagnostics + events (STEP 7, STEP 8) ───────────────────────────────────────
test('emits applied / skipped / conflict events', () => {
  const events: DecisionEvent[] = [];
  const decisions: Decision[] = [
    decision({ id: 'win', action: 'enable', target: { type: 'flag', key: 'f' }, priority: 10 }),
    decision({ id: 'lose', action: 'disable', target: { type: 'flag', key: 'f' }, priority: 1 }),
  ];
  createDecisionEnforcer({ clock: () => 0, onEvent: (e) => events.push(e) }).applyMany(decisions);
  const types = events.map(e => e.type);
  assert.ok(types.includes('decision.applied'));
  assert.ok(types.includes('decision.conflict'));
  assert.ok(types.includes('decision.skipped'));
});

// ── Runtime integration (STEP 6) ────────────────────────────────────────────────
const ectx = (over: Partial<ExperienceContext> = {}): ExperienceContext => ({ tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr', device: 'desktop', platform: 'web', environment: { environment: 'production' }, country: 'SA', segments: [], flags: {}, now: '2026-01-01T00:00:00.000Z', ...over });
const req = (over: Partial<ExperienceContext> = {}): ExperienceRequest => ({ experienceId: 'home', context: ectx(over) });
const flag = (id: string, over: Partial<FeatureFlag> = {}): FeatureFlag => ({ metadata: { id, name: id, version: '1', priority: 0 }, enabled: over.enabled ?? true, default: over.default, rules: over.rules });
const schema = () => ({ id: 'home', channel: 'website', schemaVersion: '1', layout: { id: 'r', type: 'layout', layout: 'section', children: [] }, locales: ['en'], defaultLocale: 'en', pages: [], nav: [] } as any);
const renderableEngine = () => {
  const engine = createExperienceEngine({ services: { experience: { async resolve(r) { return { status: 'resolved', experienceId: r.experienceId, channel: 'website', version: '1', schema: schema(), diagnostics: [] }; } } } });
  engine.registries.renderers.register('r', { id: 'r', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string' });
  engine.pipeline.registerPort({ target: 'html-string', render: () => '<html>ok</html>' } as RenderingPort<string>);
  return engine;
};

test("'enforcement' is a runtime stage placed immediately before rendering", () => {
  const i = EXECUTION_STAGES.indexOf('enforcement');
  assert.ok(i > EXECUTION_STAGES.indexOf('policy'), 'after policy');
  assert.equal(EXECUTION_STAGES[i + 1], 'rendering', 'immediately before rendering');
});

test('the runtime enforcement stage applies flag + policy decisions and surfaces the outcome', async () => {
  const engine = renderableEngine();
  engine.flags.register(flag('beta-ui', { enabled: true }));
  engine.policies.register(createFeatureFlagPolicy(engine.flags));

  const events: DecisionEvent[] = [];
  const exec = await engine.execute(req(), { onDecisionEvent: (e) => events.push(e) });

  assert.ok(exec.stages.includes('enforcement'));
  assert.ok(exec.enforcement, 'enforcement outcome surfaced on the execution');
  assert.ok(exec.enforcement!.state.enabled.includes('beta-ui'), 'feature flag enforced as an enable decision');
  assert.ok(exec.diagnostics.some(d => d.stage === 'enforcement' && /applied/.test(d.message)));
  assert.ok(events.some(e => e.type === 'decision.applied'));
  assert.equal(exec.response.renderingResult?.status, 'rendered', 'rendering is unchanged by enforcement');
});

test('the enforcement stage is a no-op when there are no decisions (rendering unaffected)', async () => {
  const engine = createExperienceEngine();
  engine.providers.register(createStaticConfigurationProvider([{ id: 'b', tenantId: 't1', channel: 'website', environment: 'production', version: '1.0.0', config: {}, metadata: { version: '1.0.0', generatedAt: '' } } as ConfigurationBundle]));
  const exec = await engine.execute(req());
  assert.ok(exec.stages.includes('enforcement'));
  assert.equal(exec.enforcement?.applied.length, 0);
  assert.equal(exec.ok, true);
});
