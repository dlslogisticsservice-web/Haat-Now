// Experience Engine · Production Enablement tests (Wave 15).
// Proves the rollout gate (global OFF / tenant / experience / percentage), the canary scoping,
// instant disable + circuit breaker, failure isolation, and the execution metrics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRolloutGate, createRenderPlanMetrics, rolloutBucket, createExperienceEngine, createFeatureFlagPolicy,
  type ExperienceContext, type ExperienceRequest, type RenderingPort, type FeatureFlag,
} from '../index';

const ctxFor = (tenantId: string) => ({ tenantId, experienceId: 'home' });

// ── STEP 1 · feature gate ────────────────────────────────────────────────────────
test('an unconfigured gate is a hard GLOBAL OFF', () => {
  const gate = createRolloutGate();
  assert.deepEqual(gate.shouldExecute(ctxFor('t1')), { execute: false, reason: 'global-off' });
});

test('enabled but with no criteria denies by default (never a silent global rollout)', () => {
  const gate = createRolloutGate({ enabled: true });
  const d = gate.shouldExecute(ctxFor('t1'));
  assert.equal(d.execute, false);
  assert.equal(d.reason, 'no-criteria');
});

test('experience allowlist opts in exactly one experience', () => {
  const gate = createRolloutGate({ enabled: true, experiences: ['home'] });
  assert.equal(gate.shouldExecute({ tenantId: 't1', experienceId: 'home' }).execute, true);
  assert.equal(gate.shouldExecute({ tenantId: 't1', experienceId: 'about' }).execute, false);
});

test('tenant allowlist opts in exactly one tenant', () => {
  const gate = createRolloutGate({ enabled: true, tenants: ['t1'] });
  assert.equal(gate.shouldExecute(ctxFor('t1')).reason, 'tenant-allowlist');
  assert.equal(gate.shouldExecute(ctxFor('t2')).execute, false);
});

test('percentage rollout is deterministic and monotonic', () => {
  const bucket = rolloutBucket('t1', 'home');
  assert.ok(bucket >= 0 && bucket < 100);
  assert.equal(rolloutBucket('t1', 'home'), bucket, 'same inputs → same bucket (no randomness)');

  const at0 = createRolloutGate({ enabled: true, percentage: 0 }).shouldExecute(ctxFor('t1'));
  assert.equal(at0.execute, false, '0% rolls out to nobody');
  const at100 = createRolloutGate({ enabled: true, percentage: 100 }).shouldExecute(ctxFor('t1'));
  assert.equal(at100.execute, true, '100% rolls out to everyone');
  // a tenant in at N% stays in at any higher percentage
  const inAt = createRolloutGate({ enabled: true, percentage: bucket + 1 }).shouldExecute(ctxFor('t1'));
  assert.equal(inAt.execute, true);
  const outAt = createRolloutGate({ enabled: true, percentage: bucket }).shouldExecute(ctxFor('t1'));
  assert.equal(outAt.execute, false);
});

// ── STEP 3 · rollback ────────────────────────────────────────────────────────────
test('disable() is an instant kill switch; enable() restores', () => {
  const gate = createRolloutGate({ enabled: true, experiences: ['home'] });
  assert.equal(gate.shouldExecute(ctxFor('t1')).execute, true);
  gate.disable('incident-123');
  assert.deepEqual(gate.shouldExecute(ctxFor('t1')), { execute: false, reason: 'global-off' });
  assert.equal(gate.status().lastDisableReason, 'incident-123');
  gate.enable();
  assert.equal(gate.shouldExecute(ctxFor('t1')).execute, true);
});

test('the circuit breaker trips after N consecutive failures and survives enable()', () => {
  const gate = createRolloutGate({ enabled: true, experiences: ['home'], tripAfterFailures: 3 });
  gate.recordOutcome(false); gate.recordOutcome(false);
  assert.equal(gate.tripped(), false, 'not yet');
  gate.recordOutcome(false);
  assert.equal(gate.tripped(), true);
  assert.equal(gate.shouldExecute(ctxFor('t1')).reason, 'tripped');
  gate.enable();
  assert.equal(gate.shouldExecute(ctxFor('t1')).reason, 'tripped', 'a tripped breaker is not cleared by enable()');
  gate.reset();
  assert.equal(gate.shouldExecute(ctxFor('t1')).execute, true);
});

test('a success resets the consecutive-failure streak', () => {
  const gate = createRolloutGate({ enabled: true, experiences: ['home'], tripAfterFailures: 3 });
  gate.recordOutcome(false); gate.recordOutcome(false); gate.recordOutcome(true); gate.recordOutcome(false);
  assert.equal(gate.tripped(), false);
  assert.equal(gate.status().consecutiveFailures, 1);
  assert.equal(gate.status().totalFailures, 3);
});

// ── STEP 2 · metrics ─────────────────────────────────────────────────────────────
test('metrics aggregate latency, plan size, nodes modified and operations', () => {
  const m = createRenderPlanMetrics();
  assert.equal(m.snapshot().executions, 0);
  m.record({ executionMs: 10, planSize: 4, nodesModified: 2, applied: 3, skipped: 1, redirected: false, failed: false });
  m.record({ executionMs: 20, planSize: 6, nodesModified: 1, applied: 1, skipped: 2, redirected: true, failed: true });
  const s = m.snapshot();
  assert.equal(s.executions, 2);
  assert.equal(s.failures, 1);
  assert.equal(s.redirects, 1);
  assert.equal(s.latencyMs.min, 10);
  assert.equal(s.latencyMs.max, 20);
  assert.equal(s.latencyMs.avg, 15);
  assert.equal(s.planSize.max, 6);
  assert.equal(s.nodesModified, 3);
  assert.equal(s.operationsExecuted, 4);
  assert.equal(s.operationsSkipped, 3);
  m.reset();
  assert.equal(m.snapshot().executions, 0);
});

