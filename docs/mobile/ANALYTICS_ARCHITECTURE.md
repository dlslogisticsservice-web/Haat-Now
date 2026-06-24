# Analytics & Crash Reporting Architecture (Task H)

**Date:** 2026-06-24 · Design only (architecture, no SDK wired yet).

## Stack
| Concern | Tool | Scope |
|---|---|---|
| Product analytics | **Firebase Analytics** (GA4) | events + screens, native + web |
| Crash reporting | **Firebase Crashlytics** (native) | Android/iOS crashes + ANRs |
| Error + performance (web/JS) | **Sentry** | JS exceptions, React error boundary, web vitals, releases |
| Performance | Firebase Performance + Sentry transactions | network/render traces |

## Abstraction layer (single seam — `src/services/analytics-client.ts`, future)
One thin wrapper so screens never import a vendor SDK directly:
```ts
analytics.screen(name)            // screen tracking
analytics.track(event, props)     // event tracking
analytics.setUser(id, role)       // identity (no PII beyond id/role)
analytics.error(err, context)     // -> Sentry + Crashlytics
```
Implementation swaps Firebase (native via Capacitor community plugin) vs web SDK behind the same interface.
The existing **`ErrorBoundary.onError`** hook is the wiring point for crash/error capture.

## Event taxonomy (initial)
| Category | Events |
|---|---|
| Funnel | `view_home`, `view_merchant`, `add_to_cart`, `begin_checkout`, `place_order`, `order_delivered` |
| Discovery | `search`, `search_zero_result`, `open_trending`, `reorder` |
| Growth | `apply_referral`, `cashback_earned`, `favorite_added` |
| Account | `login`, `logout`, `address_added` |
| Support | `ticket_created` |
| Role ops | `driver_accept`, `driver_online`, `merchant_accept_order` |

## Screen tracking
Map App `currentScreen` (`home/restaurant/checkout/orders/wallet/profile/discover`) → `analytics.screen()`
in one effect — no per-screen edits.

## Privacy
- No PII in event props (ids/roles only). Honor notification/ads consent.
- Sentry: scrub request bodies/headers; never log tokens (consistent with current logging policy).

## Implementation steps (future, ~1 day)
1. Add Sentry (web) first — lowest effort, wraps `ErrorBoundary.onError` + `main.tsx`.
2. Add Firebase Analytics/Crashlytics with the native shells (`google-services.json` / plist already needed for push).
3. Build the `analytics-client` seam + screen/funnel events.
4. Configure release tagging + source maps upload in CI.

## Current state
**Not wired.** Baseline `console.error` + `ErrorBoundary.onError` hook exist as the integration points.
