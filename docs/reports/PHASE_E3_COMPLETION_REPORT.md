# Phase E3 — Operations Command Center — Completion Report

**Date:** 2026-06-24 · Competitor-grade live operations center: real-time maps, dispatch, monitoring,
and geographic/zone/operations analytics, integrated with Google Maps Platform. Applied live + verified.
Commits: `ccde68c` (backend) · `6deab72` (service) · `df03d83` (UI).

---

## What was delivered

### M1 — Backend (`20260614000032_ops_command_center.sql`, applied live + recorded)
- **Real-time architecture fix (important):** `orders`, `drivers`, `driver_locations`,
  `merchant_branches` were **not in the `supabase_realtime` publication** — the app's existing realtime
  subscriptions were receiving **no DB events**. Added all four to the publication + set
  `REPLICA IDENTITY FULL` so subscriptions can filter on non-PK columns. Live maps now stream.
- `batch_auto_dispatch(limit, timeout)` — auto-dispatch up to N unassigned orders in one pass (admin).
- `ops_summary()` — live counts: active/unassigned/in-transit orders, online/available/busy drivers,
  pending offers, delivered + revenue today.
- `ops_zone_analytics()` — per zone: active orders, online/available drivers, delivered today, ETA.

### M2 — Service (`src/services/ops/command.service.ts`)
`summary`, `zoneAnalytics`, `batchDispatch`, `liveDrivers` / `liveOrders` / `liveMerchants` (map markers
from coordinates), and `subscribeLive` (realtime channel on `driver_locations` + `drivers` + `orders` →
`onChange`).

### M3 — UI — Operations Command Center (new "غرفة العمليات" tab, first in OperationsCenter)
- **Live Google Maps** (`@vis.gl/react-google-maps@1.8.3`): **driver markers colored by status**
  (available=green, busy=orange, on-break=blue), **active-order markers**, **merchant-branch markers**,
  toggleable layers, and an **order heatmap** (Google Maps visualization library).
- **Live ops summary header** (6 KPIs).
- **Real-time updates:** `subscribeLive` auto-refreshes on driver-location / driver / order changes
  (+ 15 s safety poll).
- **Dispatch monitoring** feed + **batch dispatch** (assign all unassigned).
- **Zone analytics** table (geographic/operations breakdown per zone).

## Requirement coverage
| Requirement | Status | How |
|---|---|---|
| Live orders map | ✅ | active-order markers on Google Maps |
| Live drivers map | ✅ | driver markers (status-colored), realtime |
| Live merchants map | ✅ | merchant-branch markers |
| Smart / Auto dispatch | ✅ | E-A `find_nearest_drivers` + `auto_dispatch_order` (existing) |
| Batch dispatch | ✅ **new** | `batch_auto_dispatch` + UI button |
| Reassignment center | ✅ | `reassign_order` RPC + dispatch panel |
| Dispatch monitoring | ✅ | live assignment feed |
| Heat maps | ✅ | order-density heatmap layer |
| Delivery / Driver / Merchant monitoring | ✅ | live markers + summary + zone table |
| Geographic / Zone / Operations analytics | ✅ | `ops_zone_analytics` + `ops_summary` |
| Google Maps Platform | ✅ | `@vis.gl/react-google-maps` (real APIProvider/Map/Marker/heatmap) |
| Real-time architecture | ✅ | realtime publication fixed + subscription |

## Verification (live)
- Realtime publication now lists `orders, drivers, driver_locations, merchant_branches` ✅
- `ops_summary()` returns live JSON counts ✅ · `ops_zone_analytics()` returns 3 zones ✅
- `batch_auto_dispatch(10)` runs (returned 0 — no unassigned orders in dev) ✅
- Build ✅ · Lint ✅ · E2E 24/24 ✅ (no regression).

## Honest scope notes (not inflated)
- **Google Maps tiles require `VITE_GOOGLE_MAPS_API_KEY`.** The integration is **real** (not a placeholder
  image) — when the key is unset the map area shows a clear "configure key" notice and **all data panels
  still function** (summary, monitoring, batch dispatch, zone analytics). Setting the key is a config item
  (already on the launch checklist). This is the one thing standing between the code and rendered tiles.
- **Heatmap uses order coordinates** (density), not zone polygons — because **zones currently have no
  polygons drawn** (0/3). A polygon-drawing tool + polygon overlays is a fast-follow; the point heatmap is
  real and live.
- **Driver positions update via the realtime channel + a 15 s safety poll.** True per-second tracking at
  fleet scale needs the driver-location-off-REST redesign noted in the scale roadmap (Realtime broadcast/
  presence) — out of scope for E3.
- **Marker rendering uses classic `Marker` with Google's colored dot icons** (works without a Cloud
  `mapId`); upgrading to `AdvancedMarker` + custom pins needs a configured map style id.
- Cluster/marker virtualization isn't added yet — fine for hundreds of live entities; thousands would want
  marker clustering (`@googlemaps/markerclusterer`).

## Result
A real, live Operations Command Center is in place: Google-Maps live maps (drivers/orders/merchants +
heatmap), realtime streaming (after fixing the publication gap), batch dispatch, dispatch monitoring, and
geographic/zone/operations analytics. The only blocker to rendered map tiles is the **Google Maps API
key** (config), and richer geo (zone polygons, marker clustering, per-second tracking) are scoped
fast-follows.
