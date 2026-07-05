# Final Website Platform Scorecard

> HaaT Now · Phase 10 · Design-phase scorecard. Two columns: **Current** (what exists today,
> evidence-cited) and **Designed** (the target this phase specifies). Scores 0–10 against an
> enterprise website-platform bar. This is a *design* scorecard — "Designed" scores are the
> achievable target if the roadmap is executed, not a claim of current capability.

## 1. Scores

| Dimension | Current | Designed | Notes |
|---|---:|---:|---|
| Persistence & Publishing | 1.0 | 9.0 | Current: localStorage + same-tab event (`website.service.ts:244-253`). Designed: DB snapshots + atomic idempotent publish + edge/CDN |
| Rendering & Performance | 2.0 | 8.5 | Current: client SPA, no SSR. Designed: edge SSR/ISR, image opt, 95+ Lighthouse target |
| Content Model (pages/blocks) | 4.0 | 8.5 | Good model exists; normalize + expand + versioned schemas |
| Visual Builder | 4.5 | 8.5 | Real editor today; add dynamic blocks, DnD RPC, global sections, custom registry |
| Theme Engine | 5.0 | 9.0 | Live re-skin already works; add persisted per-site token system + dark/light + marketplace |
| Media Library | 2.5 | 8.5 | Storage upload works; add tables, webp/avif, folders, usage, replace-everywhere |
| SEO | 2.0 | 9.0 | Client-only head + org JSON-LD today; add server SSR SEO, schemas, sitemap/redirects/score |
| Localization | 1.5 | 8.5 | AR/EN only, hand-wired dir; add per-block translations, RTL server-set, TM, per-locale snapshots |
| Publishing Workflow | 1.5 | 9.0 | Add draft/preview/approve/schedule/rollback, atomic, audited |
| Forms | 0.0 | 8.0 | None today; schema forms + spam + webhooks + onboarding routing |
| Analytics | 1.0 | 8.0 | Fire-and-forget seam only; add first-party per-page analytics + RUM |
| Multi-Tenancy & White Label | 2.0 | 9.0 | localStorage-shared today; per-tenant RLS, domain/SSL, isolation by design |
| Domains & SSL | 1.0 | 8.5 | Cosmetic string + manual dropdown; add DNS verify + ACME auto-SSL + renewal |
| RBAC & Audit | 2.0 | 8.5 | None website-specific today; `website.*` perms + page-level + `operation_events` audit |
| Differentiation (delivery blocks) | 0.0 | 9.5 | Unique: live stores/products/offers/drivers/maps wired to the platform |

## 2. Composite

- **Current Website Platform score: ~2.2 / 10** — a credible admin-UX prototype on a non-existent
  backend; publishing does not reach the live site.
- **Designed Website Platform score: ~8.7 / 10** — an enterprise, multi-tenant, edge-rendered
  Website OS whose unique moat (operationally-wired delivery blocks + true white-label) exceeds
  generic incumbents on the axes that matter for this business.

## 3. The three findings that define the gap
1. **Publishing is fictional today** — it moves data inside one browser (`website.service.ts:244`).
   The single most important design decision (Builder/Runtime split + published snapshot + edge)
   fixes this in Phase A.
2. **Nothing is server-persisted except media blobs** — no `website_*` tables exist (verified live).
   The schema (23 tables, all multi-tenant) is the foundation.
3. **The winning capability is unbuilt** — dynamic delivery-data blocks. This is where HaaT Now
   beats Shopify/Webflow/Wix and should be prioritized once the foundation lands (Phase D).

## 4. Readiness statement
This phase delivers **architecture + product design only** (16 documents in `docs/website/`). No
code was implemented, per the Phase 10 mandate. The design is internally consistent with the
platform's Phase 9 primitives (tenant RLS, `role_permissions`/`auth_has_permission`, atomic
idempotent RPCs, the scheduler, Supabase Storage, the tenant theme engine) and applies the Phase 8/
9.5 lessons (no `using(true)` policies, verify applied state, atomic publishing).

**Recommendation:** approve the architecture and begin **Phase A** (real persistence + publish that
goes live) — it is independently deployable, low-risk (additive + flagged), and converts the
Website Center from a demo into a functioning platform.

---

## Document index (docs/website/)
`WEBSITE_PLATFORM_ARCHITECTURE` · `WEBSITE_DOMAIN_MODEL` · `WEBSITE_DATABASE_SCHEMA` ·
`WEBSITE_BUILDER_SPEC` · `VISUAL_BUILDER_SPEC` · `THEME_ENGINE` · `MEDIA_LIBRARY` · `SEO_PLATFORM` ·
`LOCALIZATION_PLATFORM` · `PUBLISHING_ENGINE` · `WHITE_LABEL_WEBSITE` · `WEBSITE_ANALYTICS` ·
`WEBSITE_MIGRATION_PLAN` · `WEBSITE_GAP_ANALYSIS` · `WEBSITE_IMPLEMENTATION_ROADMAP` ·
`FINAL_WEBSITE_PLATFORM_SCORECARD`.
