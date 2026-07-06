# Marketplace Platform

> HaaT Now · Phase 10.5 · Design only (Part 6). Extends the Phase 10 `website_templates` +
> `website_component_library` into a full marketplace for themes, templates, components, sections,
> and plugins/extensions — multi-tenant, with an Extension SDK, versioning, ratings, and licensing.

## 1. What can be listed
Theme · Template (site/page) · Component (block) · Section · Plugin/Extension. All share one
listing model; `kind` differentiates.

## 2. Tables (additive, multi-tenant, RLS)
```sql
create table website_marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  publisher_tenant_id uuid,                       -- null = HaaT-official
  kind text not null check (kind in ('theme','template','component','section','plugin')),
  slug text unique not null, name text not null, category text,
  latest_version text not null, min_platform_version text,   -- compatibility
  license text not null default 'free' check (license in ('free','paid','subscription','revshare')),
  price_cents int, currency text, status text default 'draft'
    check (status in ('draft','in_review','approved','published','delisted')),
  preview_url text, rating_avg numeric default 0, rating_count int default 0, installs int default 0
);
create table website_marketplace_versions (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references website_marketplace_listings(id) on delete cascade,
  version text not null, payload jsonb,           -- template graph / theme tokens / component manifest
  bundle_url text,                                -- signed, for plugin/component code
  changelog text, min_platform_version text, published_at timestamptz, unique (listing_id, version)
);
create table website_marketplace_installs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, listing_id uuid not null,
  version text not null, installed_at timestamptz default now(), enabled boolean default true,
  license_key text, unique (tenant_id, listing_id)
);
create table website_marketplace_reviews (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, listing_id uuid not null,
  rating int check (rating between 1 and 5), comment text, created_at timestamptz default now(),
  unique (tenant_id, listing_id)                  -- one review per tenant
);
```

## 3. Install semantics (isolation-safe)
- Installing a **theme/template/section** = **clone the payload into the tenant** (an isolated copy),
  exactly the Phase 10 rule — never a shared mutable reference. Updates are opt-in re-installs with a
  diff preview.
- Installing a **component/plugin** = register it in the tenant's `website_component_library` +
  `website_marketplace_installs`, gated by plan + feature flag.
- Tenant data never leaves the tenant; a marketplace item cannot read another tenant's content
  (RLS + sandbox for code).

## 4. Extension SDK
- A typed SDK defines how a component/plugin declares itself: `{ type, schema (props JSON-schema),
  ssrRender, hydrate?, jsonLd?, dataSource?, permissions[], minPlatformVersion }` — the same block
  contract from the Visual Builder, formalized for third parties.
- Plugins can contribute: blocks, Low-Code actions, Journey actions, data sources (Realtime Blocks),
  and headless resolvers.
- **Capability-scoped**: a plugin declares the permissions/data it needs; the host grants only those.

## 5. Security & review (non-negotiable for multi-tenant)
- Code-bearing listings (plugin/custom component) go through **review + static analysis** before
  `approved`; execution is **sandboxed** (isolated boundary; no cross-tenant data; no ambient
  secrets). Untrusted tenant code runs client-only + sandboxed by default (Visual Builder §5).
- Signed bundles; version pinning; supply-chain checks. The Phase 8/9.5 security discipline applies:
  no ambient `anon` execution, no broad grants.

## 6. Versioning & compatibility
- Semantic versions per listing; `min_platform_version` gates installs against the running platform.
- Component schema migrations ship with versions so installed instances upgrade without breaking
  existing pages (Visual Builder §4 versioned schemas).
- Tenants pin versions; auto-update is opt-in.

## 7. Ratings, licensing, monetization
- Ratings/reviews (one per tenant, verified install required).
- Licensing: free / one-time / subscription / revenue-share. Paid installs settle through the
  **existing payment + finance ledger** (Phase 9 double-entry) — a marketplace purchase posts to the
  ledger like any other money movement; no parallel billing system.
- Publisher payouts reuse the settlement engine (merchant/partner payable) — the marketplace becomes
  a first-class revenue stream on rails that already exist.

## 8. Integration with strict concerns
- Multi-tenant (RLS); RBAC (`marketplace.publish`, `marketplace.install`); localized listings;
  audited installs/publishes; flag-gated (marketplace can be disabled per tenant); analytics on
  installs/conversions; governed review workflow (reuse the Workflow Engine for listing approval).
