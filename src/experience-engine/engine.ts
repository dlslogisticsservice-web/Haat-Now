// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · core (STEP 2).
//
// The chassis. It composes empty registries with (optional) ports and services and exposes
// a stable surface. At this FOUNDATION stage it wires no resolution logic: `resolve()`
// delegates to an ExperienceResolver if one is supplied, else returns an honest 'not-found'
// — it never fabricates a resolution. Later waves install the real resolvers.
//
// PURE: no clock (the caller supplies `context.now`), no DOM, no network, no imports outside
// this module tree. This is the guarantee that makes the Engine independently testable and
// safe to build long before it is connected to any channel.
// ─────────────────────────────────────────────────────────────────────────────
import type { ExperienceContext, ExperienceEnvironment, ExperienceRequest, ExperienceResolution, ExperienceResponse } from './context';
import type { ExperienceEvent } from './events';
import type { EnginePorts } from './ports';
import type { EngineServices } from './services';
import type { EngineRegistries } from './registries';
import { createRegistries } from './registries';
import type { RenderingResult, RenderOptions } from './pipeline';
import { RenderingPipeline, createRenderingPipeline } from './pipeline';
import type { ExperienceExecution, ExecutionOptions, ExperienceRuntime } from './runtime';
import { createExperienceRuntime } from './runtime';
import type { DeliveryContext, DeliverySource, ExperienceDelivery, DeliveryOptions } from './delivery';
import { createExperienceDelivery } from './delivery';
import type { ProviderRegistry } from './providers';
import { createProviderRegistry, createExperienceProvider, createExperienceProviderGateway } from './providers';
import type { PolicyRegistry, PolicyEngine } from './policy';
import { createPolicyRegistry, createPolicyEngine } from './policy';
import type { RemoteConfiguration, RemoteConfigurationOptions } from './configuration';
import { createRemoteConfiguration } from './configuration';
import type { AudienceRegistry } from './audience';
import { createAudienceRegistry, createTargetResolver } from './audience';
import type { FeatureFlagRegistry } from './flags';
import { createFeatureFlagRegistry, createFeatureFlagResolver } from './flags';
import type { DecisionEnforcement } from './enforcement';
import { createDecisionEnforcement } from './enforcement';
import type { RenderDecisionAdapter } from './render-adapter';
import { createRenderDecisionAdapter } from './render-adapter';
import type { RenderPlanBuilder } from './render-plan';
import { createRenderPlanBuilder } from './render-plan';
import type { RenderPlanMetrics, RolloutConfig, RolloutGate } from './rollout';
import { createRenderPlanMetrics, createRolloutGate } from './rollout';
import type { DecisionContextBuilder, DecisionContextProvider } from './decision-context';
import { createDecisionContextBuilder } from './decision-context';

/** Engine build version — the foundation ships as a pre-1.0 chassis. */
export const ENGINE_VERSION = '0.1.0-foundation';

export interface ExperienceEngineOptions {
  ports?: EnginePorts;
  services?: EngineServices;
  environment?: ExperienceEnvironment;
  /** Delivery Layer wiring (caches + event sink). The source is always the engine's `resolve`. */
  delivery?: DeliveryOptions;
  /** Remote Configuration wiring (TTL, injected signature verifier, event sink) (Wave 8). */
  configuration?: RemoteConfigurationOptions;
  /** Render Plan execution rollout (Wave 15). Omitted ⇒ global OFF (nothing executes). */
  rollout?: RolloutConfig;
  /** Decision Context providers registered at construction (Wave 18). */
  contextProviders?: DecisionContextProvider[];
}

