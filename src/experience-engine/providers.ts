// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Provider Architecture (Wave 6).
//
// A Provider is a pluggable, prioritised, health-reporting source of one kind of experience
// artifact (experience, configuration, snapshot, manifest, theme, asset, …). The Provider
// Registry registers them, matches by capability, resolves by priority, and reports health.
// The Delivery Layer orchestrates the experience source THROUGH the registry instead of
// talking to a concrete source.
//
//   Delivery → ExperienceProviderGateway → ProviderRegistry → ExperienceProvider → DeliverySource
//
// PURE. This module depends only on the delivery/context/type contracts (one-directional —
// delivery never imports providers, so there is no cycle). STEP 3 ships the ExperienceProvider
// (wrapping the existing DeliverySource, behaviour unchanged); every other provider kind is a
// CONTRACT ONLY — no implementation this wave. Remote Configuration is NOT implemented.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, Environment, ExperienceId, Json, LocaleCode, SemVer, TenantId, Timestamp } from './types';
import type { ExperienceResolution } from './context';
import type { DeliveryContext, DeliverySource, ExperienceProviderGateway, ExperienceSnapshot, SelectedExperienceProvider, SnapshotManifest } from './delivery';

// ── STEP 1 · Provider contracts ─────────────────────────────────────────────────
export type ProviderKind = 'experience' | 'configuration' | 'snapshot' | 'manifest' | 'theme' | 'asset' | (string & {});

/** Higher wins. Providers of the same kind are selected in descending priority. */
export type ProviderPriority = number;

/** STEP 10 · the four health states every provider reports. */
export type ProviderHealthStatus = 'healthy' | 'degraded' | 'offline' | 'unsupported';

export interface ProviderHealth {
  status: ProviderHealthStatus;
  since?: Timestamp;
  detail?: string;
}

/** Capability descriptor — the registry matches these against a ProviderContext. */
export interface ProviderCapabilities {
  channels?: ChannelId[];
  environments?: Environment[];
  /** Whether the provider can serve preview/draft content. */
  preview?: boolean;
  /** Free-form capability tags (e.g. 'html-string', 'react-dom', 'signed'). */
  tags?: string[];
}

export interface ProviderMetadata {
  id: string;
  name: string;
  kind: ProviderKind;
  version: SemVer;
  priority?: ProviderPriority;
  capabilities?: ProviderCapabilities;
  description?: string;
}

/** The identity a provider is matched and resolved against. */
export interface ProviderContext {
  tenantId: TenantId;
  channel: ChannelId;
  environment: Environment;
  locale?: LocaleCode;
  preview?: boolean;
  now?: Timestamp;
  /** Optional capability tag the caller requires (matched against capabilities.tags). */
  capability?: string;
}

/** The base every provider implements: identity, capability match, and health. */
export interface Provider {
  readonly metadata: ProviderMetadata;
  supports(ctx: ProviderContext): boolean;
  health(): ProviderHealth;
}

// ── STEP 3 · Experience Provider (the only implemented kind this wave) ──────────
export interface ExperienceProvider extends Provider {
  resolve(ctx: DeliveryContext): Promise<ExperienceResolution>;
}

// ── STEP 4 · Configuration Provider — CONTRACT ONLY (Remote Config NOT implemented) ─
export interface ConfigurationResult { config: Json; version: SemVer; fromCache: boolean; signature?: string }
export interface ConfigurationProvider extends Provider {
  load(ctx: ProviderContext): Promise<ConfigurationResult | null>;
  verifySignature?(payload: string, signature: string): Promise<boolean>;
}

// ── STEP 5 · Snapshot Provider — CONTRACT ONLY ──────────────────────────────────
export interface SnapshotProvider extends Provider {
  getSnapshot(ctx: ProviderContext, experienceId: ExperienceId, version?: SemVer): Promise<ExperienceSnapshot | null>;
  putSnapshot?(snapshot: ExperienceSnapshot): Promise<void>;
}

// ── STEP 6 · Manifest Provider — CONTRACT ONLY ──────────────────────────────────
export interface ManifestProvider extends Provider {
  getManifest(ctx: ProviderContext, experienceId: ExperienceId): Promise<SnapshotManifest | null>;
}

// ── STEP 7 · Theme Provider — CONTRACT ONLY ─────────────────────────────────────
export interface ThemeProvider extends Provider {
  getTheme(ctx: ProviderContext, themeId?: string): Promise<Json | null>;
}

// ── STEP 8 · Asset Provider — CONTRACT ONLY ─────────────────────────────────────
export interface AssetReference { id?: string; url?: string; kind?: string }
export interface ResolvedAsset { url: string; contentType?: string; bytes?: number }
export interface AssetProvider extends Provider {
  resolveAsset(ctx: ProviderContext, ref: AssetReference): Promise<ResolvedAsset | null>;
}

// ── Capability matching (pure) ──────────────────────────────────────────────────
export function providerMatches(meta: ProviderMetadata, ctx: ProviderContext): boolean {
  const cap = meta.capabilities;
  if (!cap) return true;
  if (cap.channels && cap.channels.length > 0 && !cap.channels.includes(ctx.channel)) return false;
  if (cap.environments && cap.environments.length > 0 && !cap.environments.includes(ctx.environment)) return false;
  if (ctx.preview && cap.preview === false) return false;
  if (ctx.capability && cap.tags && !cap.tags.includes(ctx.capability)) return false;
  return true;
}

