// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Decision Context (Wave 18).
//
// ONE context object every decision capability reads. Until now audiences, flags, experiments and
// policies each received a different slice of the request; this unifies them behind a single,
// deterministically-built value that the runtime populates BEFORE policy evaluation.
//
//   defaults → providers (priority order) → explicit overrides  ⇒  DecisionContext
//
// PURE. No storage, no clock, no randomness: a stable visitor id is DERIVED from a seed the host
// supplies (the host owns persistence — see the website channel's browser provider). Flags and
// experiment variants are typed STRUCTURALLY so this module imports neither flags.ts nor policy.ts;
// policy.ts imports this one, and the dependency stays one-directional.
//
// NO Personalization and NO AI: this describes the request, it does not infer anything from it.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, DeviceKind, Environment, ExperienceId, Json, LocaleCode, PlatformKind, RoleId, TenantId, TextDirection, Timestamp } from './types';
import type { ExperienceContext } from './context';

// ── Identity ─────────────────────────────────────────────────────────────────────
export type VisitorKind = 'anonymous' | 'authenticated';

export interface VisitorIdentity {
  /** Stable across requests and sessions for the same visitor. Never invented per request. */
  visitorId: string;
  kind: VisitorKind;
  /** Present only when authenticated. */
  userId?: string;
  /** Stable within one browsing session (resets when the session does). */
  sessionId?: string;
  /** First-seen timestamp, when the host knows it. */
  since?: Timestamp;
}

const djb2 = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return (h >>> 0).toString(36);
};

/**
 * Derive a stable visitor id from a host-supplied seed (a persisted token, an account id, …).
 * Deterministic: the same seed always yields the same id, in every process. This module will not
 * mint an identity out of thin air — an id with no stable seed would silently break allocation.
 */
export function deriveVisitorId(seed: string, namespace = 'v1'): string {
  return `vis_${djb2(`${namespace}|${seed}`)}`;
}

/** An anonymous visitor built from a persisted seed the host owns. */
export function anonymousVisitor(seed: string, opts: { sessionId?: string; since?: Timestamp } = {}): VisitorIdentity {
  return { visitorId: deriveVisitorId(seed), kind: 'anonymous', sessionId: opts.sessionId, since: opts.since };
}

/**
 * An authenticated visitor. The visitor id is derived from the ACCOUNT, so identity (and therefore
 * experiment allocation) is stable across devices and survives a cleared browser token.
 */
export function authenticatedVisitor(userId: string, opts: { sessionId?: string; since?: Timestamp } = {}): VisitorIdentity {
  return { visitorId: deriveVisitorId(userId, 'user'), kind: 'authenticated', userId, sessionId: opts.sessionId, since: opts.since };
}

/** The fallback when the host has no seed at all — explicitly marked, never silently "stable". */
export const UNKNOWN_VISITOR: VisitorIdentity = { visitorId: 'vis_unknown', kind: 'anonymous' };

// ── Model ────────────────────────────────────────────────────────────────────────
export interface DecisionLanguage { locale: LocaleCode; direction: TextDirection }
export interface DecisionDevice { kind: DeviceKind; platform: PlatformKind; mobile?: boolean }
export interface DecisionLocation { country?: string; region?: string; city?: string; timezone?: string }

/** Structural — deliberately not imported from flags.ts (that module imports policy.ts). */
export type DecisionFlags = { [key: string]: { enabled: boolean; variant?: string; value?: Json } };
/** experimentId → assigned variant key. */
export type DecisionExperiments = { [experimentId: string]: string };

export interface DecisionContext {
  identity: VisitorIdentity;
  tenantId: TenantId;
  channel: ChannelId;
  environment: Environment;
  role: RoleId;
  language: DecisionLanguage;
  device: DecisionDevice;
  location: DecisionLocation;
  experienceId?: ExperienceId;
  preview: boolean;
  segments: string[];
  audiences: string[];
  flags: DecisionFlags;
  experiments: DecisionExperiments;
  /** Extensible bag for provider contributions. Merged, never replaced wholesale. */
  attributes: { [key: string]: Json };
  now: Timestamp;
}

