// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Rendering Pipeline (Wave 3).
//
// Turns a resolved experience into rendered output:
//   Resolution → RendererResolver → RenderingPort → RenderingResult
//
// PURE. The pipeline knows nothing about HTML, React, or any concrete renderer — it selects
// a renderer from the RendererRegistry (metadata) and executes the matching RenderingPort
// (an interface an adapter satisfies). It NEVER throws: every failure mode returns a
// RenderingResult with an explicit status. Execution time comes from an injected clock, so
// the pipeline stays deterministic in tests.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, SemVer } from './types';
import type { ExperienceContext, ExperienceResolution } from './context';
import type { RendererMetadata } from './metadata';
import type { RenderingPort } from './ports';
import type { RendererRegistry } from './registries';

/** Known render targets. Only 'html-string' (Website) is executable today; the rest are
 *  declared so the pipeline is multi-target-ready without implementing them (STEP 8). */
export type RenderTarget =
  | 'html-string' | 'react-dom' | 'react-native' | 'flutter' | 'json' | 'voice' | 'email' | 'pdf' | (string & {});

export type RenderStatus =
  | 'rendered' | 'renderer-missing' | 'unsupported-target' | 'renderer-failed' | 'version-conflict' | 'skipped'
  /** Wave 14: a RenderPlan redirect short-circuited rendering (the port was not called). */
  | 'redirected';

/** The full outcome of a render attempt (STEP 5). */
export interface RenderingResult<Out = unknown> {
  status: RenderStatus;
  renderer: string | null;
  target: string | null;
  version: SemVer | null;
  executionMs: number;
  output: Out | null;
  warnings: string[];
  diagnostics: string[];
}

/** RendererResolver output: the chosen renderer + whether it was a fallback. */
export interface RendererSelection {
  renderer: RendererMetadata | null;
  fallback: boolean;
  diagnostics: string[];
}

export interface RendererCriteria { channel: ChannelId; target?: string; version?: SemVer }

/**
 * RendererResolver (STEP 2). Selects the best renderer for the criteria, with a fallback to
 * any channel renderer when the exact target is absent. Pure; records diagnostics.
 */
export function resolveRenderer(registry: RendererRegistry, criteria: RendererCriteria): RendererSelection {
  const diagnostics: string[] = [];
  const channelRenderers = registry.byChannel(criteria.channel);
  if (channelRenderers.length === 0) {
    return { renderer: null, fallback: false, diagnostics: [`no renderer registered for channel '${criteria.channel}'`] };
  }

  // Prefer exact target (+ version) by priority.
  if (criteria.target) {
    const exact = registry.matching({ channel: criteria.channel, target: criteria.target, version: criteria.version });
    if (exact.length > 0) {
      diagnostics.push(`matched target '${criteria.target}'${criteria.version ? ` v${criteria.version}` : ''}`);
      return { renderer: exact[0], fallback: false, diagnostics };
    }
    // Target present but no version match — surface a version note (pipeline may flag conflict).
    const targetOnly = registry.matching({ channel: criteria.channel, target: criteria.target });
    if (targetOnly.length > 0) {
      diagnostics.push(`target '${criteria.target}' found but not version '${criteria.version}' — using v${targetOnly[0].version}`);
      return { renderer: targetOnly[0], fallback: false, diagnostics };
    }
    diagnostics.push(`no renderer for target '${criteria.target}' — falling back to a channel default`);
  }

  // Fallback: highest-priority renderer for the channel.
  const best = [...channelRenderers].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  return { renderer: best, fallback: !!criteria.target, diagnostics };
}

/**
 * The Render Plan execution seam (Wave 14). Declared STRUCTURALLY so pipeline.ts imports nothing
 * from the plan modules — `context.ts` already type-references this module, so an import the other
 * way would close a cycle. `render-plan-executor.ts` satisfies this shape.
 */
export interface PipelinePlanExecutor {
  execute(resolution: ExperienceResolution, context: ExperienceContext): {
    resolution: ExperienceResolution;
    redirect: string | null;
    applied: string[];
    skipped: string[];
    executionMs: number;
    diagnostics: string[];
  };
}

export interface RenderOptions {
  /** Force a specific target; otherwise the resolved/default target is used. */
  target?: string;
  /** Fail if the resolved renderer's version differs from this. */
  requireVersion?: SemVer;
  /** Monotonic clock for execution timing. Default: performance.now when available, else 0. */
  clock?: () => number;
  /**
   * FEATURE GATE (Wave 14) — Render Plan execution. OFF by default: unless this is explicitly
   * true AND a `planExecutor` is supplied, the pipeline behaves exactly as before.
   */
  executePlan?: boolean;
  /** The bound plan executor. Ignored unless `executePlan` is true. */
  planExecutor?: PipelinePlanExecutor;
}

