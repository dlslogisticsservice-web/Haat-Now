# Website Platform Architecture — "Website OS"

> HaaT Now · Phase 10 · Enterprise Architecture & Product Design (documentation only)
> Date: 2026-07-05. Target scale: 10,000+ companies, multi-country. Every claim about the
> *current* system is cited `file:line`.

---

# PART 1 — Audit of the existing Website Center

## 1.1 The one-sentence truth
**The current Website Center is a single-browser, `localStorage`-only editor. "Publishing" copies
a draft to a "published" slot inside the editor's own browser storage and fires a same-tab DOM
event. Nothing is persisted server-side, so no other device, user, or crawler can ever see a
published change.** The only genuinely server-persisted asset is uploaded media (Supabase Storage).

## 1.2 Why "Publish" does not update the live website

`websiteService.publish()` (`src/services/website.service.ts:244-253`):
```
publish(tenantId) {
  rec.history.unshift(...); rec.version += 1;
  rec.published = clone({ ...rec.draft });   // draft → published, IN localStorage
  writeStore(store);                          // localStorage.setItem('haat_sb_website_v1', …)
  emitChange(tenantId);                       // window.dispatchEvent('haat:website')  ← same tab only
}
```
Three structural reasons it cannot reach the "live" site:
1. **Storage is `localStorage`.** `readStore`/`writeStore` (`website.service.ts:64-65`) read/write
   `localStorage['haat_sb_website_v1']` **unconditionally** — there is **no Supabase branch** in the
   entire service. Even in live mode (`HAAT_LIVE_BACKEND=1`), website content never touches the DB.
2. **The public runtime reads the same `localStorage`.** `main.tsx:12-60` mounts `PublicSiteApp`
   client-side; `resolveSite()` (`runtime.ts:39-50`) calls `websiteService.getPublishedSite()`,
   which reads the same browser store. A visitor on another device gets a **freshly seeded default
   site** (`defaultSite()`, `website.service.ts:85-158`), never the publisher's edits.
3. **`emitChange` is a same-tab `CustomEvent`** (`website.service.ts:70-72`) — it re-renders only the
   tab that already holds the data. There is no server, no CDN purge, no SSR, no rebuild.

## 1.3 Data persistence matrix

| Data | Where it lives | Persisted server-side? |
|---|---|---|
| Pages, sections/blocks, nav, footer, blog, SEO defaults, cookie, domain strings, version history | `localStorage['haat_sb_website_v1']` (`website.service.ts:17,61-65`) | ❌ No |
| Tenant brand/theme (colors, logo) | tenant record (localStorage in sandbox; `tenants` table in live) | ⚠️ Partial (tenant row) |
| Uploaded media blobs | **Supabase Storage** via `assetsService.upload` → `storage.service.ts` (5 buckets) | ✅ Yes (blob only) |
| Media metadata / library / usage | nowhere (no table) | ❌ No |
| SEO head tags, sitemap.xml, robots.txt | generated **in-browser** at render (`runtime.ts:98-139`) | ❌ No (no edge) |

## 1.4 Static vs dynamic pages
- **No server-static pages.** Every "page" is client-rendered from localStorage by `PublicSiteApp` +
  `BlockRenderer` (`src/features/website/blocks.tsx:17`).
- **No data-dynamic pages.** All 12 block types are **presentational only** — `hero, richtext,
  features, cards, stats, testimonials, partners, cta, gallery, app_download, faq, contact`
  (`website.service.ts:26-39`). None pull live platform data (no restaurants/products/offers/
  drivers/maps blocks). The mission's "dynamic content" blocks do not exist.

## 1.5 Disconnected components & missing pieces

| Component | State |
|---|---|
| `website.service.ts`, `runtime.ts`, `blocks.tsx`, `PublicSiteApp.tsx`, `WebsiteCenter.tsx` | **Disconnected** from Supabase (localStorage) |
| `MediaPicker` → `storage.service` | ✅ Connected (Supabase Storage) — the lone real integration |
| Domain / SSL | Cosmetic: string field + manual `sslStatus` dropdown (`website.service.ts:58`) |
| SEO / sitemap / robots | Client-side only; comment claims "served at the edge in production" but **no edge function exists** (`runtime.ts:125`) |

**Missing APIs (all of them):** website CRUD, atomic publish, scheduled publish, domain
provisioning (DNS/ACME), SSR/ISR rendering, sitemap/robots at the edge, media transform pipeline,
forms ingestion, per-page analytics ingestion, translation, redirects.

**Missing database tables (all of them):** every `website_*` table. Verified live against the
`haat-now-dev` project — no `website_*` table exists; there is no website migration in
`supabase/migrations/`.

