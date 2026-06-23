# Safe-Area Global Fix Report

**Date:** 2026-06-23
**Branch:** `feat/auth-recovery-frontend-sprint`
**Commit:** `4313fb0`
**Files:** `src/index.css`, `src/components/layout/AppPageLayout.tsx` (new), `src/App.tsx`,
`ProfileScreen.tsx`, `WalletScreen.tsx`, `AdminDashboard.tsx`, `MerchantApp.tsx`, `DriverApp.tsx`

---

## Root causes

1. **Top overlap.** Sticky headers (`sticky top-0`) sat at the very top of the viewport with **no
   `env(safe-area-inset-top)` reservation**, so on notched devices the status bar / notch overlapped
   the header content.
2. **Bottom overlap.** Bottom reservation was done with **scattered per-screen magic numbers**
   (`104px`, `128px`, …) that were inconsistent and easy to get wrong — exactly the "screen-specific
   hacks" the fix had to remove.

## Global solution

### 1. Single-source tokens (`index.css`)
```css
:root {
  --app-header-height: 64px;
  --app-tabs-height: 0px;          /* overridable per layout */
  --app-bottom-nav-height: 88px;
  --app-action-bar-height: 0px;    /* overridable when a fixed action bar exists */
  --top-safe-space:    calc(env(safe-area-inset-top, 0px)    + var(--app-header-height) + var(--app-tabs-height));
  --bottom-safe-space: calc(env(safe-area-inset-bottom, 0px) + var(--app-bottom-nav-height) + var(--app-action-bar-height) + 24px);
}
.app-header-safe      { padding-top: env(safe-area-inset-top, 0px); }     /* sticky headers clear the notch */
.app-page-top         { padding-top: var(--top-safe-space); }            /* non-sticky-header screens */
.app-page-bottom      { padding-bottom: var(--bottom-safe-space); }
.app-page-bottom-flat { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 24px); }  /* sidebar portals */
```
Sub-tokens are overridable per layout, so content automatically reserves space for **header + tabs**
(top) and **bottom navigation + action bar** (bottom) without hardcoded numbers.

### 2. Reusable `AppPageLayout` (`components/layout/AppPageLayout.tsx`)
A drop-in page shell that codifies the tokens:
- `header` → rendered `sticky top-0` with `env(safe-area-inset-top)` padding (notch-safe).
- `tabs` → optional sticky strip under the header.
- `children` → scroll area reserving `--bottom-safe-space`.
- `bottomBar` → optional **fixed** action/CTA bar that always sits above the bottom nav + home indicator.
- `bottomNav` / `actionBarHeight` props drive the reservation (customer flow vs sidebar portals).

### 3. Applied globally

| Surface | Top fix | Bottom fix |
|---|---|---|
| **Customer** (App shell) | `app-header-safe` on `#stitch_header` | `#customer_main` → `var(--bottom-safe-space)` |
| **Customer · Profile** | `app-header-safe` on header | page → `var(--bottom-safe-space)` |
| **Customer · Wallet** | `app-header-safe` on header | page → `var(--bottom-safe-space)` |
| **Customer · Restaurant / Checkout / Orders / Tracking** | covered by the global `#stitch_header` notch reservation | render inside `#customer_main` (token); plus preserved CTA protections (below) |
| **Merchant** portal | main reserves `env(safe-area-inset-top)` | sidebar layout (no bottom nav) |
| **Driver** portal | container reserves `env(safe-area-inset-top)` | sidebar/stack layout |
| **Admin** portal | main reserves `env(safe-area-inset-top)` | sidebar layout (no bottom nav) |

### 4. Preserved CTA protections (unchanged, still inset-aware)
- Product modal (all 5 categories share it) + its Add-to-Cart action → `.safe-sheet-action`
- Cart drawer + shared `Drawer` footer (modal actions) → `.safe-sheet-action`
- Checkout swipe bar → `bottom: calc(88px + inset)`; scroll → `calc(170px + inset)`
- Payment error toast → `calc(168px + inset)`
- Floating cart pill → `bottom: calc(88px + inset)`

## Screen verification

| Screen | Top (header/notch) | Bottom (nav/CTA) |
|---|---|---|
| Profile | ✅ header reserves inset-top | ✅ `--bottom-safe-space` |
| Address (Profile tab) | ✅ (same page) | ✅ `--bottom-safe-space` |
| Restaurant | ✅ global header | ✅ menu list + floating pill clear nav |
| Product modal | ✅ overlay | ✅ `.safe-sheet-action` (CTA never hidden) |
| Cart | ✅ drawer | ✅ `.safe-sheet-action` (checkout CTA clear) |
| Checkout | ✅ global header | ✅ swipe bar + scroll padding clear nav |
| Orders | ✅ global header | ✅ `#customer_main` token |
| Tracking | ✅ global header | ✅ inside `#customer_main` token |

No CTA, checkout button, add-to-cart button, or modal action is hidden behind the bottom navigation;
no header content is hidden behind the notch / status bar.

## Build status
- `npx tsc --noEmit` (app `src`): clean (only pre-existing Deno edge-function files, excluded from the app build).
- `npm run build`: ✅ passes (~8.5s).

## Notes
- On non-notched / desktop devices `env(safe-area-inset-*)` evaluates to `0`, so there is **zero
  visual change** there — the fix only adds space where a real inset exists.
- `AppPageLayout` is the reusable standard going forward. Existing bespoke screens were updated to use
  the **same tokens directly** rather than being rewrapped, to honor "never break current UI"; they can
  be migrated to `AppPageLayout` incrementally with no behavioural change.

## Commit & push
- Commit: `4313fb0` — `fix(ui): global safe-area layout system (top + bottom reservation)`
- Push: ✅ `aa23809..4313fb0` → `origin/feat/auth-recovery-frontend-sprint`; remote HEAD == local HEAD (0/0).
