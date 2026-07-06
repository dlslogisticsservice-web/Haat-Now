# Headless Experience APIs

> HaaT Now · Phase 10.5 · Design only (Part 12). Exposes the published experience (content + realtime
> blocks + personalization overlays) to any surface — mobile apps, partner apps, kiosks, digital
> signage, external sites, future SDKs. Built on the Phase 10 snapshot + edge; GraphQL-ready.

## 1. Principles
- **Read the same snapshot the web renders** — the API serves the compiled published snapshot
  (`website_published_pages` / experience variants), so headless consumers get identical content with
  no separate CMS.
- **Content API (public, cacheable)** vs **Personalization/Realtime API (per-visitor, islands)** —
  the same first-paint/hydration split as the web, exposed as two API tiers.
- **Multi-tenant by key** — every request is scoped to a tenant via an API key/domain; RLS + service
  role enforce isolation.

## 2. Surfaces (Part 12)
| Surface | Consumes |
|---|---|
| Mobile Apps (HaaT app + tenant apps) | Content API + Realtime blocks + personalization |
| Partner Apps | scoped Content API (capability-limited keys) |
| Kiosks | Content API (static-ish) + store availability |
| Digital Signage | Content API + realtime offers/menus (polling) |
| External Websites | Content API (CORS-scoped) + embed SDK |
| Future SDKs | typed client over the same API |

## 3. API shape
- **REST (v1, first)**: resource endpoints — `/v1/sites/{id}/pages/{path}` (resolved experience),
  `/v1/blocks/{id}/data` (realtime block data), `/v1/forms/{key}` (submit), `/v1/experiments/assign`,
  `/v1/personalize` (overlays for an anon/auth id). Served by edge functions reading snapshots.
- **GraphQL-ready (v2)**: the domain model (WEBSITE_DOMAIN_MODEL) maps cleanly to a schema
  (Site→Pages→Sections→Blocks, Menus, Seo, RealtimeBlock(data)). Supabase provides `pg_graphql`;
  a gateway can expose a curated, tenant-scoped GraphQL schema over the published views. Design the
  REST resources to be GraphQL-projectable now (avoid a rewrite later).
- **Content negotiation**: JSON (data) or server-rendered HTML fragment (for embeds/signage).

## 4. Auth & scoping
- **API keys** per tenant, capability-scoped (content-read / forms-write / realtime / personalize),
  rate-limited, rotatable. Stored hashed (`website_api_keys`), never client-embedded for write scopes.
- **Visitor auth**: personalization/owner-only realtime endpoints require the visitor's platform JWT;
  RLS enforces owner-only (a consumer can only fetch that visitor's wallet/loyalty/order — the
  Realtime Blocks rule).
- **CORS**: allow-listed origins per tenant for browser embeds.

## 5. Versioning & stability
- **URL-versioned** (`/v1`, `/v2`); additive changes only within a version; deprecations announced
  with sunset headers. Content shape is the snapshot schema (component-versioned, forward-compatible).
- **ETags + caching**: content responses carry ETags from the snapshot version → efficient CDN + client
  caching; a publish changes the ETag (Publishing Engine revalidate).
- **Contracts**: OpenAPI (REST) + GraphQL SDL published; typed SDK generated from them.

## 6. Tables (additive, multi-tenant, RLS)
```sql
create table website_api_keys (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  name text, key_hash text not null unique, scopes text[] not null,
  origins text[], rate_limit int, last_used_at timestamptz, revoked boolean default false,
  created_at timestamptz default now()
);
```

## 7. Performance & scale
- Content API is CDN-cacheable per (tenant, path, variant) — same experience cache key as the web.
- Realtime/personalize endpoints are per-visitor (no CDN) but lightweight (island payloads), rate-
  limited, and backed by short-TTL rollups + realtime channels.
- 10k tenants: keys index by hash; content reads hit `website_published_pages` (O(1)); no per-request
  content compilation.

## 8. Integration with strict concerns
- Multi-tenant (key/RLS scoped); RBAC (key scopes + `api.keys.manage` to mint); localized (locale
  param); SEO N/A (data API) but the HTML-fragment mode stays crawlable if embedded server-side;
  analytics (API usage metered); flag-gated (headless can be disabled per plan); audited (key mint/
  revoke, write calls); observability tracks API latency/error/rate-limit per key.