/** What the runtime knows before providers run. */
export interface DecisionContextInput {
  context: ExperienceContext;
  identity?: VisitorIdentity;
  experienceId?: ExperienceId;
  preview?: boolean;
  audiences?: string[];
  flags?: DecisionFlags;
  experiments?: DecisionExperiments;
}

// ── Providers ────────────────────────────────────────────────────────────────────
/**
 * A contributor of context. Providers run in ascending priority, so a HIGHER priority provider is
 * applied later and therefore wins. Returning null contributes nothing.
 */
export interface DecisionContextProvider {
  readonly id: string;
  readonly priority?: number;
  contribute(current: DecisionContext, input: DecisionContextInput): Partial<DecisionContext> | null;
}

export interface DecisionContextBuilder {
  use(provider: DecisionContextProvider): void;
  remove(id: string): void;
  providers(): DecisionContextProvider[];
  build(input: DecisionContextInput, overrides?: Partial<DecisionContext>): DecisionContext;
  clear(): void;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Deterministic merge. Scalars and arrays are REPLACED when the patch provides them; the nested
 * record-shaped members (language, device, location, flags, experiments, attributes) are merged
 * key-wise so one provider can add a field without erasing another's.
 */
export function mergeDecisionContext(base: DecisionContext, patch: Partial<DecisionContext> | null | undefined): DecisionContext {
  if (!patch) return base;
  const out: DecisionContext = { ...base };
  for (const key of Object.keys(patch) as Array<keyof DecisionContext>) {
    const value = patch[key];
    if (value === undefined) continue;
    const current = base[key];
    (out as unknown as Record<string, unknown>)[key as string] = isObject(value) && isObject(current)
      ? { ...current, ...value }
      : value;
  }
  return out;
}

/** The baseline context derived purely from what the runtime already has. */
export function baseDecisionContext(input: DecisionContextInput): DecisionContext {
  const c = input.context;
  return {
    identity: input.identity ?? UNKNOWN_VISITOR,
    tenantId: c.tenantId,
    channel: c.channel,
    environment: c.environment.environment,
    role: c.role,
    language: { locale: c.locale, direction: c.direction },
    device: { kind: c.device, platform: c.platform },
    location: { country: c.country },
    experienceId: input.experienceId,
    preview: !!input.preview,
    segments: c.segments ?? [],
    audiences: input.audiences ?? [],
    flags: input.flags ?? {},
    experiments: input.experiments ?? {},
    attributes: {},
    now: c.now ?? '',
  };
}

export function createDecisionContextBuilder(initial: DecisionContextProvider[] = []): DecisionContextBuilder {
  let registered: DecisionContextProvider[] = [...initial];

  return {
    use(provider: DecisionContextProvider): void {
      registered = [...registered.filter(p => p.id !== provider.id), provider];
    },
    remove(id: string): void { registered = registered.filter(p => p.id !== id); },
    providers(): DecisionContextProvider[] {
      return [...registered].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    },
    clear(): void { registered = []; },

    build(input: DecisionContextInput, overrides?: Partial<DecisionContext>): DecisionContext {
      let ctx = baseDecisionContext(input);
      for (const provider of this.providers()) {
        try {
          ctx = mergeDecisionContext(ctx, provider.contribute(ctx, input));
        } catch {
          // A failing provider must never break a request — it simply contributes nothing.
        }
      }
      // Explicit overrides always win, applied last.
      return mergeDecisionContext(ctx, overrides);
    },
  };
}

/** Attach experiment assignments discovered after policy evaluation (pure, non-mutating). */
export function withExperiments(ctx: DecisionContext, experiments: DecisionExperiments): DecisionContext {
  const keys = Object.keys(experiments);
  if (keys.length === 0) return ctx;
  return { ...ctx, experiments: { ...ctx.experiments, ...experiments } };
}

/** A stable allocation unit for experiments — the whole point of carrying identity. */
export function decisionUnitId(ctx: DecisionContext): string {
  return ctx.identity.visitorId !== UNKNOWN_VISITOR.visitorId
    ? ctx.identity.visitorId
    : `${ctx.tenantId}:${ctx.experienceId ?? '-'}`;
}
