# Website Builder Spec — Pages, Routing & Forms

> HaaT Now · Phase 10 · Design only. Covers Part 4 (Website Builder) and Part 12 (Forms Platform).

## 1. Page operations (Part 4)

| Operation | Behaviour | Backend |
|---|---|---|
| **Create Page** | new `website_pages` row (draft); optional from-template payload | Page Service RPC |
| **Delete Page** | soft-delete (status → deleted); null nav refs; auto-create redirect stub; block if it's the home page | RPC (transactional) |
| **Duplicate Page** | deep-copy page → sections → blocks → seo with new ids; slug `-copy` | RPC (Phase 9 clone pattern) |
| **Draft** | default state; only editors see it (preview) | RLS: `website.edit` |
| **Publish** | include page in the next site snapshot compile; instant CDN revalidate | Publishing Engine |
| **Unpublish** | remove page from the published snapshot; serve 404/redirect | Publishing Engine |
| **Schedule Publish** | set `publish_at`; scheduler flips to published + revalidates | pg_cron / scheduled edge (Phase 9 scheduler) |
| **Restore Version** | restore a `website_revisions` snapshot → new revision (never mutate history) | Revision Service |
| **Clone Website** | deep-copy an entire site (pages/sections/blocks/nav/theme/seo/media refs) to a new site/tenant | atomic RPC |
| **Page Ordering** | `position` reorder within a parent; single transactional reorder RPC | CMS Service |
| **Nested Pages** | `parent_id` tree; full path derived by walking parents | Page Service |
| **Slug Management** | unique per (site, locale, parent); slug change auto-creates 301 redirect | Page Service + Redirects |
| **Breadcrumbs** | derived from the page tree; emitted as BreadcrumbList JSON-LD | SEO Service |
| **Dynamic Routes** | `route_type='dynamic'` + `data_source` (blog, or a tenant-scoped platform query) | Rendering Engine |

### 1.1 Routing model
- Path = `/` + join(slugs from root to page). Home page = empty slug at root.
- **Reserved system routes**: `/sitemap.xml`, `/robots.txt`, `/404` — served by the edge, never
  user-editable as content pages.
- **Dynamic route resolution**: `/blog/:slug` → look up the blog post; `/stores/:city` → a
  tenant+country-scoped query against the platform's merchant repository, rendered through a
  dynamic block. Dynamic routes are ISR-cached with a short TTL.
- **Locale routing**: default locale served at root; secondary locales at `/{locale}/…` or a
  locale subdomain (configurable per site). See `LOCALIZATION_PLATFORM.md`.

### 1.2 Slug & redirect safety
- Changing a slug writes a `website_redirects` 301 (old path → new path) automatically.
- Nav & internal links reference `page_id`, so a slug change never yields a broken menu.
- A broken-link scan (SEO Platform) flags any content link whose target page no longer exists.

## 2. Forms Platform (Part 12)

### 2.1 Form kinds (first-class, platform-integrated)
`contact`, `support`, `merchant_app`, `driver_app`, `newsletter`, `feedback`, `booking`, `custom`.
Merchant/driver application forms can **feed the existing onboarding/KYC pipeline** (create a
`kyc_reviews`/application record) instead of a dumb inbox — a differentiator vs generic CMS forms.

### 2.2 Schema-driven fields
`website_forms.schema` is a JSON array of field defs: `{ key, label, type, required, validation,
options, i18n }`. Field types: text, email, phone, textarea, select, multiselect, checkbox, radio,
date, file (→ Media Service), hidden, consent. Validation runs **client and server** (never trust
the client — the Phase 8 lesson).

### 2.3 Submission pipeline
```
Visitor submits → edge form endpoint
  → spam check (honeypot + Turnstile/reCAPTCHA score)
  → server-side validation against form schema
  → insert website_form_submissions (tenant-scoped, RLS)
  → side effects: notify_emails, webhook_url (signed, retried), and
     kind-specific routing (merchant_app → onboarding; newsletter → CRM segment)
  → return success / localized errors
```

### 2.4 Spam protection & abuse
- Honeypot field + time-to-submit heuristic + optional Cloudflare Turnstile / reCAPTCHA.
- Rate limiting per IP-hash + per form (reuse a platform rate-limit primitive).
- Submissions store `ip_hash` (not raw IP) and `user_agent`; `spam_score` retained for triage.

### 2.5 Webhook integration
- Per-form `webhook_url` receives a **signed** payload (HMAC-SHA256, the payment-webhook pattern),
  with retry + dead-letter. Delivery logged for audit.

### 2.6 Permissions & audit
- Viewing submissions requires `website.forms.view`; export requires `website.forms.export`.
- Form create/edit requires `website.forms.manage`. All gated by `auth_has_permission` (Phase 9).
- Submission reads are tenant-isolated by RLS; no cross-tenant access.

## 3. Builder UX principles
- **Autosave** drafts (debounced) → `website_revisions` checkpoint on every meaningful change.
- **Optimistic UI** with server reconciliation; conflict detection via `updated_at` (last-writer
  warning, not silent overwrite).
- **Undo/redo** backed by the revision stack.
- **Keyboard-first** block ops; drag-and-drop reorder (persisted via the reorder RPC).
- **Roles in the builder**: an editor with only `website.edit` can save drafts but the Publish
  button is disabled unless they also hold `website.publish` (or an approval flow is configured).
