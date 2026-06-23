# Architecture Scalability Report — HAAT NOW

**Date:** 2026-06-24

## React rendering
- Role portals + non-landing customer screens are **lazy-loaded** (`React.lazy`); vendor libs split
  (`vendor-react/supabase/i18n`). Entry chunk ≈ **312 KB**. Lottie runtime code-split. Scales for TTI.
- State: local `useState` + small contexts (AppConfig/Design/Experience). No heavy global store; re-renders
  are component-local. Cart is client state synced to DB (customer only, after the E2E-sprint fix). No
  memory-leak vectors found — effects clean up channels/timers (`supabase.removeChannel` on unmount,
  `cancelAnimationFrame`, `clearInterval`).

## Supabase architecture
- Client uses **anon key only** + RLS. Edge functions (payments) run service-role server-side.
- Reads via PostgREST; writes via PostgREST + edge functions. Connection multiplexing via the Supabase
  pooler (PgBouncer) is the concurrency substrate.

## Database schema / indexes — primary finding
- Schema is sound (normalized: orders/order_items/products/variants/branches/merchants/drivers/zones).
- **29 hot foreign keys had no covering index** → Seq Scans on every order/product/driver read. Measured
  190–424 ms at 500k orders. **Fixed** (now 0.2–3.9 ms). See `DATABASE_STRESS_REPORT.md`.

## Query patterns / N+1
- `order.service` / `driver.service` filter by `customer_id` / `branch_id` / `driver_id` + sort
  `created_at` — now all index-backed.
- Product detail embeds `product_images` + `product_variants` — the embed join is now index-backed
  (`idx_product_*_product`), eliminating the per-product N+1 scan.
- Recommendation: add `.range()` pagination to the `HomeScreen` restaurant list and orders list as the
  catalog grows (currently RLS-scope-bounded, fine at launch).

## Realtime subscriptions
- Customer notifications: one channel per signed-in customer (`customer-notifs-<id>`). Fine at 5k
  concurrent; 100k registered (not concurrent) is fine.
- Driver fleet (20k): per-driver global channels would exceed Realtime concurrency defaults
  (Free 200 / Pro 500). Binding constraint — mitigate with zone channels / Team tier (BN-H1). Latency is
  not the limiter.

## API bottlenecks / memory
- No `eval`/`innerHTML`/`dangerouslySetInnerHTML`. No unbounded in-memory accumulation. Lazy chunks keep
  memory flat per route.

## Verdict
Architecture scales to target once indexes exist (done); the only structural ceiling is Realtime concurrent
connections for the full driver fleet, addressed by tier/channel design.
