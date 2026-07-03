# Website Platform — Database

Proposed schema for the Website Platform, designed to **extend** the existing model, not replace it. Reuses the
`tenants` spine and mirrors the proven **`screen_experiences` + `screen_experience_history`** draft/publish/version
pattern. All new tables are additive, `IF NOT EXISTS`, tenant-scoped, and RLS-guarded — consistent with the 48
existing migrations. In **sandbox** these are mirrored as `localStorage` namespaces (dual-mode).

## 1. Reused (no change)
| Existing table / field | Role for websites |
|---|---|
| `tenants` — `slug`, `default_website`, `site_name`, `cms_structure`, `navigation`, `primary_color`, `favicon_url`, `logo_url`, `theme_preset_id`, `plan`, `status` | The site's owner + brand/theme/tier/status. Website settings hang off the tenant. |
| `screen_experiences` / `screen_experience_history` | The publishing **pattern** website tables mirror (draft/published/version/history). |
| `design_settings` / theme presets store | The look (Theme Engine). |
| `platform_providers` (analytics) | Website analytics config. |
| `subscriptions` / `memberships` | Website tier entitlements. |
| Storage buckets (`assets.service`, `storage.service`) | Media/logo/favicon/OG images. |

## 2. New tables (additive)

### `website_sites` — one per tenant
```
id uuid pk · tenant_id uuid fk→tenants · site_name text · default_locale text
brand jsonb            -- {colors, typography, logo_url, favicon_url, social{...}}  (denormalized cache of tenant brand)
seo_defaults jsonb     -- {title_suffix, description, og_image, twitter}
cookie jsonb           -- {enabled, policy_url, categories[]}
analytics jsonb        -- {provider_id, measurement_id}  (→ platform_providers)
status text            -- draft | published | suspended
published_version int  · created_at · updated_at
```

### `website_pages`
```
id uuid pk · site_id uuid fk→website_sites · tenant_id uuid
kind text              -- landing | standard | blog_index | help_index | careers | legal
path text              -- '/', '/about', '/pricing'    (unique per site)
title text · is_home bool · nav_order int
seo jsonb              -- {title, description, canonical, og_image, noindex}
draft_config jsonb     -- { sections: Block[] }
published_config jsonb -- { sections: Block[] }         (public runtime reads this)
version_number int · status text (draft|published|archived) · created_at · updated_at
```

### `website_page_history` (versioning / rollback — mirrors `screen_experience_history`)
```
id uuid pk · page_id uuid fk→website_pages · version_number int
config jsonb · published_at · published_by uuid
```

### `website_navigation` & `website_footer`
```
website_navigation: id · site_id · tenant_id · items jsonb (ordered links) · draft/published jsonb · version
website_footer:     id · site_id · tenant_id · columns jsonb · social jsonb · legal_links jsonb · draft/published jsonb · version
```

### `blog_posts`
```
id uuid pk · site_id · tenant_id · slug text (unique per site) · title · cover_url
body jsonb (Block[]) · excerpt · tags text[] · author text · seo jsonb
status text (draft|published|scheduled) · published_at · created_at · updated_at
```

### `help_articles`
```
id · site_id · tenant_id · category text · slug (unique per site) · title · body jsonb · seo jsonb
status · order int · created_at · updated_at
```

### `careers_postings`
```
id · site_id · tenant_id · title · location · employment_type · body jsonb · apply_url · status · created_at
```

### `legal_pages`
```
id · site_id · tenant_id · kind text (privacy|terms|refund|cookie) · title · body jsonb
effective_date date · version_number int · status · published_at
```

### `website_domains`  (custom-domain management — the key missing piece)
```
id uuid pk · tenant_id uuid fk→tenants · site_id uuid fk→website_sites
domain text unique               -- 'acme.com' or 'acme.haatnow.app'
is_primary bool · is_subdomain bool
verification_token text · verification_status text  -- pending | verified | failed
ssl_status text                  -- provisioning | active | error
dns_records jsonb                -- expected CNAME/TXT for operator/tenant
provider_ref text                -- external domain/DNS provider id (Vercel/Cloudflare)
created_at · verified_at
```

### `website_seo` (optional global/site-level; page-level SEO lives on the page row)
```
id · site_id · tenant_id · sitemap_enabled bool · robots txt · default_meta jsonb · updated_at
```

## 3. Conventions (match existing platform)
- **Draft/published/version + `*_history`** on every editable content table (safe editing + rollback), exactly as
  `screen_experiences`.
- **Tenant-scoped + RLS**: every row carries `tenant_id`; RLS restricts read/write to the owning tenant (public
  runtime reads only `published_config` of `status='published'`, `site.status='published'`). Consistent with the
  existing `security_hardening`/`rls_recovery` migrations.
- **Blocks are JSON** (`Block[]`) so new block types need no schema migration — only renderer code.
- **Media** referenced by URL from the existing buckets (no blobs in these tables).

## 4. Sandbox mirror (dual-mode)
`localStorage` namespaces (demo/preview only): `haat_sb_website_sites_v1`, `haat_sb_website_pages_v1`,
`haat_sb_website_domains_v1`, etc. — read/written by `website.service` when `VITE_AUTH_MODE=sandbox`, never in
live runtime.

## 5. Migration plan (additive)
One migration per programme sprint (timestamped, `IF NOT EXISTS`, RLS + indexes), never editing existing
migrations. Reconcile with the single-source `supabase/migrations/` set. No change to any existing table's shape;
`tenants` already exposes the website fields used here.

See: [WEBSITE_PLATFORM_ARCHITECTURE.md](WEBSITE_PLATFORM_ARCHITECTURE.md) · [WEBSITE_RUNTIME.md](WEBSITE_RUNTIME.md).
