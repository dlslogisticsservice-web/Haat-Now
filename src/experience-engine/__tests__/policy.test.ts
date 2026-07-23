// Experience Engine · Policy Engine tests (Wave 7).
// Proves registration, priority ordering, scope matching, deterministic conflict resolution,
// the effective decision, diagnostics/events, and the Runtime policy-stage integration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPolicyRegistry, createPolicyEvaluator, policyMatchesScope, toPolicyContext,
  createExperienceEngine, EXECUTION_STAGES,
  type Policy, type PolicyContext, type PolicyResult, type PolicyHealth, type PolicyEvent,
  type PolicyScope, type ExperienceContext, type ExperienceRequest, type RenderingPort,
} from '../index';

// A stub policy: fixed metadata + scope + a canned result, tunable health.
const stub = (id: string, over: {
  type?: string; priority?: number; scope?: PolicyScope; result?: PolicyResult; health?: () => PolicyHealth; applies?: (c: PolicyContext) => boolean; evaluate?: (c: PolicyContext) => PolicyResult | Promise<PolicyResult>;
} = {}): Policy => ({
  metadata: { id, name: id, type: (over.type ?? 'configuration') as any, version: '1.0.0', priority: over.priority ?? 0, scope: over.scope },
  applies: over.applies ?? ((c: PolicyContext) => policyMatchesScope(over.scope, c)),
  evaluate: over.evaluate ?? (() => over.result ?? { effect: 'noop' }),
  health: over.health ?? (() => ({ status: 'healthy' })),
});

const pctx = (over: Partial<PolicyContext> = {}): PolicyContext => ({ tenantId: 't1', channel: 'website', environment: 'production', role: 'guest', locale: 'en', ...over });

// ── registration + lookup (STEP 8) ──────────────────────────────────────────────
test('registry registers, looks up, lists by type, and unregisters', () => {
  const reg = createPolicyRegistry();
  const p = stub('cfg.a', { type: 'configuration' });
  reg.register(p);
  assert.equal(reg.has('cfg.a'), true);
  assert.equal(reg.get('cfg.a'), p);
  assert.equal(reg.size(), 1);
  assert.deepEqual(reg.byType('configuration').map(x => x.metadata.id), ['cfg.a']);
  reg.unregister('cfg.a');
  assert.equal(reg.has('cfg.a'), false);
});

// ── priority ordering (STEP 8) ──────────────────────────────────────────────────
test('matching() returns usable, in-scope policies sorted by priority desc', () => {
  const reg = createPolicyRegistry();
  reg.register(stub('low', { priority: 1 }));
  reg.register(stub('high', { priority: 10 }));
  reg.register(stub('mid', { priority: 5 }));
  assert.deepEqual(reg.matching(pctx()).map(p => p.metadata.id), ['high', 'mid', 'low']);
  assert.equal(reg.resolve(pctx())?.metadata.id, 'high');
});

// ── scope matching (STEP 8) ─────────────────────────────────────────────────────
test('policyMatchesScope filters by channel, environment, role, tenant, locale, segments', () => {
  assert.equal(policyMatchesScope(undefined, pctx()), true, 'no scope = always applies');
  assert.equal(policyMatchesScope({ channels: ['website'] }, pctx()), true);
  assert.equal(policyMatchesScope({ channels: ['customer'] }, pctx()), false);
  assert.equal(policyMatchesScope({ environments: ['staging'] }, pctx()), false);
  assert.equal(policyMatchesScope({ roles: ['guest'] }, pctx({ role: 'guest' })), true);
  assert.equal(policyMatchesScope({ tenants: ['t2'] }, pctx()), false);
  assert.equal(policyMatchesScope({ segments: ['vip'] }, pctx({ segments: ['vip', 'beta'] })), true);
  assert.equal(policyMatchesScope({ segments: ['vip'] }, pctx({ segments: ['beta'] })), false);
});

