// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Policy Engine (Wave 7).
//
// The single decision-making layer. Policies are pluggable, prioritised, scope-matched,
// health-reporting decision units. The Policy Registry registers them; the Policy Evaluator
// matches by scope, evaluates by priority, merges results deterministically, and produces the
// EFFECTIVE runtime decision. Policy evaluation runs as a Runtime stage.
//
//   Runtime → Delivery → Providers → (resolution) → Policy Engine → Effective Runtime Decision
//
// PURE + FRAMEWORK ONLY. No business rules: the evaluator merges whatever policies return; it
// encodes precedence (priority + effect rank), not domain logic. STEP 4 policy types are
// CONTRACTS ONLY — none is implemented. Remote Configuration, Feature Flags and Personalization
// are NOT implemented. This module depends only on the context/type contracts (one-directional).
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, Environment, ExperienceId, Json, LocaleCode, RoleId, SemVer, TenantId, Timestamp } from './types';
import type { ExperienceContext } from './context';
import type { DecisionContext } from './decision-context';

// ── STEP 1 · Policy contracts ───────────────────────────────────────────────────
export type PolicyType =
  | 'configuration' | 'feature-flag' | 'personalization' | 'experiment'
  | 'licensing' | 'tenant' | 'geography' | 'runtime-override' | (string & {});

/** Higher wins. Policies are evaluated/merged in descending priority. */
export type PolicyPriority = number;

/** The four health states every policy reports (mirrors Provider health). */
export type PolicyHealthStatus = 'healthy' | 'degraded' | 'offline' | 'unsupported';
export interface PolicyHealth { status: PolicyHealthStatus; since?: Timestamp; detail?: string }

/** Where a policy applies. The registry matches these against a PolicyContext. */
export interface PolicyScope {
  channels?: ChannelId[];
  environments?: Environment[];
  roles?: RoleId[];
  tenants?: TenantId[];
  locales?: LocaleCode[];
  countries?: string[];
  segments?: string[];
  experiences?: ExperienceId[];
  /** Audience ids this policy applies to — matched against the context's resolved audiences (Wave 9). */
  audiences?: string[];
  tags?: string[];
}

export interface PolicyMetadata {
  id: string;
  name: string;
  type: PolicyType;
  version: SemVer;
  priority?: PolicyPriority;
  scope?: PolicyScope;
  description?: string;
}

/** The identity a policy is evaluated against. */
export interface PolicyContext {
  tenantId: TenantId;
  channel: ChannelId;
  environment: Environment;
  role?: RoleId;
  locale?: LocaleCode;
  country?: string;
  experienceId?: ExperienceId;
  preview?: boolean;
  segments?: string[];
  /** Audience ids resolved for this request (Wave 9) — lets a policy scope by audience. */
  audiences?: string[];
  /**
   * Effective feature flags resolved for this request (Wave 10). Typed structurally so policy.ts
   * never imports flags.ts (flags.ts imports policy.ts for FeatureFlagPolicy) — no dependency cycle.
   */
  flags?: { [key: string]: { enabled: boolean; variant?: string; value?: Json } };
  /**
   * The unified Decision Context (Wave 18) — the single value future capabilities read. Populated
   * by the runtime BEFORE policy evaluation. The fields above remain for existing policies.
   */
  decision?: DecisionContext;
  now?: Timestamp;
}

/** What a policy decides. `directives` are key→value contributions merged into the decision. */
export type PolicyEffect = 'allow' | 'deny' | 'override' | 'annotate' | 'noop';
export interface PolicyDirective { key: string; value: Json }
export interface PolicyResult {
  effect: PolicyEffect;
  directives?: PolicyDirective[];
  reason?: string;
  tags?: string[];
}

/** The base every policy implements: identity, scope match, evaluation, health. */
export interface Policy {
  readonly metadata: PolicyMetadata;
  applies(ctx: PolicyContext): boolean;
  evaluate(ctx: PolicyContext): PolicyResult | Promise<PolicyResult>;
  health(): PolicyHealth;
}

