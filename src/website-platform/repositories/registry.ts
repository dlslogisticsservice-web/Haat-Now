// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Repository registry (Wave 1).
// Instantiates every aggregate repository from one `defineAggregate` spec each
// (the DRY factory), and exposes a typed RepositoryBundle for the service layer.
// Site/Page reuse the Wave 0 bespoke factories (frozen). Backend is selectable
// ('supabase' | 'memory') so services + tests share one wiring.
// ─────────────────────────────────────────────────────────────────────────────

import type { Repository } from './repository';
import { defineAggregate } from './mapping';
import { createSupabaseSiteRepository, createSupabasePageRepository } from './supabase.repository';
import { createMemorySiteRepository, createMemoryPageRepository } from './memory-config';

import type {
  WebsiteSite, WebsitePage, WebsiteSection, WebsiteBlock, WebsiteMenu, WebsiteNavItem,
  WebsiteSeo, WebsiteRedirect, WebsiteDomain, WebsiteAsset, WebsiteTranslation, WebsiteForm, WebsiteTheme,
} from '../domain/entities';
import type { WebsiteMediaFolder, WebsiteMediaVariant, WebsiteTemplate, WebsiteCustomCode } from '../domain/aggregates';
import type { CreateSiteDto, UpdateSiteDto, CreatePageDto, UpdatePageDto, CreateSectionDto, CreateBlockDto, UpdateBlockDto } from '../domain/dto';
import type { UpdateSectionDto } from '../domain/dto-ext';
import type {
  CreateMenuDto, UpdateMenuDto, CreateNavItemDto, UpdateNavItemDto, CreateThemeDto, UpdateThemeDto,
  CreateAssetDto, UpdateAssetDto, CreateMediaFolderDto, UpdateMediaFolderDto, CreateMediaVariantDto, UpdateMediaVariantDto,
  CreateSeoDto, UpdateSeoDto, CreateTranslationDto, UpdateTranslationDto, CreateTemplateDto, UpdateTemplateDto,
  CreateFormDto, UpdateFormDto, CreateRedirectDto, UpdateRedirectDto, CreateDomainDto, UpdateDomainDto,
  CreateCustomCodeDto, UpdateCustomCodeDto,
} from '../domain/dto-ext';

// ── Aggregate definitions (one spec each; behavior from the generic base) ────────
const sections = defineAggregate<WebsiteSection, CreateSectionDto, UpdateSectionDto>({
  table: 'website_sections', entityName: 'WebsiteSection',
  defaults: i => ({ scope: i.scope ?? 'local', position: i.position ?? 0, settings: i.settings ?? {}, visibility: i.visibility ?? {}, key: i.key ?? null, name: i.name ?? null, pageId: i.pageId ?? null }),
});
const blocks = defineAggregate<WebsiteBlock, CreateBlockDto, UpdateBlockDto>({
  table: 'website_blocks', entityName: 'WebsiteBlock',
  defaults: i => ({ props: i.props ?? {}, position: i.position ?? 0, visibility: i.visibility ?? {}, enabled: i.enabled ?? true }),
});
const menus = defineAggregate<WebsiteMenu, CreateMenuDto, UpdateMenuDto>({
  table: 'website_menus', entityName: 'WebsiteMenu', defaults: () => ({}),
});
const navigation = defineAggregate<WebsiteNavItem, CreateNavItemDto, UpdateNavItemDto>({
  table: 'website_navigation', entityName: 'WebsiteNavItem',
  defaults: i => ({ parentId: i.parentId ?? null, pageId: i.pageId ?? null, externalUrl: i.externalUrl ?? null, position: i.position ?? 0, visibility: i.visibility ?? {} }),
});
const themes = defineAggregate<WebsiteTheme, CreateThemeDto, UpdateThemeDto>({
  table: 'website_themes', entityName: 'WebsiteTheme',
  defaults: i => ({ siteId: i.siteId ?? null, basePreset: i.basePreset ?? null, mode: i.mode ?? 'both', isActive: i.isActive ?? false, tokens: [] }),
});
const assets = defineAggregate<WebsiteAsset, CreateAssetDto, UpdateAssetDto>({
  table: 'website_assets', entityName: 'WebsiteAsset',
  defaults: i => ({ folderId: i.folderId ?? null, altText: i.altText ?? null, title: i.title ?? null, width: i.width ?? null, height: i.height ?? null, bytes: i.bytes ?? null, checksum: i.checksum ?? null }),
});
const mediaFolders = defineAggregate<WebsiteMediaFolder, CreateMediaFolderDto, UpdateMediaFolderDto>({
  table: 'website_media_folders', entityName: 'WebsiteMediaFolder',
  defaults: i => ({ parentId: i.parentId ?? null }),
});
const mediaVariants = defineAggregate<WebsiteMediaVariant, CreateMediaVariantDto, UpdateMediaVariantDto>({
  table: 'website_media', entityName: 'WebsiteMediaVariant',
  defaults: i => ({ format: i.format ?? null, width: i.width ?? null, height: i.height ?? null, bytes: i.bytes ?? null }),
});
const seo = defineAggregate<WebsiteSeo, CreateSeoDto, UpdateSeoDto>({
  table: 'website_seo', entityName: 'WebsiteSeo',
  defaults: i => ({ locale: i.locale ?? 'ar', robots: i.robots ?? 'index,follow', keywords: i.keywords ?? [], metaTitle: i.metaTitle ?? null, metaDescription: i.metaDescription ?? null, canonical: i.canonical ?? null, og: null, twitter: null, jsonLd: [], score: null }),
});
const translations = defineAggregate<WebsiteTranslation, CreateTranslationDto, UpdateTranslationDto>({
  table: 'website_translations', entityName: 'WebsiteTranslation',
  defaults: i => ({ sourceHash: i.sourceHash ?? null, status: 'draft' }),
});
const templates = defineAggregate<WebsiteTemplate, CreateTemplateDto, UpdateTemplateDto>({
  table: 'website_templates', entityName: 'WebsiteTemplate',
  defaults: i => ({ category: i.category ?? null, previewUrl: i.previewUrl ?? null, visibility: i.visibility ?? 'private', installs: 0 }),
});
const forms = defineAggregate<WebsiteForm, CreateFormDto, UpdateFormDto>({
  table: 'website_forms', entityName: 'WebsiteForm',
  defaults: i => ({ kind: (i.kind ?? 'contact') as WebsiteForm['kind'], schema: (i.schema ?? []) as WebsiteForm['schema'], spamProtection: i.spamProtection ?? 'honeypot', webhookUrl: i.webhookUrl ?? null, notifyEmails: i.notifyEmails ?? [] }),
});
const redirects = defineAggregate<WebsiteRedirect, CreateRedirectDto, UpdateRedirectDto>({
  table: 'website_redirects', entityName: 'WebsiteRedirect',
  defaults: i => ({ code: i.code ?? 301, matchType: i.matchType ?? 'exact', hits: 0 }),
});
const domains = defineAggregate<WebsiteDomain, CreateDomainDto, UpdateDomainDto>({
  table: 'website_domains', entityName: 'WebsiteDomain',
  defaults: i => ({ isPrimary: i.isPrimary ?? false, status: i.status ?? 'pending', verifyToken: null, dnsRecords: null, sslExpiresAt: null }),
});
const customCode = defineAggregate<WebsiteCustomCode, CreateCustomCodeDto, UpdateCustomCodeDto>({
  table: 'website_custom_code', entityName: 'WebsiteCustomCode',
  defaults: i => ({ pageId: i.pageId ?? null, enabled: i.enabled ?? false, requiresFlag: 'website.custom_code' }),
});

