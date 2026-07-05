# Website Platform Implementation Roadmap

> HaaT Now · Phase 10 · Design only (Part 17). Five phases (A–E), **each independently deployable**
> and behind a feature flag. Sequenced so the highest-value fix ("publish actually goes live")
> lands first, and nothing breaks the existing demo.

## Phase A — Foundation: real persistence + publish that goes live  ★ the critical fix
**Goal:** kill the localStorage-only architecture; a published change is served from the server.
- `website_*` core migrations: `sites, pages, sections, blocks, navigation, menus, seo,
  publish_history, published_pages, settings, revisions, component_library` (multi-tenant + RLS).
- Repositories + Website/CMS/Page/SEO/Publishing services (replace localStorage; dual-write flag).
- `publish_site` atomic idempotent RPC → snapshot compile.
- **Rendering Engine (edge)** reading `website_published_pages` (SSR) + CDN revalidate on publish.
- Importer: localStorage site → tables. Rewire `WebsiteCenter` to services (behind flag).
- **Exit:** a canary tenant edits → publishes → the change is live on the edge-rendered site from any
  device. Gates: lint/build/E2E green; staging `pg_policies`/advisors clean.
**Independently deployable:** yes — old SPA path stays default until cutover.

## Phase B — Builder & Theme depth
**Goal:** a real visual builder + full theme system.
- Component library expansion (Banner/Image/Video/Heading/Button/Pricing/Timeline + existing).
- Schema-driven inspector, drag-and-drop reorder RPC, global/reusable sections, revisions/undo.
- Theme Engine: `website_themes/theme_tokens`, token editor (all groups), dark/light compile,
  import/export, a11y contrast gate.
- Nested pages, slug management + auto-redirects, breadcrumbs, page duplicate/clone.
- **Exit:** a tenant can build a multi-page themed site with reusable sections, versioned.

## Phase C — Media, SEO, Localization, Domains
**Goal:** production content operations.
- Media Library: `website_assets/media/folders/usage`, transform pipeline (webp/avif/resize),
  usage graph, replace-everywhere, dedup, image search, alt enforcement; fix bucket-listing.
- SEO Platform: `website_seo`, JSON-LD (org/breadcrumb/faq/restaurant/product), edge sitemap/robots,
  redirect manager, broken-link scan, SEO score.
- Localization: `website_translations`, per-block translation, RTL server-set direction, per-locale
  snapshots + hreflang, translation memory.
- Domain Service: subdomain routing + custom domain verify + **ACME/auto-SSL** + renewal.
- **Exit:** a tenant ships a bilingual, SEO-complete site on a custom domain with real SSL.

## Phase D — Dynamic platform blocks, Forms, Templates
**Goal:** the differentiator — operationally-wired sites.
- Dynamic blocks (Restaurants/Stores/Products/Offers/Coupons/Categories/Cities/Drivers/Partners/
  Maps) resolving tenant+country-scoped platform data at render (ISR), **no PII**.
- Forms Platform: `website_forms/submissions`, schema fields, spam protection, webhooks, and
  kind-specific routing (merchant/driver apps → onboarding/KYC pipeline).
- Template & theme marketplace (`website_templates`, install = clone), starter template set.
- **Exit:** a merchant site shows live stores/offers and captures onboarding leads into the pipeline.

## Phase E — Analytics, Performance, Advanced
**Goal:** measurement, optimization, enterprise extras.
- Website Analytics: edge beacon, `website_page_analytics`, dashboards, RUM Core Web Vitals,
  goals/funnels, forms analytics; privacy-first/cookieless.
- Performance hardening: island hydration, per-page JS budgets, prefetch, Lighthouse CI ≥95.
- Advanced (gated): custom code, Custom React Component Registry (sandboxed), A/B testing,
  membership/gated content, multi-site franchise management.
- **Exit:** measurable 95+ Lighthouse on sample tenants; analytics + optimization loop closed.

## Cross-phase guardrails (apply every phase)
- **Feature-flagged, per-tenant rollout** with instant rollback (Migration Plan §5).
- **Multi-tenant RLS from day one**; no `using(true)`; staging advisor review each phase.
- **Atomic, idempotent RPCs** for publish/clone/domain (Phase 9 pattern).
- **CI gates**: typecheck both paths, architecture guard, bundle-size budget, Lighthouse on a
  sample tenant, and (from Phase A) live E2E of the edge-rendered public site.
- **Audit** every publish/domain/permission change to `operation_events`.

## Sequencing rationale
Phase A first because it fixes the one thing that makes the current center non-functional (publish
doesn't go live) and unblocks everything else. B–E layer capability on a correct foundation, each
shippable alone, so value lands continuously and risk stays bounded.

## Rough effort (indicative, not a commitment)
A: 3–5 wks · B: 3–4 wks · C: 4–6 wks · D: 4–6 wks · E: 4–6 wks. Phases can overlap after A.
