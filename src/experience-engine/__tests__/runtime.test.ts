// Experience Engine · Runtime Orchestrator tests.
// Proves the full staged lifecycle: Request → Orchestrator → all 8 stages → Rendering →
// Response. Verifies stage order, diagnostics, events, hooks, middleware, graceful failure,
// metrics, and the high-level execute/executePreview/executeDraft API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createExperienceEngine, EXECUTION_STAGES,
  type ExperienceContext, type ExperienceRequest, type EngineServices,
  type RuntimeEvent, type ExecutionStage, type RenderingPort,
} from '../index';

const schema = () => ({ id: 'e', channel: 'website', schemaVersion: '1', layout: { id: 'r', type: 'layout', layout: 'section', children: [] }, locales: ['en'], defaultLocale: 'en', pages: [], nav: [] } as any);

const buildEngine = (servicesOver: Partial<EngineServices> = {}) => {
  const engine = createExperienceEngine({
    services: {
      rules: { async decide(_c, cands) { return { experienceId: cands[0] ?? null, appliedRules: ['locale', 'theme'] }; } },
      version: { async pick() { return '3'; } },
      experience: { async resolve(req) { return { status: 'resolved', experienceId: req.experienceId, channel: 'website', version: '3', schema: schema(), appliedRules: ['locale', 'theme'], diagnostics: [`preview=${!!req.preview}`] }; } },
      ...servicesOver,
    },
  });
  engine.registries.renderers.register('r', { id: 'r', name: 'R', version: '1.0.0', channels: ['website'], target: 'html-string' });
  const port: RenderingPort<string> = { target: 'html-string', render: () => '<html>ok</html>' };
  engine.pipeline.registerPort(port);
  return engine;
};

const ctx = (): ExperienceContext => ({ tenantId: 't1', channel: 'website', role: 'guest', locale: 'en', direction: 'ltr', device: 'desktop', platform: 'web', environment: { environment: 'production' }, flags: {}, now: '2026-01-01T00:00:00.000Z' });
const req = (): ExperienceRequest => ({ experienceId: 'home', context: ctx() });

// ── the full lifecycle + stage order ────────────────────────────────────────────
test('execute() runs all stages in order and produces a rendered response', async () => {
  const engine = buildEngine();
  const exec = await engine.execute(req(), { traceId: 'trace-1', clock: () => 0 });

  assert.equal(exec.ok, true);
  assert.deepEqual(exec.stages, [...EXECUTION_STAGES], 'exact stage order');
  assert.equal(exec.traceId, 'trace-1');
  assert.equal(exec.response.resolution.status, 'resolved');
  assert.equal(exec.response.renderingResult?.status, 'rendered');
  assert.equal(exec.response.renderingResult?.output, '<html>ok</html>');
  assert.equal(exec.failedStage, undefined);
});

test('metrics record per-stage timing for every stage', async () => {
  const engine = buildEngine();
  const exec = await engine.execute(req());
  assert.equal(Object.keys(exec.metrics.stageMs).length, EXECUTION_STAGES.length);
  assert.ok(exec.metrics.totalMs >= 0);
  for (const s of EXECUTION_STAGES) assert.ok(typeof exec.metrics.stageMs[s] === 'number');
});

test('the configuration stage now loads remote configuration (Wave 8)', async () => {
  const engine = buildEngine();
  const exec = await engine.execute(req());
  // With no configuration provider registered the stage loads an empty effective config, source 'none'.
  assert.ok(exec.diagnostics.some(d => d.stage === 'configuration' && /source=none/.test(d.message)));
  assert.equal(exec.configuration?.source, 'none');
  assert.equal(exec.configuration?.rejected, false);
});

