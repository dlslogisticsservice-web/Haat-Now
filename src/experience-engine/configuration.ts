// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Remote Configuration (Wave 8).
//
// The first functional capability on the DXP kernel. It COMPOSES the existing pieces — the
// Provider Registry (a ConfigurationProvider), the Delivery ConfigurationCache, and the Policy
// Engine — into one coordinator that the Runtime's configuration stage drives. No new
// infrastructure layer is introduced.
//
//   resolve → Cache lookup → Configuration Provider → Signature verify → Cache store →
//             Configuration Policy evaluation → Effective Configuration
//
// PURE + SECURE. No secrets in the client: signature verification is injected (or provided by
// the ConfigurationProvider). An unverifiable signed bundle is 'unverified', NEVER 'valid'; an
// invalid signature is REJECTED. Only 'configuration' policies participate — no Feature Flags,
// no Personalization. Depends only on context/types/providers/policy/delivery (one-directional).
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, Environment, ExperienceId, Json, SemVer, TenantId, Timestamp } from './types';
import type { ExperienceContext } from './context';
import type { ConfigurationProvider, ProviderContext, ProviderRegistry } from './providers';
import type { PolicyContext, PolicyEffect, PolicyEngine, PolicyEvent } from './policy';
import type { Cache } from './delivery';

// ── STEP 2 · Remote config model ────────────────────────────────────────────────
export interface ConfigurationVersion { version: SemVer; status: 'draft' | 'published' | 'archived'; publishedAt?: Timestamp }
export interface ConfigurationSignature { algorithm: 'HMAC-SHA256' | (string & {}); signature: string; signedAt: Timestamp }
export interface ConfigurationMetadata {
  version: SemVer;
  generatedAt: Timestamp;
  tenantId?: TenantId;
  channel?: ChannelId;
  environment?: Environment;
  checksum?: string;
  sizeBytes?: number;
}
export interface ConfigurationBundle {
  id: string;
  tenantId: TenantId;
  channel: ChannelId;
  environment: Environment;
  version: SemVer;
  config: { [k: string]: Json };
  metadata: ConfigurationMetadata;
  signature?: ConfigurationSignature;
}
export interface ConfigurationManifest {
  tenantId: TenantId;
  channel: ChannelId;
  environment: Environment;
  versions: ConfigurationVersion[];
  current?: SemVer;
  signature?: ConfigurationSignature;
}

// ── Diagnostics + effective result (STEP 6) ─────────────────────────────────────
export type ConfigurationSource = 'cache' | 'provider' | 'none';
export type SignatureStatus = 'valid' | 'invalid' | 'unsigned' | 'unverified';
export interface ConfigurationPolicySummary { matched: string[]; ignored: string[]; effect: PolicyEffect; conflicts: number; directives: number }

export interface EffectiveConfiguration {
  config: { [k: string]: Json };
  version: SemVer;
  source: ConfigurationSource;
  fromCache: boolean;
  providerId?: string;
  signatureStatus: SignatureStatus;
  rejected: boolean;
  reason?: string;
  policySummary: ConfigurationPolicySummary;
  metadata?: ConfigurationMetadata;
  diagnostics: string[];
  resolvedAt: Timestamp;
}

// ── Events (STEP 7) ──────────────────────────────────────────────────────────────
export type ConfigurationEventType = 'configuration.loaded' | 'configuration.cached' | 'configuration.invalidated' | 'configuration.rejected';
export interface ConfigurationEvent { type: ConfigurationEventType; key: string; at: Timestamp; version?: SemVer; message?: string }

// ── pure helpers ─────────────────────────────────────────────────────────────────
const djb2 = (s: string): string => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(16); };
const stableStringify = (v: Json): string => JSON.stringify(v);
export const configChecksum = (config: { [k: string]: Json }): string => djb2(stableStringify(config));

/** Deterministic cache key over tenant · channel · environment (STEP 3). */
export const configurationCacheKey = (tenantId: TenantId, channel: ChannelId, environment: Environment): string => `${tenantId}|${channel}|${environment}`;

const isSemver = (v: SemVer | undefined): boolean => typeof v === 'string' && v.length > 0;