const isUsable = (h: ProviderHealthStatus): boolean => h === 'healthy' || h === 'degraded';
const healthRank = (h: ProviderHealthStatus): number => (h === 'healthy' ? 0 : h === 'degraded' ? 1 : 2);

// ── STEP 2 · Provider Registry ──────────────────────────────────────────────────
export interface ProviderRegistry {
  register(provider: Provider): void;
  unregister(id: string): void;
  get(id: string): Provider | null;
  has(id: string): boolean;
  all(): Provider[];
  byKind(kind: ProviderKind): Provider[];
  /** All providers of a kind that support the context AND are usable, sorted by priority. */
  matching(kind: ProviderKind, ctx: ProviderContext): Provider[];
  /** The single best provider of a kind for a context, or null (graceful). */
  resolve(kind: ProviderKind, ctx: ProviderContext): Provider | null;
  /** Health snapshot of every registered provider, keyed by id. */
  health(): Record<string, ProviderHealth>;
  ids(): string[];
  size(): number;
  clear(): void;
}

/** In-memory registry. Pure infrastructure — registration, matching, priority, health. */
export class InMemoryProviderRegistry implements ProviderRegistry {
  private readonly providers = new Map<string, Provider>();

  register(provider: Provider): void { this.providers.set(provider.metadata.id, provider); }
  unregister(id: string): void { this.providers.delete(id); }
  get(id: string): Provider | null { return this.providers.get(id) ?? null; }
  has(id: string): boolean { return this.providers.has(id); }
  all(): Provider[] { return [...this.providers.values()]; }
  byKind(kind: ProviderKind): Provider[] { return this.all().filter(p => p.metadata.kind === kind); }

  matching(kind: ProviderKind, ctx: ProviderContext): Provider[] {
    return this.byKind(kind)
      .filter(p => isUsable(p.health().status) && p.supports(ctx))
      .sort((a, b) => {
        const pri = (b.metadata.priority ?? 0) - (a.metadata.priority ?? 0);
        if (pri !== 0) return pri;
        return healthRank(a.health().status) - healthRank(b.health().status);
      });
  }

  resolve(kind: ProviderKind, ctx: ProviderContext): Provider | null {
    return this.matching(kind, ctx)[0] ?? null;
  }

  health(): Record<string, ProviderHealth> {
    const out: Record<string, ProviderHealth> = {};
    for (const [id, p] of this.providers) out[id] = p.health();
    return out;
  }

  ids(): string[] { return [...this.providers.keys()]; }
  size(): number { return this.providers.size; }
  clear(): void { this.providers.clear(); }
}

export function createProviderRegistry(): ProviderRegistry { return new InMemoryProviderRegistry(); }

// ── STEP 3 · wrap the existing DeliverySource as an ExperienceProvider ──────────
export interface ExperienceProviderOptions {
  id?: string;
  name?: string;
  version?: SemVer;
  priority?: ProviderPriority;
  capabilities?: ProviderCapabilities;
  /** Health probe. Default: always healthy. */
  health?: () => ProviderHealth;
}

/**
 * Wrap a DeliverySource as the first ExperienceProvider. Delivery behaviour is UNCHANGED:
 * `resolve` delegates verbatim to the wrapped source.
 */
export function createExperienceProvider(source: DeliverySource, opts: ExperienceProviderOptions = {}): ExperienceProvider {
  const metadata: ProviderMetadata = {
    id: opts.id ?? 'experience.default',
    name: opts.name ?? 'Experience Provider',
    kind: 'experience',
    version: opts.version ?? '1.0.0',
    priority: opts.priority ?? 0,
    capabilities: opts.capabilities,
  };
  return {
    metadata,
    supports: (ctx: ProviderContext): boolean => providerMatches(metadata, ctx),
    health: opts.health ?? ((): ProviderHealth => ({ status: 'healthy' })),
    resolve: (ctx: DeliveryContext): Promise<ExperienceResolution> => source.resolve(ctx),
  };
}

// ── STEP 9 · the gateway Delivery orchestrates through ──────────────────────────
/** Map a DeliveryContext to the ProviderContext the registry matches against (pure). */
export function toProviderContext(ctx: DeliveryContext): ProviderContext {
  const c = ctx.context;
  return { tenantId: c.tenantId, channel: c.channel, environment: c.environment.environment, locale: c.locale, preview: ctx.preview, now: c.now };
}

/**
 * Adapt a ProviderRegistry into the ExperienceProviderGateway seam that Delivery holds. The
 * registry selects the best ExperienceProvider (priority + capability + health); the gateway
 * returns it as a SelectedExperienceProvider. Delivery never imports the registry — only this
 * structural gateway — so there is no dependency cycle.
 */
export function createExperienceProviderGateway(registry: ProviderRegistry): ExperienceProviderGateway {
  return {
    resolveExperienceProvider(ctx: DeliveryContext): SelectedExperienceProvider | null {
      const provider = registry.resolve('experience', toProviderContext(ctx)) as ExperienceProvider | null;
      if (!provider) return null;
      return { id: provider.metadata.id, resolve: (c: DeliveryContext) => provider.resolve(c) };
    },
  };
}
