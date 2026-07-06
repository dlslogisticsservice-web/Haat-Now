# Realtime Experience Blocks

> HaaT Now · Phase 10.5 · Design only (Part 10). Extends the Phase 10 **dynamic blocks**
> (Restaurants/Stores/Products/Offers/…) into **intelligent, realtime** blocks wired to live platform
> data — the DXP moat. All are tenant + country scoped and **PII-free** (Phase 9 lesson), served via
> the cache-safe hydration model.

## 1. Rendering model (cache-safe realtime)
Two-tier, matching the Experience Engine discipline:
- **First paint (SSR/ISR)**: block renders a server-cached shell + last-known data (short TTL) →
  fast, SEO-visible, CDN-cached.
- **Live hydration (island)**: after paint, the block subscribes/polls the **Headless API** (or a
  Supabase realtime channel for truly live data like driver positions/ETA) → updates in place.
This keeps HTML cacheable at 10k tenants while data stays live. Each block declares its freshness
tier: `static-ish` (ISR, minutes), `near-real-time` (poll, seconds), or `live` (realtime channel).

## 2. Block catalog (Part 10) & data sources (existing repositories/services)

| Block | Data source | Freshness | Scope / safety |
|---|---|---|---|
| **Nearby Restaurants** | merchant/catalog repo + geo | ISR | tenant+city; open-now |
| **Live Offers** | coupon/promotions service | ISR (seconds) | country+active |
| **Popular Products** | product repo + order-popularity rollup | ISR | merchant/category |
| **Trending Categories** | analytics rollup | ISR | tenant |
| **Driver Heatmap** | driver density aggregate (counts, not positions) | near-real-time | **aggregate only, no driver PII** |
| **Delivery ETA** | `order_tracking` RPC / zone quote | live | authenticated order or address-based estimate |
| **Order Tracking** | orders + driver_locations realtime channel (Phase 8 pipeline) | live | **owner-only** (the customer's order) |
| **Merchant Status** | merchant open/closed + capacity | near-real-time | tenant |
| **Store Availability** | store settings + hours + load | near-real-time | tenant |
| **Dynamic Promotions** | campaign + personalization | ISR | audience-targeted |
| **Loyalty Status** | loyalty service | live | **authenticated visitor only** |
| **Wallet Summary** | wallet service | live | **authenticated, owner-only, island (never cached)** |
| **Campaign Banner** | campaign service + Experience variant | ISR | audience/UTM |
| **Geo Promotions** | offers × edge geo | ISR | country/city |

## 3. Security & privacy (hard rules)
- **Authenticated, owner-only** blocks (Order Tracking, Loyalty Status, Wallet Summary) render as
  **client islands** that call the Headless API with the user's token — their data is **never** in a
  CDN-cached page and is RLS-enforced server-side (a visitor can only see their own order/wallet).
- **Aggregate-only** blocks (Driver Heatmap) expose counts/density, never individual driver rows —
  respecting the Phase 9 PII lockdown (drivers table PII revoked).
- All data reads are **tenant + country scoped** at the resolver; a block on `brandA.com` can never
  read brandB or another country's data.

## 4. Data-source contract
Each realtime block declares `{ dataSource, params, freshness, authScope, ssrFallback }`. The
resolver (edge, service role) maps `dataSource` → an existing platform repository/RPC with the
tenant/country/auth scope injected. New blocks = new registry entries, not new backends.

## 5. Consistency with the marketplace mission
These blocks are what make a HaaT website *operational*, not a brochure: a merchant's site shows
their live open stores, current offers, real delivery ETA, and popular items — driven by the same
data that runs their business. No incumbent DXP can do this (Gap Analysis / Experience Platform §1.3).

## 6. Performance
- SSR fallback data comes from short-TTL rollups (Phase 9 scheduler), so first paint never waits on a
  live query. Live updates are diff-patched into the DOM (small islands). Realtime channels are
  throttled/geohash-partitioned (the SCALABILITY note from Phase 8) to survive high driver volume.

## 7. Integration with strict concerns
- Multi-tenant + country scoped (RLS at the resolver); RBAC (some blocks require the visitor's own
  auth); localized labels; SEO — realtime data is supplemental, canonical content stays crawlable;
  analytics track block interactions; flag-gated per block; audited config changes; observability
  monitors data-source latency/errors per block.
