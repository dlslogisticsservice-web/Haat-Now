# Medium-Priority Bugs — E2E Sprint

**Date:** 2026-06-24 · **Branch:** `feat/auth-recovery-frontend-sprint`
**Definition:** cosmetic, non-blocking, or edge-case. (Not fixed in this sprint per "Critical + High only";
logged for the backlog. None block any journey.)

---

## M1 — Swipe-to-confirm is interactable during the checkout loading state
`#checkout_swipe_handle` is present while the checkout page is still fetching addresses/payment data
("Preparing your order details…"). The handlers guard on `swipeComplete`/`actionLoading` but **not** the
data-loading flag. A user who swipes before data loads hits the existing `addresses.length === 0` guard
(an alert), so there is **no crash or bad order** — but ideally the swipe should be disabled until load
completes. Non-blocking.

## M2 — Cart drawer auto-opens after add-to-cart; tapping the cart nav while open closes it
`handleAddToCart` opens the cart drawer; the bottom-nav cart button sits behind the drawer overlay, so a
redundant tap on it lands on the backdrop and closes the drawer. Normal users proceed via the drawer's
checkout button (works); only affects an unusual double-tap. Cosmetic/UX.

## M3 — Bundle size warning (entry chunk has historically exceeded 500 KB pre-split)
Vite emits a chunk-size advisory. Already mitigated by lazy routes + vendor splitting (entry ≈ 312 KB).
Informational, not a defect.

---

## Result: 3 medium observations, **0 blocking**. Deferred to backlog (sprint scope = Critical + High).
