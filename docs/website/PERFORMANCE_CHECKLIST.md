# Performance Checklist — Official HaaT Now Website

> Targets: **95+ Lighthouse Performance**, **90+ Best Practices**, Core Web Vitals in
> the "good" band. The platform module is tree-shaken until flags enable it, so the
> baseline bundle is unchanged — this checklist protects the flagged-on experience.

## Core Web Vitals
- [ ] LCP ≤ 2.5s (hero image/text is the LCP element; preloaded, not lazy).
- [ ] CLS ≤ 0.1 (reserved dimensions via `Skeleton`/`SkeletonGrid`; no layout shift on load).
- [ ] INP ≤ 200ms (autocomplete + filters debounced; no long tasks on input).
- [ ] TTFB ≤ 0.8s (served from published snapshot / edge, not runtime compile).

## JavaScript
- [ ] Route-level code splitting; portal/checkout not in the homepage bundle.
- [ ] Wave 4 `website-platform` verified tree-shaken out when flags OFF (bundle byte-identical to pre-Wave-4 baseline).
- [ ] No duplicate deps; search/collections reuse shared engine (no logic duplication → no dead weight).
- [ ] Third-party scripts deferred/async; none block main thread.

## Images & media
- [ ] Responsive images (`srcset`/`sizes`), modern formats (WebP/AVIF), correct dimensions.
- [ ] Below-the-fold images lazy-loaded; hero eager + `fetchpriority=high`.
- [ ] Icons inlined/SVG sprite, not individual network requests.

## Network & caching
- [ ] Static assets fingerprinted + immutable cache headers.
- [ ] Snapshot HTML cached at edge with revalidation on publish.
- [ ] Fonts: `font-display: swap`, preloaded, subset; no FOIT.
- [ ] Realtime uses subscriptions where available; `createPollingSubscription` interval ≥ 15s for availability/inventory to bound request volume.

## Runtime
- [ ] `resolveHomepage` / `resolveBanners` / `resolveCollection` run over bounded lists (page-size capped in repos, `pageSize: 100–200`).
- [ ] No N+1 fetches on homepage; collections hydrate from a shared pool fetch.
- [ ] PWA service worker caches shell + offline fallback (Wave 3).

## Best Practices (Lighthouse)
- [ ] HTTPS everywhere; no mixed content.
- [ ] No console errors; no deprecated APIs.
- [ ] Correct `charset`, `viewport`, `Content-Security-Policy` present.
- [ ] Images have explicit width/height.

## Verification
- [ ] Lighthouse Performance ≥ 95 and Best Practices ≥ 90 (mobile profile) on Home, Merchant, Search, Collection.
- [ ] WebPageTest / field data (CrUX) confirms lab results after 28-day window.
- [ ] Bundle-size report diffed against baseline; flagged-off delta = 0.
