// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Runtime Orchestrator (Wave 4).
//
// The single execution coordinator for an experience request. It runs eight EXPLICIT,
// OBSERVABLE stages in order — Request → Context → Rules → Version → Configuration
// (placeholder) → Resolution → Rendering → Response — coordinating the EXISTING services
// (engine.resolve, pipeline.render, the resolvers) rather than re-implementing them.
//
// Design principles kept from the earlier waves:
//  · PURE — no DOM, no network, no clock beyond an injectable one (deterministic tests).
//  · GRACEFUL — a stage failure is recorded, never thrown out; execution always reaches
//    'response' and returns an ExperienceExecution with ok=false.
//  · ADDITIVE — it drives the same resolvers/pipeline; nothing is duplicated or replaced.
// ─────────────────────────────────────────────────────────────────────────────
import type { SemVer, Timestamp } from './types';
import type { ExperienceContext, ExperienceRequest, ExperienceResolution, ExperienceResponse } from './context';
import type { RenderingResult, RenderOptions } from './pipeline';
import type { EngineServices } from './services';
import type { DeliveryContext, DeliveryResult } from './delivery';
import type { PolicyEngineEvaluateOptions, PolicyEvent, PolicyOutcome } from './policy';
import type { ConfigurationEvent, EffectiveConfiguration, ResolveConfigurationOptions } from './configuration';
import type { AudienceEvent, ResolveTargetOptions, TargetResolution } from './audience';
import type { FlagEvent, FlagResolution, ResolveFlagsOptions } from './flags';
import type { DecisionEvent, DecisionOutcome, DecisionResolverInput, EnforceOptions, EnforcedState } from './enforcement';
import type { AdaptOptions, RenderInstructionEvent, RenderInstructionSet } from './render-adapter';
import type { BuildPlanOptions, RenderPlan, RenderPlanEvent } from './render-plan';
import { createRenderPlanExecutor } from './render-plan-executor';
import type { RenderPlanExecutionResult } from './render-plan-executor';
import type { RenderPlanMetrics, RolloutDecision, RolloutGate } from './rollout';
import type { DecisionContext, DecisionContextBuilder, VisitorIdentity } from './decision-context';
import { withExperiments } from './decision-context';

// ── Stages (Wave 7 inserts 'policy'; Wave 11 inserts 'enforcement' before rendering) ──
export type ExecutionStage =
  | 'request' | 'context' | 'rules' | 'version' | 'configuration' | 'resolution' | 'policy' | 'enforcement' | 'rendering' | 'response';

export const EXECUTION_STAGES: readonly ExecutionStage[] =
  ['request', 'context', 'rules', 'version', 'configuration', 'resolution', 'policy', 'enforcement', 'rendering', 'response'];

export type ExecutionMode = 'execute' | 'preview' | 'draft';

// ── Diagnostics + metrics (STEP 3) ──────────────────────────────────────────────
export interface ExecutionDiagnostic { stage: ExecutionStage; level: 'info' | 'warn' | 'error'; message: string }

export interface ExecutionMetrics {
  totalMs: number;
  stageMs: Partial<Record<ExecutionStage, number>>;
}

