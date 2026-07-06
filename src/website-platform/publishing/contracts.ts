// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Publishing foundation contracts (Wave 0).
// INTERFACES ONLY — no rendering/compile implementation in this wave. These define
// the seams the Publishing Engine, Snapshot Compiler, Renderer and Delivery layers
// will implement. Establishing them now lets later waves land behind the flags
// without touching callers.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, Result, ISODateTime } from '../shared/types';
import type { JsonObject } from '../domain/entities';
import type { PublishScope } from '../domain/enums';

/** A fully-resolved page as compiled into a published snapshot. */
export interface CompiledPage {
  path: string;
  locale: string;
  /** Denormalized block tree ready to render (no further DB reads). */
  content: JsonObject;
  /** Resolved SEO head data. */
  seo: JsonObject;
  /** Pre-rendered HTML for static pages (null for dynamic/ISR pages). */
  html: string | null;
  etag: string;
}

/** An immutable, versioned compilation of an entire site (or a subset of pages). */
export interface SiteSnapshot {
  siteId: UUID;
  version: number;
  scope: PublishScope;
  pages: CompiledPage[];
  /** Compiled theme CSS-variable map ({ light, dark }). */
  theme: JsonObject;
  compiledAt: ISODateTime;
}

/** A publish request (idempotent on `idempotencyKey`). */
export interface PublishRequest {
  tenantId: UUID;
  siteId: UUID;
  scope: PublishScope;
  /** For partial publishes, the pages to compile; ignored for full. */
  pageIds?: UUID[];
  publishedBy: UUID | null;
  scheduledAt?: ISODateTime | null;
  idempotencyKey: string;
}

export interface PublishResult {
  siteId: UUID;
  version: number;
  scope: PublishScope;
  invalidatedKeys: string[];
}

/** Compiles the current draft graph into an immutable snapshot. */
export interface SnapshotCompiler {
  compile(request: PublishRequest): Promise<Result<SiteSnapshot>>;
}

/** The context a renderer needs to resolve a request to a compiled page. */
export interface RenderContext {
  host: string;
  path: string;
  locale: string;
  /** Coarse, low-cardinality signals only (never per-user) — the cache-key discipline. */
  variantKey: string;
  deviceClass: 'mobile' | 'tablet' | 'desktop';
}

export interface RenderedResponse {
  status: number;
  html: string;
  headers: Readonly<Record<string, string>>;
  cacheKey: string;
}

/** Renders a compiled page to an HTTP response (edge SSR/ISR). Impl in a later wave. */
export interface Renderer {
  render(snapshot: SiteSnapshot, context: RenderContext): Promise<Result<RenderedResponse>>;
}

/** Persists a snapshot and invalidates the delivery cache for changed keys. */
export interface DeliveryTarget {
  publish(snapshot: SiteSnapshot): Promise<Result<PublishResult>>;
  invalidate(siteId: UUID, keys: string[]): Promise<Result<true>>;
}

/** The top-level publishing façade the CMS calls. */
export interface PublishingEngine {
  publish(request: PublishRequest): Promise<Result<PublishResult>>;
  rollback(tenantId: UUID, siteId: UUID, toVersion: number): Promise<Result<PublishResult>>;
}
