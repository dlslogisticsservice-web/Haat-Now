# Official HaaT Now Website — Experience (Wave 3)

> The production public website: premium UX, realtime, ordering, customer portal, growth
> engine, PWA and SEO — all on the frozen foundation, additive, flag-gated. The HaaT site is
> the first Website / first Tenant / first CMS+Publishing consumer / first white-label template.

## What ships in Wave 3
| Part | Delivered |
|---|---|
| 1 Production frontend | Premium site shell (`src/features/site/SiteApp.tsx`) rendering any published `SiteSnapshot` (reuses the ONE `SnapshotRenderer`), nav/header/footer, 19 content pages (Wave 2) + marketing pages (Part 8) |
| 2 Premium UX | Reusable primitives (`features/site/ui/primitives.tsx`): GlassCard, Skeleton/SkeletonGrid, EmptyState, Spinner, PrimaryButton, Badge, AnimateIn — CSS-var themed, accessible, keyboard-navigable, responsive, reduced-motion aware |
| 3 Realtime | `RealtimePort` (`realtime/realtime.ts`) reusing the app's order/driver-location/tracking/notification channels |
| 4 Customer portal | `CustomerPortalPort` (`portal/portal.ts`) over the app services — wallet/loyalty/orders/favorites/notifications |
| 5 App Growth Engine | Config-driven multi-campaign platform (`growth/campaign.ts`) — see `APP_GROWTH_ENGINE.md` |
| 6 Smart Checkout Migration | Value-based, never-force, coupon-injecting (`growth/checkout-migration.ts`) — see `CHECKOUT_MIGRATION.md` |
| 7 Experimentation | A/B variants + winner detection (`growth/experiments.ts`) |
| 8 Marketing platform | Landing/campaign/referral/partner/city/collection/seasonal pages (`marketing/marketing.ts`) — see `MARKETING_PLATFORM.md` |
| 9 PWA | Manifest + service worker + install prompt (`pwa/pwa.ts`) — see `PWA_IMPLEMENTATION.md` |
| 10 SEO excellence | Server-rendered SEO + JSON-LD + sitemap + launch validation (Wave 2 `seo/seo.ts`) |

## Success criteria (customer can, without the app)
- **Discover / browse / search / order / pay / track**: the `WebsiteOrderingPort` (Wave 2) drives
  browse → cart → checkout → track over the **same app backend** (no duplicated logic).
- **Account / support**: the `CustomerPortalPort` exposes wallet/loyalty/orders/favorites/
  notifications; support/contact via content pages + forms.
- **Realtime**: live driver position, ETA, delivery status, live notifications via `RealtimePort`.

## Premium UX — benchmarked against Talabat / Jahez / Uber Eats / DoorDash / Deliveroo
Glass surfaces + depth, skeleton loading (never blank), smart empty states with a next action,
micro-interactions (press/scale, fade/slide-in), sticky glass header, mobile-first responsive grid,
RTL/LTR, WCAG-minded (roles, `aria-*`, focus, Escape-to-close, reduced-motion).

## Architecture & safety
- The frontend lives in `src/features/site/` and **never imports `lib/supabase`** (architecture
  guard passes) — it uses services + platform modules.
- It reuses the **single** `SnapshotRenderer` (SPA injects the exact HTML the edge serves) — no
  duplicate rendering logic.
- Wave 3 is **additive + unwired + flag-gated**: the shipped app (customer/merchant/driver/admin)
  is byte-identical; **E2E 24/24** unchanged. Mounting the site frontend for public-site requests is
  a flagged launch step (`website.site_frontend`).

## Reusability
Nothing is HaaT-specific: the shell renders any tenant's snapshot; growth/marketing/portal/realtime/
PWA are tenant-scoped and brand-driven. The HaaT site is the reference **white-label template**.

## Lighthouse
Design targets 95+ perf / 100 SEO: edge SSR, small hydration, fingerprinted lazy images, cache
manifest, server-rendered SEO + JSON-LD. Lighthouse should be run on a deployed sample tenant (this
environment has no perf harness beyond the Puppeteer E2E smoke).
