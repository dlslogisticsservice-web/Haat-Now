// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Feature Flags Engine (Wave 10).
//
// A business capability that REUSES the kernel — no new infrastructure. Flags are named,
// prioritised, audience-targetable switches with optional variants. They are evaluated as part
// of the Runtime context (after audiences), surfaced on the execution, and bridged into the
// Policy Engine via a concrete FeatureFlagPolicy.
//
//   Runtime · context stage → Audience Resolution → Feature Flag Evaluation → Policy → Effective Decision
//
// PURE + FRAMEWORK ONLY. No business flags are predefined; the evaluator resolves whatever a flag
// declares. Depends only on context/types + the Policy contracts (one-directional: policy.ts does
// NOT import this module — PolicyContext.flags is a structural type — so there is no cycle).
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, Environment, ExperienceId, Json, LocaleCode, SemVer, TenantId, Timestamp } from './types';
import type { ExperienceContext } from './context';
import type { Policy, PolicyContext, PolicyResult } from './policy';

// ── STEP 1 · Feature Flag model ─────────────────────────────────────────────────
/** STEP 4 · the targeting dimensions a flag rule can match. AND over present dimensions. */
export interface FlagCriteria {
  tenants?: TenantId[];
  countries?: string[];
  locales?: LocaleCode[];
  environments?: Environment[];
  channels?: ChannelId[];
  preview?: boolean;
  /** Matched audiences (from the Audience Engine) — overlap match. */
  audiences?: string[];
}

export interface FeatureFlagVariant { key: string; value: Json; weight?: number }

/** A targeting rule: when its criteria match, it sets enabled and/or selects a variant. */
export interface FeatureFlagRule {
  id?: string;
  criteria?: FlagCriteria;
  enabled?: boolean;
  variant?: string;
}

export interface FeatureFlagMetadata {
  id: string;
  name: string;
  version: SemVer;
  priority?: number;
  description?: string;
  tags?: string[];
}

export interface FeatureFlag {
  metadata: FeatureFlagMetadata;
  /** Master switch. A disabled flag is always off regardless of rules. */
  enabled: boolean;
  /** Applied when no rule matches. Defaults to the master switch. */
  default?: { enabled?: boolean; variant?: string; value?: Json };
  variants?: FeatureFlagVariant[];
  rules?: FeatureFlagRule[];
}

export type FlagReason = 'disabled' | 'rule-match' | 'default' | 'no-match';

export interface FeatureFlagResult {
  flagId: string;
  enabled: boolean;
  variant?: string;
  value?: Json;
  reason: FlagReason;
  priority: number;
  matchedRuleId?: string;
  evaluationMs: number;
}

/** The compact per-flag state carried into the Policy/Configuration context. */
export interface EffectiveFlagState { enabled: boolean; variant?: string; value?: Json }
export type EffectiveFlags = { [key: string]: EffectiveFlagState };

// ── Flag context ─────────────────────────────────────────────────────────────────
export interface FlagContext {
  tenantId: TenantId;
  channel: ChannelId;
  environment: Environment;
  locale?: LocaleCode;
  country?: string;
  preview?: boolean;
  audiences?: string[];
  now?: Timestamp;
}

/** Map an ExperienceContext (+ resolved audiences) to a FlagContext (pure). */
export function toFlagContext(context: ExperienceContext, extra: { preview?: boolean; audiences?: string[] } = {}): FlagContext {
  return { tenantId: context.tenantId, channel: context.channel, environment: context.environment.environment, locale: context.locale, country: context.country, preview: extra.preview, audiences: extra.audiences, now: context.now };
}

// ── Criteria matching (pure) ─────────────────────────────────────────────────────
const hit = <T>(allowed: T[] | undefined, value: T | undefined): boolean =>
  !allowed || allowed.length === 0 || (value !== undefined && allowed.includes(value));
const overlaps = (allowed: string[] | undefined, values: string[] | undefined): boolean =>
  !allowed || allowed.length === 0 || (!!values && values.some(v => allowed.includes(v)));