// ── STEP 4 · policy types — CONTRACTS ONLY (none implemented this wave) ──────────
export interface ConfigurationPolicy extends Policy { readonly metadata: PolicyMetadata & { type: 'configuration' } }
export interface FeatureFlagPolicy extends Policy { readonly metadata: PolicyMetadata & { type: 'feature-flag' } }
export interface PersonalizationPolicy extends Policy { readonly metadata: PolicyMetadata & { type: 'personalization' } }
export interface ExperimentPolicy extends Policy { readonly metadata: PolicyMetadata & { type: 'experiment' } }
export interface LicensingPolicy extends Policy { readonly metadata: PolicyMetadata & { type: 'licensing' } }
export interface TenantPolicy extends Policy { readonly metadata: PolicyMetadata & { type: 'tenant' } }
export interface GeographyPolicy extends Policy { readonly metadata: PolicyMetadata & { type: 'geography' } }
export interface RuntimeOverridePolicy extends Policy { readonly metadata: PolicyMetadata & { type: 'runtime-override' } }

// ── Effective decision + diagnostics (STEP 6) ───────────────────────────────────
export interface PolicyConflict { key: string; winner: string; loser: string; winningValue: Json; losingValue: Json }

export interface EffectivePolicyDecision {
  effect: PolicyEffect;
  directives: { [key: string]: Json };
  contributors: string[];
  conflicts: PolicyConflict[];
}

/** Per-policy evaluation record — the decision trace. */
export interface PolicyEvaluation {
  policyId: string;
  type: PolicyType;
  matched: boolean;
  skipped: boolean;
  priority: PolicyPriority;
  result?: PolicyResult;
  evaluationMs: number;
  error?: string;
}

/** The full outcome of an evaluation pass (STEP 6). */
export interface PolicyOutcome {
  decision: EffectivePolicyDecision;
  matched: string[];
  ignored: string[];
  evaluations: PolicyEvaluation[];
  totalMs: number;
}

// ── Events (STEP 7) ──────────────────────────────────────────────────────────────
export type PolicyEventType = 'policy.matched' | 'policy.skipped' | 'policy.evaluated' | 'policy.conflict';
export interface PolicyEvent { type: PolicyEventType; policyId?: string; at: Timestamp; message?: string }

// ── Scope matching (pure) ────────────────────────────────────────────────────────
const hit = <T>(allowed: T[] | undefined, value: T | undefined): boolean =>
  !allowed || allowed.length === 0 || (value !== undefined && allowed.includes(value));

const overlaps = (allowed: string[] | undefined, values: string[] | undefined): boolean =>
  !allowed || allowed.length === 0 || (!!values && values.some(v => allowed.includes(v)));

export function policyMatchesScope(scope: PolicyScope | undefined, ctx: PolicyContext): boolean {
  if (!scope) return true;
  return hit(scope.channels, ctx.channel)
    && hit(scope.environments, ctx.environment)
    && hit(scope.roles, ctx.role)
    && hit(scope.tenants, ctx.tenantId)
    && hit(scope.locales, ctx.locale)
    && hit(scope.countries, ctx.country)
    && hit(scope.experiences, ctx.experienceId)
    && overlaps(scope.segments, ctx.segments)
    && overlaps(scope.audiences, ctx.audiences);
}

/** Map an ExperienceContext to the PolicyContext the engine evaluates against (pure). */
export function toPolicyContext(context: ExperienceContext, extra: { experienceId?: ExperienceId; preview?: boolean; audiences?: string[]; flags?: PolicyContext['flags']; decision?: DecisionContext } = {}): PolicyContext {
  return {
    tenantId: context.tenantId,
    channel: context.channel,
    environment: context.environment.environment,
    role: context.role,
    locale: context.locale,
    country: context.country,
    experienceId: extra.experienceId,
    preview: extra.preview,
    segments: context.segments,
    audiences: extra.audiences,
    flags: extra.flags,
    decision: extra.decision,
    now: context.now,
  };
}

const isUsable = (h: PolicyHealthStatus): boolean => h === 'healthy' || h === 'degraded';
const healthRank = (h: PolicyHealthStatus): number => (h === 'healthy' ? 0 : h === 'degraded' ? 1 : 2);
const effectRank = (e: PolicyEffect): number => (e === 'deny' ? 4 : e === 'override' ? 3 : e === 'allow' ? 2 : e === 'annotate' ? 1 : 0);

// ── STEP 2 · Policy Registry ────────────────────────────────────────────────────
export interface PolicyRegistry {
  register(policy: Policy): void;
  unregister(id: string): void;
  get(id: string): Policy | null;
  has(id: string): boolean;
  all(): Policy[];
  byType(type: PolicyType): Policy[];
  /** All usable policies whose scope matches, sorted by priority desc (STEP 2). */
  matching(ctx: PolicyContext, types?: PolicyType[]): Policy[];
  /** The single highest-priority matching policy, or null (graceful). */
  resolve(ctx: PolicyContext, types?: PolicyType[]): Policy | null;
  health(): Record<string, PolicyHealth>;
  ids(): string[];
  size(): number;
  clear(): void;
}

