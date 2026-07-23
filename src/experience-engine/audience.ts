// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Audience & Targeting Engine (Wave 9).
//
// A business capability (NOT a new infrastructure layer). It matches AUDIENCES — named,
// prioritised targeting rules — against a request context, producing the matched audience set
// that becomes Runtime context and can be queried by the Policy Engine.
//
//   Runtime · context stage → TargetResolver.resolve → matched audiences → Policy / Configuration
//
// PURE + FRAMEWORK ONLY. No business rules: it evaluates whatever criteria an audience declares;
// it does not decide what an audience means. Depends only on the context/type contracts
// (one-directional — nothing it uses imports it back, and Policy consumes only audience *ids*).
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, DeviceKind, Environment, ExperienceId, Json, LocaleCode, PlatformKind, RoleId, SemVer, TenantId, Timestamp } from './types';
import type { ExperienceContext } from './context';

// ── STEP 1 · Audience model ─────────────────────────────────────────────────────
/** STEP 3 · the supported target dimensions. A criteria block is AND over its present dims. */
export interface AudienceCriteria {
  tenants?: TenantId[];
  countries?: string[];
  locales?: LocaleCode[];
  channels?: ChannelId[];
  environments?: Environment[];
  roles?: RoleId[];
  devices?: DeviceKind[];
  platforms?: PlatformKind[];
  /** User segments — overlap match (any listed segment present in the context). */
  segments?: string[];
  /** Preview-mode target — matched against the context's preview flag when set. */
  preview?: boolean;
}

/** A single targeting rule: a criteria block, optionally negated. */
export interface AudienceRule {
  id?: string;
  criteria: AudienceCriteria;
  negate?: boolean;
}

/** A named grouping of rules combined with `all` (AND, default) or `any` (OR). */
export interface AudienceSegment {
  id: string;
  name?: string;
  rules: AudienceRule[];
  match?: 'all' | 'any';
}

export interface AudienceMetadata {
  id: string;
  name: string;
  version: SemVer;
  priority?: number;
  description?: string;
  tags?: string[];
}

/** A prioritised audience: segments combined with `any` (OR, default) or `all` (AND). */
export interface Audience {
  metadata: AudienceMetadata;
  segments: AudienceSegment[];
  match?: 'all' | 'any';
}

/** STEP 6 · per-dimension evaluation record. */
export interface CriteriaTrace { dimension: string; expected?: Json; actual?: Json; matched: boolean }

/** The result of matching one audience against a context. */
export interface AudienceMatch {
  audienceId: string;
  matched: boolean;
  priority: number;
  matchedSegments: string[];
  rejectedSegments: string[];
  criteriaTrace: CriteriaTrace[];
  evaluationMs: number;
}

// ── The identity audiences match against ────────────────────────────────────────
export interface AudienceContext {
  tenantId: TenantId;
  channel: ChannelId;
  environment: Environment;
  role?: RoleId;
  locale?: LocaleCode;
  country?: string;
  device?: DeviceKind;
  platform?: PlatformKind;
  segments?: string[];
  preview?: boolean;
  now?: Timestamp;
}

/** Map an ExperienceContext to the AudienceContext the engine matches against (pure). */
export function toAudienceContext(context: ExperienceContext, extra: { preview?: boolean } = {}): AudienceContext {
  return {
    tenantId: context.tenantId,
    channel: context.channel,
    environment: context.environment.environment,
    role: context.role,
    locale: context.locale,
    country: context.country,
    device: context.device,
    platform: context.platform,
    segments: context.segments,
    preview: extra.preview,
    now: context.now,
  };
}

// ── Criteria matching (pure) ─────────────────────────────────────────────────────
const hit = <T>(allowed: T[] | undefined, value: T | undefined): boolean =>
  !allowed || allowed.length === 0 || (value !== undefined && allowed.includes(value));
const overlaps = (allowed: string[] | undefined, values: string[] | undefined): boolean =>
  !allowed || allowed.length === 0 || (!!values && values.some(v => allowed.includes(v)));

type DimCheck = { dimension: string; present: boolean; expected?: Json; actual?: Json; matched: boolean };

function criteriaChecks(c: AudienceCriteria, ctx: AudienceContext): DimCheck[] {
  const arr = (dim: string, allowed: string[] | undefined, actual: string | undefined): DimCheck =>
    ({ dimension: dim, present: !!allowed && allowed.length > 0, expected: allowed, actual, matched: hit(allowed, actual) });
  return [
    arr('tenant', c.tenants, ctx.tenantId),
    arr('country', c.countries, ctx.country),
    arr('locale', c.locales, ctx.locale),
    arr('channel', c.channels, ctx.channel),
    arr('environment', c.environments, ctx.environment),
    arr('role', c.roles, ctx.role),
    arr('device', c.devices, ctx.device),
    arr('platform', c.platforms, ctx.platform),
    { dimension: 'segments', present: !!c.segments && c.segments.length > 0, expected: c.segments, actual: ctx.segments, matched: overlaps(c.segments, ctx.segments) },
    { dimension: 'preview', present: c.preview !== undefined, expected: c.preview, actual: !!ctx.preview, matched: c.preview === undefined || c.preview === !!ctx.preview },
  ];
}

/** Evaluate one criteria block (AND over present dimensions). Returns match + a trace. */
export function matchCriteria(c: AudienceCriteria, ctx: AudienceContext): { matched: boolean; trace: CriteriaTrace[] } {
  const checks = criteriaChecks(c, ctx);
  const present = checks.filter(k => k.present);
  const trace: CriteriaTrace[] = present.map(k => ({ dimension: k.dimension, expected: k.expected, actual: k.actual, matched: k.matched }));
  return { matched: present.every(k => k.matched), trace };
}

