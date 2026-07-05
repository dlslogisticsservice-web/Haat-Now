# White-Label Website

> HaaT Now · Phase 10 · Design only (Part 10). Every tenant owns a fully isolated website:
> theme, pages, media, SEO, navigation, domain, logo, brand, fonts, colors, templates — and
> **no tenant can access another tenant's data**. This closes the Phase 8 white-label gap
> (provisioning was localStorage-only and the provisioner wrote non-existent tenant columns —
> fixed in Phase 9 `20260705000001`).

## 1. Ownership model — what each tenant owns
| Asset | Table | Isolation |
|---|---|---|
| Site(s) | `website_sites` | `tenant_id` RLS |
| Theme + tokens | `website_themes/theme_tokens` | `tenant_id` RLS |
| Pages/sections/blocks | `website_pages/sections/blocks` | `tenant_id` RLS |
| Media | `website_assets/media` | `tenant_id` RLS + storage path namespaced by tenant |
| SEO/redirects | `website_seo/redirects` | `tenant_id` RLS |
| Navigation/menus | `website_navigation/menus` | `tenant_id` RLS |
| Domain | `website_domains` | `tenant_id` RLS; host globally unique |
| Logo/brand/fonts/colors | tenant record + `website_theme_tokens` | `tenant_id` RLS |
| Templates | `website_templates` (private/tenant scope) | `tenant_id` RLS |

## 2. Isolation guarantees (the hard requirement)
- **DB layer**: every `website_*` table enforces `tenant_id = public.auth_tenant()` (RLS), building
  on the Phase 9 tenant foundation. There is **no `using(true)` policy** anywhere in Website OS
  (the Phase 8/9.5 lesson — permissive policies leaked PII).
- **Render layer**: the edge resolves host → exactly one tenant via `website_domains`, then reads
  only that tenant's published snapshot (service role, filtered). A request to `brandA.com` can
  never load brandB content, theme, or media.
- **Media layer**: storage paths are `tenant_id/…`; signed/deterministic URLs; website bucket
  listing disabled (fixes the Phase 9.5 advisor "public bucket allows listing" finding).
- **Template/theme marketplace**: installing a shared template **clones** its payload into the
  tenant (an isolated copy) — never a shared mutable reference.

## 3. Domain Service (subdomain + custom domain)
State machine (`website_domains.status`):
```
pending → verifying → verified → ssl_pending → active(live)   (→ failed on error)
```
- **Subdomain** (`brand.haatnow.app`): auto-provisioned at site create (already the cosmetic
  behavior today, `website.service.ts:155`) — now backed by a real DNS wildcard + edge routing.
- **Custom domain** (`brand.com`):
  1. Tenant adds the host → we issue DNS records (CNAME/A + TXT verify token).
  2. Verification job polls DNS until the TXT/CNAME resolves → `verified`.
  3. **ACME/SSL**: request a certificate (via the hosting platform's cert automation or ACME);
     on issue → `ssl_pending` → `active`. This is the piece that is entirely missing today
     (SSL is a manual dropdown, `WebsiteCenter.tsx`).
  4. Edge routing maps the host → tenant/site for rendering.
- **Renewal**: `ssl_expires_at` tracked; the Phase 9 scheduler triggers renewal ahead of expiry.
- **One primary domain per site** + aliases (which 301 to primary for SEO).

## 4. Provisioning integration (fix the Phase 8 gap end-to-end)
When a tenant is provisioned (the existing `provisioningService` orchestrator), the website step
now:
1. creates a `website_sites` row (real table, not localStorage),
2. seeds default pages/sections/blocks from the chosen template (`website_templates`),
3. binds the `brand.haatnow.app` subdomain (`website_domains`),
4. installs the tenant's theme tokens (`website_themes/theme_tokens`) from the brand,
5. publishes an initial snapshot so the site is **live immediately**.
This turns provisioning from "sets flag fields" into "produces a real, reachable, isolated website"
— the Phase 8 WHITE_LABEL_READINESS deliverable.

## 5. Per-tenant capability gating
- `website_feature_flags` (per site/tenant) gate advanced capabilities: custom code, custom
  component registry, multi-site, extra locales, marketplace publishing.
- Plan limits (from the subscription model) cap pages/media/domains/bandwidth per tenant.

## 6. Franchise / multi-site
- A tenant may own **N sites** (franchise brands, country microsites). Each site is independently
  themed, domained, and published, but shares the tenant's media library and template pool
  (configurable). RLS is per tenant; site scoping is by `site_id`.

## 7. Audit & compliance
- Domain binds, SSL issuance, publishes, and permission changes all write `operation_events` audit
  rows. Tenant data export (all `website_*` for a tenant) supports portability/GDPR; deletion
  cascades via `on delete cascade` from `website_sites`/`tenants`.