export class InMemoryPolicyRegistry implements PolicyRegistry {
  private readonly policies = new Map<string, Policy>();

  register(policy: Policy): void { this.policies.set(policy.metadata.id, policy); }
  unregister(id: string): void { this.policies.delete(id); }
  get(id: string): Policy | null { return this.policies.get(id) ?? null; }
  has(id: string): boolean { return this.policies.has(id); }
  all(): Policy[] { return [...this.policies.values()]; }
  byType(type: PolicyType): Policy[] { return this.all().filter(p => p.metadata.type === type); }

  matching(ctx: PolicyContext, types?: PolicyType[]): Policy[] {
    return this.all()
      .filter(p => (!types || types.length === 0 || types.includes(p.metadata.type)))
      .filter(p => isUsable(p.health().status) && p.applies(ctx))
      .sort((a, b) => {
        const pri = (b.metadata.priority ?? 0) - (a.metadata.priority ?? 0);
        if (pri !== 0) return pri;
        return healthRank(a.health().status) - healthRank(b.health().status);
      });
  }

  resolve(ctx: PolicyContext, types?: PolicyType[]): Policy | null {
    return this.matching(ctx, types)[0] ?? null;
  }

  health(): Record<string, PolicyHealth> {
    const out: Record<string, PolicyHealth> = {};
    for (const [id, p] of this.policies) out[id] = p.health();
    return out;
  }

  ids(): string[] { return [...this.policies.keys()]; }
  size(): number { return this.policies.size; }
  clear(): void { this.policies.clear(); }
}

export function createPolicyRegistry(): PolicyRegistry { return new InMemoryPolicyRegistry(); }

// ── STEP 3 · Policy Evaluator (framework only — no business rules) ──────────────
const defaultClock = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);

export interface PolicyEvaluatorOptions {
  onEvent?: (event: PolicyEvent) => void;
  clock?: () => number;
}

export class PolicyEvaluator {
  private readonly onEvent?: (event: PolicyEvent) => void;
  private readonly clock: () => number;

  constructor(opts: PolicyEvaluatorOptions = {}) {
    this.onEvent = opts.onEvent;
    this.clock = opts.clock ?? defaultClock;
  }

  private emit(type: PolicyEventType, at: Timestamp, policyId?: string, message?: string): void {
    this.onEvent?.({ type, policyId, at, message });
  }

  /** Evaluate one policy. Never throws — a failure is captured in the evaluation record. */
  async evaluate(policy: Policy, ctx: PolicyContext): Promise<PolicyEvaluation> {
    const at = ctx.now ?? '';
    const priority = policy.metadata.priority ?? 0;
    const base: PolicyEvaluation = { policyId: policy.metadata.id, type: policy.metadata.type, matched: false, skipped: true, priority, evaluationMs: 0 };

    if (!isUsable(policy.health().status) || !policy.applies(ctx)) {
      this.emit('policy.skipped', at, policy.metadata.id, 'scope/health mismatch');
      return base;
    }

    this.emit('policy.matched', at, policy.metadata.id);
    const t0 = this.clock();
    try {
      const result = await policy.evaluate(ctx);
      const evaluationMs = this.clock() - t0;
      this.emit('policy.evaluated', at, policy.metadata.id, result.effect);
      return { ...base, matched: true, skipped: false, result, evaluationMs };
    } catch (e) {
      const evaluationMs = this.clock() - t0;
      const error = e instanceof Error ? e.message : String(e);
      this.emit('policy.evaluated', at, policy.metadata.id, `error: ${error}`);
      return { ...base, matched: true, skipped: false, evaluationMs, error };
    }
  }

  /** Evaluate many policies in priority order (already sorted by the registry). */
  async evaluateMany(policies: Policy[], ctx: PolicyContext): Promise<PolicyEvaluation[]> {
    const out: PolicyEvaluation[] = [];
    for (const p of policies) out.push(await this.evaluate(p, ctx));
    return out;
  }