/** The complete set of aggregate repositories for a chosen backend. */
export interface RepositoryBundle {
  sites: Repository<WebsiteSite, CreateSiteDto, UpdateSiteDto>;
  pages: Repository<WebsitePage, CreatePageDto, UpdatePageDto>;
  sections: Repository<WebsiteSection, CreateSectionDto, UpdateSectionDto>;
  blocks: Repository<WebsiteBlock, CreateBlockDto, UpdateBlockDto>;
  menus: Repository<WebsiteMenu, CreateMenuDto, UpdateMenuDto>;
  navigation: Repository<WebsiteNavItem, CreateNavItemDto, UpdateNavItemDto>;
  themes: Repository<WebsiteTheme, CreateThemeDto, UpdateThemeDto>;
  assets: Repository<WebsiteAsset, CreateAssetDto, UpdateAssetDto>;
  mediaFolders: Repository<WebsiteMediaFolder, CreateMediaFolderDto, UpdateMediaFolderDto>;
  mediaVariants: Repository<WebsiteMediaVariant, CreateMediaVariantDto, UpdateMediaVariantDto>;
  seo: Repository<WebsiteSeo, CreateSeoDto, UpdateSeoDto>;
  translations: Repository<WebsiteTranslation, CreateTranslationDto, UpdateTranslationDto>;
  templates: Repository<WebsiteTemplate, CreateTemplateDto, UpdateTemplateDto>;
  forms: Repository<WebsiteForm, CreateFormDto, UpdateFormDto>;
  redirects: Repository<WebsiteRedirect, CreateRedirectDto, UpdateRedirectDto>;
  domains: Repository<WebsiteDomain, CreateDomainDto, UpdateDomainDto>;
  customCode: Repository<WebsiteCustomCode, CreateCustomCodeDto, UpdateCustomCodeDto>;
}

export type RepositoryBackend = 'supabase' | 'memory';

/** Wire the full bundle for the chosen backend. */
export function createRepositoryBundle(backend: RepositoryBackend): RepositoryBundle {
  const supa = backend === 'supabase';
  return {
    sites: supa ? createSupabaseSiteRepository() : createMemorySiteRepository(),
    pages: supa ? createSupabasePageRepository() : createMemoryPageRepository(),
    sections: supa ? sections.supabase() : sections.memory(),
    blocks: supa ? blocks.supabase() : blocks.memory(),
    menus: supa ? menus.supabase() : menus.memory(),
    navigation: supa ? navigation.supabase() : navigation.memory(),
    themes: supa ? themes.supabase() : themes.memory(),
    assets: supa ? assets.supabase() : assets.memory(),
    mediaFolders: supa ? mediaFolders.supabase() : mediaFolders.memory(),
    mediaVariants: supa ? mediaVariants.supabase() : mediaVariants.memory(),
    seo: supa ? seo.supabase() : seo.memory(),
    translations: supa ? translations.supabase() : translations.memory(),
    templates: supa ? templates.supabase() : templates.memory(),
    forms: supa ? forms.supabase() : forms.memory(),
    redirects: supa ? redirects.supabase() : redirects.memory(),
    domains: supa ? domains.supabase() : domains.memory(),
    customCode: supa ? customCode.supabase() : customCode.memory(),
  };
}
