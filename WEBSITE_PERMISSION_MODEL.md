# Website Platform — Permission Model

Access control for the Website Platform **extends the existing RBAC** (`rbac.service` + `useRbac`/`<Can>`) and the
existing **Subscription** tiering — no parallel permission system. Server-side enforcement is Supabase **RLS**
(consistent with the Production Activation sprint); the client `<Can>` gates the UI.

## 1. New permission group + keys (added to `PERMISSIONS` in `rbac.service`)
Group: **`website`** (mirrors the real module, like `platform`/`security`).

| Key | Purpose |
|---|---|
| `website.view` | View the Website Center |
| `website.pages.manage` | Create/edit pages, sections, hero, nav, footer |
| `website.blog.manage` | Manage blog posts |
| `website.help.manage` | Manage Help Center articles |
| `website.careers.manage` | Manage careers postings |
| `website.legal.manage` | Manage legal pages (privacy/terms/refund/cookie) |
| `website.seo.manage` | Manage SEO + sitemap/robots + analytics/consent |
| `website.domains.manage` | Add/verify custom domains |
| `website.publish` | Publish/rollback site content (the gate for going live) |

`website.*` are added to the catalog **in the same commit** as the implementation (per the Implementation
Standard §7), reusing the existing `Permission`/`PermissionGroup` structures.

## 2. Mapping to existing role templates (`ROLE_TEMPLATES`)
| Role template | Website permissions |
|---|---|
| `super_admin` | `*` (all, incl. `website.domains.manage`, `website.publish`) |
| `country_manager` | `website.view`, `website.pages.manage`, `website.blog.manage`, `website.help.manage`, `website.legal.manage`, `website.publish` |
| `marketing_manager` | `website.view`, `website.pages.manage`, `website.blog.manage`, `website.seo.manage` (no publish-to-domain / no domains) |
| `support_agent` | `website.view`, `website.help.manage` |
| `compliance_officer` | `website.view`, `website.legal.manage` |
| `merchant_owner` (tenant-scoped) | `website.view`, `website.pages.manage`, `website.blog.manage`, `website.publish` — **scoped to their own tenant** |
| others | `website.view` only or none |

Domain management (`website.domains.manage`) is intentionally **super/platform-only** by default (DNS + SSL are
platform operations).

## 3. Enforcement (two layers, reused)
- **UI:** `<Can perm="website.pages.manage">…</Can>` / `useRbac().can()` — identity-driven in live (Production
  Activation sprint), acting-role preview in sandbox. No new guard component.
- **Server (authoritative):** Supabase **RLS** on the `website_*` tables — tenant-scoped read/write; the public
  runtime may read only `published` rows. Mirrors the existing `admin_rls_policies`/`security_hardening` approach.

## 4. Subscription tiering (reuse `subscription.service`)
Website capability is gated by plan features (via `subscription.usageGuard`/`planFeatures`), **not** by inventing
new limits:

| Plan | Website entitlement (feature flags) |
|---|---|
| `free` | No public site (or a single HAAT-branded landing) |
| `starter` | Website + core pages (home/about/contact) + SEO basics |
| `business` | + Blog + Help Center + Careers + analytics |
| `enterprise` | + Custom domain(s) + unlimited pages + white-label removal of HAAT branding |

A `website.publish` action checks the tenant's plan feature (e.g. `features_json.website`, `features_json.custom_domain`)
before allowing publish/domain binding — reusing the existing subscription feature model.

## 5. Multi-tenant scoping
- Platform admins (super/country) manage the HAAT NOW site and, per scope, tenant sites.
- A tenant's own admins (`merchant_owner`) manage **only their** site — enforced by `tenant_id` on every
  `website_*` row + RLS, and by the tenant context already carried in the session.

## 6. What is NOT added
- No new roles engine, no new guard, no new subscription engine, no new audit log — all reused
  (`operation_events` records website publish/domain events, like other lifecycle actions).

See: [WEBSITE_DATABASE.md](WEBSITE_DATABASE.md) · [WEBSITE_PLATFORM_ARCHITECTURE.md](WEBSITE_PLATFORM_ARCHITECTURE.md).