test('out-of-scope policies are ignored in the effective set', async () => {
  const reg = createPolicyRegistry();
  reg.register(stub('website-only', { scope: { channels: ['website'] }, result: { effect: 'allow' } }));
  reg.register(stub('customer-only', { scope: { channels: ['customer'] }, result: { effect: 'deny' } }));
  const outcome = await createPolicyEvaluator().resolveEffectivePolicy(reg, pctx({ channel: 'website' }));
  assert.deepEqual(outcome.matched, ['website-only']);
  assert.deepEqual(outcome.ignored, ['customer-only']);
  assert.equal(outcome.decision.effect, 'allow');
});

// ── conflict resolution + effective decision (STEP 8) ───────────────────────────
test('merge is deterministic: higher priority wins a directive; the clash is a recorded conflict', async () => {
  const reg = createPolicyRegistry();
  reg.register(stub('hi', { priority: 10, result: { effect: 'override', directives: [{ key: 'theme', value: 'dark' }] } }));
  reg.register(stub('lo', { priority: 1, result: { effect: 'annotate', directives: [{ key: 'theme', value: 'light' }, { key: 'banner', value: 'on' }] } }));
  const outcome = await createPolicyEvaluator().resolveEffectivePolicy(reg, pctx());

  assert.equal(outcome.decision.directives.theme, 'dark', 'higher priority wins');
  assert.equal(outcome.decision.directives.banner, 'on', 'non-conflicting directive still merges');
  assert.equal(outcome.decision.effect, 'override', 'strongest effect among matches');
  assert.equal(outcome.decision.conflicts.length, 1);
  assert.deepEqual(outcome.decision.conflicts[0], { key: 'theme', winner: 'hi', loser: 'lo', winningValue: 'dark', losingValue: 'light' });
  assert.deepEqual(outcome.decision.contributors.sort(), ['hi', 'lo']);
});

test('deny is the strongest effect regardless of order', async () => {
  const reg = createPolicyRegistry();
  reg.register(stub('allow', { priority: 100, result: { effect: 'allow' } }));
  reg.register(stub('deny', { priority: 1, result: { effect: 'deny' } }));
  const outcome = await createPolicyEvaluator().resolveEffectivePolicy(reg, pctx());
  assert.equal(outcome.decision.effect, 'deny');
});

// ── health filtering (STEP 8) ───────────────────────────────────────────────────
test('offline/unsupported policies are skipped; degraded still evaluates', async () => {
  const reg = createPolicyRegistry();
  reg.register(stub('offline', { priority: 100, health: () => ({ status: 'offline' }), result: { effect: 'deny' } }));
  reg.register(stub('degraded', { priority: 5, health: () => ({ status: 'degraded' }), result: { effect: 'allow' } }));
  const outcome = await createPolicyEvaluator().resolveEffectivePolicy(reg, pctx());
  assert.deepEqual(outcome.matched, ['degraded']);
  assert.ok(outcome.ignored.includes('offline'));
  assert.equal(outcome.decision.effect, 'allow');
});

// ── graceful failure ─────────────────────────────────────────────────────────────
test('a throwing policy is captured, not thrown; other policies still decide', async () => {
  const reg = createPolicyRegistry();
  reg.register(stub('boom', { priority: 10, evaluate: () => { throw new Error('policy boom'); } }));
  reg.register(stub('ok', { priority: 1, result: { effect: 'allow' } }));
  const outcome = await createPolicyEvaluator().resolveEffectivePolicy(reg, pctx());
  assert.equal(outcome.decision.effect, 'allow', 'the failed policy does not contribute');
  assert.ok(outcome.evaluations.find(e => e.policyId === 'boom')?.error);
});

