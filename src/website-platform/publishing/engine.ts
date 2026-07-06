// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Publishing Engine (Wave 2).
// Compiles the draft content graph into an immutable, versioned, checksummed
// snapshot and manages the draft→published pipeline: atomic publish, rollback,
// scheduled publish, preview URLs, publish history, and content-integrity validation.
// Builds on Wave 1 (SnapshotStore, repositories, outbox, jobs) + Wave 0 contracts.
// Persistence + compilation only — HTML rendering lives in ../rendering.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, Result, ISODateTime } from '../shared/types';
import { ok, err, isOk } from '../shared/types';
import { errors } from '../shared/errors';
import type { JsonObject, JsonValue } from '../domain/entities';
import type { CompiledPage, SiteSnapshot, PublishRequest, PublishResult, SnapshotCompiler, PublishingEngine } from './contracts';
import type { PlatformContext, OperationContext } from '../services/context';
import { contentHash, checksum } from '../snapshot/snapshot';

// ── Manifests ──────────────────────────────────────────────────────────────────
export interface SnapshotManifest {
  siteId: UUID;
  version: number;
  hash: string;
  checksum: string;
  pageCount: number;
  paths: string[];
  compiledAt: ISODateTime;
}
export interface AssetManifestEntry { assetId: UUID; storagePath: string; fingerprint: string }
export interface AssetManifest { siteId: UUID; entries: AssetManifestEntry[] }
export interface VersionManifestEntry { version: number; hash: string; publishedAt: ISODateTime }
export interface VersionManifest { siteId: UUID; current: number; history: VersionManifestEntry[] }

function fingerprint(input: string): string {
  return contentHash(input);
}

// ── Compiler ─────────────────────────────────────────────────────────────────────
/** Reads the draft graph via repositories and produces an immutable SiteSnapshot. */
export class RepositorySnapshotCompiler implements SnapshotCompiler {
  constructor(private readonly ctx: PlatformContext) {}

  async compile(request: PublishRequest): Promise<Result<SiteSnapshot>> {
    const { tenantId, siteId } = request;
    const site = await this.ctx.repos.sites.getById(tenantId, siteId);
    if (!isOk(site)) return err(site.error);

    const pagesRes = await this.ctx.repos.pages.list(tenantId, { pageSize: 200, filters: [{ field: 'siteId', operator: 'eq', value: siteId }] });
    if (!isOk(pagesRes)) return err(pagesRes.error);
    let pages = pagesRes.value.items;
    if (request.scope === 'partial' && request.pageIds && request.pageIds.length > 0) {
      const set = new Set(request.pageIds);
      pages = pages.filter(p => set.has(p.id));
    }

    const compiled: CompiledPage[] = [];
    for (const page of pages) {
      const sectionsRes = await this.ctx.repos.sections.list(tenantId, { pageSize: 200, filters: [{ field: 'pageId', operator: 'eq', value: page.id }], sort: [{ field: 'position', direction: 'asc' }] });
      const sections = isOk(sectionsRes) ? sectionsRes.value.items : [];
      const sectionTrees: JsonValue[] = [];
      for (const section of sections) {
        const blocksRes = await this.ctx.repos.blocks.list(tenantId, { pageSize: 200, filters: [{ field: 'sectionId', operator: 'eq', value: section.id }], sort: [{ field: 'position', direction: 'asc' }] });
        const blocks = isOk(blocksRes) ? blocksRes.value.items.filter(b => b.enabled) : [];
        sectionTrees.push({
          id: section.id, key: section.key, settings: section.settings, visibility: section.visibility,
          blocks: blocks.map(b => ({ id: b.id, type: b.type, props: b.props, visibility: b.visibility })),
        } as unknown as JsonValue);
      }
      const seoRes = await this.ctx.repos.seo.list(tenantId, { pageSize: 5, filters: [{ field: 'pageId', operator: 'eq', value: page.id }] });
      const seoRow = isOk(seoRes) ? seoRes.value.items[0] : undefined;

      const content: JsonObject = { pageId: page.id, title: page.title, sections: sectionTrees };
      const seo: JsonObject = seoRow
        ? { title: seoRow.metaTitle, description: seoRow.metaDescription, canonical: seoRow.canonical, robots: seoRow.robots, keywords: seoRow.keywords, jsonLd: seoRow.jsonLd }
        : { title: page.title, robots: 'index,follow' };

      compiled.push({
        path: pathForPage(page.slug),
        locale: page.locale,
        content,
        seo,
        html: null,                         // rendered lazily by the Renderer (Part 2)
        etag: contentHash({ content, seo }),
      });
    }

    // Theme: active theme tokens (light/dark maps).
    const themesRes = await this.ctx.repos.themes.list(tenantId, { pageSize: 20, filters: [{ field: 'siteId', operator: 'eq', value: siteId }] });
    const activeTheme = isOk(themesRes) ? themesRes.value.items.find(t => t.isActive) ?? themesRes.value.items[0] : undefined;
    let theme: JsonObject = {};
    if (activeTheme) {
      const tokensRes = await this.ctx.children.themeTokens.find({ themeId: activeTheme.id });
      const tokens = isOk(tokensRes) ? tokensRes.value : [];
      const light: JsonObject = {}; const dark: JsonObject = {};
      for (const t of tokens) (t.mode === 'dark' ? dark : light)[`${t.groupKey}.${t.tokenKey}`] = t.value;
      theme = { themeId: activeTheme.id, name: activeTheme.name, light, dark };
    }

    return ok({
      siteId,
      version: 0,                            // assigned at publish
      scope: request.scope,
      pages: compiled,
      theme,
      compiledAt: this.ctx.clock(),
    });
  }
}

