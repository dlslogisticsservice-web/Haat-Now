# Website Platform — Deployment Plan

How the Website Platform ships **inside the existing repo/deployment**, how unlimited tenants/domains are served,
and how sites update without code deploys. Reuses the existing Vite build, Vercel hosting, provisioning engine,
and the three-environment model (Sandbox / Staging / Production).

## 1. Ships inside the existing app (no new project)
- The **Public Website Runtime** is a lazily-loaded route/surface in the existing `src/App.tsx` SPA
  (`PublicSiteApp`), built by the existing `npm run build` (Vite). No new repo, no new pipeline.
- The **Website Center** admin console is a new panel under the Admin Portal's Platform nav group — same bundle.
- One deployment serves the apps **and** every tenant site (multi-tenant by domain resolution).

## 2. Domain routing (unlimited domains)
```
*.haatnow.app            → Vercel wildcard domain → resolve subdomain(slug) → tenant
acme.com (custom)        → tenant adds domain in Website Center → website_domains row (pending)
                           → operator/tenant sets DNS (CNAME → cname.vercel-dns.com, TXT verify)
                           → verification_status=verified, ssl_status=active → routed to tenant
```
- **Wildcard subdomains**: one Vercel wildcard domain covers unlimited tenants with zero per-tenant deploy.
- **Custom domains**: added via the Vercel Domains API (or Cloudflare) at the **operator** level; `website_domains`
  tracks verification token, DNS records to set, and SSL status. Reuses `platform.service` env `domain` concept.
- Edge resolution maps host → `tenant_id` (a lightweight middleware/edge function reading `website_domains`).

## 3. No-code-deploy content updates
Per [WEBSITE_RUNTIME.md](WEBSITE_RUNTIME.md): theme/brand/CMS/page/design edits are **data** (Supabase rows /
CSS-var tokens), served at runtime. A **publish** bumps `published_version` → cache key changes → the site serves
new content on next load. **No bundle rebuild** for content/theme/brand/SEO. Only new *block types* or *page
kinds* (new renderer code) require a normal app deploy.

## 4. Provisioning (reuse the existing engine)
The `provisioning.service` **`cms` step already exists** ("Default site & pages"). Extend it (in a later sprint)
to also create a `website_sites` row + default `website_pages` from the template's `cms_structure.pages` and
`navigation`. Standing up a tenant therefore stands up its site automatically — no manual step.

## 5. SEO
- Per-tenant **`sitemap.xml`** and **`robots.txt`** generated from published pages (dynamic route or on-publish
  regeneration), extending the existing static `public/sitemap.xml`/`robots.txt`.
- Per-page `<title>`/meta/OG/canonical from the page `seo` field; `noindex` respected for draft/staging hosts.

## 6. Phased rollout (each phase = one governed sprint with its own release gate)
| Phase | Scope | Deploy |
|---|---|---|
| W1 | `website.service` + `website_*` schema + migrations (draft/publish/version) | preview |
| W2 | Website Center console (pages/nav/footer/hero/sections) — reuses Design Center/Assets/RBAC | preview |
| W3 | Public Website Runtime + wildcard subdomain routing | preview → prod |
| W4 | Blog / Help / Careers / Legal page kinds | preview |
| W5 | SEO + per-tenant sitemap/robots + cookie/consent + analytics injection | preview |
| W6 | Custom-domain management (verification + SSL) + provisioning extension | preview → prod |

## 7. Environments
| Env | Website source | Domains |
|---|---|---|
| Sandbox | `localStorage` website keys (preview only) | `?tenant=<slug>` / localhost |
| Staging | Supabase `website_*` (staging project) | staging subdomains |
| Production | Supabase `website_*` (prod project) | wildcard + verified custom domains |

## 8. Release gate (per the mandatory rule)
Every website sprint runs: **TypeScript · Lint · Production Build · existing E2E**. On green → commit, push to the
working branch, **Preview Deployment** (no auto-merge to production). On any failure → `IMPLEMENTATION_BLOCKERS_REPORT.md`
and stop. A `RELEASE_REPORT.md` is produced each sprint.

## 9. Rollback strategy
- **Content:** `website_page_history` → restore a prior published version (per-page, instant, no deploy).
- **Site:** flip `website_sites.status` to `draft`/`suspended` (takes the site offline instantly).
- **Domain:** unbind in `website_domains` (routing stops immediately).
- **Code (renderer):** `git revert <sha>` + redeploy the app bundle; feature-flag the public route so disabling it
  restores prior behavior (apps unaffected).

See: [WEBSITE_PLATFORM_ARCHITECTURE.md](WEBSITE_PLATFORM_ARCHITECTURE.md) · [WEBSITE_DATABASE.md](WEBSITE_DATABASE.md)
· [WEBSITE_PERMISSION_MODEL.md](WEBSITE_PERMISSION_MODEL.md).
