// Experience Engine · Decision Context tests (Wave 18).
// Proves identity (stable / anonymous / authenticated), provider merge + override precedence,
// context stability across requests, and the runtime population before policy evaluation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDecisionContextBuilder, baseDecisionContext, mergeDecisionContext, withExperiments,
  deriveVisitorId, anonymousVisitor, authenticatedVisitor, decisionUnitId, UNKNOWN_VISITOR,
  createExperienceEngine, createExperimentRegistry, createExperimentPolicy,
  type DecisionContext, type DecisionContextProvider, type ExperienceContext,
  type ExperienceRequest, type RenderingPort, type Policy, type PolicyContext, type FeatureFlag,
} from '../index';

const ectx = (over: Partial<ExperienceContext> = {}): ExperienceContext => ({
  tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr',
  device: 'desktop', platform: 'web', environment: { environment: 'production' },
  country: 'SA', segments: ['early'], flags: {}, now: '2026-01-01T00:00:00.000Z', ...over,
});
const input = (over: any = {}) => ({ context: ectx(), experienceId: '/', preview: false, ...over });

// ── Identity ─────────────────────────────────────────────────────────────────────
test('a derived visitor id is deterministic and seed-specific', () => {
  assert.equal(deriveVisitorId('seed-1'), deriveVisitorId('seed-1'), 'same seed → same id, always');
  assert.notEqual(deriveVisitorId('seed-1'), deriveVisitorId('seed-2'));
  assert.match(deriveVisitorId('seed-1'), /^vis_/);
});

test('anonymous identity is stable across sessions; session id is carried separately', () => {
  const a = anonymousVisitor('durable-seed', { sessionId: 's1' });
  const b = anonymousVisitor('durable-seed', { sessionId: 's2' });
  assert.equal(a.visitorId, b.visitorId, 'a new session does not change the visitor');
  assert.equal(a.kind, 'anonymous');
  assert.notEqual(a.sessionId, b.sessionId);
});

test('authenticated identity is keyed by ACCOUNT, not by browser seed', () => {
  const u = authenticatedVisitor('user-9');
  assert.equal(u.kind, 'authenticated');
  assert.equal(u.userId, 'user-9');
  assert.equal(u.visitorId, authenticatedVisitor('user-9').visitorId, 'stable across devices');
  assert.notEqual(u.visitorId, anonymousVisitor('user-9').visitorId, 'account and browser namespaces differ');
});

test('with no seed the identity is explicitly UNKNOWN, never a fabricated stable id', () => {
  const ctx = baseDecisionContext(input());
  assert.equal(ctx.identity.visitorId, UNKNOWN_VISITOR.visitorId);
  assert.equal(decisionUnitId(ctx), 't1:/', 'falls back to the coarse unit, and says so');
  const known = baseDecisionContext(input({ identity: anonymousVisitor('seed-1') }));
  assert.equal(decisionUnitId(known), known.identity.visitorId, 'a real visitor is the allocation unit');
});

// ── Model ────────────────────────────────────────────────────────────────────────
test('the base context carries every required dimension', () => {
  const ctx = baseDecisionContext(input({ identity: anonymousVisitor('s'), audiences: ['vip'], flags: { f: { enabled: true } } }));
  assert.equal(ctx.tenantId, 't1');
  assert.equal(ctx.channel, 'website');
  assert.equal(ctx.environment, 'production');
  assert.equal(ctx.role, 'guest');
  assert.deepEqual(ctx.language, { locale: 'en', direction: 'ltr' });
  assert.deepEqual(ctx.device, { kind: 'desktop', platform: 'web' });
  assert.equal(ctx.location.country, 'SA');
  assert.deepEqual(ctx.segments, ['early']);
  assert.deepEqual(ctx.audiences, ['vip']);
  assert.equal(ctx.flags.f.enabled, true);
  assert.deepEqual(ctx.experiments, {});
  assert.equal(ctx.experienceId, '/');
});

// ── Merge ────────────────────────────────────────────────────────────────────────
test('merge replaces scalars/arrays and key-merges nested records', () => {
  const base = baseDecisionContext(input());
  const merged = mergeDecisionContext(base, {
    location: { city: 'Riyadh' },
    attributes: { tier: 'gold' },
    audiences: ['vip'],
  });
  assert.equal(merged.location.country, 'SA', 'existing nested key preserved');
  assert.equal(merged.location.city, 'Riyadh', 'new nested key added');
  assert.deepEqual(merged.audiences, ['vip'], 'arrays are replaced');
  assert.equal(merged.attributes.tier, 'gold');
  assert.equal(base.location.city, undefined, 'the input is not mutated');
});

