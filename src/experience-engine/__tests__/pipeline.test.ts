// Experience Engine · Rendering Pipeline tests.
// Proves the pipeline selects a renderer, executes its port, times it deterministically,
// and returns an explicit RenderingResult for EVERY failure mode — it never throws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createExperienceEngine, resolveRenderer,
  type ExperienceContext, type ExperienceResolution, type RenderingPort, type RendererMetadata,
} from '../index';

const ctx = (): ExperienceContext => ({
  tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr',
  device: 'desktop', platform: 'web', environment: { environment: 'sandbox' }, now: '2026-01-01T00:00:00.000Z',
});

const resolution = (over: Partial<ExperienceResolution> = {}): ExperienceResolution => ({
  status: 'resolved', experienceId: 'home', channel: 'website', version: '1.0.0',
  schema: { id: 'home', channel: 'website', schemaVersion: '1', layout: { id: 'r', type: 'layout', layout: 'section', children: [] }, locales: ['en'], defaultLocale: 'en', pages: [], nav: [] } as any,
  ...over,
});

const rendererMeta = (over: Partial<RendererMetadata> = {}): RendererMetadata => ({
  id: 'r1', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string', priority: 0, ...over,
});

const fakePort = (target: string, out: string, throws = false): RenderingPort<string> => ({
  target,
  render() { if (throws) throw new Error('boom'); return out; },
});

// deterministic clock: 1000 then 1007 → executionMs 7
const clock = () => { let n = 1000; return () => (n += 7) - 7; };

// ── happy path ──────────────────────────────────────────────────────────────
test('resolve → renderer selection → port execution → RenderingResult', () => {
  const engine = createExperienceEngine();
  engine.registries.renderers.register('r1', rendererMeta());
  engine.pipeline.registerPort(fakePort('html-string', '<html>ok</html>'));

  const r = engine.render(resolution(), ctx(), { clock: clock() });
  assert.equal(r.status, 'rendered');
  assert.equal(r.renderer, 'r1');
  assert.equal(r.target, 'html-string');
  assert.equal(r.version, '1.0.0');
  assert.equal(r.output, '<html>ok</html>');
  assert.equal(r.executionMs, 7, 'timed via the injected clock (deterministic)');
});

test('highest-priority renderer wins when several match', () => {
  const reg = createExperienceEngine().registries.renderers;
  reg.register('lo', rendererMeta({ id: 'lo', priority: 1 }));
  reg.register('hi', rendererMeta({ id: 'hi', priority: 9 }));
  const sel = resolveRenderer(reg, { channel: 'website', target: 'html-string' });
  assert.equal(sel.renderer?.id, 'hi');
  assert.equal(sel.fallback, false);
});

test('resolveRenderer falls back to a channel renderer when the target is absent', () => {
  const reg = createExperienceEngine().registries.renderers;
  reg.register('rd', rendererMeta({ id: 'rd', target: 'react-dom' }));
  const sel = resolveRenderer(reg, { channel: 'website', target: 'html-string' });
  assert.equal(sel.renderer?.id, 'rd');
  assert.equal(sel.fallback, true);
  assert.ok(sel.diagnostics.some(d => /falling back/.test(d)));
});

// ── error handling (STEP 7) — every mode returns a result, never throws ────────
test('renderer-missing when no renderer is registered for the channel', () => {
  const engine = createExperienceEngine();
  const r = engine.render(resolution(), ctx());
  assert.equal(r.status, 'renderer-missing');
  assert.equal(r.output, null);
});

test('unsupported-target when a renderer is selected but no port is registered', () => {
  const engine = createExperienceEngine();
  engine.registries.renderers.register('r1', rendererMeta());
  const r = engine.render(resolution(), ctx());
  assert.equal(r.status, 'unsupported-target');
  assert.match(r.diagnostics.join(' '), /no RenderingPort/);
});

test('renderer-failed (gracefully) when the port throws', () => {
  const engine = createExperienceEngine();
  engine.registries.renderers.register('r1', rendererMeta());
  engine.pipeline.registerPort(fakePort('html-string', '', true));
  const r = engine.render(resolution(), ctx());
  assert.equal(r.status, 'renderer-failed');
  assert.equal(r.output, null);
  assert.match(r.diagnostics.join(' '), /threw: boom/);
});

test('version-conflict when a specific renderer version is required but absent', () => {
  const engine = createExperienceEngine();
  engine.registries.renderers.register('r1', rendererMeta({ version: '1.0.0' }));
  engine.pipeline.registerPort(fakePort('html-string', 'x'));
  const r = engine.render(resolution(), ctx(), { requireVersion: '2.0.0' });
  assert.equal(r.status, 'version-conflict');
});

test('skipped when the resolution is not resolved (nothing to render)', () => {
  const engine = createExperienceEngine();
  const r = engine.render(resolution({ status: 'not-found', schema: undefined }), ctx());
  assert.equal(r.status, 'skipped');
});

// ── resolveAndRender is the full flow ──────────────────────────────────────────
test('resolveAndRender returns resolution + renderingResult together', async () => {
  const engine = createExperienceEngine({
    services: { experience: { async resolve() { return resolution(); } } },
  });
  engine.registries.renderers.register('r1', rendererMeta());
  engine.pipeline.registerPort(fakePort('html-string', '<html>done</html>'));

  const res = await engine.resolveAndRender({ experienceId: 'home', context: ctx() });
  assert.equal(res.resolution.status, 'resolved');
  assert.equal(res.renderingResult?.status, 'rendered');
  assert.equal(res.renderingResult?.output, '<html>done</html>');
});
