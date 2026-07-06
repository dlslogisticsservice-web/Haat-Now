// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · API contracts (Wave 0).
// REST resource + request/response CONTRACTS only — no endpoints are implemented in
// this wave. Shapes are designed to be GraphQL-projectable (the domain model maps
// 1:1 to a schema) so v2 GraphQL needs no rewrite. See docs/website/API_CONTRACTS.md.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID } from '../shared/types';
import type { WebsiteSite, WebsitePage } from '../domain/entities';
import type { CreateSiteDto, UpdateSiteDto, CreatePageDto, UpdatePageDto } from '../domain/dto';

/** API version prefix. Additive within a version; breaking changes bump it. */
export const API_VERSION = 'v1' as const;
export type ApiVersion = typeof API_VERSION;

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** A declarative route contract (path + method + auth scope). Executed by a later wave. */
export interface RouteContract {
  method: HttpMethod;
  path: string;
  scope: ApiScope;
  summary: string;
}

/** Capability scopes an API key/route requires (maps to RBAC website.* permissions). */
export type ApiScope = 'content.read' | 'content.write' | 'publish' | 'forms.write' | 'realtime' | 'personalize';

/** Standard envelope for list responses (paginated). */
export interface ApiListResponse<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number; hasMore: boolean };
}
export interface ApiItemResponse<T> {
  data: T;
}
export interface ApiErrorResponse {
  error: { code: string; message: string };
}

// ── Site resource ───────────────────────────────────────────────────────────
export type CreateSiteRequest = CreateSiteDto;
export type UpdateSiteRequest = UpdateSiteDto;
export type SiteResponse = ApiItemResponse<WebsiteSite>;
export type SiteListResponse = ApiListResponse<WebsiteSite>;

// ── Page resource ───────────────────────────────────────────────────────────
export type CreatePageRequest = CreatePageDto;
export type UpdatePageRequest = UpdatePageDto;
export type PageResponse = ApiItemResponse<WebsitePage>;
export type PageListResponse = ApiListResponse<WebsitePage>;

/** The Wave-0 REST surface (contract catalog; handlers land in a later wave). */
export const WEBSITE_ROUTES: ReadonlyArray<RouteContract> = [
  { method: 'GET', path: '/v1/sites', scope: 'content.read', summary: 'List sites for the tenant' },
  { method: 'POST', path: '/v1/sites', scope: 'content.write', summary: 'Create a site' },
  { method: 'GET', path: '/v1/sites/:siteId', scope: 'content.read', summary: 'Get a site' },
  { method: 'PATCH', path: '/v1/sites/:siteId', scope: 'content.write', summary: 'Update a site (optimistic-locked)' },
  { method: 'DELETE', path: '/v1/sites/:siteId', scope: 'content.write', summary: 'Soft-delete a site' },
  { method: 'GET', path: '/v1/sites/:siteId/pages', scope: 'content.read', summary: 'List pages of a site' },
  { method: 'POST', path: '/v1/sites/:siteId/pages', scope: 'content.write', summary: 'Create a page' },
  { method: 'PATCH', path: '/v1/pages/:pageId', scope: 'content.write', summary: 'Update a page (optimistic-locked)' },
  { method: 'DELETE', path: '/v1/pages/:pageId', scope: 'content.write', summary: 'Soft-delete a page' },
  { method: 'POST', path: '/v1/sites/:siteId/publish', scope: 'publish', summary: 'Publish (atomic, idempotent)' },
  { method: 'POST', path: '/v1/forms/:formKey/submit', scope: 'forms.write', summary: 'Submit a form' },
];

/** Reserved GraphQL type names (v2), aligned with the domain model for a clean port. */
export const GRAPHQL_TYPES: ReadonlyArray<string> = [
  'Site', 'Page', 'Section', 'Block', 'Menu', 'NavItem', 'Seo', 'Theme', 'Domain', 'Redirect', 'RealtimeBlock',
];

/** A GraphQL-readiness marker so route contracts and the schema stay in lockstep. */
export interface GraphQLProjection {
  restPath: string;
  graphqlType: string;
  keyArg: keyof Pick<WebsiteSite, 'id'> | 'siteId' | 'pageId';
}

export type SiteId = UUID;
export type PageId = UUID;
