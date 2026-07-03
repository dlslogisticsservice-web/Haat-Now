# Website Runtime — Implementation Report

**Sprint:** Website Platform Runtime — implement the public tenant-website runtime **inside** the existing HAAT
NOW SPA. No separate project/repo, no Admin redesign, reuse-first.

## Outcome
✅ Implemented and runtime-verified. Gate green: **typecheck 0 · build ✓ · sandbox E2E 24/24 · website runtime
probe PASS**. The public site is **additive** — it mounts only for tenant-website requests; the default host/path
renders the existing role apps unchanged.

## Reused (no duplication) — mandatory first-step inspection
| Reused module | How |
|---|---|
| **Tenant Service** | `resolveTenantBySlug`/tenant record = the site's owner + brand spine; `applyTheme` for brand runtime |
| **Theme Engine** (`designSystem`) | The site renders from the **same** design tokens (CSS vars) → theme/brand change re-skins it, no rebuild |
| **Experience Service** | Its draft/publish/version/rollback **pattern** is mirrored by `website.service` (one CMS model) |
| **Provisioning / Templates** | Default site seeded from the tenant's `cms_structure.pages` + `navigation` (template manifests) |
| **Monitoring** | `monitoring.track()` = the analytics seam for pageviews (Phase 7 — no new analytics service) |
| **Platform Registry / Subscription / Permissions / Integration Center / Media / Auth / Routing** | Consumed as-is; the runtime adds no parallel systems |

## Files (new runtime behavior only)
| File | Role |
|---|---|
| `src/services/website.service.ts` (new, governed) | Per-tenant content engine: pages/sections/nav/footer/blog/legal/SEO, draft/publish/version/rollback, **instant-publish event** (`haat:website`). Sandbox `haat_sb_website_v1`. SERVICE_REGISTRY entry added. |
| `src/features/website/runtime.ts` (new) | Resolvers: request (host/subdomain/custom-domain/`?site=`), tenant, page, brand/theme, SEO (build + inject), sitemap.xml + robots.txt, analytics. |
| `src/features/website/blocks.tsx` (new) | Token-styled block renderer (hero/features/cta/richtext/faq/contact/gallery). |
| `src/features/website/PublicSiteApp.tsx` (new) | Public renderer: header/nav, pages, blog(+post), help, legal, 404, footer, cookie banner, maintenance/status, client routing, SEO+analytics wiring. |
| `src/main.tsx` (edit) | Additive public-site chooser inside the existing providers. |

## Phase-by-phase
| Phase | Delivered |
|---|---|
| **1 · Runtime Engine** | Tenant-aware runtime; request → tenant → site resolution; page/content/theme/brand/SEO resolvers. |
| **2 · Public Rendering** | Home/landing, About, Contact, Blog (index + post), Help Center, Privacy, Terms, and custom pages (from `cms_structure`). |
| **3 · CMS Runtime** | `publish()` writes published content + dispatches `haat:website`; the runtime re-renders **immediately** (verified: maintenance toggle without reload). No rebuild, no redeploy. |
| **4 · Brand Runtime** | `applyBrand` → `tenantService.applyTheme` → the ONE theme engine writes CSS vars; logo/favicon/colors/typography + nav/footer update instantly across the site. |
| **5 · Tenant Runtime** | `<slug>.haatnow.app` subdomain + custom-domain host resolution; site **status** + **maintenance mode** (maintenance/coming-soon screens); SSL-state field on the site record. |
| **6 · SEO Runtime** | Per-page `<title>`/description/canonical, OpenGraph, Twitter cards, JSON-LD structured data injected into `<head>`; per-tenant `generateSitemap` + `generateRobots`. |
| **7 · Analytics Runtime** | `trackPageview` → `monitoring.track('website_pageview', …)` — reuses the existing seam; **no duplicate analytics service**. |

## Runtime verification (Definition of Done — behavior, not code-presence)
Puppeteer probe against `/?site=foodexpress`:
```
#public_site render · 5 nav links · hero · footer · cookie banner
SEO: title (changes per page) · description · og:title · canonical · twitter:card · JSON-LD
routing: About · Blog (2 posts) · blog post article · Privacy (legal)
instant maintenance ON → #public_site_maintenance, OFF → #public_site  (no reload)
analytics seam fired · console errors: 0   → PROBE PASS
```

## Governance
`website.service` ships with the mandatory governance header + a `SERVICE_REGISTRY.md` entry (owner
Experience/Platform). Layer rules respected: content service depends on storage + tenant (sibling, acyclic); the
runtime (feature layer) composes services. The public site is a **new surface**, not a change to any existing
module.

## Known limitations (honest)
- **Sandbox runtime is complete and verified.** The **live** path (the designed `website_*` Supabase tables from
  [WEBSITE_DATABASE.md](../architecture/WEBSITE_DATABASE.md), edge serving of `/sitemap.xml` + `/robots.txt`, and
  real custom-domain DNS/SSL provisioning) is the documented staging follow-up — consistent with the
  three-environment model (sandbox first-class; production = real Supabase).
- No **Website Center admin editor** in this sprint (runtime only); content is edited via `website.service` /
  the `window.__site` dev hook. The editor console is the next phase (W2 in the deployment plan).
- SPA-served `/sitemap.xml` and `/robots.txt` need an edge/static route to be crawler-visible in production;
  the generators exist and are unit-ready.

## Rollback
Fully additive + request-gated. Revert `d9799c4` (`git revert d9799c4`) or remove the `main.tsx` chooser — the
role apps, admin, and sandbox demo are unaffected (the public site simply stops mounting).
