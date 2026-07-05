# Visual Builder Spec — Block Editor & Component System

> HaaT Now · Phase 10 · Design only (Part 5). A block-based visual editor with a validated
> component registry, dynamic platform-data blocks, reusable/global sections, and a custom
> component registry.

## 1. The block model
A **block** is `{ type, props, position, visibility, enabled }`. `type` must exist in
`website_component_library`; `props` are validated against that component's JSON-schema. This gives:
- **Auto-generated edit forms** (schema → form fields) — no bespoke editor per block.
- **Forward-compat**: unknown/legacy props are preserved, not dropped, across versions.
- **Safe rendering**: the renderer only mounts registered components; arbitrary types are ignored.

The current system's 12 presentational blocks (`website.service.ts:26-39`) become the seed of the
registry; this spec adds the missing content, commerce, dynamic, form, and advanced blocks.

## 2. Block catalog (Part 5)

### 2.1 Layout & content (presentational)
Hero · Banner · Image · Gallery · Video · Text · Rich Text · Heading · Button · Feature Cards ·
Pricing · Testimonials · FAQ · Timeline · Statistics.
*(Hero, Features/Cards, Stats, Testimonials, FAQ, Gallery, Rich Text already exist and migrate
directly; Banner, Image, Video, Heading, Button, Pricing, Timeline are new.)*

### 2.2 Dynamic commerce blocks (**the strategic differentiator** — pull live platform data)
These do not exist today. Each resolves at render time from the platform's existing repositories,
**scoped to the site's tenant + country**, and is ISR-cached:

| Block | Data source (existing platform) | Scoping |
|---|---|---|
| **Restaurants / Stores** | `merchant.repository` / `catalog.repository` | tenant + country + zone/city filter |
| **Products** | `product.repository` | merchant/category filter |
| **Offers / Coupons** | `coupon.service` / promotions | active + country |
| **Categories** | catalog categories | tenant |
| **Cities** | `config/countries` + zones | country |
| **Drivers / Partners** | drivers / partner logos | aggregate/marketing only (no PII) |
| **Maps** | Google Maps (`@vis.gl/react-google-maps`) | zone/branch coordinates |

**Isolation rule:** dynamic blocks may only read data belonging to the site's tenant/country, and
**never PII** (respecting the Phase 9 PII lockdown — e.g. a "Drivers" block shows counts/marketing,
not driver phone numbers). Enforced server-side in the render resolver.

### 2.3 Form & interaction blocks
Contact Form · Newsletter · (any `website_forms` form embedded by key) — see Forms Platform.

### 2.4 Advanced blocks (gated by feature flag + permission)
- **Custom HTML** — sanitized, sandboxed; gated by `website.custom_code` flag + permission.
- **Custom React Component Registry** — tenants/agencies register vetted components (see §5).
- **Reusable Sections** — a `scope='local'` section saved as a template for re-insertion.
- **Global Sections** — a `scope='global'` section shared by reference across pages; editing it
  updates every page that includes it (header/footer/CTA banners).

## 3. Editor experience
- **Canvas**: WYSIWYG live preview using the same renderer as production (the existing
  `BlockRenderer` pattern, `blocks.tsx`), with device frames (desktop/tablet/mobile) — the current
  editor already has device preview; this generalizes it.
- **Inspector**: schema-driven props form + style controls (spacing, background, alignment) +
  per-device visibility toggles (already modeled as `BlockVisibility`).
- **Insert**: block palette grouped by category; section templates (SaaS/Product/Simple exist
  today, `WebsiteCenter.tsx`) expand into a full library.
- **Drag & drop**: reorder blocks/sections; move between sections; reorder persisted via a single
  transactional RPC (no partial trees).
- **Inline editing**: text/heading blocks edit in place; rich-text via a controlled editor emitting
  sanitized HTML/portable-text.
- **Selection & structure tree**: an outline panel (page → sections → blocks) for large pages.
- **Responsive**: edit per-breakpoint overrides; visibility per device.

## 4. Component library governance
- `website_component_library` is the single registry; each entry carries `schema`, `category`,
  `is_dynamic`, `min_plan`, `feature_flag`, `version`.
- **Versioned schemas**: bumping a component's version provides a migration function for stored
  props (never break existing pages).
- **Plan/flag gating**: e.g. Custom Code and the Custom Component Registry require a plan +
  `website_feature_flags` state; enforced at insert and at render.

## 5. Custom React Component Registry (advanced, gated)
For agencies/enterprise tenants who need bespoke components:
- A component is registered as `{ type, schema, bundle_url (signed), version, sandbox: true }`.
- Rendered in an **isolated boundary** (error-boundary + sandbox) so a faulty custom component
  cannot crash the page or read other tenants' data.
- Server render executes only **allow-listed, reviewed** bundles; untrusted tenant code is
  client-only + sandboxed. (Security-reviewed pipeline; disabled by default.)

## 6. Rendering contract
- One renderer, two modes: **edit** (interactive, in the SPA) and **published** (edge SSR from
  snapshot). Both consume the same block schema, guaranteeing preview == production.
- Each block component declares: its schema, an SSR render fn (HTML), and an optional hydration
  fn (interactivity). Static blocks emit zero JS; interactive ones hydrate island-style.
