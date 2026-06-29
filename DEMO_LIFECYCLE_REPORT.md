# Operational Demo Lifecycle — Report

The Haat Now platform is demonstrable end-to-end through **one complete operational order flow** across
all five roles, on the existing application (no redesign, no fake pages). This sprint **closed the last
gap**: the admin live-operations map was a **dead placeholder when no Google Maps key is present** — it is
now a **fully-functional animated SVG simulation** (moving fleet, routes, ETA, heatmap), so the entire
flow — including realtime driver movement — is demonstrable with **zero external keys**.

## Lifecycle diagram (one order, all roles)
```
 CUSTOMER          MERCHANT           DISPATCH            DRIVER              ADMIN
 ─────────         ─────────          ─────────          ─────────          ─────────
 browse ▸ cart                                                              live dashboard
   │                                                                          │
 checkout ▸ pay ─▶ receive order                                            order timeline
   │               accept / reject                                           │
 track (poll 5s)   prep timer ▸ ready ─▶ auto-assign ───▶ receive offer     dispatch monitor
   │                                     manual override   accept / reject    driver movement
   │                                     reassign ◀────────  (decline)        (LIVE SIM map)
   │◀── notify ◀──────────────────────────────────────── pickup ▸ navigate  merchant status
 delivered ◀───────────────────────────────────────────  deliver ▸ POD ───▶ system events
   │                                                                          │
 rating                                                                     finance / KPIs
```
Shared state: `sandboxStore` (orders/wallet/notifications) — every role reads the same order; the customer
tracker polls every 5s; merchant/driver re-read on each status action; admin OCC polls + subscribes.

## What this sprint built — animated SVG ops simulation (no Maps key)
`OpsSvgMap` replaces the OCC "Google Maps key required" dead placeholder. It is **fully functional with no
key** and satisfies every Maps requirement:
| Requirement | Status |
|---|---|
| **Realtime movement simulation** (rAF loop, ~7 fps) | ✅ verified `moved: true` (drivers move t0→t1) |
| **Animated driver marker** (pulse ring on in-transit) | ✅ |
| **Merchant marker** (red) · **Customer marker** (blue) | ✅ |
| **Route animation** (driver→customer, animated dash) | ✅ |
| **ETA updates** (live per in-transit driver: `22′ 16′ 14′ …`) | ✅ |
| **Heatmap activity** (toggle) · **moving drivers** (fleet of 14) | ✅ |
| Layer toggles (drivers/orders/merchants/heat) drive the SVG | ✅ |
| Overlays **real** live drivers/orders/merchants when present (lat/lng fit-bounds) | ✅ |
| HUD: `LIVE SIM · in transit N · available M` + legend | ✅ |
**Verified**: OCC renders the sim (28 SVG nodes, `LIVE SIM` badge), and the fleet animates (first driver
`85.4,15.3 → 12.8,22.5` after 3.5s). When `VITE_GOOGLE_MAPS_API_KEY` is set, the real Google map +
markers + heatmap render instead — both paths are wired.

## End-to-end lifecycle — demonstrable (existing flow, screenshots)
| Step | Role | Evidence |
|---|---|---|
| 1. Browse → cart → checkout → pay → place order | Customer | `flow/1_customer_order.png` |
| 2. Receive → accept → prep timer → ready | Merchant | `flow/2_merchant_accept.png` |
| 3. Assign → accept → navigate → pickup → deliver → POD | Dispatch + Driver | `flow/3_driver_deliver.png` |
| 4. Delivered → notification → rating | Customer | `flow/4_customer_delivered.png` |
| 5. Realtime dashboard · driver movement · dispatch monitor · system events | Admin | `lifecycle/ops_map_t0.png`, `ops_map_t1.png` |
| 5b. Finance / KPIs | Admin | `flow/5b_admin_finance.png` |

Driver courier card (COD/timeline/navigate-call-chat) and merchant Reports analytics shipped in the
prior driver/merchant sprints are part of the same flow.

## Notifications & demo data
- **Notifications**: `sandboxStore` writes per-role notifications on status changes (order placed,
  accepted, delivered + wallet credit); the customer tracker polls every 5s; OCC dispatch monitor + feed.
- **Demo data**: `demoSeed.ts` generates the realistic dataset (100 drivers, 50 merchants, 80 branches,
  300 orders, 150 customers, zones, categories) into `haat_crud_*`; `OpsSvgMap` additionally **generates a
  live moving fleet + heatmap activity** so the ops view is always animated even before real orders exist.

## QA
- No dead screens (the Maps placeholder is gone — the map is now functional). No fake buttons. No
  placeholder dialogs. Layer toggles, dispatch, zone table, SLA monitor all live.
- Status changes propagate through the shared `sandboxStore` to every role's view (poll / re-read).

## Honestly remaining (external / additive — not faked)
- **Cross-tab instant push**: status changes propagate via shared store + polling (5–15s) / on-action
  re-read; a `storage`-event push for sub-second cross-tab sync is an additive enhancement.
- **Real Google Maps tiles** (satellite/traffic/real road routes): external `VITE_GOOGLE_MAPS_API_KEY`
  (both the OCC live map and the SVG simulation are wired; only tiles need the key).

## Validation
Typecheck/Lint **0 errors** ✅ · Build ✅ · **E2E 24/24** ✅ · in-browser ops-sim render + movement
verification ✅.

## Production
- **URL**: https://haat-now.vercel.app
- **SHA**: confirmed below.
- **CI**: GitHub Actions GREEN.
