// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Service layer (Wave 1).
// A generic AggregateService (create/get/update/delete/restore/list with audit +
// events) means the 12 named services share ONE implementation (no duplicate logic).
// Services use repositories/audit/events/uow only — never the database directly.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, Result, Page, PageRequest, WebsitePlatformError } from '../shared/types';
import { ok, err, isOk } from '../shared/types';
import type { Repository, PersistedEntity } from '../repositories/repository';
import type { JsonValue } from '../domain/entities';
import type { PlatformContext, OperationContext } from './context';

import type { WebsiteSite, WebsitePage, WebsiteSection, WebsiteBlock, WebsiteMenu, WebsiteNavItem, WebsiteSeo, WebsiteTranslation, WebsiteForm, WebsiteTheme, WebsiteAsset } from '../domain/entities';
import type { WebsiteTemplate, WebsiteMediaVariant, WebsiteRevisionRow, WebsiteSettingRow } from '../domain/aggregates';
import type { CreateSiteDto, UpdateSiteDto, CreatePageDto, UpdatePageDto, CreateSectionDto, CreateBlockDto, UpdateBlockDto } from '../domain/dto';
import { validateCreateSite, validateCreatePage, validateCreateBlock } from '../domain/dto';
import type {
  UpdateSectionDto, CreateMenuDto, UpdateMenuDto, CreateNavItemDto, UpdateNavItemDto, CreateThemeDto, UpdateThemeDto,
  CreateSeoDto, UpdateSeoDto, CreateTranslationDto, UpdateTranslationDto, CreateTemplateDto, UpdateTemplateDto,
  CreateAssetDto, UpdateAssetDto, CreateMediaVariantDto, UpdateMediaVariantDto,
} from '../domain/dto-ext';
import {
  validateCreateTheme, validateCreateSeo, validateCreateTranslation, validateCreateTemplate,
  validateCreateMenu, validateCreateNavItem, validateCreateAsset,
} from '../domain/dto-ext';

function auditCtx(ctx: PlatformContext, op: OperationContext) {
  return { tenantId: op.tenantId, actorId: op.actorId, correlationId: op.correlationId, environment: ctx.environment };
}

/** Generic aggregate service — the shared implementation behind every named service. */
export class AggregateService<TEntity extends PersistedEntity, TCreate, TUpdate> {
  constructor(
    protected readonly ctx: PlatformContext,
    protected readonly repo: Repository<TEntity, TCreate, TUpdate>,
    protected readonly entityType: string,
    protected readonly validate?: (input: TCreate) => Result<TCreate, WebsitePlatformError>,
  ) {}

  async create(op: OperationContext, input: TCreate): Promise<Result<TEntity>> {
    if (this.validate) {
      const v = this.validate(input);
      if (!isOk(v)) return err(v.error);
    }
    const r = await this.repo.create(input);
    if (isOk(r)) {
      await this.ctx.audit.record(auditCtx(this.ctx, op), {
        action: `${this.entityType}.create`, entityType: this.entityType, entityId: r.value.id,
        before: null, after: r.value as unknown as JsonValue,
      });
    }
    return r;
  }

  async get(op: OperationContext, id: UUID): Promise<Result<TEntity>> {
    return this.repo.getById(op.tenantId, id);
  }

  async list(op: OperationContext, request?: PageRequest): Promise<Result<Page<TEntity>>> {
    return this.repo.list(op.tenantId, request);
  }

  async update(op: OperationContext, id: UUID, patch: TUpdate, expectedVersion?: number): Promise<Result<TEntity>> {
    const before = await this.repo.getById(op.tenantId, id);
    if (!isOk(before)) return err(before.error);
    const r = await this.repo.update(op.tenantId, id, patch, expectedVersion);
    if (isOk(r)) {
      await this.ctx.audit.record(auditCtx(this.ctx, op), {
        action: `${this.entityType}.update`, entityType: this.entityType, entityId: id,
        before: before.value as unknown as JsonValue, after: r.value as unknown as JsonValue,
      });
    }
    return r;
  }

  async remove(op: OperationContext, id: UUID): Promise<Result<TEntity>> {
    const before = await this.repo.getById(op.tenantId, id);
    if (!isOk(before)) return err(before.error);
    const r = await this.repo.softDelete(op.tenantId, id);
    if (isOk(r)) {
      await this.ctx.audit.record(auditCtx(this.ctx, op), {
        action: `${this.entityType}.delete`, entityType: this.entityType, entityId: id,
        before: before.value as unknown as JsonValue, after: null,
      });
    }
    return r;
  }

