// Experience Engine · Audience & Targeting Engine tests (Wave 9).
// Proves criteria matching across every supported dimension, priority ordering, multiple
// audiences, the empty case, segment/rule combinators, diagnostics + events, the policy
// audience-scope integration, and the Runtime context-stage integration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAudienceRegistry, createTargetResolver, createAudienceMatcher, matchCriteria, toAudienceContext,
  policyMatchesScope, createExperienceEngine, createStaticConfigurationProvider,
  type Audience, type AudienceContext, type AudienceCriteria, type AudienceEvent,
  type Policy, type PolicyContext, type ExperienceContext, type ExperienceRequest, type ConfigurationBundle,
} from '../index';

const actx = (over: Partial<AudienceContext> = {}): AudienceContext => ({ tenantId: 't1', channel: 'website', environment: 'production', role: 'guest', locale: 'en', country: 'SA', device: 'desktop', platform: 'web', segments: [], preview: false, ...over });
const ectx = (over: Partial<ExperienceContext> = {}): ExperienceContext => ({ tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr', device: 'desktop', platform: 'web', environment: { environment: 'production' }, country: 'SA', segments: [], flags: {}, now: '2026-01-01T00:00:00.000Z', ...over });

const aud = (id: string, criteria: AudienceCriteria, over: { priority?: number; match?: 'all' | 'any'; segMatch?: 'all' | 'any'; rules?: any[] } = {}): Audience => ({
  metadata: { id, name: id, version: '1.0.0', priority: over.priority ?? 0 },
  segments: [{ id: `${id}.seg`, rules: over.rules ?? [{ criteria }], match: over.segMatch }],
  match: over.match,
});

// ── criteria matching across every supported dimension (STEP 3, STEP 8) ─────────
test('matchCriteria matches each supported dimension', () => {
  assert.equal(matchCriteria({ tenants: ['t1'] }, actx()).matched, true);
  assert.equal(matchCriteria({ tenants: ['t2'] }, actx()).matched, false);
  assert.equal(matchCriteria({ countries: ['SA'] }, actx()).matched, true);
  assert.equal(matchCriteria({ locales: ['ar'] }, actx()).matched, false);
  assert.equal(matchCriteria({ channels: ['website'] }, actx()).matched, true);
  assert.equal(matchCriteria({ environments: ['staging'] }, actx()).matched, false);
  assert.equal(matchCriteria({ roles: ['guest'] }, actx()).matched, true);
  assert.equal(matchCriteria({ devices: ['mobile'] }, actx()).matched, false);
  assert.equal(matchCriteria({ platforms: ['web'] }, actx()).matched, true);
  assert.equal(matchCriteria({ segments: ['vip'] }, actx({ segments: ['vip', 'beta'] })).matched, true);
  assert.equal(matchCriteria({ segments: ['vip'] }, actx({ segments: ['beta'] })).matched, false);
  assert.equal(matchCriteria({ preview: true }, actx({ preview: true })).matched, true);
  assert.equal(matchCriteria({ preview: true }, actx({ preview: false })).matched, false);
});

test('a criteria block is AND over its present dimensions', () => {
  const c: AudienceCriteria = { channels: ['website'], countries: ['SA'], roles: ['guest'] };
  assert.equal(matchCriteria(c, actx()).matched, true);
  assert.equal(matchCriteria(c, actx({ country: 'AE' })).matched, false, 'one failing dimension fails the block');
});

// ── matching (STEP 8) ────────────────────────────────────────────────────────────
test('an audience matches when its segment criteria are satisfied', () => {
  const m = createAudienceMatcher({ clock: () => 0 }).match(aud('a1', { channels: ['website'] }), actx());
  assert.equal(m.matched, true);
  assert.deepEqual(m.matchedSegments, ['a1.seg']);
  assert.equal(m.rejectedSegments.length, 0);
});

// ── priority (STEP 8) ────────────────────────────────────────────────────────────
test('resolve() returns matched audiences sorted by priority desc', () => {
  const reg = createAudienceRegistry();
  reg.register(aud('low', { channels: ['website'] }, { priority: 1 }));
  reg.register(aud('high', { channels: ['website'] }, { priority: 10 }));
  reg.register(aud('mid', { channels: ['website'] }, { priority: 5 }));
  const res = createTargetResolver(reg, { clock: () => 0 }).resolve(ectx());
  assert.deepEqual(res.matched, ['high', 'mid', 'low']);
});

// ── multiple audiences + no audience (STEP 8) ───────────────────────────────────
test('multiple audiences: some match, some are rejected', () => {
  const reg = createAudienceRegistry();
  reg.register(aud('sa-web', { countries: ['SA'], channels: ['website'] }));
  reg.register(aud('ae-only', { countries: ['AE'] }));
  reg.register(aud('vip', { segments: ['vip'] }));
  const res = createTargetResolver(reg, { clock: () => 0 }).resolve(ectx({ segments: ['vip'] }));
  assert.deepEqual(res.matched.sort(), ['sa-web', 'vip']);
  assert.deepEqual(res.rejected, ['ae-only']);
});

test('no audiences registered → nothing matched (graceful)', () => {
  const res = createTargetResolver(createAudienceRegistry(), { clock: () => 0 }).resolve(ectx());
  assert.deepEqual(res.matched, []);
  assert.deepEqual(res.rejected, []);
});

// ── segment / rule / audience combinators ───────────────────────────────────────
test('segment match=any ORs its rules; negate inverts a rule', () => {
  const anyAud: Audience = { metadata: { id: 'any', name: 'any', version: '1' }, segments: [{ id: 's', match: 'any', rules: [{ criteria: { countries: ['AE'] } }, { criteria: { countries: ['SA'] } }] }] };
  assert.equal(createAudienceMatcher({ clock: () => 0 }).match(anyAud, actx({ country: 'SA' })).matched, true);

  const negAud: Audience = { metadata: { id: 'neg', name: 'neg', version: '1' }, segments: [{ id: 's', rules: [{ criteria: { countries: ['AE'] }, negate: true }] }] };
  assert.equal(createAudienceMatcher({ clock: () => 0 }).match(negAud, actx({ country: 'SA' })).matched, true, 'NOT in AE → matches');
});

test('an audience with no segments targets everyone', () => {
  const all: Audience = { metadata: { id: 'all', name: 'all', version: '1' }, segments: [] };
  assert.equal(createAudienceMatcher({ clock: () => 0 }).match(all, actx()).matched, true);
});

// ── diagnostics + events (STEP 6, STEP 7) ───────────────────────────────────────
test('resolution exposes a criteria trace + timing and emits evaluated/matched/rejected', () => {
  const reg = createAudienceRegistry();
  reg.register(aud('yes', { channels: ['website'], countries: ['SA'] }));
  reg.register(aud('no', { countries: ['AE'] }));
  const events: AudienceEvent[] = [];
  const res = createTargetResolver(reg, { clock: () => 0, onEvent: (e) => events.push(e) }).resolve(ectx());

  const yes = res.matches.find(m => m.audienceId === 'yes')!;
  assert.equal(yes.matched, true);
  assert.ok(yes.criteriaTrace.some(t => t.dimension === 'channel' && t.matched));
  assert.ok(yes.criteriaTrace.some(t => t.dimension === 'country' && t.matched));
  assert.ok(typeof yes.evaluationMs === 'number');
  const types = events.map(e => e.type);
  assert.ok(types.includes('audience.evaluated'));
  assert.ok(types.includes('audience.matched'));
  assert.ok(types.includes('audience.rejected'));
});

test('toAudienceContext maps an ExperienceContext faithfully', () => {
  const a = toAudienceContext(ectx({ locale: 'ar', device: 'mobile' }), { preview: true });
  assert.equal(a.tenantId, 't1');
  assert.equal(a.environment, 'production');
  assert.equal(a.locale, 'ar');
  assert.equal(a.device, 'mobile');
  assert.equal(a.preview, true);
});

// ── policy audience-scope integration (STEP 4) ──────────────────────────────────
test('policyMatchesScope honours the audience dimension', () => {
  const ctx: PolicyContext = { tenantId: 't1', channel: 'website', environment: 'production', audiences: ['vip'] };
  assert.equal(policyMatchesScope({ audiences: ['vip'] }, ctx), true);
  assert.equal(policyMatchesScope({ audiences: ['staff'] }, ctx), false);
  assert.equal(policyMatchesScope({ audiences: ['vip'] }, { tenantId: 't1', channel: 'website', environment: 'production' }), false, 'no audiences in context → no overlap');
});

// ── Runtime integration (STEP 5) — audiences become context, drive policy + config ─
const req = (over: Partial<ExperienceContext> = {}): ExperienceRequest => ({ experienceId: 'home', context: ectx(over) });
const bundle: ConfigurationBundle = { id: 'b', tenantId: 't1', channel: 'website', environment: 'production', version: '1.0.0', config: { base: 1 }, metadata: { version: '1.0.0', generatedAt: '' } };
const cfgPolicyForVip: Policy = {
  metadata: { id: 'cfg.vip', name: 'cfg.vip', type: 'configuration', version: '1', priority: 5, scope: { audiences: ['vip'] } },
  applies: (c) => policyMatchesScope({ audiences: ['vip'] }, c),
  evaluate: () => ({ effect: 'override', directives: [{ key: 'perk', value: 'gold' }] }),
  health: () => ({ status: 'healthy' }),
};

test('the runtime resolves audiences into context and they gate a configuration policy', async () => {
  const engine = createExperienceEngine();
  engine.providers.register(createStaticConfigurationProvider([bundle], { id: 'cfg.web' }));
  engine.audiences.register(aud('vip', { segments: ['vip'] }, { priority: 10 }));
  engine.policies.register(cfgPolicyForVip);

  const events: AudienceEvent[] = [];
  const vip = await engine.execute(req({ segments: ['vip'] }), { onAudienceEvent: (e) => events.push(e) });
  assert.deepEqual(vip.audiences?.matched, ['vip'], 'audience matched and surfaced on the execution');
  assert.equal(vip.configuration?.config.perk, 'gold', 'audience-scoped config policy applied');
  assert.ok(vip.diagnostics.some(d => d.stage === 'context' && /1 matched/.test(d.message)));
  assert.ok(events.some(e => e.type === 'audience.matched' && e.audienceId === 'vip'));

  const guest = await engine.execute(req({ segments: [] }));
  assert.deepEqual(guest.audiences?.matched, [], 'no audience for a non-vip context');
  assert.equal(guest.configuration?.config.perk, undefined, 'the audience-scoped policy did not apply');
  assert.equal(guest.configuration?.config.base, 1, 'base config still delivered');
});

test('the context stage is a no-op for audiences when none are registered', async () => {
  const engine = createExperienceEngine();
  const exec = await engine.execute(req());
  assert.deepEqual(exec.audiences?.matched, []);
  assert.equal(exec.ok, true);
});
