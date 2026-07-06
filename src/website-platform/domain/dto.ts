// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Data-transfer objects + validation (Wave 0).
// Input shapes for create/update operations and their validators. Entities are
// server-owned (id/audit/version); DTOs carry only client-settable fields.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID } from '../shared/types';
import type { Result, WebsitePlatformError } from '../shared/types';
import { Validator, isNonEmptyString, isSlug, isOneOf, isUuid } from '../shared/validation';
import { SITE_STATUSES, PAGE_STATUSES, ROUTE_TYPES } from './enums';
import type { SiteStatus, PageStatus, RouteType } from './enums';
import type { JsonObject, DeviceVisibility } from './entities';

// ── Site ──────────────────────────────────────────────────────────────────────
export interface CreateSiteDto {
  tenantId: UUID;
  slug: string;
  name: string;
  defaultLocale?: string;
  locales?: string[];
  status?: SiteStatus;
  settings?: JsonObject;
}
export interface UpdateSiteDto {
  name?: string;
  status?: SiteStatus;
  defaultLocale?: string;
  locales?: string[];
  maintenance?: boolean;
  activeThemeId?: UUID | null;
  primaryDomainId?: UUID | null;
  settings?: JsonObject;
  /** Optimistic-lock guard — the version the caller last read. */
  expectedVersion?: number;
}

export function validateCreateSite(input: CreateSiteDto): Result<CreateSiteDto, WebsitePlatformError> {
  return new Validator()
    .field(input.tenantId, 'tenantId', isUuid, 'uuid')
    .field(input.slug, 'slug', isSlug, 'slug')
    .field(input.name, 'name', isNonEmptyString, 'required')
    .check(input.status === undefined || isOneOf(SITE_STATUSES)(input.status), 'status', 'enum')
    .toResult(input);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export interface CreatePageDto {
  tenantId: UUID;
  siteId: UUID;
  slug: string;
  title: string;
  parentId?: UUID | null;
  routeType?: RouteType;
  locale?: string;
  inNav?: boolean;
  position?: number;
}
export interface UpdatePageDto {
  title?: string;
  slug?: string;
  parentId?: UUID | null;
  status?: PageStatus;
  routeType?: RouteType;
  inNav?: boolean;
  position?: number;
  publishAt?: string | null;
  dataSource?: JsonObject | null;
  expectedVersion?: number;
}

export function validateCreatePage(input: CreatePageDto): Result<CreatePageDto, WebsitePlatformError> {
  return new Validator()
    .field(input.tenantId, 'tenantId', isUuid, 'uuid')
    .field(input.siteId, 'siteId', isUuid, 'uuid')
    .field(input.slug, 'slug', isSlug, 'slug')
    .field(input.title, 'title', isNonEmptyString, 'required')
    .check(input.routeType === undefined || isOneOf(ROUTE_TYPES)(input.routeType), 'routeType', 'enum')
    .toResult(input);
}

export function validateUpdatePage(input: UpdatePageDto): Result<UpdatePageDto, WebsitePlatformError> {
  return new Validator()
    .check(input.slug === undefined || isSlug(input.slug), 'slug', 'slug')
    .check(input.title === undefined || isNonEmptyString(input.title), 'title', 'required')
    .check(input.status === undefined || isOneOf(PAGE_STATUSES)(input.status), 'status', 'enum')
    .toResult(input);
}

// ── Section / Block ─────────────────────────────────────────────────────────────
export interface CreateSectionDto {
  tenantId: UUID;
  siteId: UUID;
  pageId: UUID | null;
  scope?: 'local' | 'global';
  key?: string | null;
  name?: string | null;
  position?: number;
  settings?: JsonObject;
  visibility?: DeviceVisibility;
}

export interface CreateBlockDto {
  tenantId: UUID;
  siteId: UUID;
  sectionId: UUID;
  type: string;
  props?: JsonObject;
  position?: number;
  visibility?: DeviceVisibility;
  enabled?: boolean;
}
export interface UpdateBlockDto {
  props?: JsonObject;
  position?: number;
  visibility?: DeviceVisibility;
  enabled?: boolean;
  expectedVersion?: number;
}

export function validateCreateBlock(input: CreateBlockDto): Result<CreateBlockDto, WebsitePlatformError> {
  return new Validator()
    .field(input.tenantId, 'tenantId', isUuid, 'uuid')
    .field(input.siteId, 'siteId', isUuid, 'uuid')
    .field(input.sectionId, 'sectionId', isUuid, 'uuid')
    .field(input.type, 'type', isNonEmptyString, 'required')
    .toResult(input);
}
