# Marketing Platform (Wave 3, Part 8)

> Reusable marketing pages that compose ordinary content blocks and persist via the services — so
> every page is **editable later in Website Center** and SEO-ready. `marketing/marketing.ts`.
> Flag: `website.marketing`. Reusable by every tenant.

## Page kinds
`landing` · `campaign` · `referral` · `partner` · `city` · `restaurant_collection` · `seo_collection`
· `seasonal` (`MARKETING_KINDS`).

## Building a page
`buildMarketingBlocks(spec)` composes the renderer's block types (hero, cta, cards, features) from a
declarative `MarketingPageSpec` (heading/subheading/CTA/items/coupon/city/SEO). Kind-specific touches
(e.g. referral → a "How it works" features block; coupon → a promo CTA). Every page ends with an
app-install CTA.

## Persisting a page
`MarketingService.createPage(op, siteId, spec)` writes the page → section (tagged with `marketingKind`)
→ blocks → SEO **via the services** (repository-only). The result is normal `website_*` data, so it
appears in Website Center and is fully editable — no special marketing store.

## SEO
Each marketing page carries launch-ready SEO (title/description); rendered SEO (meta/OG/Twitter/
JSON-LD/breadcrumb) + sitemap inclusion come from the Wave 2 SEO generator automatically. `seo_collection`
pages are curated link hubs for topical/SEO authority.

## Reuse across the platform
Because marketing pages are just content + SEO, they flow through the **same** Publishing Engine,
Renderer, and edge delivery as any page — and through the **same** Growth Engine / Checkout Migration
for conversion. City/campaign/referral pages can each target their own growth campaign (UTM/coupon).

## Reusability
Tenant-scoped + brand-agnostic. A white-label tenant builds city/referral/seasonal pages with the
identical builders — the HaaT marketing pages are the reference template.

## Tests
`__tests__/checkout-marketing-pwa.test.ts` — block composition per kind + `MarketingService.createPage`
persisting a city page (page + blocks + SEO) via the services.