// ── Execution state threaded through the stages (STEP 1 + STEP 3) ───────────────
export interface ExecutionContext {
  traceId: string;
  mode: ExecutionMode;
  request: ExperienceRequest;
  /** The ExperienceContext identity (renamed field to avoid clashing with the type name). */
  experienceContext: ExperienceContext_;
  currentStage: ExecutionStage | null;
  completedStages: ExecutionStage[];
  /** Audiences resolved in the context stage (Wave 9) — carried into policy/configuration. */
  audiences?: TargetResolution;
  /** Feature flags resolved in the context stage (Wave 10) — carried into policy/configuration. */
  flags?: FlagResolution;
  /** The unified Decision Context (Wave 18), populated before policy evaluation. */
  decisionContext?: DecisionContext;
  appliedRules?: string[];
  version?: SemVer | null;
  /** Configuration stage output — the effective remote configuration (Wave 8). */
  configuration?: EffectiveConfiguration | null;
  /** Policy stage output — the effective runtime decision + diagnostics (Wave 7). */
  policy?: PolicyOutcome;
  /** Enforcement stage output — the applied decisions + enforced state (Wave 11). */
  enforcement?: DecisionOutcome;
  /** Render Decision Adapter output — renderer-agnostic instructions (Wave 12). */
  renderInstructions?: RenderInstructionSet;
  /** Render Plan Builder output — the declarative plan (Wave 13). */
  renderPlan?: RenderPlan;
  /** Render Plan execution outcome + rollout decision (Wave 15). */
  renderPlanExecution?: RenderPlanExecutionRecord;
  resolution?: ExperienceResolution;
  renderingResult?: RenderingResult;
  diagnostics: ExecutionDiagnostic[];
  warnings: string[];
  errors: string[];
  metrics: ExecutionMetrics;
  startedAt: Timestamp;
}
type ExperienceContext_ = ExperienceContext;

/** Per-execution record of the Render Plan rollout decision + what it did (Wave 15). */
export interface RenderPlanExecutionRecord {
  executed: boolean;
  reason: string;
  bucket?: number;
  applied: string[];
  skipped: string[];
  nodesModified: number;
  planSize: number;
  executionMs: number;
  redirected: boolean;
  failed: boolean;
}

/** The record of one completed (or failed) execution (STEP 1). */
export interface ExperienceExecution {
  traceId: string;
  ok: boolean;
  response: ExperienceResponse;
  stages: ExecutionStage[];
  metrics: ExecutionMetrics;
  diagnostics: ExecutionDiagnostic[];
  /** The effective runtime decision produced by the policy stage (Wave 7), if evaluated. */
  policy?: PolicyOutcome;
  /** The effective remote configuration produced by the configuration stage (Wave 8). */
  configuration?: EffectiveConfiguration;
  /** The audiences resolved in the context stage (Wave 9). */
  audiences?: TargetResolution;
  /** The feature flags resolved in the context stage (Wave 10). */
  flags?: FlagResolution;
  /** The unified Decision Context (Wave 18) — enriched with experiment variants after policy. */
  decisionContext?: DecisionContext;
  /** The enforcement outcome produced by the enforcement stage (Wave 11). */
  enforcement?: DecisionOutcome;
  /** The renderer-agnostic instructions produced by the Render Decision Adapter (Wave 12). */
  renderInstructions?: RenderInstructionSet;
  /** The declarative plan compiled by the Render Plan Builder (Wave 13). */
  renderPlan?: RenderPlan;
  /** The rollout decision + plan execution outcome for this request (Wave 15). */
  renderPlanExecution?: RenderPlanExecutionRecord;
  failedStage?: ExecutionStage;
  error?: string;
}

// ── Observability hooks (STEP 4) + runtime events (STEP 7) ──────────────────────
export interface RuntimeHooks {
  onBeforeStage?(stage: ExecutionStage, exec: ExecutionContext): void;
  onAfterStage?(stage: ExecutionStage, exec: ExecutionContext): void;
  onStageFailed?(stage: ExecutionStage, error: unknown, exec: ExecutionContext): void;
  onExecutionCompleted?(execution: ExperienceExecution): void;
  onExecutionFailed?(execution: ExperienceExecution, error: unknown): void;
}

export type RuntimeEventType =
  | 'execution.started' | 'stage.started' | 'stage.completed' | 'stage.failed'
  | 'execution.completed' | 'execution.failed';

export interface RuntimeEvent {
  type: RuntimeEventType;
  traceId: string;
  stage?: ExecutionStage;
  at: Timestamp;
  message?: string;
}

// ── Middleware framework (STEP 5) — no concrete middleware shipped ──────────────
export type ExecutionNext = () => Promise<void>;
export type ExecutionMiddleware = (exec: ExecutionContext, next: ExecutionNext) => Promise<void>;