// ── STEP 1 · a concrete ConfigurationProvider (static, in-memory source) ─────────
export interface StaticConfigurationProviderOptions {
  id?: string;
  name?: string;
  priority?: number;
  health?: () => { status: 'healthy' | 'degraded' | 'offline' | 'unsupported'; since?: Timestamp; detail?: string };
  /** Verify a signed bundle's authenticity. Injected — no secret lives in this module. */
  verifySignature?: (payload: string, signature: string) => Promise<boolean> | boolean;
}

/**
 * Wrap a fixed set of ConfigurationBundles as a ConfigurationProvider (honours the existing
 * contract exactly: returns a ConfigurationResult). Supports version, signature, metadata, health.
 */
export function createStaticConfigurationProvider(bundles: ConfigurationBundle[], opts: StaticConfigurationProviderOptions = {}): ConfigurationProvider {
  const byKey = new Map<string, ConfigurationBundle>();
  for (const b of bundles) byKey.set(configurationCacheKey(b.tenantId, b.channel, b.environment), b);
  const metadata = {
    id: opts.id ?? 'configuration.static',
    name: opts.name ?? 'Static Configuration Provider',
    kind: 'configuration' as const,
    version: '1.0.0',
    priority: opts.priority ?? 0,
  };
  return {
    metadata,
    supports: (ctx: ProviderContext): boolean => byKey.has(configurationCacheKey(ctx.tenantId, ctx.channel, ctx.environment)),
    health: opts.health ?? (() => ({ status: 'healthy' as const })),
    async load(ctx: ProviderContext) {
      const bundle = byKey.get(configurationCacheKey(ctx.tenantId, ctx.channel, ctx.environment));
      if (!bundle) return null;
      return { config: bundle.config, version: bundle.version, fromCache: false, signature: bundle.signature?.signature };
    },
    verifySignature: opts.verifySignature ? (payload: string, signature: string) => Promise.resolve(opts.verifySignature!(payload, signature)) : undefined,
  };
}

// ── STEP 3 · Configuration cache controller (uses the existing ConfigurationCache) ─
interface ConfigurationCacheEntry { bundle: ConfigurationBundle; storedAtMs: number; ttlMs: number; signatureStatus: SignatureStatus }

export class ConfigurationCacheController {
  private readonly keys = new Set<string>();
  constructor(private readonly cache: Cache<unknown>, private readonly ttlMs: number) {}

  /** Lookup with TTL + version validation (STEP 3). Returns the bundle only when fresh + valid. */
  lookup(key: string, nowMs: number, expectedVersion?: SemVer): { bundle: ConfigurationBundle | null; hit: boolean; expired: boolean; versionMismatch: boolean; signatureStatus: SignatureStatus } {
    const entry = this.cache.get(key) as ConfigurationCacheEntry | null;
    if (!entry) return { bundle: null, hit: false, expired: false, versionMismatch: false, signatureStatus: 'unsigned' };
    const expired = nowMs - entry.storedAtMs > entry.ttlMs;
    const versionMismatch = !!expectedVersion && entry.bundle.version !== expectedVersion;
    const valid = isSemver(entry.bundle.version) && !expired && !versionMismatch;
    return { bundle: valid ? entry.bundle : null, hit: true, expired, versionMismatch, signatureStatus: entry.signatureStatus };
  }

  store(key: string, bundle: ConfigurationBundle, nowMs: number, signatureStatus: SignatureStatus): void {
    this.cache.set(key, { bundle, storedAtMs: nowMs, ttlMs: this.ttlMs, signatureStatus } as ConfigurationCacheEntry);
    this.keys.add(key);
  }

  /** Invalidate a single key, or every key within a scope. Returns the count removed. */
  invalidate(scope?: { tenantId?: TenantId; channel?: ChannelId; environment?: Environment }): number {
    let n = 0;
    for (const key of [...this.keys]) {
      const [t, c, e] = key.split('|');
      if (scope && ((scope.tenantId && scope.tenantId !== t) || (scope.channel && scope.channel !== c) || (scope.environment && scope.environment !== e))) continue;
      this.cache.delete(key);
      this.keys.delete(key);
      n++;
    }
    return n;
  }
}