// ── events (STEP 7) ──────────────────────────────────────────────────────────────
test('runtime emits execution + stage events in order', async () => {
  const engine = buildEngine();
  const events: RuntimeEvent[] = [];
  await engine.execute(req(), { onEvent: (e) => events.push(e), traceId: 'tr' });

  assert.equal(events[0].type, 'execution.started');
  assert.equal(events[events.length - 1].type, 'execution.completed');
  const stageStarts = events.filter(e => e.type === 'stage.started').map(e => e.stage);
  assert.deepEqual(stageStarts, [...EXECUTION_STAGES]);
  assert.ok(events.every(e => e.traceId === 'tr'));
});

// ── hooks (STEP 4) ───────────────────────────────────────────────────────────────
test('observability hooks fire before/after every stage and on completion', async () => {
  const engine = buildEngine();
  const before: ExecutionStage[] = [], after: ExecutionStage[] = [];
  let completed = false;
  await engine.execute(req(), {
    hooks: {
      onBeforeStage: (s) => before.push(s),
      onAfterStage: (s) => after.push(s),
      onExecutionCompleted: () => { completed = true; },
    },
  });
  assert.deepEqual(before, [...EXECUTION_STAGES]);
  assert.deepEqual(after, [...EXECUTION_STAGES]);
  assert.equal(completed, true);
});

// ── middleware (STEP 5) ──────────────────────────────────────────────────────────
test('middleware wraps the execution (onion order)', async () => {
  const engine = buildEngine();
  const trail: string[] = [];
  await engine.execute(req(), {
    middleware: [
      async (_e, next) => { trail.push('a:in'); await next(); trail.push('a:out'); },
      async (_e, next) => { trail.push('b:in'); await next(); trail.push('b:out'); },
    ],
  });
  assert.deepEqual(trail, ['a:in', 'b:in', 'b:out', 'a:out']);
});

test('middleware can short-circuit before the stages run', async () => {
  const engine = buildEngine();
  let stageRan = false;
  const exec = await engine.execute(req(), {
    hooks: { onBeforeStage: () => { stageRan = true; } },
    middleware: [async () => { /* never calls next() */ }],
  });
  assert.equal(stageRan, false, 'stages skipped when middleware does not call next()');
  assert.equal(exec.stages.length, 0);
});

// ── graceful failure (STEP 9) ────────────────────────────────────────────────────
test('a failing stage is recorded gracefully; later stages still run', async () => {
  const engine = buildEngine({
    rules: { async decide() { throw new Error('rules boom'); } },
  });
  const failed: ExecutionStage[] = [];
  const exec = await engine.execute(req(), { hooks: { onStageFailed: (s) => failed.push(s) } });

  assert.equal(exec.ok, false);
  assert.equal(exec.failedStage, 'rules');
  assert.deepEqual(failed, ['rules']);
  assert.ok(!exec.stages.includes('rules'), 'the failed stage is not marked completed');
  // but the orchestrator continued — resolution/rendering/response still ran:
  assert.ok(exec.stages.includes('resolution') && exec.stages.includes('rendering') && exec.stages.includes('response'));
  assert.ok(exec.response.resolution.status === 'resolved', 'a partial failure still yields a response');
  assert.ok(exec.diagnostics.some(d => d.stage === 'rules' && d.level === 'error'));
});

// ── high-level API (STEP 8) ──────────────────────────────────────────────────────
test('executePreview / executeDraft resolve the working copy (preview=true)', async () => {
  const engine = buildEngine();
  const published = await engine.execute(req());
  const preview = await engine.executePreview(req());
  const draft = await engine.executeDraft(req());

  assert.ok(published.response.resolution.diagnostics?.includes('preview=false'));
  assert.ok(preview.response.resolution.diagnostics?.includes('preview=true'));
  assert.ok(draft.response.resolution.diagnostics?.includes('preview=true'));
});

test('execute() on a bare engine (no services) is graceful, not thrown', async () => {
  const engine = createExperienceEngine();
  const exec = await engine.execute(req());
  // request/context/configuration/response run; resolution reports not-found; rendering skipped.
  assert.equal(exec.response.resolution.status, 'not-found');
  assert.equal(exec.response.renderingResult?.status, 'skipped');
  assert.ok(exec.stages.includes('response'));
});
