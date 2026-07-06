# Website Ordering (Wave 2)

> Ordering directly from the website — browse, search, cart, checkout, track — using the **same
> backend as the mobile app**. No duplicated business logic. Flag: `website.ordering`.

## Principle: reuse, don't reimplement
`src/website-platform/ordering/ordering.ts` defines a `WebsiteOrderingPort` and an
`AppServicesOrdering` adapter that delegates **1:1** to the existing app services:
| Website capability | Delegates to |
|---|---|
| `getCategories` / `browse` / `search` / `productDetails` | `productService` (`src/services/product.service.ts`) |
| `getCart` / `addToCart` / `updateQuantity` / `removeFromCart` / `calculateTotal` | `cartService` |
| `checkout` | `orderService.createOrder` (the SAME atomic, idempotent order creation the app uses — Phase 9 `create_order` in live mode) |
| `trackOrder` / `myOrders` | `orderService.getOrderDetails` / `getCustomerOrders` |

The website carries **zero** ordering business logic of its own — it is a thin typed facade. Pricing,
coupons, order creation, and tracking all execute in the app services, so web and app can never drift.

## Contract
`WebsiteOrderingPort` returns the app's own domain types (`Product`, `Order`, `CartState`, …) wrapped
in the platform `Result` type, so callers get typed success/error without exceptions. `checkout`
accepts the same fields the app checkout uses (customer, branch, items, location snapshot, idempotency
key).

## Runtime note
`AppServicesOrdering` is imported and used in the browser (where the app services run). Its correctness
(implements the port → delegates) is guaranteed by the compiler; the end-to-end browse→checkout→track
flow is proven in tests via a port-shaped fake (the real app services read `import.meta.env` at load,
so they are exercised in the browser/E2E, not in the Node unit tests — the same isolation used across
the platform).

## Reusability
The adapter is brand-agnostic: any white-label tenant's website uses the identical port over the
identical backend. Tenant scoping is enforced by the app services + RLS underneath.

## Tests
`__tests__/deeplink-ordering-website.test.ts` — a port implementation drives browse→checkout→track.