const matchRule = (rule: AudienceRule, ctx: AudienceContext): { matched: boolean; trace: CriteriaTrace[] } => {
  const r = matchCriteria(rule.criteria, ctx);
  return { matched: rule.negate ? !r.matched : r.matched, trace: r.trace };
};

const matchSegment = (segment: AudienceSegment, ctx: AudienceContext): { matched: boolean; trace: CriteriaTrace[] } => {
  if (segment.rules.length === 0) return { matched: true, trace: [] };
  const results = segment.rules.map(r => matchRule(r, ctx));
  const matched = (segment.match ?? 'all') === 'any' ? results.some(r => r.matched) : results.every(r => r.matched);
  return { matched, trace: results.flatMap(r => r.trace) };
};

const defaultClock = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);

// ── STEP 2 · Audience Matcher ────────────────────────────────────────────────────
export interface AudienceMatcher { match(audience: Audience, ctx: AudienceContext): AudienceMatch }

export function createAudienceMatcher(opts: { clock?: () => number } = {}): AudienceMatcher {
  const clock = opts.clock ?? defaultClock;
  return {
    match(audience: Audience, ctx: AudienceContext): AudienceMatch {
      const t0 = clock();
      const seg = audience.segments.map(s => ({ id: s.id, ...matchSegment(s, ctx) }));
      const matched = audience.segments.length === 0
        ? true
        : (audience.match ?? 'any') === 'all' ? seg.every(s => s.matched) : seg.some(s => s.matched);
      return {
        audienceId: audience.metadata.id,
        matched,
        priority: audience.metadata.priority ?? 0,
        matchedSegments: seg.filter(s => s.matched).map(s => s.id),
        rejectedSegments: seg.filter(s => !s.matched).map(s => s.id),
        criteriaTrace: seg.flatMap(s => s.trace),
        evaluationMs: clock() - t0,
      };
    },
  };
}

// ── STEP 2 · Target Evaluator ────────────────────────────────────────────────────
export interface TargetEvaluator { evaluate(audiences: Audience[], ctx: AudienceContext): AudienceMatch[] }

export function createTargetEvaluator(opts: { clock?: () => number } = {}): TargetEvaluator {
  const matcher = createAudienceMatcher(opts);
  return { evaluate: (audiences, ctx) => audiences.map(a => matcher.match(a, ctx)) };
}

// ── Audience registry ────────────────────────────────────────────────────────────
export interface AudienceRegistry {
  register(audience: Audience): void;
  unregister(id: string): void;
  get(id: string): Audience | null;
  has(id: string): boolean;
  all(): Audience[];
  ids(): string[];
  size(): number;
  clear(): void;
}

export class InMemoryAudienceRegistry implements AudienceRegistry {
  private readonly audiences = new Map<string, Audience>();
  register(a: Audience): void { this.audiences.set(a.metadata.id, a); }
  unregister(id: string): void { this.audiences.delete(id); }
  get(id: string): Audience | null { return this.audiences.get(id) ?? null; }
  has(id: string): boolean { return this.audiences.has(id); }
  all(): Audience[] { return [...this.audiences.values()]; }
  ids(): string[] { return [...this.audiences.keys()]; }
  size(): number { return this.audiences.size; }
  clear(): void { this.audiences.clear(); }
}

export function createAudienceRegistry(): AudienceRegistry { return new InMemoryAudienceRegistry(); }

// ── Diagnostics + events (STEP 6, STEP 7) ───────────────────────────────────────
export interface TargetResolution {
  matched: string[];
  rejected: string[];
  matches: AudienceMatch[];
  evaluationMs: number;
}

export type AudienceEventType = 'audience.matched' | 'audience.rejected' | 'audience.evaluated';
export interface AudienceEvent { type: AudienceEventType; audienceId: string; at: Timestamp; message?: string }

// ── STEP 2 · Target Resolver ─────────────────────────────────────────────────────
export interface ResolveTargetOptions {
  preview?: boolean;
  experienceId?: ExperienceId;
  onEvent?: (event: AudienceEvent) => void;
}

export interface TargetResolver {
  resolve(context: ExperienceContext, opts?: ResolveTargetOptions): TargetResolution;
}

export interface TargetResolverOptions {
  clock?: () => number;
  onEvent?: (event: AudienceEvent) => void;
}

export function createTargetResolver(registry: AudienceRegistry, resolverOpts: TargetResolverOptions = {}): TargetResolver {
  const clock = resolverOpts.clock ?? defaultClock;
  const matcher = createAudienceMatcher({ clock });
  return {
    resolve(context: ExperienceContext, opts: ResolveTargetOptions = {}): TargetResolution {
      const at = context.now ?? '';
      const actx = toAudienceContext(context, { preview: opts.preview });
      const emit = (type: AudienceEventType, audienceId: string, message?: string): void => {
        const e: AudienceEvent = { type, audienceId, at, message };
        opts.onEvent?.(e);
        resolverOpts.onEvent?.(e);
      };

      const t0 = clock();
      const matches = registry.all().map(a => {
        const m = matcher.match(a, actx);
        emit('audience.evaluated', m.audienceId, `${m.matched ? 'matched' : 'rejected'} in ${m.evaluationMs.toFixed(3)}ms`);
        emit(m.matched ? 'audience.matched' : 'audience.rejected', m.audienceId);
        return m;
      });

      const matched = matches.filter(m => m.matched).sort((a, b) => b.priority - a.priority).map(m => m.audienceId);
      const rejected = matches.filter(m => !m.matched).map(m => m.audienceId);
      return { matched, rejected, matches, evaluationMs: clock() - t0 };
    },
  };
}
