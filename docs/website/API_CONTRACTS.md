# Website Platform · API Contracts (Wave 0)

> REST resource contracts + GraphQL readiness (`src/website-platform/api/contracts.ts`). Wave 0
> defines **contracts only** — no endpoints are implemented. Shapes are GraphQL-projectable so the
> v2 GraphQL schema needs no rewrite.

## Versioning
- URL-versioned: `/v1/…`. Additive within a version; a breaking change bumps to `/v2`.
- `API_VERSION = 'v1'`.

## Auth scopes (map to RBAC `website.*` permissions / API-key scopes)
`content.read` · `content.write` · `publish` · `forms.write` · `realtime` · `personalize`.

## REST routes (contract catalog — handlers land in a later wave)

| Method | Path | Scope | Summary |
|---|---|---|---|
| GET | `/v1/sites` | content.read | List sites for the tenant |
| POST | `/v1/sites` | content.write | Create a site |
| GET | `/v1/sites/:siteId` | content.read | Get a site |
| PATCH | `/v1/sites/:siteId` | content.write | Update a site (optimistic-locked) |
| DELETE | `/v1/sites/:siteId` | content.write | Soft-delete a site |
| GET | `/v1/sites/:siteId/pages` | content.read | List pages of a site |
| POST | `/v1/sites/:siteId/pages` | content.write | Create a page |
| PATCH | `/v1/pages/:pageId` | content.write | Update a page (optimistic-locked) |
| DELETE | `/v1/pages/:pageId` | content.write | Soft-delete a page |
| POST | `/v1/sites/:siteId/publish` | publish | Publish (atomic, idempotent) |
| POST | `/v1/forms/:formKey/submit` | forms.write | Submit a form |

Contract tests (`contracts.test.ts`) assert every route has a valid method + scope + `/v1/` path.

## Envelopes
```ts
interface ApiItemResponse<T> { data: T }
interface ApiListResponse<T> { data: T[]; meta: { total; page; pageSize; hasMore } }
interface ApiErrorResponse { error: { code: string; message: string } }
```
Request bodies reuse the domain DTOs directly (`CreateSiteDto`, `UpdateSiteDto`, `CreatePageDto`,
`UpdatePageDto`) — one validation source for the app, the API, and tests.

## Optimistic concurrency
`PATCH` requests carry `expectedVersion` (from the DTO). The repository performs a version-guarded
update and returns `409`-class `optimistic_lock` when stale. This is part of the contract, not a
per-endpoint afterthought.

## GraphQL readiness (v2)
- The domain model maps 1:1 to a schema; reserved type names in `GRAPHQL_TYPES`:
  `Site, Page, Section, Block, Menu, NavItem, Seo, Theme, Domain, Redirect, RealtimeBlock`.
- Supabase `pg_graphql` can expose a curated, tenant-scoped schema over the published views; the
  REST resources are designed to be GraphQL-projectable (`GraphQLProjection`), so no rewrite is
  needed to add GraphQL later.
- Pagination/filter/sort shapes (`PageRequest`, `FilterClause`, `SortClause`) are transport-agnostic
  and reused by both REST and GraphQL.

## Multi-tenancy & security (enforced when handlers land)
- Every route is tenant-scoped by the caller's session/API key (RLS `auth_tenant()` underneath).
- Write scopes require the corresponding `website.*` permission (`auth_has_permission`).
- Public/headless read is served from the published snapshot via the edge, never from these
  authenticated write routes.