const defaultClock = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);

const missing = (diag: string, target: string | null): RenderingResult =>
  ({ status: 'renderer-missing', renderer: null, target, version: null, executionMs: 0, output: null, warnings: [], diagnostics: [diag] });

/**
 * The pipeline. Holds one RenderingPort per target; selects + executes; never throws.
 */
export class RenderingPipeline {
  private readonly ports = new Map<string, RenderingPort>();

  constructor(private readonly renderers: RendererRegistry) {}

  /** Register an executable RenderingPort (keyed by its target). Last registration wins. */
  registerPort(port: RenderingPort): void { this.ports.set(port.target, port); }
  getPort(target: string): RenderingPort | null { return this.ports.get(target) ?? null; }
  hasPort(target: string): boolean { return this.ports.has(target); }
  targets(): string[] { return [...this.ports.keys()]; }

  /** Execute rendering for a resolution. Returns a RenderingResult for EVERY outcome. */
  render<Out = unknown>(resolution: ExperienceResolution, context: ExperienceContext, opts: RenderOptions = {}): RenderingResult<Out> {
    const clock = opts.clock ?? defaultClock;

    if (resolution.status !== 'resolved' || !resolution.schema) {
      return { status: 'skipped', renderer: null, target: opts.target ?? null, version: resolution.version ?? null, executionMs: 0, output: null, warnings: [], diagnostics: [`nothing to render (resolution status '${resolution.status}')`] };
    }

    // 1 · select a renderer
    const selection = resolveRenderer(this.renderers, { channel: resolution.channel, target: opts.target, version: opts.requireVersion ?? resolution.version });
    if (!selection.renderer) {
      return missing(selection.diagnostics[0] ?? 'no renderer', opts.target ?? null) as RenderingResult<Out>;
    }
    const renderer = selection.renderer;

    // 2 · version conflict (only when explicitly required)
    if (opts.requireVersion && renderer.version !== opts.requireVersion) {
      return { status: 'version-conflict', renderer: renderer.id, target: renderer.target, version: renderer.version, executionMs: 0, output: null, warnings: [], diagnostics: [`required v${opts.requireVersion} but renderer is v${renderer.version}`] };
    }

    // 3 · find the executable port for the renderer's target
    const target = renderer.target;
    const port = this.getPort(target);
    if (!port) {
      return { status: 'unsupported-target', renderer: renderer.id, target, version: resolution.version ?? null, executionMs: 0, output: null, warnings: selection.diagnostics, diagnostics: [`renderer '${renderer.id}' selected but no RenderingPort registered for target '${target}'`] };
    }

    // 4 · execute — graceful on failure, never throws
    const warnings = selection.fallback ? ['used a fallback renderer'] : [];
    const diagnostics = [...selection.diagnostics];

    // 4a · Render Plan execution (Wave 14) — GATED OFF by default. When enabled, the plan is
    // interpreted here and the port receives an ordinary (transformed) resolution; the renderer
    // never sees the plan and the port abstraction is not bypassed.
    let effective = resolution;
    if (opts.executePlan && opts.planExecutor) {
      try {
        const planRun = opts.planExecutor.execute(resolution, context);
        diagnostics.push(...planRun.diagnostics);
        if (planRun.applied.length) diagnostics.push(`plan applied: ${planRun.applied.join('; ')}`);
        if (planRun.skipped.length) diagnostics.push(`plan skipped: ${planRun.skipped.join('; ')}`);
        diagnostics.push(`plan execution ${planRun.executionMs.toFixed(3)}ms`);
        if (planRun.redirect) {
          // Short-circuit: do NOT call the port.
          return { status: 'redirected', renderer: renderer.id, target, version: resolution.version ?? null, executionMs: planRun.executionMs, output: null, warnings, diagnostics: [...diagnostics, `redirected to ${planRun.redirect}`] };
        }
        effective = planRun.resolution;
      } catch (e) {
        // A failing executor must never break rendering — fall back to the untransformed resolution.
        warnings.push('plan execution failed; rendered without plan');
        diagnostics.push(`plan executor threw: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const t0 = clock();
    let output: Out | null = null;
    let status: RenderStatus = 'rendered';
    try {
      output = port.render(effective, context) as Out;
    } catch (e) {
      status = 'renderer-failed';
      diagnostics.push(`renderer '${renderer.id}' threw: ${e instanceof Error ? e.message : String(e)}`);
    }
    const executionMs = clock() - t0;

    return { status, renderer: renderer.id, target, version: resolution.version ?? null, executionMs, output, warnings, diagnostics };
  }
}

export function createRenderingPipeline(renderers: RendererRegistry): RenderingPipeline {
  return new RenderingPipeline(renderers);
}
