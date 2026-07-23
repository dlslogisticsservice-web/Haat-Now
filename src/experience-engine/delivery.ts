// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Experience Delivery Layer (Wave 5).
//
// The single gateway between the Runtime and the experience sources. It inserts a cache /
// version / snapshot layer in front of resolution:
//
//   deliver → Lookup Cache → Validate → Resolve Source → Update Cache → DeliveryResult
//
// PURE. Generic caches are in-memory infrastructure (a typed Map, like InMemoryRegistry) —
// not business logic. The delivery layer knows nothing about website.service; it calls a
// DeliverySource (the engine wraps `resolve` as one). GRACEFUL: a source failure returns a
// DeliveryResult, never throws. Remote Configuration is NOT implemented — its cache is a
// declared placeholder only.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, ExperienceId, SemVer, TenantId, Timestamp } from './types';
import type { ExperienceContext, ExperienceResolution } from './context';
import type { ExperienceSchema } from './schema';
import type { ComponentMetadata, AssetMetadata } from './metadata';

// ── Cache contracts (STEP 2) — interfaces + one generic pure impl ──────────────
export interface Cache<V> {
  get(key: string): V | null;
  set(key: string, value: V): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
}

/** Generic in-memory cache. Pure infrastructure — no business logic. */
export class InMemoryCache<V> implements Cache<V> {
  private readonly m = new Map<string, V>();
  get(key: string): V | null { return this.m.has(key) ? (this.m.get(key) as V) : null; }
  set(key: string, value: V): void { this.m.set(key, value); }
  has(key: string): boolean { return this.m.has(key); }
  delete(key: string): void { this.m.delete(key); }
  clear(): void { this.m.clear(); }
  get size(): number { return this.m.size; }
}

export type VersionCache = Cache<SemVer>;
export type SchemaCache = Cache<ExperienceSchema>;
export type SnapshotCache = Cache<ExperienceSnapshot>;
export type ManifestCache = Cache<SnapshotManifest>;
export type ComponentCache = Cache<ComponentMetadata>;
export type AssetCache = Cache<AssetMetadata>;
/** Placeholder — Remote Configuration is NOT implemented this wave. */
export type ConfigurationCache = Cache<unknown>;

export interface DeliveryCaches {
  version: VersionCache;
  schema: SchemaCache;
  snapshot: SnapshotCache;
  manifest: ManifestCache;
  component: ComponentCache;
  asset: AssetCache;
  configuration: ConfigurationCache;
}

export function createDeliveryCaches(): DeliveryCaches {
  return {
    version: new InMemoryCache<SemVer>(),
    schema: new InMemoryCache<ExperienceSchema>(),
    snapshot: new InMemoryCache<ExperienceSnapshot>(),
    manifest: new InMemoryCache<SnapshotManifest>(),
    component: new InMemoryCache<ComponentMetadata>(),
    asset: new InMemoryCache<AssetMetadata>(),
    configuration: new InMemoryCache<unknown>(),
  };
}

// ── Cache keys (STEP 3) — deterministic ────────────────────────────────────────
export interface DeliveryContext {
  experienceId: ExperienceId;
  context: ExperienceContext;
  version?: SemVer;
  preview?: boolean;
}

/** Deterministic key over tenant · channel · experience · locale · env · version · preview. */
export function deliveryCacheKey(ctx: DeliveryContext): string {
  const c = ctx.context;
  return [c.tenantId, c.channel, ctx.experienceId, c.locale, c.environment.environment, ctx.version ?? 'latest', ctx.preview ? 'preview' : 'published'].join('|');
}

// ── Snapshot models (STEP 6) ────────────────────────────────────────────────────
export interface SnapshotVersion { version: SemVer; status: 'draft' | 'published' | 'archived'; publishedAt?: Timestamp }
export interface SnapshotSignature { algorithm: 'HMAC-SHA256' | (string & {}); signature: string; signedAt: Timestamp }
export interface SnapshotMetadata { version: SemVer; generatedAt: Timestamp; checksum?: string; sizeBytes?: number }
export interface SnapshotManifest { experienceId: ExperienceId; channel: ChannelId; versions: SnapshotVersion[]; signature?: SnapshotSignature }
export interface ExperienceSnapshot {
  id: string;
  experienceId: ExperienceId;
  channel: ChannelId;
  version: SemVer;
  schema: ExperienceSchema;
  metadata: SnapshotMetadata;
  /** Detached signature — verified before trust once remote delivery exists (placeholder). */
  signature?: SnapshotSignature;
}