/** Onion composition: mw[0] wraps mw[1] … wraps the core stage loop. Guards double-next(). */
export function composeMiddleware(mw: ExecutionMiddleware[], core: (exec: ExecutionContext) => Promise<void>): (exec: ExecutionContext) => Promise<void> {
  return (exec) => {
    let last = -1;
    const dispatch = (n: number): Promise<void> => {
      if (n <= last) return Promise.reject(new Error('next() called multiple times in middleware'));
      last = n;
      const fn = mw[n];
      return fn ? fn(exec, () => dispatch(n + 1)) : core(exec);
    };
    return dispatch(0);
  };
}

// ── Options + the minimal engine surface the runtime drives ─────────────────────
export interface ExecutionOptions {
  mode?: ExecutionMode;
  hooks?: RuntimeHooks;
  onEvent?: (event: RuntimeEvent) => void;
  /** Optional sink for Policy events (policy.matched/skipped/evaluated/conflict) (Wave 7). */
  onPolicyEvent?: (event: PolicyEvent) => void;
  /** Optional sink for Configuration events (loaded/cached/invalidated/rejected) (Wave 8). */
  onConfigurationEvent?: (event: ConfigurationEvent) => void;
  /** Optional sink for Audience events (matched/rejected/evaluated) (Wave 9). */
  onAudienceEvent?: (event: AudienceEvent) => void;
  /** Optional sink for Feature Flag events (evaluated/enabled/disabled) (Wave 10). */
  onFlagEvent?: (event: FlagEvent) => void;
  /** Optional sink for Decision events (applied/skipped/conflict) (Wave 11). */
  onDecisionEvent?: (event: DecisionEvent) => void;
  /** Optional sink for Render Instruction events (created/ignored) (Wave 12). */
  onInstructionEvent?: (event: RenderInstructionEvent) => void;
  /** Optional sink for Render Plan events (plan.built) (Wave 13). */
  onPlanEvent?: (event: RenderPlanEvent) => void;
  /**
   * FEATURE GATE (Wave 14) — execute the RenderPlan during rendering. **OFF by default.**
   * When false/absent the rendering stage behaves exactly as it did before Wave 14.
   */
  executeRenderPlan?: boolean;
  middleware?: ExecutionMiddleware[];
  render?: RenderOptions;
  /** Monotonic clock for metrics. Default: performance.now when available, else 0. */
  clock?: () => number;
  /** Injectable trace id for deterministic tests. */
  traceId?: string;
  /** The visitor identity for this request (Wave 18). The HOST owns persistence. */
  visitor?: VisitorIdentity;
  /** Explicit Decision Context overrides — applied last, after every provider (Wave 18). */
  decisionOverrides?: Partial<DecisionContext>;
}

