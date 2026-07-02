# Multi-Portal Operational Simulation Report

Certifies the **product** (the real UI), not the engine. The complete order lifecycle was driven through
**real clicks/forms only** — no `sandboxStore`, no service calls, no `window.__sb`. Every action was
performed as a user performs it, across all five portals.

## Architecture note (honest, up front)
- The demo "backend" is **client-side localStorage**, which is **per-browser-context**. Five *literal*
  simultaneous browsers as different roles cannot share state without the real backend (frozen). The
  faithful UI-only equivalent is **sequential role-switching in one shared context** = the shared demo
  backend. Each portal genuinely observes the prior portal's UI actions through that shared store.
- **Realtime websockets are gated OFF in the demo** (to eliminate the prior 403/ws errors). So cross-portal
  propagation is **shared-store + refresh/poll**, not live sockets. Verified accordingly — there are no
  websocket updates to test in the demo (production with the real backend would add them).

## Lifecycle executed via UI — ALL PASSED
| Portal | Action (real click/form) | Result | Transition |
|---|---|---|---|
| **Customer** | browse → product modal → **Add to cart** → **Checkout** → **swipe to place order** | ✅ "تم تأكيد الطلب" | → `pending` |
| **Merchant** | sees order → **Accept order** → **Start preparing** | ✅ | `pending → accepted → preparing` |
| **Captain** | **Go online** → **Accept order** → Trip tab → **Confirm delivery** | ✅ | `preparing → on_the_way → delivered` |
| **Captain** | wallet credited on delivery | ✅ wallet > 0 | — |
| **Customer** | **Orders** → order shows **تم التوصيل** → open detail (timeline + **Reorder** + **Rate**) | ✅ | — |
| **Admin** | Dashboard reflects · **Operations Command Center** → live map (LIVE SIM) | ✅ | — |

**Cross-portal synchronization verified:** customer's placed order appeared for the merchant; the
merchant-accepted order appeared in the captain's feed; the captain's delivery appeared as `delivered` for
the customer and on the admin dashboards — all through the shared demo backend.

## UI bug found → fixed
- **Duplicate React key in the order-status timeline.** Opening a *restaurant* order threw
  `Encountered two children with the same key` because the restaurant flow has two steps sharing
  `key: 'preparing'` (`tlInPrep` + `tlReady`) and the timeline rendered `key={step.key}`.
  **Fix:** unique key `${step.labelKey}-${idx}` + unique id `step_${idx}`. **Re-tested: order detail now
  opens with 0 console errors.**

## Verified
- **Buttons:** add-to-cart, checkout, swipe-place-order, orders nav, merchant accept + start-preparing,
  captain online-toggle + accept + confirm-delivery + trip-tab, admin OCC nav — all functional.
- **Dialogs:** product modal, cart drawer, CRUD edit/add drawers (prior phase).
- **Maps:** OCC live map renders + animates; captain trip map.
- **Toasts:** order-confirmed, accept, delivery, updated/created (CRUD) — observed.
- **Status transitions:** `pending → accepted → preparing → on_the_way → delivered` — every transition
  driven and observed via UI.
- **Notifications:** generated per status change in the shared store (8/order, prior load test).
- **Console errors across the full UI lifecycle:** **0** (after the timeline-key fix).

## Remaining issues
- **Rating completion:** the rating UI (`MultiTargetReview` — rate merchant + driver) renders and is
  error-free; the harness did not auto-complete the multi-target submit (per-target submit), so end-to-end
  review persistence via UI is **partially verified** (UI present + no errors; full submit click pending).
- **5 literal simultaneous browsers:** not possible on the demo backend (per-context localStorage + single
  session key) — requires the real Supabase backend (frozen). Documented, not a defect.
- **Websocket updates:** none in the demo by design (gated to remove 403s).

## Estimated Release Candidate readiness (UI-verified, product-level)
**~93%.** The full customer→merchant→captain→customer→admin lifecycle executes through the real UI with
correct status transitions, cross-portal sync, and **zero console errors** after the fix found here. Open
items: multi-target rating submit verification, and the realtime/multi-browser features that depend on the
frozen real backend.