// ── diagnostics + events (STEP 6, STEP 7) ───────────────────────────────────────
test('evaluation exposes the decision trace and emits matched/skipped/evaluated/conflict events', async () => {
  const reg = createPolicyRegistry();
  reg.register(stub('hi', { priority: 10, result: { effect: 'override', directives: [{ key: 'k', value: 1 }] } }));
  reg.register(stub('lo', { priority: 1, result: { effect: 'allow', directives: [{ key: 'k', value: 2 }] } }));
  reg.register(stub('off-scope', { scope: { channels: ['customer'] }, result: { effect: 'deny' } }));

  const events: PolicyEvent[] = [];
  const outcome = await createPolicyEvaluator({ onEvent: (e) => events.push(e) }).resolveEffectivePolicy(reg, pctx({ channel: 'website' }));

  // decision trace: one evaluation per matched policy, with priority + timing
  assert.equal(outcome.evaluations.length, 2);
  assert.ok(outcome.evaluations.every(e => typeof e.evaluationMs === 'number' && e.priority >= 0));
  assert.deepEqual(outcome.matched, ['hi', 'lo']);
  assert.deepEqual(outcome.ignored, ['off-scope']);
  // events fired
  const types = events.map(e => e.type);
  assert.ok(types.includes('policy.matched'));
  assert.ok(types.includes('policy.skipped'));
  assert.ok(types.includes('policy.evaluated'));
  assert.ok(types.includes('policy.conflict'));
});

test('toPolicyContext maps an ExperienceContext identity faithfully', () => {
  const ec: ExperienceContext = { tenantId: 't1', channel: 'website', role: 'customer', locale: 'ar', direction: 'rtl', device: 'mobile', platform: 'web', environment: { environment: 'staging' }, country: 'SA', segments: ['vip'], flags: { beta: true }, now: '2026-01-01T00:00:00.000Z' };
  const pc = toPolicyContext(ec, { experienceId: 'home', preview: true });
  assert.equal(pc.tenantId, 't1');
  assert.equal(pc.environment, 'staging');
  assert.equal(pc.role, 'customer');
  assert.equal(pc.country, 'SA');
  assert.equal(pc.experienceId, 'home');
  assert.equal(pc.preview, true);
  assert.deepEqual(pc.segments, ['vip']);
});

// ── Runtime integration (STEP 5) ────────────────────────────────────────────────
const ctx = (): ExperienceContext => ({ tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr', device: 'desktop', platform: 'web', environment: { environment: 'production' }, flags: {}, now: '2026-01-01T00:00:00.000Z' });
const schema = () => ({ id: 'home', channel: 'website', schemaVersion: '1', layout: { id: 'r', type: 'layout', layout: 'section', children: [] }, locales: ['en'], defaultLocale: 'en', pages: [], nav: [] } as any);
const buildEngine = () => {
  const engine = createExperienceEngine({ services: { experience: { async resolve(r) { return { status: 'resolved', experienceId: r.experienceId, channel: 'website', version: '3', schema: schema(), diagnostics: [] }; } } } });
  engine.registries.renderers.register('r', { id: 'r', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string' });
  engine.pipeline.registerPort({ target: 'html-string', render: () => '<html>ok</html>' } as RenderingPort<string>);
  return engine;
};
const req = (): ExperienceRequest => ({ experienceId: 'home', context: ctx() });

test('the runtime runs a policy stage; it is a no-op when no policies are registered', async () => {
  const engine = buildEngine();
  const exec = await engine.execute(req());
  assert.ok(EXECUTION_STAGES.includes('policy'), "'policy' is a runtime stage");
  assert.ok(exec.stages.includes('policy'));
  assert.equal(exec.ok, true);
  assert.equal(exec.policy?.decision.effect, 'noop', 'empty registry → no-op decision');
  assert.equal(exec.response.renderingResult?.status, 'rendered', 'resolution/rendering unaffected');
});

test('a registered policy is evaluated by the runtime stage and surfaces in the execution', async () => {
  const engine = buildEngine();
  engine.policies.register(stub('runtime.override', { priority: 5, result: { effect: 'override', directives: [{ key: 'maintenance', value: false }] } }));
  const events: PolicyEvent[] = [];
  const exec = await engine.execute(req(), { onPolicyEvent: (e) => events.push(e) });

  assert.equal(exec.policy?.decision.effect, 'override');
  assert.equal(exec.policy?.decision.directives.maintenance, false);
  assert.deepEqual(exec.policy?.matched, ['runtime.override']);
  assert.ok(events.some(e => e.type === 'policy.evaluated' && e.policyId === 'runtime.override'));
  assert.ok(exec.diagnostics.some(d => d.stage === 'policy' && /1 matched/.test(d.message)));
});