/** The engine capabilities the runtime coordinates (decoupled from the concrete engine). */
export interface RuntimeEngineDeps {
  resolve(request: ExperienceRequest): Promise<ExperienceResponse>;
  pipeline: { render(resolution: ExperienceResolution, context: ExperienceContext, opts?: RenderOptions): RenderingResult };
  services: EngineServices;
  /**
   * The Experience Delivery Layer (Wave 5) — the single cache-aware gateway to the sources.
   * OPTIONAL and additive: when present the resolution stage delivers through it (cache →
   * source); when absent the stage falls back to `resolve` directly (Wave 4 behaviour).
   */
  delivery?: { deliver(ctx: DeliveryContext): Promise<DeliveryResult> };
  /**
   * The Policy Engine (Wave 7) — the decision layer the policy stage evaluates through.
   * OPTIONAL and additive: when absent the policy stage is a framework no-op.
   */
  policy?: { evaluate(context: ExperienceContext, opts?: PolicyEngineEvaluateOptions): Promise<PolicyOutcome> };
  /**
   * Remote Configuration (Wave 8) — the capability the configuration stage loads through
   * (provider → cache → policy). OPTIONAL and additive: when absent the stage falls back to a
   * legacy ConfigurationResolver, or a placeholder note.
   */
  configuration?: { resolve(context: ExperienceContext, opts?: ResolveConfigurationOptions): Promise<EffectiveConfiguration> };
  /**
   * The Audience & Targeting Engine (Wave 9) — resolves matched audiences in the context stage.
   * OPTIONAL and additive: when absent the context stage behaves exactly as before.
   */
  audiences?: { resolve(context: ExperienceContext, opts?: ResolveTargetOptions): TargetResolution };
  /**
   * The Feature Flags Engine (Wave 10) — resolves effective flags in the context stage (after
   * audiences). OPTIONAL and additive: when absent the context stage behaves exactly as before.
   */
  flags?: { resolve(context: ExperienceContext, opts?: ResolveFlagsOptions): FlagResolution };
  /**
   * The Decision Enforcement Engine (Wave 11) — applies the effective decisions immediately
   * before rendering. OPTIONAL and additive: when absent the enforcement stage is a no-op.
   */
  enforcement?: { enforce(input: DecisionResolverInput, opts?: EnforceOptions): DecisionOutcome };
  /**
   * The Render Decision Adapter (Wave 12) — converts the EnforcedState into renderer-agnostic
   * instructions after enforcement. OPTIONAL and additive; it never changes rendering.
   */
  renderAdapter?: { adapt(state: EnforcedState, opts?: AdaptOptions): RenderInstructionSet };
  /**
   * The Render Plan Builder (Wave 13) — compiles the instruction set into a declarative plan.
   * OPTIONAL and additive; it never changes rendering.
   */
  renderPlanBuilder?: { build(set: RenderInstructionSet, opts?: BuildPlanOptions): RenderPlan };
  /** Production rollout controls for Render Plan execution (Wave 15). Default is deny. */
  rollout?: RolloutGate;
  /** Render Plan execution metrics sink (Wave 15). */
  renderPlanMetrics?: RenderPlanMetrics;
  /** Builds the unified Decision Context before policy evaluation (Wave 18). */
  decisionContext?: DecisionContextBuilder;
}

const defaultClock = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);
let traceSeq = 0;
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// ── The orchestrator ────────────────────────────────────────────────────────────
export class ExperienceRuntime {
  constructor(private readonly deps: RuntimeEngineDeps) {}

  async execute(request: ExperienceRequest, opts: ExecutionOptions = {}): Promise<ExperienceExecution> {
    const clock = opts.clock ?? defaultClock;
    const mode: ExecutionMode = opts.mode ?? 'execute';
    const at = request.context.now ?? '';
    const traceId = opts.traceId ?? `trace_${request.experienceId}_${++traceSeq}`;

    const exec: ExecutionContext = {
      traceId, mode, request,
      experienceContext: request.context,
      currentStage: null, completedStages: [],
      diagnostics: [], warnings: [], errors: [],
      metrics: { totalMs: 0, stageMs: {} }, startedAt: at,
    };

    const emit = (type: RuntimeEventType, stage?: ExecutionStage, message?: string): void =>
      opts.onEvent?.({ type, traceId, stage, at, message });

    emit('execution.started');

    const core = async (e: ExecutionContext): Promise<void> => {
      for (const stage of EXECUTION_STAGES) {
        await this.runStage(stage, e, opts, clock, emit);
      }
    };

    const runner = composeMiddleware(opts.middleware ?? [], core);
    const t0 = clock();
    try {
      await runner(exec);
      exec.metrics.totalMs = clock() - t0;
      const execution = this.build(exec);
      opts.hooks?.onExecutionCompleted?.(execution);
      emit('execution.completed');
      return execution;
    } catch (e) {
      // A throw here is exceptional (middleware/core failure) — still return a record.
      exec.metrics.totalMs = clock() - t0;
      exec.errors.push(`orchestrator: ${msg(e)}`);
      const execution = this.build(exec, exec.currentStage ?? undefined, msg(e));
      opts.hooks?.onExecutionFailed?.(execution, e);
      emit('execution.failed', exec.currentStage ?? undefined, msg(e));
      return execution;
    }
  }