/** Build a snapshot from a resolved experience (pure). */
export function buildSnapshot(resolution: ExperienceResolution, generatedAt: Timestamp): ExperienceSnapshot {
  const version = resolution.version ?? '0';
  return {
    id: `snap_${resolution.experienceId}_${version}`,
    experienceId: resolution.experienceId,
    channel: resolution.channel,
    version,
    schema: resolution.schema as ExperienceSchema,
    metadata: { version, generatedAt },
  };
}

// ── Cache invalidation (STEP 5) — contracts only, no execution ──────────────────
export type InvalidationTrigger = 'publish' | 'rollback' | 'version-change' | 'theme-change' | 'asset-change' | 'rule-change';
export interface InvalidationScope { tenantId?: TenantId; channel?: ChannelId; experienceId?: ExperienceId }

/** Contract for computing which cache keys a change invalidates. NOT executed here. */
export interface CacheInvalidator {
  keysFor(trigger: InvalidationTrigger, scope: InvalidationScope): string[];
}

/** Pure helper: does a delivery key fall within a scope? (used by a future invalidator). */
export function keyInScope(key: string, scope: InvalidationScope): boolean {
  const [tenant, channel, experience] = key.split('|');
  return (scope.tenantId == null || scope.tenantId === tenant) &&
    (scope.channel == null || scope.channel === channel) &&
    (scope.experienceId == null || scope.experienceId === experience);
}

// ── Delivery events (STEP 7) ────────────────────────────────────────────────────
export type DeliveryEventType = 'cache.hit' | 'cache.miss' | 'cache.updated' | 'snapshot.loaded' | 'snapshot.stored' | 'manifest.loaded';
export interface DeliveryEvent { type: DeliveryEventType; key: string; at: Timestamp; message?: string }

// ── Delivery result + source ────────────────────────────────────────────────────
export type DeliveryStatus = 'hit' | 'miss-resolved' | 'not-found' | 'error';
export type DeliveryDiagnostics = string[];

export interface DeliveryMetadata {
  cacheKey: string;
  fromCache: boolean;
  version: SemVer | null;
  sourceKind: 'cache' | 'source';
  generatedAt: Timestamp;
  /** The Provider that produced this (Wave 6). Absent on a cache hit — no provider consulted. */
  providerId?: string;
}

export interface DeliveryResult {
  status: DeliveryStatus;
  resolution: ExperienceResolution;
  metadata: DeliveryMetadata;
  diagnostics: DeliveryDiagnostics;
}

/** The seam to the actual experience source (the engine wraps `resolve` as one). */
export interface DeliverySource {
  resolve(ctx: DeliveryContext): Promise<ExperienceResolution>;
}

/**
 * An ExperienceProvider the registry selected, reduced to what Delivery needs (Wave 6). It is
 * structurally a DeliverySource plus an id — defined HERE so delivery never imports the
 * provider module (one-directional dependency, no cycle).
 */
export interface SelectedExperienceProvider extends DeliverySource {
  id: string;
}

/** The seam Delivery orchestrates through — backed by the Provider Registry (Wave 6). */
export interface ExperienceProviderGateway {
  resolveExperienceProvider(ctx: DeliveryContext): SelectedExperienceProvider | null;
}

export interface DeliveryOptions {
  caches?: DeliveryCaches;
  onEvent?: (event: DeliveryEvent) => void;
  /**
   * The Provider gateway (Wave 6). When present the experience source is resolved through the
   * Provider Registry; when absent Delivery calls the direct `source` (Wave 5 behaviour).
   */
  providers?: ExperienceProviderGateway;
}

