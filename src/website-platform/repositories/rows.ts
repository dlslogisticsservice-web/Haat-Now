// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Row types + entity mappers (Wave 0).
// The DB (snake_case) ↔ entity (camelCase) boundary. Mapping is centralized here so
// the Supabase repositories stay declarative and serialization is tested in isolation.
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteSite, WebsitePage, JsonObject } from '../domain/entities';
import type { SiteStatus, PageStatus, RouteType } from '../domain/enums';
import type { CreateSiteDto, UpdateSiteDto, CreatePageDto, UpdatePageDto } from '../domain/dto';

/** Shared audit columns present on every website_* row. */
interface RowAudit {
  id: string;
  tenant_id: string;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteRow extends RowAudit {
  slug: string;
  name: string;
  status: SiteStatus;
  default_locale: string;
  locales: string[] | null;
  primary_domain_id: string | null;
  active_theme_id: string | null;
  maintenance: boolean;
  published_version: number;
  settings: JsonObject | null;
}

export interface PageRow extends RowAudit {
  site_id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  route_type: RouteType;
  data_source: JsonObject | null;
  status: PageStatus;
  publish_at: string | null;
  position: number;
  in_nav: boolean;
  locale: string;
}

export function siteFromRow(r: SiteRow): WebsiteSite {
  return {
    id: r.id,
    siteId: r.id,
    tenantId: r.tenant_id,
    slug: r.slug,
    name: r.name,
    status: r.status,
    defaultLocale: r.default_locale,
    locales: r.locales ?? [],
    primaryDomainId: r.primary_domain_id,
    activeThemeId: r.active_theme_id,
    maintenance: r.maintenance,
    publishedVersion: r.published_version,
    settings: r.settings ?? {},
    version: r.version,
    deletedAt: r.deleted_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function siteInsert(input: CreateSiteDto): Record<string, unknown> {
  return {
    tenant_id: input.tenantId,
    slug: input.slug,
    name: input.name,
    status: input.status ?? 'draft',
    default_locale: input.defaultLocale ?? 'ar',
    locales: input.locales ?? ['ar', 'en'],
    settings: input.settings ?? {},
  };
}

export function siteUpdate(patch: UpdateSiteDto): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.defaultLocale !== undefined) row.default_locale = patch.defaultLocale;
  if (patch.locales !== undefined) row.locales = patch.locales;
  if (patch.maintenance !== undefined) row.maintenance = patch.maintenance;
  if (patch.activeThemeId !== undefined) row.active_theme_id = patch.activeThemeId;
  if (patch.primaryDomainId !== undefined) row.primary_domain_id = patch.primaryDomainId;
  if (patch.settings !== undefined) row.settings = patch.settings;
  return row;
}

export function pageFromRow(r: PageRow): WebsitePage {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    siteId: r.site_id,
    parentId: r.parent_id,
    slug: r.slug,
    title: r.title,
    routeType: r.route_type,
    dataSource: r.data_source,
    status: r.status,
    publishAt: r.publish_at,
    position: r.position,
    inNav: r.in_nav,
    locale: r.locale,
    version: r.version,
    deletedAt: r.deleted_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function pageInsert(input: CreatePageDto): Record<string, unknown> {
  return {
    tenant_id: input.tenantId,
    site_id: input.siteId,
    parent_id: input.parentId ?? null,
    slug: input.slug,
    title: input.title,
    route_type: input.routeType ?? 'static',
    locale: input.locale ?? 'ar',
    in_nav: input.inNav ?? true,
    position: input.position ?? 0,
  };
}

export function pageUpdate(patch: UpdatePageDto): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.slug !== undefined) row.slug = patch.slug;
  if (patch.parentId !== undefined) row.parent_id = patch.parentId;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.routeType !== undefined) row.route_type = patch.routeType;
  if (patch.inNav !== undefined) row.in_nav = patch.inNav;
  if (patch.position !== undefined) row.position = patch.position;
  if (patch.publishAt !== undefined) row.publish_at = patch.publishAt;
  if (patch.dataSource !== undefined) row.data_source = patch.dataSource;
  return row;
}