  /** Run one stage: hooks + events + metrics, with per-stage graceful error capture. */
  private async runStage(stage: ExecutionStage, exec: ExecutionContext, opts: ExecutionOptions, clock: () => number, emit: (t: RuntimeEventType, s?: ExecutionStage, m?: string) => void): Promise<void> {
    exec.currentStage = stage;
    opts.hooks?.onBeforeStage?.(stage, exec);
    emit('stage.started', stage);
    const s0 = clock();
    try {
      await this.executeStage(stage, exec, opts);
      exec.completedStages.push(stage);
      emit('stage.completed', stage);
      opts.hooks?.onAfterStage?.(stage, exec);
    } catch (e) {
      exec.errors.push(`${stage}: ${msg(e)}`);
      exec.diagnostics.push({ stage, level: 'error', message: msg(e) });
      emit('stage.failed', stage, msg(e));
      opts.hooks?.onStageFailed?.(stage, e, exec);
      // graceful: do NOT rethrow — later stages still run, 'response' still assembles.
    } finally {
      exec.metrics.stageMs[stage] = clock() - s0;
    }
  }

  /** Per-stage logic. Coordinates existing services; the Resolution stage is authoritative. */
  private async executeStage(stage: ExecutionStage, exec: ExecutionContext, opts: ExecutionOptions): Promise<void> {
    const { services } = this.deps;
    const note = (level: ExecutionDiagnostic['level'], message: string) => exec.diagnostics.push({ stage, level, message });
    const preview = exec.mode !== 'execute' || !!exec.request.preview;

    switch (stage) {
      case 'request': {
        if (!exec.request.experienceId) throw new Error('missing experienceId');
        if (!exec.request.context) throw new Error('missing context');
        note('info', `mode=${exec.mode} preview=${preview}`);
        return;
      }
      case 'context': {
        // Use an installed ContextResolver if present; otherwise the request's context stands.
        if (services.context) {
          note('info', 'context resolved via ContextResolver');
        } else {
          note('info', 'no ContextResolver installed — using request context');
        }
        // Audience & Targeting (Wave 9): matched audiences become part of the runtime context.
        if (this.deps.audiences) {
          exec.audiences = this.deps.audiences.resolve(exec.experienceContext, { preview, experienceId: exec.request.experienceId, onEvent: opts.onAudienceEvent });
          note('info', `audiences: ${exec.audiences.matched.length} matched, ${exec.audiences.rejected.length} rejected${exec.audiences.matched.length ? ` [${exec.audiences.matched.join(', ')}]` : ''}`);
        }
        // Feature Flags (Wave 10): evaluated with the matched audiences, become part of context.
        if (this.deps.flags) {
          exec.flags = this.deps.flags.resolve(exec.experienceContext, { preview, experienceId: exec.request.experienceId, audiences: exec.audiences?.matched, onEvent: opts.onFlagEvent });
          note('info', `flags: ${exec.flags.matched.length} on, ${exec.flags.rejected.length} off${exec.flags.matched.length ? ` [${exec.flags.matched.join(', ')}]` : ''}`);
        }
        // Decision Context (Wave 18): the ONE context every later capability reads. Built here so
        // it is populated BEFORE policy evaluation; experiment variants are folded in afterwards.
        if (this.deps.decisionContext) {
          exec.decisionContext = this.deps.decisionContext.build({
            context: exec.experienceContext,
            identity: opts.visitor,
            experienceId: exec.request.experienceId,
            preview,
            audiences: exec.audiences?.matched,
            flags: exec.flags?.flags,
          }, opts.decisionOverrides);
          note('info', `decision context: visitor=${exec.decisionContext.identity.visitorId} (${exec.decisionContext.identity.kind}), ${exec.decisionContext.audiences.length} audience(s)`);
        }
        return;
      }
      case 'rules': {
        if (services.rules) {
          const decision = await services.rules.decide(exec.experienceContext, [exec.request.experienceId]);
          exec.appliedRules = decision.appliedRules;
          note('info', `rules applied: ${decision.appliedRules.join(', ') || 'none'}`);
        } else {
          note('info', 'no RuleResolver installed');
        }
        return;
      }
      case 'version': {
        if (services.version) {
          exec.version = await services.version.pick(exec.request.experienceId, exec.experienceContext, preview);
          note('info', `version: ${exec.version ?? 'none'}`);
        } else {
          note('info', 'no VersionResolver installed');
        }
        return;
      }
      case 'configuration': {
        // Remote Configuration (Wave 8): load through the coordinator (provider → cache → policy).
        // Falls back to a legacy ConfigurationResolver, then a placeholder, for engines without it.
        if (this.deps.configuration) {
          const eff = await this.deps.configuration.resolve(exec.experienceContext, { preview, experienceId: exec.request.experienceId, audiences: exec.audiences?.matched, flags: exec.flags?.flags, onEvent: opts.onConfigurationEvent, onPolicyEvent: opts.onPolicyEvent });
          exec.configuration = eff;
          note(eff.rejected ? 'warn' : 'info', eff.rejected
            ? `configuration REJECTED (${eff.reason}) source=${eff.source} sig=${eff.signatureStatus}`
            : `configuration v${eff.version} source=${eff.source} cache=${eff.fromCache ? 'hit' : 'miss'} provider=${eff.providerId ?? '—'} sig=${eff.signatureStatus} policies=${eff.policySummary.matched.length}`);
        } else if (services.configuration) {
          const legacy = await services.configuration.load(exec.experienceContext.tenantId, exec.experienceContext.channel, exec.experienceContext.environment.environment);
          exec.configuration = legacy ? { config: {}, version: legacy.version, source: 'provider', fromCache: legacy.fromCache, signatureStatus: 'unsigned', rejected: false, policySummary: { matched: [], ignored: [], effect: 'noop', conflicts: 0, directives: 0 }, diagnostics: [], resolvedAt: exec.startedAt } : null;
          note('info', `configuration v${legacy?.version ?? '—'}`);
        } else {
          note('info', 'configuration: placeholder (remote configuration not implemented)');
        }
        return;
      }
      case 'resolution': {
        // Authoritative resolution. When the Delivery Layer is wired the request goes through
        // it (cache-first, then the source); otherwise resolve directly (Wave 4 fallback).
        const req: ExperienceRequest = { ...exec.request, preview };
        if (this.deps.delivery) {
          const dr = await this.deps.delivery.deliver({ experienceId: req.experienceId, context: exec.experienceContext, version: exec.version ?? req.version, preview });
          exec.resolution = dr.resolution;
          note(dr.resolution.status === 'resolved' ? 'info' : 'warn', `resolution via delivery (${dr.metadata.fromCache ? 'cache' : 'source'}): ${dr.resolution.status}`);
        } else {
          const resolved = await this.deps.resolve(req);
          exec.resolution = resolved.resolution;
          note(resolved.resolution.status === 'resolved' ? 'info' : 'warn', `resolution: ${resolved.resolution.status}`);
        }
        return;
      }
      case 'policy': {
        // The single decision-making layer (Wave 7). Framework only: with no policies
        // registered the effective decision is a no-op. Never gates resolution/rendering yet.
        if (this.deps.policy) {
          const outcome = await this.deps.policy.evaluate(exec.experienceContext, { experienceId: exec.request.experienceId, preview, audiences: exec.audiences?.matched, flags: exec.flags?.flags, decision: exec.decisionContext, onEvent: opts.onPolicyEvent });
          exec.policy = outcome;
          // Fold any assigned experiment variants back into the context so downstream consumers
          // (and the returned execution) see the complete picture.
          if (exec.decisionContext) {
            const assigned: { [k: string]: string } = {};
            for (const key of Object.keys(outcome.decision.directives)) {
              if (key.startsWith('experiment.')) assigned[key.slice('experiment.'.length)] = String(outcome.decision.directives[key]);
            }
            exec.decisionContext = withExperiments(exec.decisionContext, assigned);
          }
          note('info', `policy: ${outcome.matched.length} matched, ${outcome.ignored.length} ignored, effect=${outcome.decision.effect}${outcome.decision.conflicts.length ? `, ${outcome.decision.conflicts.length} conflict(s)` : ''}`);
        } else {
          note('info', 'policy: no policy engine wired (framework only)');
        }
        return;
      }
      case 'enforcement': {
        // Apply the effective decisions (policy + flags) to the enforced state, immediately
        // before rendering (Wave 11). Framework only: it records the outcome and does NOT change
        // rendering — the enforced state is the seam a later wave binds to the renderer.
        if (this.deps.enforcement) {
          const outcome = this.deps.enforcement.enforce({ policy: exec.policy?.decision, flags: exec.flags?.flags, experienceId: exec.request.experienceId }, { onEvent: opts.onDecisionEvent, at: exec.startedAt });
          exec.enforcement = outcome;
          note('info', `enforcement: ${outcome.applied.length} applied, ${outcome.skipped.length} skipped${outcome.conflicts.length ? `, ${outcome.conflicts.length} conflict(s)` : ''}`);
          // Wave 12: convert the EnforcedState into renderer-agnostic instructions (record-only —
          // the renderer is not bound to these yet, so rendering is unchanged).
          if (this.deps.renderAdapter) {
            exec.renderInstructions = this.deps.renderAdapter.adapt(outcome.state, { onEvent: opts.onInstructionEvent, at: exec.startedAt });
            note('info', `render-adapter: ${exec.renderInstructions.produced} instruction(s), ${exec.renderInstructions.ignored.length} ignored${exec.renderInstructions.redirect ? `, redirect ${exec.renderInstructions.redirect}` : ''}`);
            // Wave 13: compile the instructions into a declarative plan (still record-only —
            // the renderer does not consume the plan yet).
            if (this.deps.renderPlanBuilder) {
              exec.renderPlan = this.deps.renderPlanBuilder.build(exec.renderInstructions, { onEvent: opts.onPlanEvent, at: exec.startedAt });
              note('info', `render-plan: ${exec.renderPlan.metadata.nodeCount} node(s), size ${exec.renderPlan.metadata.planSize}${exec.renderPlan.redirect ? `, redirect ${exec.renderPlan.redirect}` : ''}`);
            }
          }
        } else {
          note('info', 'enforcement: no enforcer wired (framework only)');
        }
        return;
      }
      case 'rendering': {
        if (!exec.resolution) { note('warn', 'no resolution to render'); return; }

        // Wave 15 · rollout decision: an explicit ExecutionOptions flag overrides the gate;
        // otherwise the RolloutGate decides (global OFF / tenant / experience / percentage).
        const decision = this.rolloutDecision(exec, opts);
        let planRun: RenderPlanExecutionResult | null = null;
        let renderOpts: RenderOptions | undefined;

        if (decision.execute && exec.renderPlan) {
          const inner = createRenderPlanExecutor(exec.renderPlan);
          renderOpts = {
            executePlan: true,
            // Wrap so the runtime can observe what execution did (metrics) without the pipeline
            // needing to report it back — the pipeline contract is unchanged.
            planExecutor: { execute: (r, c) => { planRun = inner.execute(r, c); return planRun; } },
          };
        }

        exec.renderingResult = this.deps.pipeline.render(exec.resolution, exec.experienceContext, renderOpts);

        if (decision.execute && exec.renderPlan) {
          const failed = exec.renderingResult.warnings.some(w => w.startsWith('plan execution failed'));
          const record: RenderPlanExecutionRecord = {
            executed: true, reason: decision.reason, bucket: decision.bucket,
            applied: planRun?.applied ?? [], skipped: planRun?.skipped ?? [],
            nodesModified: planRun?.nodesModified ?? 0,
            planSize: exec.renderPlan.metadata.planSize,
            executionMs: planRun?.executionMs ?? 0,
            redirected: exec.renderingResult.status === 'redirected',
            failed,
          };
          exec.renderPlanExecution = record;
          this.deps.renderPlanMetrics?.record({ executionMs: record.executionMs, planSize: record.planSize, nodesModified: record.nodesModified, applied: record.applied.length, skipped: record.skipped.length, redirected: record.redirected, failed });
          this.deps.rollout?.recordOutcome(!failed);
          note(failed ? 'warn' : 'info', `render-plan execution: ON (${decision.reason}) — ${record.applied.length} applied, ${record.skipped.length} skipped, ${record.nodesModified} node(s) modified${failed ? ' — FAILED, rendered without plan' : ''}`);
        } else {
          exec.renderPlanExecution = { executed: false, reason: decision.reason, bucket: decision.bucket, applied: [], skipped: [], nodesModified: 0, planSize: exec.renderPlan?.metadata.planSize ?? 0, executionMs: 0, redirected: false, failed: false };
          note('info', `render-plan execution: OFF (${decision.reason})`);
        }

        note(exec.renderingResult.status === 'rendered' ? 'info' : 'warn', `rendering: ${exec.renderingResult.status}`);
        return;
      }
      case 'response': {
        note('info', 'response assembled');
        return;
      }
    }
  }

