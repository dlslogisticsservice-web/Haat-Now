# Website Platform — Runtime

How a public website request is served, and **why the site updates without a code deployment** whenever theme,
brand, CMS, pages, or design change. Reuses the existing theme cascade and the sandbox/live dual-mode model.

## 1. Request lifecycle
```
Visitor → https://<domain-or-subdomain>/<path>
   │
   ▼  (edge) DOMAIN RESOLUTION
website_domains[domain] → tenant_id     (custom domain)   OR   <slug>.haatnow.app → tenant by slug
   │
   ▼  TENANT LOAD  (reuse tenant.service)
tenant record (brand/theme_preset_id/colors/logo/favicon/site settings/subscription/status)
   │
   ▼  THEME CASCADE  (reuse designSystem.applyDesign)
tenantTheme(tenant) → applyDesign() → ~25 CSS vars on :root   ← SAME engine the apps use
   │
   ▼  CONTENT LOAD  (website.service — reads PUBLISHED version)
site + navigation + footer + page(path) + sections[]   (+ blog/help/legal/careers by kind)
   │
   ▼  RENDER  (Public Website Runtime)
blocks rendered from design tokens + published content + asset URLs → HTML
   │
   ▼  SEO + ANALYTICS + CONSENT
per-page <title>/meta/OG/canonical · sitemap/robots · cookie banner · analytics (if consented)
```

## 2. Rendering approach (reuse-first, minimal new code)
The runtime is a **new public route/surface inside the existing Vite SPA** (not a new project): a
`PublicSiteApp` mounted for non-authenticated public hosts/paths, parallel to the customer/driver/merchant/admin
role apps in `src/App.tsx`. It:
- reuses **DesignProvider** (the theme cascade) and the shared **design-token CSS** (`src/index.css`),
- reuses **BrandLogo**/asset components and the media URLs from `assets.service`,
- renders **published** website content from `website.service` (never draft to the public),
- is **presentation-only** — all content/theme come from data.

Server-side rendering / static generation is an optional later optimization (see WEBSITE_DEPLOYMENT_PLAN.md); the
baseline is the SPA public route, which requires no new build system.

## 3. Why updates need no code deploy
Everything that changes the site is **data**, not code:

| Change | Mechanism | Propagation |
|---|---|---|
| **Theme change** | Design Center → `DesignContext.publish` → `applyDesign` writes CSS vars | Site re-skins on next load (same `:root` vars as the apps) |
| **Brand change** | `tenant.service.saveBranding` (logo/favicon/colors) → `tenantTheme` | Cascade re-applies; logo/favicon/colors update |
| **CMS / page change** | `website.service.publish(page)` bumps `published_version` | Runtime reads the new published row |
| **Pages added/removed** | `website.service` page CRUD + nav update, then publish | New routes/nav served |
| **Design change** | same theme cascade (tokens) | Whole site reflows |

No bundle rebuild is required because the renderer reads content + tokens at runtime. Only a **new block type** or
**new page kind** (i.e. new rendering *code*) needs a deploy — content/theme/brand/SEO edits do not.

## 4. Draft vs published (safe editing)
Mirrors `experience.service`: editors work on a **draft**; the public runtime serves only **published**. Publish
snapshots the previous published into history (rollback). Preview uses a signed/admin-only draft view.

## 5. Dual-mode (sandbox / staging / production) — consistent with the platform
| Env | Content + theme source | Domain resolution |
|---|---|---|
| **Sandbox** (demo/preview) | `localStorage` (`haat_*` website keys), Proxy-stubbed Supabase | `?tenant=<slug>` / localhost — no real DNS |
| **Staging / Production** | Supabase (`website_*` tables + `screen_experiences` pattern), RLS per tenant | real DNS via `website_domains` (see deployment plan) |

Sandbox stays **first-class and flag-gated** (`VITE_AUTH_MODE`); the public runtime uses the same gate so a live
site never reads sandbox data.

## 6. Caching / invalidation
- Published content is immutable per `published_version`; a publish bumps the version → cache key changes →
  natural invalidation (CDN + client).
- `sitemap.xml`/`robots.txt` are regenerated (or served dynamically) on publish.
- Realtime is **not** required for the public site; publish-time invalidation is sufficient.

## 7. Performance & isolation
- Reuse Vite `manualChunks`; the public site is a lazily-loaded chunk (does not bloat the role apps).
- Tenant isolation follows the platform's multi-tenancy roadmap (RLS + tenant-scoped rows); the public runtime
  only ever reads **published, tenant-scoped** content.

See also: [WEBSITE_DATABASE.md](WEBSITE_DATABASE.md) · [WEBSITE_DEPLOYMENT_PLAN.md](WEBSITE_DEPLOYMENT_PLAN.md).