// ── The Remote Configuration coordinator ─────────────────────────────────────────
export interface ResolveConfigurationOptions {
  preview?: boolean;
  experienceId?: ExperienceId;
  /** Pin a specific version; a cached bundle of a different version is treated as a miss. */
  version?: SemVer;
  /** Resolved audience ids for this request (Wave 9) — carried into configuration-policy scope. */
  audiences?: string[];
  /** Effective feature flags for this request (Wave 10) — carried into configuration-policy context. */
  flags?: PolicyContext['flags'];
  onEvent?: (event: ConfigurationEvent) => void;
  onPolicyEvent?: (event: PolicyEvent) => void;
}

export interface RemoteConfiguration {
  resolve(context: ExperienceContext, opts?: ResolveConfigurationOptions): Promise<EffectiveConfiguration>;
  invalidate(scope?: { tenantId?: TenantId; channel?: ChannelId; environment?: Environment }): number;
}

export interface RemoteConfigurationDeps {
  providers: ProviderRegistry;
  policyEngine: PolicyEngine;
  /** The existing Delivery ConfigurationCache (DeliveryCaches.configuration). */
  cache: Cache<unknown>;
}
export interface RemoteConfigurationOptions {
  ttlMs?: number;
  clock?: () => number;
  /** Fallback verifier when the provider exposes none. Injected — no secret in this module. */
  verifier?: (payload: string, signature: string) => Promise<boolean> | boolean;
  onEvent?: (event: ConfigurationEvent) => void;
}

const defaultClock = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);
const DEFAULT_TTL_MS = 60_000;

const emptyEffective = (at: Timestamp, diagnostics: string[]): EffectiveConfiguration => ({
  config: {}, version: '0', source: 'none', fromCache: false, signatureStatus: 'unsigned', rejected: false,
  policySummary: { matched: [], ignored: [], effect: 'noop', conflicts: 0, directives: 0 }, diagnostics, resolvedAt: at,
});