  async restore(op: OperationContext, id: UUID): Promise<Result<TEntity>> {
    return this.repo.restore(op.tenantId, id);
  }
}

// ── Page service — adds typed lifecycle events + a transactional reorder ──────────
export class PageService extends AggregateService<WebsitePage, CreatePageDto, UpdatePageDto> {
  constructor(ctx: PlatformContext) {
    super(ctx, ctx.repos.pages, 'website.page', validateCreatePage);
  }

  override async create(op: OperationContext, input: CreatePageDto): Promise<Result<WebsitePage>> {
    const r = await super.create(op, input);
    if (isOk(r)) {
      await this.ctx.events.publish({
        type: 'website.page.created',
        meta: { id: this.ctx.idgen(), tenantId: op.tenantId, occurredAt: this.ctx.clock(), actorId: op.actorId, idempotencyKey: null },
        payload: { siteId: r.value.siteId, pageId: r.value.id, slug: r.value.slug, locale: r.value.locale },
      });
    }
    return r;
  }

  /** Reorder pages under a parent atomically (compensating transaction). */
  async reorder(op: OperationContext, ordered: ReadonlyArray<UUID>): Promise<Result<number>> {
    return this.ctx.uow.transaction(async tx => {
      let n = 0;
      for (let i = 0; i < ordered.length; i++) {
        const id = ordered[i];
        const current = await this.repo.getById(op.tenantId, id);
        if (!isOk(current)) return err(current.error);
        const prev = current.value.position;
        const step = await tx.step<WebsitePage>({
          do: () => this.repo.update(op.tenantId, id, { position: i } as UpdatePageDto),
          undo: async () => { await this.repo.update(op.tenantId, id, { position: prev } as UpdatePageDto); },
        });
        if (!isOk(step)) return err(step.error);
        n++;
      }
      return ok(n);
    });
  }
}

// ── Navigation service — menus + items + transactional reorder ────────────────────
export class NavigationService {
  readonly menus: AggregateService<WebsiteMenu, CreateMenuDto, UpdateMenuDto>;
  readonly items: AggregateService<WebsiteNavItem, CreateNavItemDto, UpdateNavItemDto>;
  constructor(private readonly ctx: PlatformContext) {
    this.menus = new AggregateService(ctx, ctx.repos.menus, 'website.menu', validateCreateMenu);
    this.items = new AggregateService(ctx, ctx.repos.navigation, 'website.nav', validateCreateNavItem);
  }
  async reorder(op: OperationContext, ordered: ReadonlyArray<UUID>): Promise<Result<number>> {
    return this.ctx.uow.transaction(async tx => {
      let n = 0;
      for (let i = 0; i < ordered.length; i++) {
        const id = ordered[i];
        const cur = await this.ctx.repos.navigation.getById(op.tenantId, id);
        if (!isOk(cur)) return err(cur.error);
        const prev = cur.value.position;
        const step = await tx.step<WebsiteNavItem>({
          do: () => this.ctx.repos.navigation.update(op.tenantId, id, { position: i }),
          undo: async () => { await this.ctx.repos.navigation.update(op.tenantId, id, { position: prev }); },
        });
        if (!isOk(step)) return err(step.error);
        n++;
      }
      return ok(n);
    });
  }
}

// ── Media metadata service — asset + variants + storage + usage ───────────────────
export class MediaMetadataService {
  readonly assets: AggregateService<WebsiteAsset, CreateAssetDto, UpdateAssetDto>;
  readonly variants: AggregateService<WebsiteMediaVariant, CreateMediaVariantDto, UpdateMediaVariantDto>;
  constructor(private readonly ctx: PlatformContext) {
    this.assets = new AggregateService(ctx, ctx.repos.assets, 'website.asset', validateCreateAsset);
    this.variants = new AggregateService(ctx, ctx.repos.mediaVariants, 'website.media', undefined);
  }
  /** Record where an asset is used (usage graph for delete-safety / replace-everywhere). */
  async recordUsage(tenantId: UUID, assetId: UUID, blockId: UUID | null, fieldPath: string | null): Promise<Result<true>> {
    const r = await this.ctx.children.assetUsage.upsert(
      { id: this.ctx.idgen(), tenantId, assetId, blockId, pageId: null, fieldPath },
      ['assetId', 'blockId', 'fieldPath'],
    );
    return isOk(r) ? ok(true) : err(r.error);
  }
  /** Delete-safety: an asset with usages cannot be removed. */
  async usageCount(tenantId: UUID, assetId: UUID): Promise<Result<number>> {
    const r = await this.ctx.children.assetUsage.find({ tenantId, assetId });
    return isOk(r) ? ok(r.value.length) : err(r.error);
  }
}