test('merge ignores undefined patch values', () => {
  const base = baseDecisionContext(input());
  const merged = mergeDecisionContext(base, { experienceId: undefined, preview: true });
  assert.equal(merged.experienceId, '/', 'undefined does not erase');
  assert.equal(merged.preview, true);
});

// ── Providers ────────────────────────────────────────────────────────────────────
const provider = (id: string, priority: number, patch: Partial<DecisionContext>): DecisionContextProvider =>
  ({ id, priority, contribute: () => patch });

test('providers run in ascending priority — the highest wins', () => {
  const b = createDecisionContextBuilder();
  b.use(provider('low', 1, { attributes: { tier: 'bronze', fromLow: true } as any }));
  b.use(provider('high', 10, { attributes: { tier: 'gold' } as any }));
  const ctx = b.build(input());
  assert.equal(ctx.attributes.tier, 'gold', 'higher priority applied last');
  assert.equal(ctx.attributes.fromLow, true, 'lower-priority contribution is preserved');
  assert.deepEqual(b.providers().map(p => p.id), ['low', 'high']);
});

test('explicit overrides beat every provider', () => {
  const b = createDecisionContextBuilder();
  b.use(provider('p', 100, { location: { country: 'AE' } }));
  const ctx = b.build(input(), { location: { country: 'KW' } });
  assert.equal(ctx.location.country, 'KW');
});

test('a provider returning null contributes nothing', () => {
  const b = createDecisionContextBuilder();
  b.use({ id: 'noop', contribute: () => null });
  assert.equal(b.build(input()).tenantId, 't1');
});

test('a THROWING provider cannot break the request', () => {
  const b = createDecisionContextBuilder();
  b.use({ id: 'boom', priority: 1, contribute: () => { throw new Error('provider boom'); } });
  b.use(provider('ok', 2, { attributes: { survived: true } as any }));
  const ctx = b.build(input());
  assert.equal(ctx.attributes.survived, true, 'later providers still run');
  assert.equal(ctx.tenantId, 't1');
});

test('re-using the same provider id replaces it rather than duplicating', () => {
  const b = createDecisionContextBuilder();
  b.use(provider('p', 1, { attributes: { v: 1 } as any }));
  b.use(provider('p', 1, { attributes: { v: 2 } as any }));
  assert.equal(b.providers().length, 1);
  assert.equal(b.build(input()).attributes.v, 2);
  b.remove('p');
  assert.equal(b.providers().length, 0);
});

// ── Context stability ────────────────────────────────────────────────────────────
test('the same request builds an identical context every time', () => {
  const b = createDecisionContextBuilder();
  b.use(provider('p', 1, { attributes: { tier: 'gold' } as any }));
  const i = input({ identity: anonymousVisitor('seed-1') });
  assert.deepEqual(b.build(i), b.build(i), 'deterministic — no clock, no randomness');
});

test('withExperiments folds in variants without mutating the original', () => {
  const ctx = baseDecisionContext(input());
  const next = withExperiments(ctx, { 'exp.hero': 'B' });
  assert.equal(next.experiments['exp.hero'], 'B');
  assert.deepEqual(ctx.experiments, {}, 'original untouched');
  assert.equal(withExperiments(ctx, {}), ctx, 'no assignments → same reference');
});