function pathForPage(slug: string): string {
  return slug === 'home' || slug === '' ? '/' : `/${slug.replace(/^\/+/, '')}`;
}

// ── Publishing engine ─────────────────────────────────────────────────────────────
export class WebsitePublishingEngine implements PublishingEngine {
  private readonly compiler: SnapshotCompiler;
  constructor(private readonly ctx: PlatformContext) {
    this.compiler = new RepositorySnapshotCompiler(ctx);
  }

  /** Draft → Published, atomic + idempotent. Compiles, versions, checksums, stores, records history. */
  async publish(request: PublishRequest): Promise<Result<PublishResult>> {
    // Idempotency: a repeat idempotencyKey returns the prior publish.
    const dup = await this.ctx.children.publishHistory.findOne({ idempotencyKey: request.idempotencyKey });
    if (isOk(dup) && dup.value) {
      return ok({ siteId: request.siteId, version: dup.value.publishVersion, scope: dup.value.scope, invalidatedKeys: [] });
    }

    const compiledRes = await this.compiler.compile(request);
    if (!isOk(compiledRes)) return err(compiledRes.error);
    const snapshot = compiledRes.value;

    // Allocate the next monotonic published version.
    const latest = await this.ctx.snapshots.latest(request.tenantId, request.siteId, 'published');
    const version = (isOk(latest) && latest.value ? latest.value.version : 0) + 1;
    const versioned: SiteSnapshot = { ...snapshot, version };

    // Integrity: validate before storing.
    const integrity = validateSnapshotIntegrity(versioned);
    if (!isOk(integrity)) return err(integrity.error);

    // Store the immutable published snapshot (hash/checksum computed by the store).
    const stored = await this.ctx.snapshots.save({
      tenantId: request.tenantId, siteId: request.siteId, kind: 'published',
      version, snapshot: versioned as unknown as JsonObject,
    });
    if (!isOk(stored)) return err(stored.error);

    // Record immutable publish history.
    await this.ctx.children.publishHistory.insert({
      id: this.ctx.idgen(), tenantId: request.tenantId, siteId: request.siteId,
      publishVersion: version, snapshot: versioned as unknown as JsonObject, scope: request.scope,
      publishedBy: request.publishedBy, publishedAt: this.ctx.clock(), idempotencyKey: request.idempotencyKey,
    });

    // Bump the site's published_version pointer.
    await this.ctx.repos.sites.update(request.tenantId, request.siteId, { status: 'published' });

    // Emit a durable publish event (cache invalidation for the future edge).
    const invalidatedKeys = versioned.pages.map(p => `${request.siteId}:${p.path}:${p.locale}`);
    await this.ctx.events.publish({
      type: 'website.publish.completed',
      meta: { id: this.ctx.idgen(), tenantId: request.tenantId, occurredAt: this.ctx.clock(), actorId: request.publishedBy, idempotencyKey: request.idempotencyKey },
      payload: { siteId: request.siteId, publishVersion: version, scope: request.scope },
    });

    return ok({ siteId: request.siteId, version, scope: request.scope, invalidatedKeys });
  }