export function matchFlagCriteria(c: FlagCriteria | undefined, ctx: FlagContext): boolean {
  if (!c) return true;
  return hit(c.tenants, ctx.tenantId)
    && hit(c.countries, ctx.country)
    && hit(c.locales, ctx.locale)
    && hit(c.environments, ctx.environment)
    && hit(c.channels, ctx.channel)
    && (c.preview === undefined || c.preview === !!ctx.preview)
    && overlaps(c.audiences, ctx.audiences);
}

const variantValue = (flag: FeatureFlag, key: string | undefined): Json | undefined =>
  key === undefined ? undefined : flag.variants?.find(v => v.key === key)?.value;

const defaultClock = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);

// ── Events (STEP 8) ──────────────────────────────────────────────────────────────
export type FlagEventType = 'flag.evaluated' | 'flag.enabled' | 'flag.disabled';
export interface FlagEvent { type: FlagEventType; flagId: string; at: Timestamp; message?: string }

// ── STEP 2 · Feature Flag Registry ──────────────────────────────────────────────
export interface FeatureFlagRegistry {
  register(flag: FeatureFlag): void;
  unregister(id: string): void;
  get(id: string): FeatureFlag | null;
  has(id: string): boolean;
  /** STEP 2 · flip the master switch of a registered flag. */
  enable(id: string): void;
  disable(id: string): void;
  list(): FeatureFlag[];
  all(): FeatureFlag[];
  ids(): string[];
  size(): number;
  clear(): void;
}

export class InMemoryFeatureFlagRegistry implements FeatureFlagRegistry {
  private readonly flags = new Map<string, FeatureFlag>();
  register(flag: FeatureFlag): void { this.flags.set(flag.metadata.id, flag); }
  unregister(id: string): void { this.flags.delete(id); }
  get(id: string): FeatureFlag | null { return this.flags.get(id) ?? null; }
  has(id: string): boolean { return this.flags.has(id); }
  enable(id: string): void { const f = this.flags.get(id); if (f) this.flags.set(id, { ...f, enabled: true }); }
  disable(id: string): void { const f = this.flags.get(id); if (f) this.flags.set(id, { ...f, enabled: false }); }
  list(): FeatureFlag[] { return [...this.flags.values()]; }
  all(): FeatureFlag[] { return [...this.flags.values()]; }
  ids(): string[] { return [...this.flags.keys()]; }
  size(): number { return this.flags.size; }
  clear(): void { this.flags.clear(); }
}

export function createFeatureFlagRegistry(): FeatureFlagRegistry { return new InMemoryFeatureFlagRegistry(); }

// ── Diagnostics (STEP 7) ─────────────────────────────────────────────────────────
export interface FlagResolution {
  flags: EffectiveFlags;
  matched: string[];   // enabled flag ids, priority-sorted
  rejected: string[];  // disabled flag ids
  results: FeatureFlagResult[];
  evaluationMs: number;
}

// ── STEP 3 · Flag Evaluator (framework only — no business rules) ────────────────
export interface FlagEvaluatorOptions { clock?: () => number }

export class FlagEvaluator {
  private readonly clock: () => number;
  constructor(opts: FlagEvaluatorOptions = {}) { this.clock = opts.clock ?? defaultClock; }

  /** Evaluate one flag: master switch → first matching rule → default. */
  evaluate(flag: FeatureFlag, ctx: FlagContext): FeatureFlagResult {
    const t0 = this.clock();
    const priority = flag.metadata.priority ?? 0;
    const base = { flagId: flag.metadata.id, priority };

    if (!flag.enabled) return { ...base, enabled: false, reason: 'disabled', evaluationMs: this.clock() - t0 };

    for (const rule of flag.rules ?? []) {
      if (matchFlagCriteria(rule.criteria, ctx)) {
        const enabled = rule.enabled ?? true;
        const variant = rule.variant ?? flag.default?.variant;
        const value = variantValue(flag, variant) ?? flag.default?.value ?? enabled;
        return { ...base, enabled, variant, value, reason: 'rule-match', matchedRuleId: rule.id, evaluationMs: this.clock() - t0 };
      }
    }

    const enabled = flag.default?.enabled ?? flag.enabled;
    const variant = flag.default?.variant;
    const value = variantValue(flag, variant) ?? flag.default?.value ?? enabled;
    return { ...base, enabled, variant, value, reason: (flag.rules && flag.rules.length ? 'no-match' : 'default'), evaluationMs: this.clock() - t0 };
  }