// ── Runtime integration ──────────────────────────────────────────────────────────
const schema = () => ({ id: 'home', channel: 'website', schemaVersion: '1', locales: ['en'], defaultLocale: 'en', nav: [], pages: [], layout: { id: 'root', type: 'layout', layout: 'section', children: [] } } as any);
const req = (): ExperienceRequest => ({ experienceId: 'home', context: ectx() });
const buildEngine = () => {
  const engine = createExperienceEngine({ services: { experience: { async resolve(r) { return { status: 'resolved', experienceId: r.experienceId, channel: 'website', version: '1', schema: schema(), diagnostics: [] }; } } } });
  engine.registries.renderers.register('r', { id: 'r', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string' });
  engine.pipeline.registerPort({ target: 'html-string', render: () => '<html/>' } as RenderingPort<string>);
  return engine;
};

test('the runtime populates the Decision Context and exposes it on the execution', async () => {
  const engine = buildEngine();
  engine.flags.register({ metadata: { id: 'promo', name: 'promo', version: '1', priority: 0 }, enabled: true } as FeatureFlag);
  const exec = await engine.execute(req(), { visitor: anonymousVisitor('seed-1') });

  const dc = exec.decisionContext!;
  assert.ok(dc, 'exposed on the execution');
  assert.equal(dc.identity.visitorId, anonymousVisitor('seed-1').visitorId);
  assert.equal(dc.tenantId, 't1');
  assert.equal(dc.experienceId, 'home');
  assert.equal(dc.flags.promo.enabled, true, 'flags resolved in the same stage are present');
  assert.ok(exec.diagnostics.some(d => d.stage === 'context' && /decision context: visitor=/.test(d.message)));
});

test('the Decision Context reaches policies BEFORE evaluation', async () => {
  const engine = buildEngine();
  let seen: PolicyContext | null = null;
  const spy: Policy = {
    metadata: { id: 'spy', name: 'spy', version: '1', type: 'tenant', priority: 0 },
    applies: () => true, health: () => ({ status: 'healthy' }),
    evaluate: (ctx) => { seen = ctx; return { effect: 'noop' }; },
  };
  engine.policies.register(spy);

  await engine.execute(req(), { visitor: authenticatedVisitor('user-9') });
  assert.ok(seen, 'the policy ran');
  assert.equal(seen!.decision?.identity.kind, 'authenticated');
  assert.equal(seen!.decision?.identity.userId, 'user-9');
});

test('experiment variants are folded back into the context after policy evaluation', async () => {
  const engine = buildEngine();
  const registry = createExperimentRegistry();
  registry.register({
    metadata: { id: 'exp.hero', name: 'Hero', version: '1' }, status: 'running',
    variants: [{ key: 'A', weight: 50, control: true }, { key: 'B', weight: 50 }],
    allocation: { unit: 'visitor' },
  });
  engine.policies.register(createExperimentPolicy(registry, { resolveUnit: (c) => c.decision ? decisionUnitId(c.decision) : 'x' }));

  const exec = await engine.execute(req(), { visitor: anonymousVisitor('seed-1') });
  const variant = exec.decisionContext!.experiments['exp.hero'];
  assert.ok(variant === 'A' || variant === 'B', 'the assigned variant is in the final context');
  assert.equal(variant, exec.policy?.decision.directives['experiment.exp.hero']);
});

test('a visitor gets the SAME experiment variant across separate executions', async () => {
  const registry = createExperimentRegistry();
  registry.register({
    metadata: { id: 'exp.hero', name: 'Hero', version: '1' }, status: 'running',
    variants: [{ key: 'A', weight: 50, control: true }, { key: 'B', weight: 50 }],
    allocation: { unit: 'visitor' },
  });
  const engine = buildEngine();
  engine.policies.register(createExperimentPolicy(registry, { resolveUnit: (c) => c.decision ? decisionUnitId(c.decision) : 'x' }));

  const visitor = anonymousVisitor('seed-77');
  const a = await engine.execute(req(), { visitor });
  const b = await engine.execute(req(), { visitor });
  assert.equal(a.decisionContext!.experiments['exp.hero'], b.decisionContext!.experiments['exp.hero']);
});

test('decisionOverrides win over everything the runtime resolved', async () => {
  const engine = buildEngine();
  const exec = await engine.execute(req(), { visitor: anonymousVisitor('s'), decisionOverrides: { location: { country: 'AE', city: 'Dubai' } } });
  assert.equal(exec.decisionContext!.location.country, 'AE');
  assert.equal(exec.decisionContext!.location.city, 'Dubai');
});

test('engine-level context providers are applied on every execution', async () => {
  const engine = createExperienceEngine({
    contextProviders: [{ id: 'geo', priority: 5, contribute: () => ({ location: { region: 'GCC' }, attributes: { source: 'edge' } }) }],
    services: { experience: { async resolve(r) { return { status: 'resolved', experienceId: r.experienceId, channel: 'website', version: '1', schema: schema(), diagnostics: [] }; } } },
  });
  const exec = await engine.execute(req());
  assert.equal(exec.decisionContext!.location.region, 'GCC');
  assert.equal(exec.decisionContext!.location.country, 'SA', 'base value preserved');
  assert.equal(exec.decisionContext!.attributes.source, 'edge');
});