const errRes = (ctx: DeliveryContext, status: ExperienceResolution['status'], diag: string): ExperienceResolution =>
  ({ status, experienceId: ctx.experienceId, channel: ctx.context.channel, diagnostics: [diag] });

// ── The Delivery Layer ──────────────────────────────────────────────────────────
export class ExperienceDelivery {
  readonly caches: DeliveryCaches;
  private readonly onEvent?: (event: DeliveryEvent) => void;
  private readonly providers?: ExperienceProviderGateway;
  /** Internal: the resolved artifact behind a key, preserved verbatim so a hit is faithful. */
  private readonly resolutions = new InMemoryCache<ExperienceResolution>();

  constructor(private readonly source: DeliverySource, opts: DeliveryOptions = {}) {
    this.caches = opts.caches ?? createDeliveryCaches();
    this.onEvent = opts.onEvent;
    this.providers = opts.providers;
  }

  /** The delivery pipeline (STEP 4). Never throws — always returns a DeliveryResult. */
  async deliver(ctx: DeliveryContext): Promise<DeliveryResult> {
    const key = deliveryCacheKey(ctx);
    const at = ctx.context.now ?? '';
    const emit = (type: DeliveryEventType, message?: string): void => this.onEvent?.({ type, key, at, message });

    // 1 · Lookup Cache — serve the cached resolution verbatim (diagnostics preserved).
    const cached = this.resolutions.get(key);
    if (cached) {
      emit('cache.hit');
      if (this.caches.snapshot.has(key)) emit('snapshot.loaded');
      const version = this.caches.version.get(key) ?? cached.version;
      const resolution: ExperienceResolution = { ...cached, diagnostics: [...(cached.diagnostics ?? []), 'delivered from cache'] };
      return { status: 'hit', resolution, metadata: { cacheKey: key, fromCache: true, version: version ?? null, sourceKind: 'cache', generatedAt: at }, diagnostics: ['cache hit'] };
    }
    emit('cache.miss');

    // 2 · Validate
    if (!ctx.experienceId || !ctx.context) {
      return { status: 'error', resolution: errRes(ctx, 'error', 'invalid delivery context'), metadata: { cacheKey: key, fromCache: false, version: null, sourceKind: 'source', generatedAt: at }, diagnostics: ['invalid delivery context'] };
    }

    // 3 · Resolve Source — via a Provider from the registry when wired, else the direct source.
    let resolution: ExperienceResolution;
    let providerId: string | undefined;
    try {
      const selected = this.providers?.resolveExperienceProvider(ctx) ?? null;
      providerId = selected?.id;
      const source: DeliverySource = selected ?? this.source;
      resolution = await source.resolve(ctx);
    } catch (e) {
      return { status: 'error', resolution: errRes(ctx, 'error', `source failed: ${e instanceof Error ? e.message : String(e)}`), metadata: { cacheKey: key, fromCache: false, version: null, sourceKind: 'source', generatedAt: at, providerId }, diagnostics: ['source threw'] };
    }

    if (resolution.status !== 'resolved' || !resolution.schema) {
      // Not cached — an unresolved experience must be re-attempted next time.
      return { status: resolution.status === 'not-found' ? 'not-found' : 'error', resolution, metadata: { cacheKey: key, fromCache: false, version: resolution.version ?? null, sourceKind: 'source', generatedAt: at, providerId }, diagnostics: [`source: ${resolution.status}`] };
    }

    // 4 · Update Cache
    this.resolutions.set(key, resolution);
    this.caches.schema.set(key, resolution.schema);
    if (resolution.version) this.caches.version.set(key, resolution.version);
    this.caches.snapshot.set(key, buildSnapshot(resolution, at));
    emit('cache.updated');
    emit('snapshot.stored');

    // 5 · Return
    return { status: 'miss-resolved', resolution, metadata: { cacheKey: key, fromCache: false, version: resolution.version ?? null, sourceKind: 'source', generatedAt: at, providerId }, diagnostics: ['resolved from source, cached'] };
  }
}

export function createExperienceDelivery(source: DeliverySource, opts: DeliveryOptions = {}): ExperienceDelivery {
  return new ExperienceDelivery(source, opts);
}