  evaluateMany(flags: FeatureFlag[], ctx: FlagContext): FeatureFlagResult[] {
    return flags.map(f => this.evaluate(f, ctx));
  }

  /** Evaluate every registered flag → effective flag map + diagnostics + events. */
  resolveEffectiveFlags(registry: FeatureFlagRegistry, ctx: FlagContext, opts: { onEvent?: (e: FlagEvent) => void } = {}): FlagResolution {
    const at = ctx.now ?? '';
    const t0 = this.clock();
    const emit = (type: FlagEventType, flagId: string, message?: string): void => opts.onEvent?.({ type, flagId, at, message });

    const results = registry.all().map(f => {
      const r = this.evaluate(f, ctx);
      emit('flag.evaluated', r.flagId, `${r.enabled ? 'on' : 'off'} (${r.reason})`);
      emit(r.enabled ? 'flag.enabled' : 'flag.disabled', r.flagId);
      return r;
    });

    const flags: EffectiveFlags = {};
    for (const r of results) flags[r.flagId] = { enabled: r.enabled, variant: r.variant, value: r.value };
    const matched = results.filter(r => r.enabled).sort((a, b) => b.priority - a.priority).map(r => r.flagId);
    const rejected = results.filter(r => !r.enabled).map(r => r.flagId);
    return { flags, matched, rejected, results, evaluationMs: this.clock() - t0 };
  }
}

export function createFlagEvaluator(opts: FlagEvaluatorOptions = {}): FlagEvaluator { return new FlagEvaluator(opts); }

// ── The runtime-facing resolver ──────────────────────────────────────────────────
export interface ResolveFlagsOptions {
  preview?: boolean;
  experienceId?: ExperienceId;
  audiences?: string[];
  onEvent?: (event: FlagEvent) => void;
}

export interface FeatureFlagResolver {
  resolve(context: ExperienceContext, opts?: ResolveFlagsOptions): FlagResolution;
}

export function createFeatureFlagResolver(registry: FeatureFlagRegistry, resolverOpts: { clock?: () => number; onEvent?: (e: FlagEvent) => void } = {}): FeatureFlagResolver {
  const evaluator = new FlagEvaluator({ clock: resolverOpts.clock });
  return {
    resolve(context: ExperienceContext, opts: ResolveFlagsOptions = {}): FlagResolution {
      const ctx = toFlagContext(context, { preview: opts.preview, audiences: opts.audiences });
      return evaluator.resolveEffectiveFlags(registry, ctx, { onEvent: opts.onEvent ?? resolverOpts.onEvent });
    },
  };
}

// ── STEP 5 · Policy integration — a concrete FeatureFlagPolicy ──────────────────
export interface FeatureFlagPolicyOptions { id?: string; priority?: number }

const flagContextFromPolicy = (pctx: PolicyContext): FlagContext =>
  ({ tenantId: pctx.tenantId, channel: pctx.channel, environment: pctx.environment, locale: pctx.locale, country: pctx.country, preview: pctx.preview, audiences: pctx.audiences, now: pctx.now });

/**
 * A Policy (type 'feature-flag') that surfaces effective flags into the Policy Engine's decision
 * as `flag.<id>` directives. It reads the flags already resolved into the PolicyContext (no
 * double evaluation); standalone, it resolves them from the registry.
 */
export function createFeatureFlagPolicy(registry: FeatureFlagRegistry, opts: FeatureFlagPolicyOptions = {}): Policy {
  const evaluator = new FlagEvaluator();
  const metadata = { id: opts.id ?? 'policy.feature-flags', name: 'Feature Flag Policy', type: 'feature-flag' as const, version: '1.0.0', priority: opts.priority ?? 0 };
  return {
    metadata,
    applies: () => true,
    health: () => ({ status: 'healthy' as const }),
    evaluate(pctx: PolicyContext): PolicyResult {
      const flags: EffectiveFlags = pctx.flags ?? evaluator.resolveEffectiveFlags(registry, flagContextFromPolicy(pctx)).flags;
      const directives = Object.keys(flags).map(k => ({ key: `flag.${k}`, value: flags[k].variant ?? flags[k].enabled }));
      return { effect: 'annotate', directives, reason: 'feature flags surfaced' };
    },
  };
}
