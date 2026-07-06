// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Memory repository configs (Wave 0).
// The `build`/`applyPatch` pairs that turn the generic InMemoryRepository into a
// working Site/Page repository. Used by unit tests and by any consumer that wants
// an in-memory backend (e.g. Storybook, contract tests). Semantics mirror the
// Supabase mappers so both backends behave identically.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID } from '../shared/types';
import type { WebsiteSite, WebsitePage } from '../domain/entities';
import type { CreateSiteDto, UpdateSiteDto, CreatePageDto, UpdatePageDto } from '../domain/dto';
import { InMemoryRepository } from './memory.repository';

function buildSite(input: CreateSiteDto, id: UUID, now: string): WebsiteSite {
  return {
    id,
    siteId: id,
    tenantId: input.tenantId,
    slug: input.slug,
    name: input.name,
    status: input.status ?? 'draft',
    defaultLocale: input.defaultLocale ?? 'ar',
    locales: input.locales ?? ['ar', 'en'],
    primaryDomainId: null,
    activeThemeId: null,
    maintenance: false,
    publishedVersion: 0,
    settings: input.settings ?? {},
    version: 1,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function applySitePatch(site: WebsiteSite, patch: UpdateSiteDto): WebsiteSite {
  return {
    ...site,
    name: patch.name ?? site.name,
    status: patch.status ?? site.status,
    defaultLocale: patch.defaultLocale ?? site.defaultLocale,
    locales: patch.locales ?? site.locales,
    maintenance: patch.maintenance ?? site.maintenance,
    activeThemeId: patch.activeThemeId !== undefined ? patch.activeThemeId : site.activeThemeId,
    primaryDomainId: patch.primaryDomainId !== undefined ? patch.primaryDomainId : site.primaryDomainId,
    settings: patch.settings ?? site.settings,
  };
}

function buildPage(input: CreatePageDto, id: UUID, now: string): WebsitePage {
  return {
    id,
    tenantId: input.tenantId,
    siteId: input.siteId,
    parentId: input.parentId ?? null,
    slug: input.slug,
    title: input.title,
    routeType: input.routeType ?? 'static',
    dataSource: null,
    status: 'draft',
    publishAt: null,
    position: input.position ?? 0,
    inNav: input.inNav ?? true,
    locale: input.locale ?? 'ar',
    version: 1,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function applyPagePatch(page: WebsitePage, patch: UpdatePageDto): WebsitePage {
  return {
    ...page,
    title: patch.title ?? page.title,
    slug: patch.slug ?? page.slug,
    parentId: patch.parentId !== undefined ? patch.parentId : page.parentId,
    status: patch.status ?? page.status,
    routeType: patch.routeType ?? page.routeType,
    inNav: patch.inNav ?? page.inNav,
    position: patch.position ?? page.position,
    publishAt: patch.publishAt !== undefined ? patch.publishAt : page.publishAt,
    dataSource: patch.dataSource !== undefined ? patch.dataSource : page.dataSource,
  };
}

export function createMemorySiteRepository(): InMemoryRepository<WebsiteSite, CreateSiteDto, UpdateSiteDto> {
  return new InMemoryRepository<WebsiteSite, CreateSiteDto, UpdateSiteDto>({
    entityName: 'WebsiteSite', build: buildSite, applyPatch: applySitePatch,
  });
}

export function createMemoryPageRepository(): InMemoryRepository<WebsitePage, CreatePageDto, UpdatePageDto> {
  return new InMemoryRepository<WebsitePage, CreatePageDto, UpdatePageDto>({
    entityName: 'WebsitePage', build: buildPage, applyPatch: applyPagePatch,
  });
}
