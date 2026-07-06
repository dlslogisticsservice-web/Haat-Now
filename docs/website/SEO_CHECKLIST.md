# SEO Checklist — Official HaaT Now Website

> Target: **100 Lighthouse SEO**. The SEO platform (Wave 2, `seo/seo.ts`) already
> produces titles, descriptions, canonicals, sitemap and redirects from published
> snapshots — this checklist verifies the official site exercises it correctly.

## Metadata (every page)
- [ ] Unique `<title>` 30–60 chars, brand-suffixed.
- [ ] `<meta name="description">` 50–160 chars (min length validated — see Wave 2 Terms fix).
- [ ] Canonical URL set; no duplicate canonicals across locales.
- [ ] `robots` meta correct (index,follow for public; noindex for portal/checkout).
- [ ] Open Graph (title/description/image/type/url) + Twitter card on shareable pages.
- [ ] `hreflang` pairs emitted for every localized page (ar/en).

## Structured data
- [ ] `BreadcrumbList` microdata rendered by `Breadcrumbs.tsx` on all non-home pages.
- [ ] `Organization` / `WebSite` JSON-LD on homepage (with SearchAction for site search).
- [ ] `Restaurant` / `Product` / `Offer` schema on merchant and product pages.
- [ ] No JSON-LD validation errors (Rich Results Test).

## Crawlability
- [ ] `sitemap.xml` generated from published pages; excludes drafts + portal routes.
- [ ] `robots.txt` references sitemap; disallows `/portal`, `/checkout`, `/api`.
- [ ] Redirects table has no loops/chains; all 301 (not 302) for permanent moves.
- [ ] All nav/footer links resolve (no 404) — cross-check `buildNavTree` output.

## Content & semantics
- [ ] Exactly one `<h1>` per page; heading hierarchy not skipped.
- [ ] Images have descriptive `alt`; decorative images `alt=""`.
- [ ] Internal links use descriptive anchor text (no "click here").
- [ ] Collections/search result pages are indexable and paginated with rel prev/next.

## Performance-linked SEO
- [ ] Core Web Vitals in "good" band (see `PERFORMANCE_CHECKLIST.md`).
- [ ] Mobile-friendly / responsive verified (no horizontal scroll).
- [ ] No render-blocking of primary content; SSR/snapshot content present in initial HTML.

## Verification
- [ ] Lighthouse SEO = 100 on Home, Merchant, Product, Collection, Search, a Legal page.
- [ ] Google Search Console: sitemap submitted, 0 coverage errors after crawl.
