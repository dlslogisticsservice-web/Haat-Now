# HaaT Now Website — Launch Checklist (Wave 2)

> Steps to take the official HaaT Now website live on the Website Platform. Everything is built and
> tested behind feature flags; launch = apply migrations, seed, publish, render at the edge, and flip
> flags — reversible at every step.

## 0. Prerequisites
- [ ] Website Platform migrations applied to staging at head: Wave 0 `20260705000100`, Wave 1
  `20260705000200`, **Wave 2 `20260705000300`** (conversion rules + analytics events).
- [ ] `pg_policies` + `get_advisors(security)` reviewed for the new tables (tenant RLS, no anon, no
  `using(true)`).

## 1. Seed the official site
- [ ] Run `seedHaatSite(ctx, op)` for the HaaT tenant → creates `website_sites` + 19 pages + sections
  + blocks + SEO (draft). Verify 19 pages persisted.
- [ ] Assign the tenant theme tokens (Wave 1 theme tokens) — optional; defaults apply otherwise.

## 2. Publish
- [ ] `PublishingEngine.publish({ scope:'full', idempotencyKey })` → snapshot v1 stored, publish
  history recorded, `website.publish.completed` emitted.
- [ ] Verify `validateSnapshotIntegrity` passed and `SnapshotStore.verify()` is true.

## 3. Render / SEO
- [ ] `renderStatic(snapshot)` (or edge `render(context)`) produces HTML for all 19 pages.
- [ ] `validateSeo(snapshot)` returns **0 issues** (titles ≤65, descriptions 50–165, canonical set).
- [ ] `generateSitemap` + `generateRobots` served at `/sitemap.xml` + `/robots.txt` (edge routes).
- [ ] JSON-LD present per page (Organization, WebSite, Breadcrumb; FAQPage on FAQ/Help).

## 4. Ordering
- [ ] Website ordering (`AppServicesOrdering`) verified against the app backend (browse → cart →
  checkout → track) in staging — same `orderService.createOrder` path, no duplicated logic.

## 5. App Conversion Engine
- [ ] Configure conversion rule(s) in Website Center (title/body/CTAs/media/coupon/deep-links/store
  links for Play + App Store + AppGallery/targeting/triggers/frequency).
- [ ] Verify deferred deep linking: installed → resumes in-app; not installed → store; post-install →
  resume via token.
- [ ] Confirm targeting (country/language/device/new-returning) and frequency caps behave.

## 6. Analytics
- [ ] Beacon ingests to `website_analytics_events`: visits, funnel steps, conversion, app-download
  clicks, app opens, checkout abandonment, coupon usage, deep-link success.
- [ ] Conversion-Engine performance (`conversionPerformance`) + funnels (`computeFunnel`) render in
  the dashboard.

## 7. Domains / performance (later-wave edge, referenced)
- [ ] `haatnow.app` (and any custom domain) routed to the edge renderer; SSL active.
- [ ] Lighthouse ≥95 on Home + a category page; images fingerprinted + lazy; cache manifest honored.

## 8. Flip flags (per tenant)
- [ ] `website.db_backend`, `website.publishing_engine`, `website.render_public`, `website.ordering`,
  `website.conversion_engine`, `website.analytics` → enabled for the HaaT tenant.
- [ ] Monitor; rollback = disable the flag (instant) or `PublishingEngine.rollback(toVersion)`.

## 9. Sign-off gates (all green in this repo)
- [x] lint (tsc + architecture guard) · typecheck · build · build:live · **test:website 95/95** · **E2E 24/24**.
- [x] No `any`, no TODO, no dead code, no duplicate logic, no architecture violations.
- [x] 100% reusable for white-label tenants (tenant-scoped, brand-agnostic).

## Rollback strategy
Every step is additive + flagged. Disable the tenant flags → back to the legacy Website Center
instantly. `PublishingEngine.rollback` reverts the live snapshot to any prior version. Migrations are
additive (empty tables if unused) — zero data loss.
