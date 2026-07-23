// Experience Engine · Feature Flags Engine tests (Wave 10).
// Proves evaluation (master switch, rules, default, variants), audience targeting, priority,
// enable/disable, diagnostics + events, the FeatureFlagPolicy bridge, and the Runtime integration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFeatureFlagRegistry, createFlagEvaluator, createFeatureFlagResolver, createFeatureFlagPolicy,
  matchFlagCriteria, toFlagContext, createExperienceEngine,
  type FeatureFlag, type FlagContext, type FlagEvent, type ExperienceContext, type ExperienceRequest,
} from '../index';

const fctx = (over: Partial<FlagContext> = {}): FlagContext => ({ tenantId: 't1', channel: 'website', environment: 'production', locale: 'en', country: 'SA', preview: false, audiences: [], ...over });
const ectx = (over: Partial<ExperienceContext> = {}): ExperienceContext => ({ tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr', device: 'desktop', platform: 'web', environment: { environment: 'production' }, country: 'SA', segments: [], flags: {}, now: '2026-01-01T00:00:00.000Z', ...over });

const flag = (id: string, over: Partial<FeatureFlag> & { priority?: number } = {}): FeatureFlag => ({
  metadata: { id, name: id, version: '1.0.0', priority: over.priority ?? 0 },
  enabled: over.enabled ?? true,
  default: over.default,
  variants: over.variants,
  rules: over.rules,
});

const ev = createFlagEvaluator({ clock: () => 0 });

// ── evaluation (STEP 9) ──────────────────────────────────────────────────────────
test('a master-enabled flag with no rules resolves to its default (on)', () => {
  const r = ev.evaluate(flag('f1'), fctx());
  assert.equal(r.enabled, true);
  assert.equal(r.reason, 'default');
});

test('a master-disabled flag is always off regardless of rules', () => {
  const r = ev.evaluate(flag('f2', { enabled: false, rules: [{ criteria: {}, enabled: true }] }), fctx());
  assert.equal(r.enabled, false);
  assert.equal(r.reason, 'disabled');
});

test('the first matching rule wins; a variant selects its value', () => {
  const f = flag('f3', {
    variants: [{ key: 'B', value: { color: 'green' } }],
    rules: [
      { id: 'r-ae', criteria: { countries: ['AE'] }, enabled: true, variant: 'B' },
      { id: 'r-sa', criteria: { countries: ['SA'] }, enabled: true, variant: 'B' },
    ],
  });
  const r = ev.evaluate(f, fctx({ country: 'SA' }));
  assert.equal(r.enabled, true);
  assert.equal(r.reason, 'rule-match');
  assert.equal(r.matchedRuleId, 'r-sa', 'first matching rule wins');
  assert.deepEqual(r.value, { color: 'green' });
});

test('no rule matches → no-match reason with the default applied', () => {
  const f = flag('f4', { default: { enabled: false }, rules: [{ criteria: { countries: ['AE'] }, enabled: true }] });
  const r = ev.evaluate(f, fctx({ country: 'SA' }));
  assert.equal(r.enabled, false);
  assert.equal(r.reason, 'no-match');
});

// ── audience targeting (STEP 4, STEP 9) ─────────────────────────────────────────
test('matchFlagCriteria targets matched audiences + context dimensions', () => {
  assert.equal(matchFlagCriteria({ audiences: ['vip'] }, fctx({ audiences: ['vip', 'beta'] })), true);
  assert.equal(matchFlagCriteria({ audiences: ['vip'] }, fctx({ audiences: ['beta'] })), false);
  assert.equal(matchFlagCriteria({ countries: ['SA'], channels: ['website'] }, fctx()), true);
  assert.equal(matchFlagCriteria({ environments: ['staging'] }, fctx()), false);
  assert.equal(matchFlagCriteria({ preview: true }, fctx({ preview: false })), false);
});

test('a flag is enabled only for its target audience', () => {
  const f = flag('beta-ui', { default: { enabled: false }, rules: [{ criteria: { audiences: ['vip'] }, enabled: true }] });
  assert.equal(ev.evaluate(f, fctx({ audiences: ['vip'] })).enabled, true);
  assert.equal(ev.evaluate(f, fctx({ audiences: [] })).enabled, false);
});

// ── priority (STEP 9) ────────────────────────────────────────────────────────────
test('resolveEffectiveFlags lists enabled flags priority-sorted', () => {
  const reg = createFeatureFlagRegistry();
  reg.register(flag('low', { priority: 1 }));
  reg.register(flag('high', { priority: 10 }));
  reg.register(flag('off', { enabled: false }));
  const res = ev.resolveEffectiveFlags(reg, fctx());
  assert.deepEqual(res.matched, ['high', 'low']);
  assert.deepEqual(res.rejected, ['off']);
  assert.equal(res.flags.high.enabled, true);
  assert.equal(res.flags.off.enabled, false);
});

// ── enable / disable (STEP 2, STEP 9) ───────────────────────────────────────────
test('registry enable/disable flips the master switch', () => {
  const reg = createFeatureFlagRegistry();
  reg.register(flag('f', { enabled: true }));
  reg.disable('f');
  assert.equal(reg.get('f')?.enabled, false);
  assert.equal(ev.evaluate(reg.get('f')!, fctx()).enabled, false);
  reg.enable('f');
  assert.equal(ev.evaluate(reg.get('f')!, fctx()).enabled, true);
  assert.equal(reg.list().length, 1);
});

// ── diagnostics + events (STEP 7, STEP 8) ───────────────────────────────────────
test('resolution carries reasons/timing and emits evaluated + enabled/disabled events', () => {
  const reg = createFeatureFlagRegistry();
  reg.register(flag('on', {}));
  reg.register(flag('off', { enabled: false }));
  const events: FlagEvent[] = [];
  const res = createFeatureFlagResolver(reg, { clock: () => 0, onEvent: (e) => events.push(e) }).resolve(ectx());
  assert.ok(res.results.every(r => typeof r.evaluationMs === 'number' && r.reason));
  const types = events.map(e => e.type);
  assert.ok(types.includes('flag.evaluated'));
  assert.ok(types.includes('flag.enabled'));
  assert.ok(types.includes('flag.disabled'));
});

test('toFlagContext maps context + audiences faithfully', () => {
  const c = toFlagContext(ectx({ locale: 'ar' }), { preview: true, audiences: ['vip'] });
  assert.equal(c.environment, 'production');
  assert.equal(c.locale, 'ar');
  assert.equal(c.preview, true);
  assert.deepEqual(c.audiences, ['vip']);
});

// ── FeatureFlagPolicy bridge (STEP 5) ───────────────────────────────────────────
test('FeatureFlagPolicy surfaces effective flags as policy directives', async () => {
  const reg = createFeatureFlagRegistry();
  reg.register(flag('promo', {}));
  const policy = createFeatureFlagPolicy(reg);
  assert.equal(policy.metadata.type, 'feature-flag');
  const result = await policy.evaluate({ tenantId: 't1', channel: 'website', environment: 'production', flags: { promo: { enabled: true }, hidden: { enabled: false } } });
  assert.equal(result.effect, 'annotate');
  assert.ok(result.directives?.some(d => d.key === 'flag.promo' && d.value === true));
  assert.ok(result.directives?.some(d => d.key === 'flag.hidden' && d.value === false));
});

// ── Runtime integration (STEP 6) ────────────────────────────────────────────────
const req = (over: Partial<ExperienceContext> = {}): ExperienceRequest => ({ experienceId: 'home', context: ectx(over) });

test('the runtime resolves flags into context and the FeatureFlagPolicy surfaces them', async () => {
  const engine = createExperienceEngine();
  engine.audiences.register({ metadata: { id: 'vip', name: 'vip', version: '1', priority: 10 }, segments: [{ id: 's', rules: [{ criteria: { segments: ['vip'] } }] }] });
  engine.flags.register(flag('beta-ui', { default: { enabled: false }, rules: [{ criteria: { audiences: ['vip'] }, enabled: true }] }));
  engine.policies.register(createFeatureFlagPolicy(engine.flags));

  const events: FlagEvent[] = [];
  const vip = await engine.execute(req({ segments: ['vip'] }), { onFlagEvent: (e) => events.push(e) });
  assert.deepEqual(vip.audiences?.matched, ['vip']);
  assert.deepEqual(vip.flags?.matched, ['beta-ui'], 'flag enabled for the vip audience');
  assert.equal(vip.flags?.flags['beta-ui'].enabled, true);
  assert.equal(vip.policy?.decision.directives['flag.beta-ui'], true, 'flag surfaced through the policy stage');
  assert.ok(vip.diagnostics.some(d => d.stage === 'context' && /1 on/.test(d.message)));
  assert.ok(events.some(e => e.type === 'flag.enabled' && e.flagId === 'beta-ui'));

  const guest = await engine.execute(req({ segments: [] }));
  assert.deepEqual(guest.flags?.matched, [], 'flag off for a non-vip context');
  assert.equal(guest.flags?.flags['beta-ui'].enabled, false);
});

test('the context stage is a no-op for flags when none are registered', async () => {
  const engine = createExperienceEngine();
  const exec = await engine.execute(req());
  assert.deepEqual(exec.flags?.matched, []);
  assert.equal(exec.ok, true);
});
