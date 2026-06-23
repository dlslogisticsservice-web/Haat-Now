# Checkout Workflow Audit

**Date:** 2026-06-23
**File:** `src/features/checkout/CheckoutPage.tsx` (+ `App.tsx` cart/order handlers).

---

## Lifecycle: Browse → Product → Cart → Checkout → Payment → Confirmation

| Stage | Mechanism | Status |
|---|---|---|
| Browse → Product | `HomeScreen.onSelectRestaurant` → `RestaurantScreen`; product card → `#product_modal` | ✅ |
| Product → Cart | `#add_to_cart_confirm` → `onAddToCart` → cart state in `App`; modal closes | ✅ |
| Cart → Checkout | cart drawer `#checkout_btn` → `handleNavigateToCheckout` → `currentScreen='checkout'` | ✅ |
| Checkout → Payment | swipe-to-confirm → `handlePlaceOrder` → `orderService.createOrder` → payment tab + status poll | ✅ |
| Payment → Confirmation | poll loop sets confirmed → `onOrderPlaced(orderId)` → success modal | ✅ |

## Validations & guards

| Concern | Implementation | Verdict |
|---|---|---|
| **Button visibility** | swipe bar `#checkout-area` at `bottom: calc(88px+inset)`; scroll `padding-bottom: calc(170px+inset)` | ✅ not hidden behind nav |
| **State transitions** | `paymentStatus: idle → verifying → failed/cancelled`; `swipeComplete`; `actionLoading` | ✅ explicit |
| **Duplicate actions** | `handlePlaceOrder()` opens with `if (actionLoading || showSuccessModal) return;` | ✅ blocks re-entry |
| **Double-payment prevention** | `setActionLoading(true)` before async create; swipe disabled while `swipeComplete`; payment opens once per order; status poll is idempotent (keeps polling on non-OK, acts once on confirmed) | ✅ |
| **Required fields** | empty cart guard; `addresses.length===0` → alert; `!selectedAddress` → alert; `!selectedPayment` → alert | ✅ |
| **Failure recovery** | on order error: close payment tab, alert, reset `swipeComplete=false` + handle position → user can retry | ✅ |
| **Cart cleanup** | `App.handleOrderPlacedSuccess(orderId)` → `setCart([])` after confirmed order | ✅ |
| **Order persistence** | sandbox: `sandboxStore.createOrder`; prod: `orderService.createOrder` (Supabase) | ✅ |
| **Coupon integrity** | coupon usage recorded **after** payment confirmation (moved out of `handlePlaceOrder`) so an unpaid/cancelled order doesn't consume a coupon | ✅ |

## Edge cases checked
- **Rapid double-swipe / double-tap:** the `actionLoading`/`showSuccessModal` guard at the top of
  `handlePlaceOrder` short-circuits the second invocation → no duplicate order, no double payment.
- **Payment cancelled / failed:** `paymentStatus` set to `cancelled`/`failed`, error toast shown
  (`bottom: calc(168px+inset)` — not hidden), swipe reset for retry; no order is confirmed and the cart
  is **not** cleared.
- **Back navigation mid-checkout:** `onBack` returns to restaurant; cart preserved.

## Findings
No defects found. Duplicate-submission and double-payment protections are present and correct; cart is
cleaned only on confirmed success; coupons are consumed only after payment confirmation; the order CTA
is not hidden behind the bottom navigation. **No code change required in this task.**
