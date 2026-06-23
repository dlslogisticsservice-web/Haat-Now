# Driver System Stress Report — HAAT NOW

**Date:** 2026-06-24 · Measured on the live DB at 500k orders / 20k drivers (post-index).

## Status-transition latency (accept / pickup / delivered)
- `update orders set status=…, driver_id=… where id=…` → **PK update, sub-ms DB** (network-dominated wall
  time only).
- driver active-orders read (`driver_id` + status) → **2.6 ms** (was 33.8 ms Seq Scan), via partial index
  `idx_orders_driver`.
- `order_status_history` append → indexed by `order_id`.

## 200 concurrent driver status updates
PK updates at sub-ms each → ~0.2 connection-second of work → **trivial** for any tier. Update latency is
not a bottleneck.

## Realtime / websocket load — the binding constraint
- 20,000 drivers each holding a Realtime subscription **exceeds Supabase Realtime concurrent-connection
  defaults** (Free **200**, Pro **500**). This is the limiter for the fleet, not DB throughput.
- Realtime message **throughput** is fine; **concurrent connections** are the ceiling.
- Mitigation (BN-H1): Team tier (configurable concurrency) and/or **zone-scoped channels** (~500 zones)
  instead of per-driver global channels, bounding fan-out; low-priority state can poll on interval.

## Verdict
DB-side driver operations scale to 20k drivers at sub-ms / 2.6 ms. The **realtime connection count** is the
only gate to a 20k-driver live fleet — a tier/architecture decision, not a code defect.
