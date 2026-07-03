# Website Platform — Architecture

**Mandate:** transform HAAT NOW into a true SaaS where every tenant owns a Website / Landing Pages / CMS / Blog /
Careers / Help Center / Legal / SEO / Custom Domain — **from inside the existing Admin Portal, in the existing
repository**. No separate project, no second repo, no duplication. The Website Platform is **another Platform
Module** that reuses the existing engines and adds only what is genuinely missing.

> Architecture only. This document (and its four siblings) designs the module; **no code is implemented beyond
> what existing modules already support.** Where an engine already does the job, it is reused as-is.

---

## 1. Reuse-first map (from codebase inspection)

| Capability | Existing module (REUSE) | Evidence | Website use |
|---|---|---|---|
| Theming / live re-skin | **Theme Engine** `src/design/designSystem.ts` (`applyDesign`→CSS vars), `DesignContext` | `applyDesign` writes ~25 `:root` vars | Website reads the **same** CSS vars → re-skins with the app, no deploy |
| Visual editor | **Design Center** `features/admin/DesignCenter.tsx` + `ThemePresetsPanel` | present | Colors/typography/brand for the site come from here (one editor) |
| Reusable looks | **Theme Presets** `themePresets.service` | 4 seeded presets | A site adopts a tenant's `theme_preset_id` |
| Tenant config spine | **Tenant Service** `tenant.service` | record has `slug`, `default_website`, `site_name`, `cms_structure`, `navigation`, brand fields | The site is a facet of the tenant record |
| White-label | **White Label** (tenant + theme cascade) | `applyTheme(tenant)` | Each tenant's site is its brand automatically |
| Content publishing | **CMS / Experience Builder** `experience.service` + `screen_experiences(_history)` | draft/publish/version/rollback per (country, screen) | **Extended** to website pages — same engine, new content domain (one CMS) |
| Stand-up automation | **Provisioning Engine** `provisioning.service` | **`cms` step already exists**: sets `default_website`/`site_name`/`cms_structure`/`navigation` | Seeds a default site on tenant creation |
| Declarative structure | **Templates** `templates.service` | manifests carry `cms_structure.pages` + `navigation` per vertical | Default pages/nav per business type |
| Media / logos / favicon | **Brand Assets** `assets.service` (`BRAND_SLOTS`), `AssetsManager`, **Storage** `storage.service` | favicon/social_banner/logo slots | Site logo/favicon/OG image/media |
| Analytics providers | **Platform / Integration Center** `platform.service` | GA / Firebase / Mixpanel / PostHog in `PROVIDER_CATALOG` | Website analytics injection + consent |
| Tiering | **Subscription** `subscription.service` | plans/features | Gate website tier (site / blog / custom domain) |
| Access | **Permissions** `rbac.service` | `platform.whitelabel.manage`, `platform.design.manage`, `platform.tenants.manage` | **Extended** with a `website.*` group |
| Config | **Settings** `admin.service` (`app_config`), `release.service` (`settings`) | present | Global website defaults, feature flags |
| SEO infra (static) | `public/robots.txt`, `public/sitemap.xml`, `public/manifest.webmanifest` | present (SPA) | Base to extend into per-tenant SEO |

**Principle:** the Website Platform **owns no theming, no media, no tenant, no auth, no subscription** — it
composes them. It adds only the missing *content model + public runtime + domain/SEO layer*.

---

## 2. What is missing (must be created — designed here, built in later governed sprints)

1. **Website content model** — Pages, Sections/Blocks (Hero, feature, gallery, CTA…), Navigation, Footer; and the
   typed page kinds Blog, Careers, Help Center, Legal. `experience.service` today models only
   `ScreenType = splash|login|onboarding`; `tenant.cms_structure`/`navigation` are opaque JSON placeholders.
2. **Public Website Runtime / renderer** — there is **no** rendered marketing site (the SPA is the 4 role apps).
3. **SEO model** — per-page title/description/OG/canonical + per-tenant `sitemap.xml`/`robots.txt` generation.
4. **Custom-domain management** — tenant ↔ domain mapping, verification, routing. Only `tenant.slug` and
   `EnvironmentConfig.domain` exist today.
5. **Cookie/consent + website analytics wiring** — providers exist in the registry; injection/consent do not.
6. **Website admin console** — the new Platform Module surface in the Admin Portal.

---

## 3. Module shape — "Website Platform" as a Platform Module