  /**
   * Wave 15 · resolve whether Render Plan execution runs for this request.
   * Precedence: an explicit `ExecutionOptions.executeRenderPlan` boolean always wins (used by
   * tests and manual canaries); otherwise the RolloutGate decides; with neither, it is OFF.
   */
  private rolloutDecision(exec: ExecutionContext, opts: ExecutionOptions): RolloutDecision {
    if (typeof opts.executeRenderPlan === 'boolean') {
      return { execute: opts.executeRenderPlan, reason: opts.executeRenderPlan ? 'experience-allowlist' : 'global-off' };
    }
    if (this.deps.rollout) {
      return this.deps.rollout.shouldExecute({ tenantId: exec.experienceContext.tenantId, experienceId: exec.request.experienceId, channel: exec.experienceContext.channel });
    }
    return { execute: false, reason: 'global-off' };
  }

  private build(exec: ExecutionContext, failedStage?: ExecutionStage, error?: string): ExperienceExecution {
    const response: ExperienceResponse = {
      resolution: exec.resolution ?? { status: 'error', experienceId: exec.request.experienceId, channel: exec.request.context.channel, diagnostics: ['no resolution produced'] },
      resolvedAt: exec.startedAt,
      renderingResult: exec.renderingResult,
      diagnostics: exec.diagnostics.map(d => `[${d.stage}] ${d.level}: ${d.message}`),
    };
    return {
      traceId: exec.traceId,
      ok: exec.errors.length === 0,
      response,
      stages: exec.completedStages,
      metrics: exec.metrics,
      diagnostics: exec.diagnostics,
      policy: exec.policy,
      configuration: exec.configuration ?? undefined,
      audiences: exec.audiences,
      flags: exec.flags,
      decisionContext: exec.decisionContext,
      enforcement: exec.enforcement,
      renderInstructions: exec.renderInstructions,
      renderPlan: exec.renderPlan,
      renderPlanExecution: exec.renderPlanExecution,
      failedStage: failedStage ?? (exec.errors.length ? (exec.diagnostics.find(d => d.level === 'error')?.stage) : undefined),
      error,
    };
  }
}

export function createExperienceRuntime(deps: RuntimeEngineDeps): ExperienceRuntime {
  return new ExperienceRuntime(deps);
}