// ── runtime integration: canary + metrics + rollback end to end ─────────────────
const ectx = (tenantId = 't1'): ExperienceContext => ({ tenantId, channel: 'website', role: 'guest', locale: 'en', direction: 'ltr', device: 'desktop', platform: 'web', environment: { environment: 'production' }, country: 'SA', segments: [], flags: {}, now: '2026-01-01T00:00:00.000Z' });
const req = (experienceId = 'home', tenantId = 't1'): ExperienceRequest => ({ experienceId, context: ectx(tenantId) });
const schema = () => ({
  id: 'home', channel: 'website', schemaVersion: '1', locales: ['en'], defaultLocale: 'en', nav: [], pages: [],
  layout: { id: 'root', type: 'layout', layout: 'section', children: [
    { id: 'hero', type: 'component', componentId: 'hero', props: { t: 1 } },
    { id: 'legacy', type: 'component', componentId: 'banner', props: { t: 2 } },
  ] },
} as any);

const engineWith = (rollout?: any) => {
  const engine = createExperienceEngine({ rollout, services: { experience: { async resolve(r) { return { status: 'resolved', experienceId: r.experienceId, channel: 'website', version: '1', schema: schema(), diagnostics: [] }; } } } });
  engine.registries.renderers.register('r', { id: 'r', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string' });
  engine.pipeline.registerPort({ target: 'html-string', render: (r) => ((r.schema as any).layout.children as any[]).map((c: any) => c.id).join(',') } as RenderingPort<string>);
  engine.flags.register({ metadata: { id: 'legacy', name: 'legacy', version: '1', priority: 0 }, enabled: true, default: { enabled: false } } as FeatureFlag);
  engine.policies.register(createFeatureFlagPolicy(engine.flags));
  return engine;
};

test('DEFAULT: an engine with no rollout config executes no plans (global off)', async () => {
  const engine = engineWith();
  const exec = await engine.execute(req());
  assert.equal(exec.response.renderingResult?.output, 'hero,legacy');
  assert.equal(exec.renderPlanExecution?.executed, false);
  assert.equal(exec.renderPlanExecution?.reason, 'global-off');
  assert.equal(engine.renderPlanMetrics.snapshot().executions, 0, 'nothing recorded when off');
});

test('CANARY: enabled for ONE experience — that experience executes, others do not', async () => {
  const engine = engineWith({ enabled: true, experiences: ['home'] });

  const canary = await engine.execute(req('home'));
  assert.equal(canary.renderPlanExecution?.executed, true);
  assert.equal(canary.renderPlanExecution?.reason, 'experience-allowlist');
  assert.equal(canary.response.renderingResult?.output, 'hero', 'the hidden node was removed');
  assert.equal(canary.renderPlanExecution?.nodesModified, 1);

  const other = await engine.execute(req('about'));
  assert.equal(other.renderPlanExecution?.executed, false);
  assert.equal(other.response.renderingResult?.output, 'hero,legacy', 'untouched — canary is scoped');
});

test('CANARY: tenant scoping isolates other tenants', async () => {
  const engine = engineWith({ enabled: true, tenants: ['t1'] });
  const inTenant = await engine.execute(req('home', 't1'));
  const outTenant = await engine.execute(req('home', 't2'));
  assert.equal(inTenant.response.renderingResult?.output, 'hero');
  assert.equal(outTenant.response.renderingResult?.output, 'hero,legacy');
});

test('METRICS: the runtime records latency, plan size, nodes modified and operations', async () => {
  const engine = engineWith({ enabled: true, experiences: ['home'] });
  await engine.execute(req('home'));
  await engine.execute(req('home'));
  const s = engine.renderPlanMetrics.snapshot();
  assert.equal(s.executions, 2);
  assert.equal(s.failures, 0);
  assert.equal(s.nodesModified, 2, '1 node per execution');
  assert.ok(s.operationsExecuted >= 2);
  assert.ok(s.planSize.max >= 1);
  assert.ok(s.latencyMs.avg >= 0);
});

test('ROLLBACK: disable() takes effect on the very next request', async () => {
  const engine = engineWith({ enabled: true, experiences: ['home'] });
  const before = await engine.execute(req('home'));
  assert.equal(before.response.renderingResult?.output, 'hero');

  engine.rollout.disable('incident');
  const after = await engine.execute(req('home'));
  assert.equal(after.response.renderingResult?.output, 'hero,legacy', 'instantly back to baseline output');
  assert.equal(after.renderPlanExecution?.executed, false);
});

test('FAILURE ISOLATION: a broken plan execution still renders and trips the breaker', async () => {
  const engine = engineWith({ enabled: true, experiences: ['home'], tripAfterFailures: 1 });
  // Force a failure inside plan execution by making the plan itself unusable.
  const original = engine.renderPlanBuilder.build;
  (engine.renderPlanBuilder as any).build = (...args: any[]) => {
    const plan = original.apply(engine.renderPlanBuilder, args as any);
    Object.defineProperty(plan, 'nodes', { get() { throw new Error('plan boom'); } });
    return plan;
  };

  const exec = await engine.execute(req('home'));
  assert.equal(exec.response.renderingResult?.status, 'rendered', 'rendering survived');
  assert.equal(exec.response.renderingResult?.output, 'hero,legacy', 'fell back to unmodified output');
  assert.equal(exec.renderPlanExecution?.failed, true);
  assert.equal(engine.renderPlanMetrics.snapshot().failures, 1);
  assert.equal(engine.rollout.tripped(), true, 'breaker tripped after the failure');
});
