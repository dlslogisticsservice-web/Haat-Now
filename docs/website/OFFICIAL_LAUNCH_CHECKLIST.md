# Official HaaT Now Website — Launch Checklist

> Gate for taking the official HaaT Now public website live. The website is the
> reference implementation every future tenant inherits, so every item here becomes a
> template obligation. All Wave 4 capabilities ship behind flags that default **OFF**;
> "launch" = flipping the relevant flags for the HaaT Now tenant only.

## 0. Pre-flight (must all be green)
- [ ] `npm run lint` (tsc + architecture guard) — 0 errors, 0 feature→lib/supabase imports.
- [ ] `npm run test:website` — 116/116 passing.
- [ ] `npm run build` (sandbox/demo) — succeeds, bundle unchanged for legacy paths.
- [ ] `npm run build:live` — succeeds with live env wiring.
- [ ] E2E runner (`node docs/testing/e2e_runner.cjs`) — 24/24.
- [ ] Migration `20260705000500_website_experience.sql` applied to staging + verified (RLS, no anon, no `using(true)`).

## 1. Customer journey — end to end, no app required
- [ ] **Discover** — homepage renders from `resolveHomepage()`; hero + collections + promos load.
- [ ] **Browse** — category and collection pages populate from the ordering port.
- [ ] **Search** — autocomplete, recent, popular, trending, nearby all return results.
- [ ] **Choose merchant / products** — merchant page, menu, product detail complete (no placeholders).
- [ ] **Checkout** — cart → address → payment → confirm, reusing the app checkout backend.
- [ ] **Track** — live ETA / driver / status via realtime port (or polling fallback).
- [ ] **Review** — order rating + merchant review submit and persist.
- [ ] **Manage account** — every Customer Portal tab loads real data (Orders, Wallet, Loyalty, Notifications, Addresses, Payment Methods, Invoices, Support, Refunds, Subscriptions, Downloads).
- [ ] **Promotions** — banners resolve per placement/targeting/schedule; coupon applies at checkout.

## 2. Configurability (nothing hardcoded)
- [ ] Homepage sections show/hide/reorder/schedule/personalize/flag from Website Center.
- [ ] Navigation header/footer/mega-menu editable; breadcrumbs derive from pages.
- [ ] Collections definitions (kind + params) editable; resolve against live pool.
- [ ] Promotion banners (placement/priority/targeting/schedule/content/CTA) editable.
- [ ] Search popular/trending terms editable via `SearchConfig`.
- [ ] Brand (name/currency/support email/tax note) drives invoices + shell.

## 3. Content completeness
- [ ] Every production page reviewed — no `TODO`, no lorem, no "coming soon".
- [ ] All 19 official-site pages published and reachable from navigation or footer.
- [ ] Legal pages (Terms, Privacy, Refund) present with adequate copy (SEO min length).
- [ ] 404 and empty states use `EmptyState` primitive, not blank screens.

## 4. Flags & rollout
- [ ] Confirm all Wave 4 flags default OFF globally (`StaticFlagResolver([])`).
- [ ] Enable per-tenant rules for HaaT Now only: `homepage_builder`, `dynamic_nav`, `search`, `collections`, `promotions`, plus prior `site_frontend`, `customer_portal`, `marketing`, `pwa`, `conversion_engine`.
- [ ] Verify legacy Website Center still loads unchanged for all other tenants.
- [ ] Rollback plan: flip flags OFF → site reverts to prior path with zero data loss.

## 5. Sign-off
- [ ] SEO checklist passed (`SEO_CHECKLIST.md`).
- [ ] Accessibility checklist passed (`ACCESSIBILITY_CHECKLIST.md`).
- [ ] Performance checklist passed (`PERFORMANCE_CHECKLIST.md`).
- [ ] Production checklist passed (`PRODUCTION_CHECKLIST.md`).
- [ ] Owner approval recorded with date + commit SHA.
