# Official HaaT Now Website — Implementation (Wave 2)

> The first production website built on the Website Platform. Defined as ordinary content data so it
> is **editable later from Website Center** and 100% reusable by white-label tenants.

## Content (Part 3) — 19 pages
`src/website-platform/haat-site/site-definition.ts` exports `HAAT_SITE` (slug `haatnow`) with all 19
pages, each as ordered blocks:
Home · About · Services · Restaurants · Grocery · Pharmacy · Parcel Delivery · Become a Driver ·
Become a Merchant · Franchise · Pricing · FAQ · Contact · Careers · Blog · Help Center · Privacy ·
Terms · Cookie Policy.

Blocks use the renderer's registry (hero, features, cards, cta, richtext, faq, contact, …). Every
page carries launch-ready SEO (title + description validated 50–165 chars, ≤65-char titles).

## Two entry points
- **`seedHaatSite(ctx, op)`** — persists the definition via the **services** (websites→pages→sections
  →blocks→seo) so the site is real, tenant-scoped `website_*` data, fully editable in Website Center
  later. Returns the new `siteId`.
- **`compileHaatSnapshot(siteId, now)`** — produces a `SiteSnapshot` directly from the definition
  (no DB) for rendering / SEO / static generation and tests.

## Production path
```
seedHaatSite → (edit in Website Center) → PublishingEngine.publish → snapshot
  → SnapshotRenderer.renderDocument / renderStatic → HTML → (edge/CDN, later wave)
  → generateSeo / generateSitemap / generateRobots → SEO artifacts
```
All of this is behind feature flags (`website.publishing_engine`, `website.render_public`) until
approved — the running app is unchanged.

## Rendering (Part 2)
`SnapshotRenderer` (`../rendering/renderer.ts`) turns a compiled page into HTML — pure, DOM-free,
edge-ready. `renderStatic` pre-renders all 19 pages; `render(context)` does per-request SSR with a
cache key + etag + `stale-while-revalidate`. Asset fingerprinting + a per-path cache manifest support
CDN caching. The block→HTML registry is extensible (`registerBlockRenderer`) and reused by tenants.

## SEO (Part 6)
`generateSeo` emits meta, canonical, robots, OpenGraph, Twitter, and JSON-LD (Organization, WebSite+
SearchAction, BreadcrumbList, FAQPage). `generateSitemap`/`generateRobots` are site-level.
`validateSeo` gates launch (all 19 HaaT pages pass — a caught short-description defect was fixed).

## Ordering (Part 4)
Ordering from the website reuses the app backend — see `WEBSITE_ORDERING.md`.

## Conversion & analytics
App-install conversion prompts (`CONVERSION_ENGINE.md`), deferred deep linking (`DEEP_LINKING.md`),
and website analytics (visits/funnels/conversion/downloads/…) are wired and config-driven.

## Reusability
Nothing about the HaaT site is special-cased: it is content data + platform services. A white-label
tenant gets the same capabilities by seeding their own `SiteDef` and publishing.

## Tests
`__tests__/deeplink-ordering-website.test.ts` (site has all 19 pages; compile → 19 valid pages; seed
→ 19 persisted pages) + `rendering-seo.test.ts` (render + SEO + sitemap + launch validation).