  /** Deterministically merge evaluation results into the effective decision (STEP 3). */
  merge(evaluations: PolicyEvaluation[], at: Timestamp = ''): EffectivePolicyDecision {
    const active = evaluations
      .filter(e => e.matched && !e.error && e.result)
      .sort((a, b) => b.priority - a.priority);

    const directives: { [key: string]: Json } = {};
    const owner: { [key: string]: string } = {};
    const contributors: string[] = [];
    const conflicts: PolicyConflict[] = [];
    let effect: PolicyEffect = 'noop';

    for (const e of active) {
      const r = e.result as PolicyResult;
      if (effectRank(r.effect) > effectRank(effect)) effect = r.effect;
      if (!contributors.includes(e.policyId)) contributors.push(e.policyId);
      for (const d of r.directives ?? []) {
        if (!(d.key in directives)) {
          directives[d.key] = d.value;
          owner[d.key] = e.policyId;
        } else if (JSON.stringify(directives[d.key]) !== JSON.stringify(d.value)) {
          // A lower-priority policy disagrees on a key already decided — the higher one wins.
          conflicts.push({ key: d.key, winner: owner[d.key], loser: e.policyId, winningValue: directives[d.key], losingValue: d.value });
          this.emit('policy.conflict', at, e.policyId, `key '${d.key}' overridden by ${owner[d.key]}`);
        }
      }
    }

    return { effect, directives, contributors, conflicts };
  }

  /** The full flow: match → evaluate → merge → effective decision + diagnostics (STEP 3). */
  async resolveEffectivePolicy(registry: PolicyRegistry, ctx: PolicyContext, opts: { types?: PolicyType[] } = {}): Promise<PolicyOutcome> {
    const at = ctx.now ?? '';
    const t0 = this.clock();
    const scoped = (opts.types && opts.types.length > 0) ? opts.types.flatMap(t => registry.byType(t)) : registry.all();
    const matched = registry.matching(ctx, opts.types);
    const matchedIds = new Set(matched.map(p => p.metadata.id));

    const ignored = scoped.filter(p => !matchedIds.has(p.metadata.id));
    for (const p of ignored) this.emit('policy.skipped', at, p.metadata.id, 'not in effective set');

    const evaluations = await this.evaluateMany(matched, ctx);
    const decision = this.merge(evaluations, at);
    const effective = evaluations.filter(e => e.matched && !e.error).map(e => e.policyId);

    return {
      decision,
      matched: effective,
      ignored: ignored.map(p => p.metadata.id),
      evaluations,
      totalMs: this.clock() - t0,
    };
  }
}

export function createPolicyEvaluator(opts: PolicyEvaluatorOptions = {}): PolicyEvaluator {
  return new PolicyEvaluator(opts);
}

// ── The Policy Engine — registry + evaluator, the surface the Runtime drives ─────
export interface PolicyEngineEvaluateOptions {
  experienceId?: ExperienceId;
  preview?: boolean;
  types?: PolicyType[];
  /** Resolved audience ids for this request (Wave 9) — carried into the PolicyContext. */
  audiences?: string[];
  /** Effective feature flags for this request (Wave 10) — carried into the PolicyContext. */
  flags?: PolicyContext['flags'];
  /** The unified Decision Context (Wave 18) — carried into the PolicyContext. */
  decision?: DecisionContext;
  onEvent?: (event: PolicyEvent) => void;
}

export interface PolicyEngine {
  readonly registry: PolicyRegistry;
  /** Evaluate the effective policy for an ExperienceContext (the Runtime's entry point). */
  evaluate(context: ExperienceContext, opts?: PolicyEngineEvaluateOptions): Promise<PolicyOutcome>;
}

export interface PolicyEngineOptions {
  clock?: () => number;
  onEvent?: (event: PolicyEvent) => void;
}

export function createPolicyEngine(registry: PolicyRegistry, engineOpts: PolicyEngineOptions = {}): PolicyEngine {
  return {
    registry,
    evaluate(context: ExperienceContext, opts: PolicyEngineEvaluateOptions = {}): Promise<PolicyOutcome> {
      const evaluator = new PolicyEvaluator({ clock: engineOpts.clock, onEvent: opts.onEvent ?? engineOpts.onEvent });
      const ctx = toPolicyContext(context, { experienceId: opts.experienceId, preview: opts.preview, audiences: opts.audiences, flags: opts.flags, decision: opts.decision });
      return evaluator.resolveEffectivePolicy(registry, ctx, { types: opts.types });
    },
  };
}
