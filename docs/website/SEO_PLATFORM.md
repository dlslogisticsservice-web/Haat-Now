# SEO Platform

> HaaT Now · Phase 10 · Design only (Part 8). Today SEO is client-side head injection with an
> Organization JSON-LD only, and sitemap/robots generated in-browser with no edge route
> (`src/features/website/runtime.ts:80-139`). Crawlers that don't execute JS see almost nothing.
> Website OS makes SEO **server-rendered, structured, and measured**.

## 1. The core fix: server-rendered SEO
The Rendering Engine emits all SEO tags in the server HTML `<head>` from the published snapshot —
title, description, canonical, robots, Open Graph, Twitter, and JSON-LD — so crawlers get complete
metadata without executing JS. (The existing `applySeo` logic, `runtime.ts:98-123`, becomes the
server template.)

## 2. Per-page SEO fields (Part 8, stored in `website_seo`)

| Field | Notes |
|---|---|
| Meta Title | per page + locale; falls back to site default → page title |
| Description | per page + locale |
| Keywords | array (low weight, still stored) |
| Canonical | defaults to the page's absolute URL; override supported |
| Robots | `index,follow` default; forced `noindex` when site is draft/maintenance (existing rule, `runtime.ts:137`) |
| Open Graph | title/description/image/type; image defaults to brand social banner |
| Twitter Card | summary / summary_large_image based on image presence (existing logic) |
| JSON-LD | array of structured-data blocks (below) |

## 3. Structured data (JSON-LD) — the schemas
Auto-emitted from content, per page:
- **Organization** (exists today) — brand, logo, url, social.
- **Breadcrumb** — from the page tree (nesting → BreadcrumbList).
- **FAQ** — auto-generated from any FAQ block on the page.
- **Restaurant / LocalBusiness** — for merchant/store pages (name, cuisine, address, geo, hours,
  rating) sourced from the platform's merchant data (tenant-scoped).
- **Merchant / Product** — for product/offer pages.
- **WebSite + SearchAction** — enables sitelinks search box.
Each block type can declare a `jsonLd(props, context)` contributor; the SEO Service merges them.

## 4. Sitemap & robots (server routes)
- **`/sitemap.xml`** — served by the edge from published pages + dynamic routes + blog; split into
  a sitemap index for large sites (>50k URLs); `lastmod` from publish time. (Today it's an in-JS
  string, `generateSitemap`, never served at a real route — this makes it a real edge route.)
- **`/robots.txt`** — edge route; `Disallow: /` when draft/maintenance, else `Allow` + sitemap
  reference (existing logic promoted to the edge).
- **Per-locale** sitemaps with `hreflang` alternates.

## 5. Redirect manager (Part 8 + `website_redirects`)
- CRUD 301/302/307/308 rules (exact / prefix / wildcard).
- Auto-redirect on slug change (Builder spec).
- Hit counter per rule; unused-rule cleanup suggestions.
- Edge evaluates redirects **before** rendering (fast path).

## 6. Broken-link detection
- A scheduled job (Phase 9 scheduler / edge cron) crawls each published site's internal links +
  media references, flags 404s and orphaned pages, and reports in the SEO dashboard.
- Internal links referencing deleted pages are surfaced in the builder (because links target
  `page_id`, deletions are detectable precisely).

## 7. SEO score
A per-page 0–100 score with actionable checks:
- title/description present + length; single H1; alt text on all images; canonical set; word count;
  internal link count; structured data present; image weight; mobile-friendly; noindex sanity.
- Score stored on `website_seo.score`; site-level SEO health aggregates page scores.

## 8. hreflang & i18n SEO
- Localized pages emit `<link rel="alternate" hreflang="…">` for every available locale + `x-default`.
- Canonical points to the same-locale URL; RTL locales get correct `<html lang dir>`.

## 9. Performance ↔ SEO
Because pages are edge-SSR/ISR with optimized images (Media Library) and small JS, Core Web Vitals
(LCP/CLS/INP) are strong by construction — the primary technical-SEO lever. Lighthouse SEO + perf
are tracked in CI on a sample tenant.

## 10. Multi-tenant
`website_seo` and `website_redirects` are tenant/site-scoped (RLS). Sitemaps/robots are generated
per resolved host, so tenants never leak into each other's search surfaces.