/** The public Engine surface every host and channel depends on. */
export interface ExperienceEngine {
  readonly version: string;
  readonly registries: EngineRegistries;
  readonly ports: EnginePorts;
  readonly services: EngineServices;
  readonly environment: ExperienceEnvironment | null;
  /** The rendering pipeline — RenderingPorts register here; render() executes through it. */
  readonly pipeline: RenderingPipeline;
  /** The Experience Delivery Layer — the cache-aware gateway the runtime resolves through. */
  readonly delivery: ExperienceDelivery;
  /** The Provider Registry — Delivery orchestrates the experience source through this (Wave 6). */
  readonly providers: ProviderRegistry;
  /** The Policy Registry — the runtime's policy stage evaluates the effective decision here (Wave 7). */
  readonly policies: PolicyRegistry;
  /** Remote Configuration — the capability the configuration stage loads through (Wave 8). */
  readonly configuration: RemoteConfiguration;
  /** The Audience Registry — the context stage resolves matched audiences from here (Wave 9). */
  readonly audiences: AudienceRegistry;
  /** The Feature Flag Registry — the context stage evaluates effective flags from here (Wave 10). */
  readonly flags: FeatureFlagRegistry;
  /** The Decision Enforcement Engine — applies effective decisions before rendering (Wave 11). */
  readonly enforcement: DecisionEnforcement;
  /** The Render Decision Adapter — converts the EnforcedState into render instructions (Wave 12). */
  readonly renderAdapter: RenderDecisionAdapter;
  /** The Render Plan Builder — compiles instructions into a declarative RenderPlan (Wave 13). */
  readonly renderPlanBuilder: RenderPlanBuilder;
  /** Production rollout controls for Render Plan execution — kill switch + canary (Wave 15). */
  readonly rollout: RolloutGate;
  /** Render Plan execution metrics (latency, plan size, nodes modified, ops) (Wave 15). */
  readonly renderPlanMetrics: RenderPlanMetrics;
  /** The Decision Context builder — register providers here (Wave 18). */
  readonly decisionContext: DecisionContextBuilder;
  /** Resolve an experience for a context. Foundation: 'not-found' until a resolver is wired. */
  resolve(request: ExperienceRequest): Promise<ExperienceResponse>;
  /** Render an already-resolved experience through the pipeline. Never throws. */
  render(resolution: ExperienceResolution, context: ExperienceContext, opts?: RenderOptions): RenderingResult;
  /** Resolve then render in one call — the full Request → Response flow. */
  resolveAndRender(request: ExperienceRequest, opts?: RenderOptions): Promise<ExperienceResponse>;
  /** The Runtime Orchestrator — coordinates the full staged execution lifecycle. */
  readonly runtime: ExperienceRuntime;
  /** High-level API: orchestrate the full staged execution (published). */
  execute(request: ExperienceRequest, opts?: ExecutionOptions): Promise<ExperienceExecution>;
  /** High-level API: orchestrate a preview execution (resolves the working copy). */
  executePreview(request: ExperienceRequest, opts?: ExecutionOptions): Promise<ExperienceExecution>;
  /** High-level API: orchestrate a draft execution (resolves the draft). */
  executeDraft(request: ExperienceRequest, opts?: ExecutionOptions): Promise<ExperienceExecution>;
  /** Fan an event out to the events + analytics ports, if present. */
  emit(event: ExperienceEvent): void;
}