// ── Revision service (append-only) ────────────────────────────────────────────────
export class RevisionService {
  constructor(private readonly ctx: PlatformContext) {}
  async record(op: OperationContext, siteId: UUID, entityType: string, entityId: UUID, snapshot: JsonValue, reason?: string): Promise<Result<WebsiteRevisionRow>> {
    const row: WebsiteRevisionRow & Record<string, unknown> = {
      id: this.ctx.idgen(), tenantId: op.tenantId, siteId, entityType, entityId,
      snapshot: snapshot as unknown as WebsiteRevisionRow['snapshot'],
      reason: reason ?? null, createdBy: op.actorId, createdAt: this.ctx.clock(),
    };
    const r = await this.ctx.children.revisions.insert(row);
    return isOk(r) ? ok(r.value) : err(r.error);
  }
  async list(op: OperationContext, entityType: string, entityId: UUID): Promise<Result<WebsiteRevisionRow[]>> {
    return this.ctx.children.revisions.find({ tenantId: op.tenantId, entityType, entityId });
  }
}

// ── Settings service (KV upsert) ──────────────────────────────────────────────────
export class SettingsService {
  constructor(private readonly ctx: PlatformContext) {}
  async set(op: OperationContext, siteId: UUID, key: string, value: WebsiteSettingRow['value']): Promise<Result<WebsiteSettingRow>> {
    const row: WebsiteSettingRow & Record<string, unknown> = { id: this.ctx.idgen(), tenantId: op.tenantId, siteId, key, value };
    const r = await this.ctx.children.settings.upsert(row, ['siteId', 'key']);
    return isOk(r) ? ok(r.value) : err(r.error);
  }
  async get(op: OperationContext, siteId: UUID, key: string): Promise<Result<WebsiteSettingRow | null>> {
    return this.ctx.children.settings.findOne({ tenantId: op.tenantId, siteId, key });
  }
  async list(op: OperationContext, siteId: UUID): Promise<Result<WebsiteSettingRow[]>> {
    return this.ctx.children.settings.find({ tenantId: op.tenantId, siteId });
  }
}

/** The full service bundle. */
export interface ServiceBundle {
  websites: AggregateService<WebsiteSite, CreateSiteDto, UpdateSiteDto>;
  pages: PageService;
  sections: AggregateService<WebsiteSection, CreateSectionDto, UpdateSectionDto>;
  blocks: AggregateService<WebsiteBlock, CreateBlockDto, UpdateBlockDto>;
  navigation: NavigationService;
  themes: AggregateService<WebsiteTheme, CreateThemeDto, UpdateThemeDto>;
  media: MediaMetadataService;
  seo: AggregateService<WebsiteSeo, CreateSeoDto, UpdateSeoDto>;
  translations: AggregateService<WebsiteTranslation, CreateTranslationDto, UpdateTranslationDto>;
  revisions: RevisionService;
  settings: SettingsService;
  templates: AggregateService<WebsiteTemplate, CreateTemplateDto, UpdateTemplateDto>;
  forms: AggregateService<WebsiteForm, unknown, unknown>;
}

export function createServices(ctx: PlatformContext): ServiceBundle {
  return {
    websites: new AggregateService(ctx, ctx.repos.sites, 'website.site', validateCreateSite),
    pages: new PageService(ctx),
    sections: new AggregateService(ctx, ctx.repos.sections, 'website.section', undefined),
    blocks: new AggregateService(ctx, ctx.repos.blocks, 'website.block', validateCreateBlock),
    navigation: new NavigationService(ctx),
    themes: new AggregateService(ctx, ctx.repos.themes, 'website.theme', validateCreateTheme),
    media: new MediaMetadataService(ctx),
    seo: new AggregateService(ctx, ctx.repos.seo, 'website.seo', validateCreateSeo),
    translations: new AggregateService(ctx, ctx.repos.translations, 'website.translation', validateCreateTranslation),
    revisions: new RevisionService(ctx),
    settings: new SettingsService(ctx),
    templates: new AggregateService(ctx, ctx.repos.templates, 'website.template', validateCreateTemplate),
    forms: new AggregateService(ctx, ctx.repos.forms as unknown as Repository<WebsiteForm, unknown, unknown>, 'website.form', undefined),
  };
}