## 1.6 What is genuinely reusable (do not throw away)
The **content model and editor UX are good** and worth migrating, not rewriting:
- The `WebsiteSite`/`WebsitePage`/`WebsiteBlock` shape (`website.service.ts:26-60`) is a sound
  starting schema — it maps cleanly onto normalized `website_*` tables.
- `WebsiteCenter.tsx` is a real visual editor (sections, block add/reorder/delete, section
  templates, device preview, live `BlockRenderer`).
- `runtime.ts` host-resolution + SEO composition logic is reusable server-side.
- `storage.service` + `MediaPicker` are a working media on-ramp.

**Verdict:** the current Website Center is a **credible prototype of the admin UX** sitting on a
**non-existent backend**. Phase 10 keeps the UX DNA and builds the real platform beneath it.

---

# PART 2 — Website Platform Architecture (the 14 services)

## 2.0 The central architectural decision — separate the Builder from the Runtime

The single most important change: **split the system into three planes**, connected by an
**immutable published snapshot**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONTROL PLANE (Admin SPA — the existing React app)                          │
│  Website Center → Website/CMS/Page/Media/Nav/SEO/Theme/Revision services      │
│  writes NORMALIZED draft rows (website_* tables) via repositories             │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │  Publishing Engine (atomic RPC) compiles draft → snapshot
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATA PLANE (Postgres + Supabase Storage)                                     │
│  Normalized draft tables  +  website_publish_history (immutable snapshots)    │
│  +  a per-page/per-site published_snapshot (denormalized JSON, CDN-friendly)  │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │  Rendering Engine reads the PUBLISHED snapshot (service role)
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DELIVERY PLANE (Edge Function + CDN)                                          │
│  Edge SSR/ISR renders HTML from the snapshot → CDN cache (per host+path)       │
│  Publish purges/revalidates the CDN key → new content is live in seconds       │
└─────────────────────────────────────────────────────────────────────────────┘
```

Why this shape:
- **It fixes "publish doesn't go live"**: the public site is served by the edge from a
  server-persisted snapshot, not the editor's browser.
- **It hits the performance targets** (SSR/ISR, 95+ Lighthouse) without turning the admin SPA into
  an SSR app — the admin stays a client app; only the *public* site is edge-rendered.
- **It is safe at 10k tenants**: rendering reads a single denormalized snapshot row per (site,path)
  → O(1) reads, CDN-cached; no N-join at request time.

## 2.1 Service catalog

| Service | Responsibility | Backed by | Notes |
|---|---|---|---|
| **Website Service** | Site lifecycle (create/clone/suspend), settings, domain binding | `website_sites`, `website_settings` | replaces today's monolithic `website.service` |
| **CMS Service** | Orchestrates page/section/block trees; content graph integrity | `website_pages/sections/blocks` | transactional tree ops |
| **Page Service** | Page CRUD, slugs, ordering, nesting, dynamic routes, breadcrumbs | `website_pages` | slug uniqueness per site |
| **Media Service** | Upload, transform (webp/avif/resize), folders, usage tracking, replace-everywhere | `website_media/assets`, Storage, transform edge fn | see MEDIA_LIBRARY.md |
| **Navigation Service** | Menus, nav trees, footer, breadcrumbs | `website_navigation/menus` | multiple named menus per site |
| **SEO Service** | Per-page meta, canonical, robots, OG/Twitter, JSON-LD, sitemap, redirects, SEO score | `website_seo`, `website_redirects` | see SEO_PLATFORM.md |
| **Publishing Engine** | Draft→snapshot compile, atomic/scheduled/instant publish, rollback, approval | `website_publish_history`, publish RPC, scheduler | see PUBLISHING_ENGINE.md |
| **Theme Engine** | Token resolution, dark/light, fonts, per-tenant theme, import/export | `website_themes/theme_tokens` + existing tenant theme engine | see THEME_ENGINE.md |
| **Revision Service** | Per-entity revisions, diff, restore, autosave | `website_revisions` | append-only |
| **Versioning** | Site-level immutable version tags (publish points) | `website_publish_history` | monotonic version per site |
| **Localization Service** | Per-page/per-block translations, RTL/LTR, translation memory | `website_translations` | see LOCALIZATION_PLATFORM.md |
| **Rendering Engine** | Edge SSR/ISR of published snapshots → HTML+CDN | edge function + snapshot | see PART 14 |
| **Preview Engine** | Authenticated draft render (no cache), device frames, share links | edge function (auth) | preview reads draft, never cached |
| **Domain Service** | Subdomain + custom domain binding, DNS verification, ACME/SSL orchestration | `website_domains`, provider/edge | see WHITE_LABEL_WEBSITE.md |

## 2.2 Layering & boundaries (reuse the platform's existing architecture)
The platform already enforces **UI → Hooks → Services → Repositories → Supabase** with an
architecture guard (`scripts/check-architecture.cjs`). Website services obey the same rule:
- Admin UI (Website Center) → `website*.service.ts` → `website*.repository.ts` → Supabase.
- Public runtime never imports repositories; it calls the **Rendering Engine edge function**, which
  uses the service-role client to read only `status='published'` snapshots.
- All money/permission-sensitive mutations go through **SECURITY DEFINER RPCs** with idempotency —
  the Phase 9 pattern (atomic publish, atomic clone).

## 2.3 Cross-cutting integrations (the strict requirements)

| Concern | How Website OS integrates |
|---|---|
| **Multi-tenancy** | Every `website_*` table has `tenant_id`; RLS `tenant_id = public.auth_tenant()` (builds on `20260627000010_tenant_isolation_foundation`). Public reads go through the edge (service role) filtered to the resolved tenant + `published`. |
| **RBAC** | New `website.*` permission keys added to the Phase 9 `role_permissions` catalog (`20260705000006`). Page-level grants via `website_page_permissions`. Enforced by `auth_has_permission()` in RPCs + RLS. |
| **Localization** | `website_translations` keyed by (entity, locale, field); RTL from locale; reuses the app's i18n direction logic. |
| **SEO** | First-class `website_seo` + edge-rendered tags + sitemap/robots edge routes. |
| **White Label** | Per-tenant site/theme/media/domain; strict tenant isolation (no cross-tenant read). |
| **Media** | `website_media` over Supabase Storage with a transform pipeline + usage graph. |
| **Feature Flags** | `website_feature_flags` (per-tenant) gate blocks/capabilities (e.g. custom-code, marketplace). |
| **Analytics** | `website_page_analytics` ingestion via a lightweight edge beacon; dashboards in Website Center. |
| **Permissions** | Draft edit, publish, domain, theme, and custom-code are distinct permissions. |
| **Audit Logs** | Every publish/rollback/domain/permission change writes an `operation_events` row (reuse the existing audit timeline) + `website_publish_history`. |

## 2.4 Request lifecycle (public visit)
1. Visitor hits `brand.com/pricing`. Edge function resolves host → tenant via `website_domains`.
2. Edge looks up the **published snapshot** for (site_id, `/pricing`) — one row read, CDN-cached.
3. If cache miss: render HTML server-side from snapshot JSON (blocks → HTML, SEO tags, JSON-LD),
   set `Cache-Control` + `stale-while-revalidate`, store at CDN key `host:path`.
4. Dynamic-data blocks (Restaurants/Products/…) are resolved at render from the platform
   repositories **scoped to the tenant/country**, with short TTLs (ISR).
5. A publish or a scheduled publish **purges/revalidates** the affected CDN keys → live in seconds.

---

# PART 14 — Performance & Rendering (design)

**Targets:** 95+ Lighthouse, SSR, SSG/ISR, image optimization, code splitting, prefetch, caching.

| Capability | Design |
|---|---|
| **SSR** | Edge function renders published-snapshot → HTML. First paint is server HTML (no SPA blank). |
| **SSG** | Fully-static pages (no dynamic blocks) are pre-rendered at publish into the snapshot's `html` field and served straight from CDN. |
| **ISR** | Pages with dynamic blocks render on first request, cache with `stale-while-revalidate`, and revalidate on publish or TTL. |
| **Image optimization** | Media pipeline emits WebP/AVIF + responsive sizes; `<img>` uses `srcset`/`sizes`, `loading=lazy`, explicit width/height (CLS=0). |
| **Code splitting** | Public runtime ships a minimal hydration bundle; block components are dynamically imported per page (only used blocks load). |
| **Prefetch** | In-viewport internal links prefetch their snapshot JSON on hover/intersection. |
| **Caching** | Three tiers: CDN (HTML per host+path), snapshot table (denormalized JSON), and edge KV for hot tenants. Publish is the only cache-invalidation trigger. |
| **Budget** | Per-page JS budget enforced in CI (bundle-size gate); Lighthouse CI on a sample tenant per deploy. |

**Rendering stack recommendation:** because the app is a Vite SPA on Vercel, implement the Rendering
& Preview engines as **edge functions** (Vercel Edge or Supabase Edge/Deno) that emit HTML from the
snapshot. This avoids converting the admin app to Next.js while delivering true SSR/ISR for the
public sites. (Alternative considered: adopt Next.js for the public site only — heavier, deferred to
GAP/ROADMAP as an option.)

See: `WEBSITE_DATABASE_SCHEMA.md`, `PUBLISHING_ENGINE.md`, `WEBSITE_IMPLEMENTATION_ROADMAP.md`.
