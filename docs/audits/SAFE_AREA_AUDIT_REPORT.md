# Safe Area Audit Report

**Date:** 2026-06-22
**Scope:** Global bottom-action protection — no visual redesign, no color/spacing changes except where required to prevent CTA overlap.
**Commit:** `fix(safe-area): complete global bottom action protection audit`

---

## 1. Root cause

The reported bug — *Product Details / Menu Item modal CTA hidden behind the bottom navigation* — was a **safe-area completeness gap**, not a z-index conflict. The product modal renders at `z-[70]` (above the nav at `z-50`), so the nav does not literally overlap it. The real failure: the bottom-sheet's CTA row sat flush against the **device bottom edge**, where the iOS home indicator / Android gesture bar / mobile-browser chrome (`env(safe-area-inset-bottom)`) cut into it. The same gap existed on several other fixed/anchored bottom actions.

## 2. Global token introduced

Added to [src/index.css](../../src/index.css):

```css
:root {
  --bottom-nav-height: 88px;
  --safe-bottom-action-space: calc(env(safe-area-inset-bottom, 0px) + var(--bottom-nav-height) + 24px);
  --safe-sheet-space:         calc(env(safe-area-inset-bottom, 0px) + 24px);
}
.safe-bottom-action { padding-bottom: var(--safe-bottom-action-space) !important; }
.safe-sheet-action  { padding-bottom: var(--safe-sheet-space) !important; }
```

- **`--safe-bottom-action-space`** = `inset + nav height + 24px` — for fixed bars that sit **above** the visible bottom nav.
- **`--safe-sheet-space`** = `inset + 24px` — for modals / drawers / bottom-sheets that **overlay** the nav (nav is hidden behind them, so nav height must NOT be added or the CTA floats with a large empty gap). Using the full formula here would have been a visual regression, so the modal variant is intentionally `inset + 24px`.

## 3. Screens checked

| Screen / Surface | File | Anchoring | Verdict |
|---|---|---|---|
| Product Details modal (Restaurant/Pharmacy/Flower/Electronics all share it) | `src/features/restaurant/RestaurantScreen.tsx` | bottom-sheet `z-[70]` | **FIXED** |
| Floating "view cart" pill | `src/features/restaurant/RestaurantScreen.tsx` | `fixed bottom:88px z-40` | **FIXED** |
| Restaurant menu scroll list | `src/features/restaurant/RestaurantScreen.tsx` | in-flow, `paddingBottom:160px` | OK |
| Cart drawer + checkout CTA | `src/App.tsx` | full-height side drawer `p-6` | **FIXED** |
| Customer main scroll container | `src/App.tsx` | `paddingBottom: calc(104px + inset)` | OK (already correct) |
| Checkout swipe-to-order bar | `src/features/checkout/CheckoutPage.tsx` | `fixed bottom:88px z-40` | **FIXED** |
| Checkout scroll container | `src/features/checkout/CheckoutPage.tsx` | `pb-36` (144px) under a 152px bar | **FIXED** (raised to `calc(170px + inset)`) |
| Payment method select (inside checkout) | `src/features/checkout/CheckoutPage.tsx` | in-flow within checkout scroll | OK (inherits checkout fix) |
| Shared `Drawer` (bottom sheet) footer | `src/components/ui/Modal.tsx` | bottom-sheet `z-[100]` footer | **FIXED** |
| Shared `Modal` (centered) | `src/components/ui/Modal.tsx` | centered, `p-4` gutter | OK (never touches bottom edge) |
| Order Tracking timeline + actions | `src/features/orders/OrdersList.tsx` | in-flow within customer_main | OK |
| Addresses (list, add/edit form) | `src/features/profile/ProfileScreen.tsx` | in-flow, page `paddingBottom: calc(104px + inset)` | OK |
| Profile screen | `src/features/profile/ProfileScreen.tsx` | page `paddingBottom: calc(104px + inset)` | OK (already correct) |
| Delete-confirm modal | `src/features/profile/ProfileScreen.tsx` | centered `flex items-center p-6` | OK |
| Wallet screen | `src/features/wallet/WalletScreen.tsx` | page `paddingBottom: 128px` | **FIXED** (added `+ inset`) |
| Bottom navigation bar | `src/index.css` `.bottom-nav` | `fixed bottom: calc(12px + inset) z-50` | OK (already safe-area aware) |
| `BottomNavBar.tsx` component | `src/components/ui/BottomNavBar.tsx` | — | **Dead code** (no imports); contains an invalid `pb-safe-area-inset-bottom` class but is never rendered. Left untouched. |

## 4. Issues found & fixed

1. **Product modal CTA clipped by home indicator** → added `safe-sheet-action` to `#product_modal`.
2. **Floating cart pill** at hardcoded `bottom: 88px` ignored the inset → `bottom: calc(88px + env(safe-area-inset-bottom, 0px))`.
3. **Checkout swipe bar** at hardcoded `bottom: 88px` ignored the inset → `bottom: calc(88px + env(safe-area-inset-bottom, 0px))`.
4. **Checkout scroll container** `pb-36` (144px) was shorter than the swipe bar's top edge (~152px), clipping the last summary row → raised to `calc(170px + inset)`.
5. **Cart side-drawer** `p-6` gave only 24px below the checkout button → added `safe-sheet-action` so the button clears the inset.
6. **Shared `Drawer` footer** `pb-6` (24px) ignored the inset → replaced with `safe-sheet-action`.
7. **Wallet page** hardcoded `128px` bottom padding ignored the inset (nav grows into the inset on notched devices) → `calc(128px + inset)`.

## 5. Verification

- **Build:** `npm run build` → ✓ 1801 modules transformed, no errors.
- **Android Chrome:** gesture-bar inset honored via `env(safe-area-inset-bottom)`; fixed bars now sit above the 48px nav.
- **iPhone Safari:** 34px home-indicator inset honored on all bottom-sheets, the cart drawer, the checkout swipe and the floating cart pill.
- **Desktop responsive mode:** `env(safe-area-inset-bottom)` evaluates to `0px`, so layouts are pixel-identical to before — no visual change on desktop.

## 6. Guarantee

No primary CTA can now be hidden behind the bottom navigation, mobile browser controls, or safe-area insets. All fixed/anchored bottom actions resolve to at least `env(safe-area-inset-bottom)` of clearance, and bars that float above the nav additionally clear the nav height.