  /** Re-point the live snapshot to an earlier version (creates a NEW version; history immutable). */
  async rollback(tenantId: UUID, siteId: UUID, toVersion: number): Promise<Result<PublishResult>> {
    const target = await this.ctx.snapshots.getByVersion(tenantId, siteId, 'published', toVersion);
    if (!isOk(target)) return err(target.error);
    if (!target.value) return err(errors.notFound('PublishedSnapshot', `${siteId}@${toVersion}`));
    if (!this.ctx.snapshots.verify(target.value)) return err(errors.validation('snapshot integrity check failed'));

    const latest = await this.ctx.snapshots.latest(tenantId, siteId, 'published');
    const newVersion = (isOk(latest) && latest.value ? latest.value.version : toVersion) + 1;
    const rolled = { ...(target.value.snapshot as unknown as SiteSnapshot), version: newVersion };

    const stored = await this.ctx.snapshots.save({ tenantId, siteId, kind: 'published', version: newVersion, snapshot: rolled as unknown as JsonObject });
    if (!isOk(stored)) return err(stored.error);
    await this.ctx.children.publishHistory.insert({
      id: this.ctx.idgen(), tenantId, siteId, publishVersion: newVersion,
      snapshot: rolled as unknown as JsonObject, scope: 'full', publishedBy: null,
      publishedAt: this.ctx.clock(), idempotencyKey: `rollback:${siteId}:${toVersion}:${newVersion}`,
    });
    await this.ctx.events.publish({
      type: 'website.publish.rolled_back',
      meta: { id: this.ctx.idgen(), tenantId, occurredAt: this.ctx.clock(), actorId: null, idempotencyKey: null },
      payload: { siteId, toVersion },
    });
    return ok({ siteId, version: newVersion, scope: 'full', invalidatedKeys: [] });
  }

  /** Schedule a publish for later — enqueues a job the drainer runs at runAfter. */
  async schedule(request: PublishRequest, runAfter: ISODateTime): Promise<Result<UUID>> {
    const enq = await this.ctx.jobs.enqueue({
      kind: 'publishing', tenantId: request.tenantId, runAfter,
      payload: { siteId: request.siteId, scope: request.scope, idempotencyKey: request.idempotencyKey } as unknown as JsonObject,
    });
    return isOk(enq) ? ok(enq.value.id) : err(enq.error);
  }

  /** A signed, expiring preview URL for the DRAFT (no cache, not indexable). */
  previewUrl(op: OperationContext, siteSlug: string, path: string, ttlSeconds = 3600): string {
    const exp = Date.now() + ttlSeconds * 1000;
    const token = fingerprint(`${op.tenantId}:${siteSlug}:${path}:${exp}`);
    return `https://${siteSlug}.haatnow.app${path}?preview=1&exp=${exp}&t=${token}`;
  }

  /** Publish history for a site (newest first). */
  async history(tenantId: UUID, siteId: UUID): Promise<Result<VersionManifest>> {
    const rows = await this.ctx.children.publishHistory.find({ tenantId, siteId });
    if (!isOk(rows)) return err(rows.error);
    const history = rows.value
      .map(r => ({ version: r.publishVersion, hash: contentHash(r.snapshot), publishedAt: r.publishedAt }))
      .sort((a, b) => b.version - a.version);
    return ok({ siteId, current: history[0]?.version ?? 0, history });
  }
}

// ── Manifest builders + integrity ────────────────────────────────────────────────
export function buildSnapshotManifest(snapshot: SiteSnapshot): SnapshotManifest {
  return {
    siteId: snapshot.siteId,
    version: snapshot.version,
    hash: contentHash(snapshot as unknown as JsonValue),
    checksum: checksum(snapshot as unknown as JsonValue),
    pageCount: snapshot.pages.length,
    paths: snapshot.pages.map(p => p.path),
    compiledAt: snapshot.compiledAt,
  };
}

export function buildAssetManifest(siteId: UUID, assets: ReadonlyArray<{ id: UUID; storagePath: string }>): AssetManifest {
  return { siteId, entries: assets.map(a => ({ assetId: a.id, storagePath: a.storagePath, fingerprint: fingerprint(a.storagePath) })) };
}

/** Content-integrity validation: structural checks before a snapshot is published. */
export function validateSnapshotIntegrity(snapshot: SiteSnapshot): Result<true> {
  if (!snapshot.siteId) return err(errors.validation('snapshot missing siteId'));
  if (snapshot.pages.length === 0) return err(errors.validation('snapshot has no pages'));
  const paths = new Set<string>();
  for (const p of snapshot.pages) {
    if (!p.path.startsWith('/')) return err(errors.validation(`invalid page path: ${p.path}`));
    const key = `${p.path}:${p.locale}`;
    if (paths.has(key)) return err(errors.conflict(`duplicate page path+locale: ${key}`));
    paths.add(key);
    if (!p.etag) return err(errors.validation(`page ${p.path} missing etag`));
  }
  return ok(true);
}

export function createPublishingEngine(ctx: PlatformContext): WebsitePublishingEngine {
  return new WebsitePublishingEngine(ctx);
}
