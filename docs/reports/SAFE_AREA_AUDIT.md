# Safe Area & Layout Audit

**Date:** 2026-06-23
**Baseline:** commit `bdaa176` (header box-model fix) + this sprint.
**Foundation:** `viewport-fit=cover` is set, so `env(safe-area-inset-*)` is live on devices.
Global tokens: `--top-safe-space`, `--bottom-safe-space` (index.css); `.app-header-safe` adds
`padding-top: env(safe-area-inset-top)`; headers size as `calc(base + env(inset-top))`.

> **Note on category screens:** Pharmacy, Flowers, Market, Electronics and Restaurant are the **same
> component** (`RestaurantScreen`, parameterized by category). Promotions render inside `HomeScreen`
> (campaign banners). So one fix covers each group.

---

## Per-screen results

| Screen | Top (header/notch) | Bottom (nav/CTA) | Issue found | Root cause | Fix |
|---|---|---|---|---|---|
| **Home** | global `#stitch_header` height `calc(56px+inset)` | content in `#customer_main` `padding-bottom: var(--bottom-safe-space)` | none remaining | — | header box-model (bdaa176) |
| **Restaurant** | under global header | `#menu_list` pb + floating cart pill `bottom: calc(88px+inset)` | none | — | inset-aware pill |
| **Product Details (modal)** | overlay (z-70) | `.safe-sheet-action` on sheet → Add-to-Cart never hidden | none | — | safe-sheet padding |
| **Cart (drawer)** | overlay | `.safe-sheet-action` on drawer + shared `Drawer` footer | none | — | safe-sheet padding |
| **Checkout** | under global header | swipe bar `bottom: calc(88px+inset)`; scroll `padding-bottom: calc(170px+inset)`; payment toast `calc(168px+inset)` | none | — | inset-aware bars |
| **Wallet** | header `calc(64px+inset)` (was `h-16`) | page `padding-bottom: var(--bottom-safe-space)` | header content under notch | fixed `h-16` + border-box ate the inset | header height → `calc(64px+inset)` (this sprint chain) |
| **Profile** | header `calc(56px+inset)`; tab strip `top: calc(56px+inset)` | page `padding-bottom: var(--bottom-safe-space)` | header & tabs under notch | fixed `height:56px` + hardcoded `top:'56px'` | both → `calc(... + inset)` |
| **Addresses** | (Profile tab — same header) | in-flow within Profile page padding | none | — | inherits Profile |
| **Orders** | under global header | renders in `#customer_main` (token) | none | — | token |
| **Tracking** | under global header | in `#customer_main` (token) | none | — | token |
| **Promotions** | in `HomeScreen` (under global header) | within `#customer_main` (token) | none | — | token |
| **Pharmacy** | = RestaurantScreen | = RestaurantScreen | none | — | shared component |
| **Flowers** | = RestaurantScreen | = RestaurantScreen | none | — | shared component |
| **Market** | = RestaurantScreen | = RestaurantScreen | none | — | shared component |
| **Electronics** | = RestaurantScreen | = RestaurantScreen | none | — | shared component |

## CTA visibility verification
- **Add-to-Cart** (product modal): inside a `.safe-sheet-action` sheet (z-70 over nav) — verified
  not covered (`elementFromPoint`, post-deploy run: top 740 / bottom 796 of 844).
- **Checkout swipe bar**: `#checkout-area` at `bottom: calc(88px+inset)` — verified not covered (692/756).
- **Save buttons** (Profile payment/address, Wallet top-up): all in-flow, covered by the page's
  `--bottom-safe-space` padding. No fixed-bottom save bars escape the reservation.
- **Bottom nav** (`.bottom-nav`, `position:fixed; bottom: 12px+inset`, ≈64px): top edge ≈ `76px+inset`;
  pages reserve `inset+112px` → ≥36px clearance.

## Root-cause summary
The only real device-only overlap was **fixed-height sticky headers** where `box-sizing:border-box`
subtracted `env(safe-area-inset-top)` from the fixed height, pushing header content under the notch
(Home/Profile/Wallet). Fixed by making header height `calc(base + env(inset-top))` and the Profile tab
strip `top: calc(56px + env(inset-top))`. Bottom reservations were already correct via the
`--bottom-safe-space` token (no fixed-bottom CTAs in the audited screens).

## Status
No remaining header overlap, hidden CTA, hidden checkout/add-to-cart/save button, or content hidden
behind the bottom navigation in the audited screens. Re-confirm on a physical notched device after the
Vercel redeploy of this sprint's commit.