```
                          ADMIN PORTAL  (existing AdminDashboard + AdminSidebar)
                                   │  new nav item (Platform group): "Website Center"
                                   ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │  WEBSITE CENTER (new admin console)  — presentation only, reuses everything     │
   │   Pages · Navigation · Footer · Hero/Sections · Blog · Help · Careers · Legal   │
   │   SEO · Cookie/Consent · Analytics · Domain · Brand (link→Design Center)         │
   └───────────────┬───────────────────────────────────────────────────────────────┘
                   │ writes via
                   ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │  website.service (NEW, governed)  — draft/publish/version/rollback for site     │
   │  content, built on the SAME pattern as experience.service. Owns NO theming/     │
   │  media/tenant/auth — delegates:                                                 │
   │   theme→designSystem · brand/spine→tenant.service · media→assets/storage ·      │
   │   tier→subscription · access→rbac · analytics→platform.service · seed→provision │
   └───────────────┬───────────────────────────────────────────────────────────────┘
                   │ persists (draft/published/history) — see WEBSITE_DATABASE.md
                   ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │  PUBLIC WEBSITE RUNTIME (NEW)  — resolves domain/slug → tenant → theme cascade   │
   │  → renders PUBLISHED pages. Reads the SAME CSS vars as the apps → live re-skin.  │
   │  See WEBSITE_RUNTIME.md.                                                          │
   └───────────────────────────────────────────────────────────────────────────────┘
```

`website.service` follows the **exact governance** of the other Platform services (header block + SERVICE_REGISTRY
entry) and the **layer rules** (platform/experience layer — imports storage + tenant/theme, never UI). It is the
**one** website content engine; it does not duplicate `experience.service` — it is the website-pages extension of
the same publishing model (draft → publish → version → rollback, per tenant).

---

## 4. Content model (the missing schema, conceptual)

```
Site (per tenant)                     ← tenant record + website settings (brand/colors/typography/logo/favicon/social/analytics/cookie/legal/domain)
 ├── Navigation (header)              ← ordered links → pages / external
 ├── Footer                          ← columns of links + social + legal links + copyright
 └── Pages[]                          ← kind: landing | standard | blog_index | help_index | careers | legal
      ├── SEO { title, description, canonical, og_image, noindex }
      └── Sections[] (ordered blocks) ← Hero | RichText | Features | Gallery | CTA | FAQ | Form | Embed | PricingRef
 ├── BlogPosts[]                      ← title, slug, cover, body(blocks), tags, author, published_at, SEO
 ├── HelpArticles[]                   ← category, title, slug, body, SEO
 ├── CareersPostings[]                ← title, location, type, body, apply_link
 └── LegalPages[]                     ← privacy | terms | refund | cookie — versioned, effective_date
```

Every block renders from **design tokens** (no hardcoded colors) so a Design Center / brand / theme change
reflows the whole site. Media references are asset URLs from `assets.service`/`storage.service`.

---

## 5. Multi-tenant & white-label

- **HAAT NOW website** = the platform tenant's site (same engine, `theme_preset` = default).
- **White-label websites** = every other tenant's site — brand/theme come from that tenant's record + preset via
  the existing **theme cascade** (`tenant.service.applyTheme` → `applyDesign` → CSS vars).
- **Unlimited tenants / domains** = one site row per tenant + one-to-many `website_domains` rows; routing resolves
  domain→tenant at the edge (see WEBSITE_RUNTIME.md / WEBSITE_DEPLOYMENT_PLAN.md).
- **Custom branding** = the tenant spine already carries it; the site inherits it with zero per-site code.

---

## 6. Governance (how it plugs in without duplication)

- **One CMS:** website content extends the `experience.service` publishing pattern; `experience.service` keeps the
  3 auth screens, `website.service` owns site pages/blog/help/legal — same draft/publish/version contract, one
  mental model. No second theming/media/tenant/auth system.
- **One theme engine, one media library, one tenant spine, one permission source, one subscription** — all reused.
- **New service governance:** `website.service` ships with the mandatory header + a `SERVICE_REGISTRY.md` entry +
  owner domain (Experience/Platform) in the same commit as its first implementation sprint.
- **Payment rule respected:** the website may *display* pricing/plan info and link to subscription management; no
  new payment gateway is introduced.

---

## 7. Deliverables of the full programme (phased, each a governed sprint)
1. `website.service` + schema (WEBSITE_DATABASE.md) — pages/nav/footer/SEO, draft/publish/version.
2. Website Center admin console (presentation-only, reuses Design Center/Assets/Subscription/RBAC).
3. Public Website Runtime + domain routing (WEBSITE_RUNTIME.md, WEBSITE_DEPLOYMENT_PLAN.md).
4. Blog / Help / Careers / Legal page kinds.
5. SEO + per-tenant sitemap/robots + cookie/consent + analytics injection.
6. Provisioning extension: seed default site from `template.cms_structure`.

**This sprint stops at architecture.** Companion docs: [WEBSITE_RUNTIME.md](WEBSITE_RUNTIME.md) ·
[WEBSITE_DATABASE.md](WEBSITE_DATABASE.md) · [WEBSITE_PERMISSION_MODEL.md](WEBSITE_PERMISSION_MODEL.md) ·
[WEBSITE_DEPLOYMENT_PLAN.md](WEBSITE_DEPLOYMENT_PLAN.md).
