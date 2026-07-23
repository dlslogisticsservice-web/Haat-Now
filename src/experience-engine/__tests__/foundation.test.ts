// Experience Engine · foundation tests.
// Verifies the chassis COMPILES and behaves as a pure, empty, honest foundation:
// registries start empty, the generic registry works, the engine constructs without any
// ports, and resolve() reports 'not-found' rather than fabricating a result. No integration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createExperienceEngine, ENGINE_VERSION, InMemoryRegistry,
  ok, err, isOk, isErr,
  type ExperienceContext, type ExperienceRequest, type ComponentMetadata,
} from '../index';

const context = (): ExperienceContext => ({
  tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr',
  device: 'desktop', platform: 'web', environment: { environment: 'sandbox' }, now: '2026-01-01T00:00:00.000Z',
});

// ── the chassis ────────────────────────────────────────────────────────────────
test('the engine constructs with no ports/services and reports its foundation version', () => {
  const engine = createExperienceEngine();
  assert.equal(engine.version, ENGINE_VERSION);
  assert.match(engine.version, /foundation/);
  assert.deepEqual(engine.ports, {});
  assert.deepEqual(engine.services, {});
  assert.equal(engine.environment, null);
});

test('every registry is created EMPTY (nothing populated at foundation stage)', () => {
  const r = createExperienceEngine().registries;
  for (const reg of [r.experiences, r.components, r.channels, r.themes, r.rules, r.renderers, r.assets, r.plugins, r.lifecycles, r.analytics]) {
    assert.equal(reg.size, 0);
    assert.deepEqual(reg.list(), []);
  }
});

test('resolve() returns an honest not-found — never a fabricated resolution', async () => {
  const engine = createExperienceEngine();
  const req: ExperienceRequest = { experienceId: 'home', context: context() };
  const res = await engine.resolve(req);
  assert.equal(res.resolution.status, 'not-found');
  assert.equal(res.resolution.experienceId, 'home');
  assert.equal(res.resolution.channel, 'website');
  assert.ok((res.resolution.diagnostics ?? []).some(d => /no ExperienceResolver/.test(d)));
  assert.equal(res.resolvedAt, '2026-01-01T00:00:00.000Z', 'time comes from context, not a clock (pure)');
});

test('resolve() delegates to an installed ExperienceResolver when present', async () => {
  const engine = createExperienceEngine({
    services: {
      experience: {
        async resolve(request) {
          return { status: 'resolved', experienceId: request.experienceId, channel: 'website', version: '1.0.0' };
        },
      },
    },
  });
  const res = await engine.resolve({ experienceId: 'home', context: context() });
  assert.equal(res.resolution.status, 'resolved');
  assert.equal(res.resolution.version, '1.0.0');
});

test('emit() fans an event to the events + analytics ports when present', () => {
  const seen: string[] = [];
  const engine = createExperienceEngine({
    ports: {
      events: { publish: (e) => seen.push(`bus:${e.type}`), subscribe: () => () => {} },
      analytics: { dispatch: (e) => seen.push(`an:${e.type}`) },
    },
  });
  engine.emit({ type: 'experience.viewed', at: '2026-01-01T00:00:00.000Z', experienceId: 'home' });
  assert.deepEqual(seen, ['bus:experience.viewed', 'an:experience.viewed']);
});

// ── generic registry (pure infra) ──────────────────────────────────────────────
test('InMemoryRegistry is a pure typed map: register/get/list/has/clear', () => {
  const reg = new InMemoryRegistry<ComponentMetadata>();
  assert.equal(reg.has('hero'), false);
  assert.equal(reg.get('hero'), null);
  const meta = { id: 'hero', name: 'Hero', version: '1.0.0', supportedChannels: ['website'], supportedRoles: ['guest'], responsive: true, rtl: true, darkMode: true, accessibility: true, abTestable: true, personalizable: true, analyticsEvents: [], dependencies: [], permissions: [], validationRules: [], previewSupport: true, publishingConstraints: [] } as ComponentMetadata;
  reg.register('hero', meta);
  assert.equal(reg.has('hero'), true);
  assert.equal(reg.get('hero'), meta);
  assert.deepEqual(reg.ids(), ['hero']);
  assert.equal(reg.size, 1);
  reg.clear();
  assert.equal(reg.size, 0);
});

test('registries are independent instances per engine (no shared global state)', () => {
  const a = createExperienceEngine().registries;
  const b = createExperienceEngine().registries;
  a.components.register('x', {} as ComponentMetadata);
  assert.equal(a.components.size, 1);
  assert.equal(b.components.size, 0, 'a second engine must not see the first engine catalog');
});

// ── Result idiom (matches repo convention; no strictNullChecks) ──────────────────
test('Result helpers narrow via predicate guards', () => {
  const good = ok(42);
  const bad = err('nope');
  assert.ok(isOk(good) && good.value === 42);
  assert.ok(isErr(bad) && bad.error === 'nope');
});