export function createRemoteConfiguration(deps: RemoteConfigurationDeps, opts: RemoteConfigurationOptions = {}): RemoteConfiguration {
  const clock = opts.clock ?? defaultClock;
  const controller = new ConfigurationCacheController(deps.cache, opts.ttlMs ?? DEFAULT_TTL_MS);

  return {
    invalidate(scope): number {
      const n = controller.invalidate(scope);
      opts.onEvent?.({ type: 'configuration.invalidated', key: scope ? Object.values(scope).join('|') : '*', at: '', message: `${n} entr${n === 1 ? 'y' : 'ies'} invalidated` });
      return n;
    },

    async resolve(context: ExperienceContext, resolveOpts: ResolveConfigurationOptions = {}): Promise<EffectiveConfiguration> {
      const at = context.now ?? '';
      const nowMs = clock();
      const key = configurationCacheKey(context.tenantId, context.channel, context.environment.environment);
      const diagnostics: string[] = [];
      const emit = (type: ConfigurationEventType, version?: SemVer, message?: string): void => {
        const e: ConfigurationEvent = { type, key, at, version, message };
        resolveOpts.onEvent?.(e);
        opts.onEvent?.(e);
      };

      // ── 1 · Configuration policy evaluation (the effective decision governs the config) ──
      const outcome = await deps.policyEngine.evaluate(context, { experienceId: resolveOpts.experienceId, preview: resolveOpts.preview, types: ['configuration'], audiences: resolveOpts.audiences, flags: resolveOpts.flags, onEvent: resolveOpts.onPolicyEvent });
      const policySummary: ConfigurationPolicySummary = {
        matched: outcome.matched, ignored: outcome.ignored, effect: outcome.decision.effect,
        conflicts: outcome.decision.conflicts.length, directives: Object.keys(outcome.decision.directives).length,
      };
      // A configuration policy may DENY configuration outright.
      if (outcome.decision.effect === 'deny') {
        diagnostics.push('configuration denied by policy');
        emit('configuration.rejected', undefined, 'denied by policy');
        return { ...emptyEffective(at, diagnostics), source: 'none', rejected: true, reason: 'denied by policy', policySummary };
      }

      // ── 2 · Cache lookup (TTL + version validation) ──
      const look = controller.lookup(key, nowMs, resolveOpts.version);
      let bundle: ConfigurationBundle | null = look.bundle;
      let source: ConfigurationSource = 'none';
      let fromCache = false;
      let providerId: string | undefined;
      let signatureStatus: SignatureStatus = 'unsigned';

      if (bundle) {
        source = 'cache';
        fromCache = true;
        signatureStatus = look.signatureStatus; // the status verified when it was stored
        diagnostics.push(`cache hit (v${bundle.version})`);
      } else {
        if (look.hit && look.expired) diagnostics.push('cache expired');
        if (look.hit && look.versionMismatch) diagnostics.push('cache version mismatch');

        // ── 3 · Configuration Provider ──
        const pctx: ProviderContext = { tenantId: context.tenantId, channel: context.channel, environment: context.environment.environment, locale: context.locale, preview: resolveOpts.preview };
        const provider = deps.providers.resolve('configuration', pctx) as ConfigurationProvider | null;
        if (!provider) {
          diagnostics.push('no configuration provider registered');
          emit('configuration.loaded', '0', 'no provider');
          return { ...emptyEffective(at, diagnostics), source: 'none', policySummary };
        }
        providerId = provider.metadata.id;

        let result;
        try {
          result = await provider.load(pctx);
        } catch (e) {
          diagnostics.push(`provider failed: ${e instanceof Error ? e.message : String(e)}`);
          emit('configuration.rejected', undefined, 'provider error');
          return { ...emptyEffective(at, diagnostics), source: 'provider', providerId, rejected: true, reason: 'provider error', policySummary };
        }
        if (!result) {
          diagnostics.push('provider returned no configuration');
          emit('configuration.loaded', '0', 'empty');
          return { ...emptyEffective(at, diagnostics), source: 'provider', providerId, policySummary };
        }

        // ── 3b · Signature verification (verify-before-trust; never fabricate 'valid') ──
        if (result.signature) {
          const verify = provider.verifySignature ?? opts.verifier;
          if (!verify) {
            signatureStatus = 'unverified';
            diagnostics.push('signed bundle accepted UNVERIFIED (no verifier available)');
          } else {
            const okSig = await verify(stableStringify(result.config), result.signature);
            if (!okSig) {
              signatureStatus = 'invalid';
              diagnostics.push('signature verification FAILED — configuration rejected');
              emit('configuration.rejected', result.version, 'invalid signature');
              return { ...emptyEffective(at, diagnostics), source: 'provider', providerId, signatureStatus, rejected: true, reason: 'invalid signature', version: result.version, policySummary } as EffectiveConfiguration;
            }
            signatureStatus = 'valid';
            diagnostics.push('signature verified');
          }
        }

        const cfg = (result.config && typeof result.config === 'object' && !Array.isArray(result.config)) ? result.config as { [k: string]: Json } : {};
        bundle = {
          id: `cfg_${key}_${result.version}`,
          tenantId: context.tenantId, channel: context.channel, environment: context.environment.environment, version: result.version,
          config: cfg,
          metadata: { version: result.version, generatedAt: at, tenantId: context.tenantId, channel: context.channel, environment: context.environment.environment, checksum: configChecksum(cfg), sizeBytes: stableStringify(cfg).length },
          signature: result.signature ? { algorithm: 'HMAC-SHA256', signature: result.signature, signedAt: at } : undefined,
        };
        source = 'provider';
        diagnostics.push(`loaded from provider ${providerId} (v${result.version})`);

        // ── 4 · Cache store ──
        controller.store(key, bundle, nowMs, signatureStatus);
        emit('configuration.cached', bundle.version, 'stored');
      }

      // ── 5 · Effective configuration = bundle config + policy directives (policy wins) ──
      const effectiveConfig: { [k: string]: Json } = { ...bundle.config, ...outcome.decision.directives };
      emit('configuration.loaded', bundle.version, source);

      return {
        config: effectiveConfig,
        version: bundle.version,
        source,
        fromCache,
        providerId,
        signatureStatus,
        rejected: false,
        policySummary,
        metadata: bundle.metadata,
        diagnostics,
        resolvedAt: at,
      };
    },
  };
}