/** Construct a fresh Engine. Registries start empty; ports/services default to none. */
export function createExperienceEngine(options: ExperienceEngineOptions = {}): ExperienceEngine {
  const registries = createRegistries();
  const ports: EnginePorts = options.ports ?? {};
  const services: EngineServices = options.services ?? {};
  const environment: ExperienceEnvironment | null = options.environment ?? null;
  const pipeline = createRenderingPipeline(registries.renderers);

  // `resolve` is a standalone so the runtime, resolveAndRender and engine.resolve share one path.
  const resolve = async (request: ExperienceRequest): Promise<ExperienceResponse> => {
    const resolvedAt = request.context.now ?? '';
    const resolver = services.experience;
    if (resolver) {
      const resolution = await resolver.resolve(request);
      return { resolution, resolvedAt };
    }
    // No resolver installed yet — report honestly, never invent a result.
    return {
      resolution: {
        status: 'not-found',
        experienceId: request.experienceId,
        channel: request.context.channel,
        diagnostics: ['engine-foundation: no ExperienceResolver wired (arrives in Wave 2+)'],
      },
      resolvedAt,
    };
  };

  // The Delivery Layer's source is `resolve` itself — delivery inserts a cache/version/
  // snapshot layer in front of it without the engine knowing about any concrete source.
  const deliverySource: DeliverySource = {
    async resolve(dctx: DeliveryContext): Promise<ExperienceResolution> {
      const request: ExperienceRequest = { experienceId: dctx.experienceId, context: dctx.context, version: dctx.version, preview: dctx.preview };
      return (await resolve(request)).resolution;
    },
  };

  // Wave 6: the source is registered as the first ExperienceProvider, and Delivery orchestrates
  // it through the Provider Registry (via the gateway). The direct source stays as the fallback,
  // so behaviour is identical whether or not a provider resolves.
  const providers = createProviderRegistry();
  providers.register(createExperienceProvider(deliverySource, { id: 'experience.website', name: 'Website Experience Provider' }));
  const providerGateway = createExperienceProviderGateway(providers);
  const delivery = createExperienceDelivery(deliverySource, { ...options.delivery, providers: providerGateway });

  // Wave 7: the Policy Engine drives the runtime's policy stage. The registry starts empty
  // (framework only) — with no policies the effective decision is a no-op and nothing changes.
  const policies = createPolicyRegistry();
  const policyEngine: PolicyEngine = createPolicyEngine(policies);

  // Wave 8: Remote Configuration composes the SAME provider registry, the Delivery
  // ConfigurationCache, and the Policy Engine — no new infrastructure. With no configuration
  // provider registered the configuration stage loads an empty effective config (source 'none').
  const configuration = createRemoteConfiguration({ providers, policyEngine, cache: delivery.caches.configuration }, options.configuration);

  // Wave 9: the Audience & Targeting Engine resolves matched audiences in the context stage.
  // The registry starts empty — with no audiences registered nothing matches and no behaviour
  // changes; matched audience ids flow into the policy + configuration stages.
  const audiences = createAudienceRegistry();
  const targetResolver = createTargetResolver(audiences);

  // Wave 10: the Feature Flags Engine evaluates effective flags in the context stage (after
  // audiences). The registry starts empty — no flags means no effective state and no behaviour
  // change; effective flags flow into the policy + configuration stages.
  const flags = createFeatureFlagRegistry();
  const flagResolver = createFeatureFlagResolver(flags);

  // Wave 11: the Decision Enforcement Engine applies the effective decisions (policy + flags) to
  // the enforced state immediately before rendering. Framework only — with no policies/flags the
  // outcome is empty and rendering is unchanged.
  const enforcement = createDecisionEnforcement();

  // Wave 12: the Render Decision Adapter converts the EnforcedState into renderer-agnostic
  // instructions after enforcement. Record-only — the renderer is not bound to these yet.
  const renderAdapter = createRenderDecisionAdapter();

  // Wave 13: the Render Plan Builder compiles the instruction set into a declarative RenderPlan.
  // Record-only — the renderer does not consume the plan yet.
  const renderPlanBuilder = createRenderPlanBuilder();

  // Wave 15: production rollout controls. Default is a hard global OFF — an engine built without
  // an explicit rollout config executes no render plans, for any tenant.
  const rollout = createRolloutGate(options.rollout ?? { enabled: false });
  const renderPlanMetrics = createRenderPlanMetrics();

  // Wave 18: the unified Decision Context, populated in the context stage before policy runs.
  const decisionContext = createDecisionContextBuilder(options.contextProviders ?? []);

  const runtime = createExperienceRuntime({ resolve, pipeline, services, delivery, policy: policyEngine, configuration, audiences: targetResolver, flags: flagResolver, enforcement, renderAdapter, renderPlanBuilder, rollout, renderPlanMetrics, decisionContext });

  const engine: ExperienceEngine = {
    version: ENGINE_VERSION,
    registries,
    ports,
    services,
    environment,
    pipeline,
    delivery,
    providers,
    policies,
    configuration,
    audiences,
    flags,
    enforcement,
    renderAdapter,
    renderPlanBuilder,
    rollout,
    renderPlanMetrics,
    decisionContext,
    runtime,

    resolve,

    render(resolution: ExperienceResolution, context: ExperienceContext, opts?: RenderOptions): RenderingResult {
      return pipeline.render(resolution, context, opts);
    },

    async resolveAndRender(request: ExperienceRequest, opts?: RenderOptions): Promise<ExperienceResponse> {
      const resolved = await resolve(request);
      const renderingResult = pipeline.render(resolved.resolution, request.context, opts);
      return { ...resolved, renderingResult };
    },

    execute(request: ExperienceRequest, opts?: ExecutionOptions): Promise<ExperienceExecution> {
      return runtime.execute(request, { ...opts, mode: 'execute' });
    },
    executePreview(request: ExperienceRequest, opts?: ExecutionOptions): Promise<ExperienceExecution> {
      return runtime.execute(request, { ...opts, mode: 'preview' });
    },
    executeDraft(request: ExperienceRequest, opts?: ExecutionOptions): Promise<ExperienceExecution> {
      return runtime.execute(request, { ...opts, mode: 'draft' });
    },

    emit(event: ExperienceEvent): void {
      ports.events?.publish(event);
      ports.analytics?.dispatch(event);
    },
  };

  return engine;
}
