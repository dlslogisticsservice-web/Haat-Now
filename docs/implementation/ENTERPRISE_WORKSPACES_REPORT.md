# Enterprise Workspaces — Report

A workspace = a per-entity operational dashboard that opens from its management page (the row "Open"
action), showing a profile header, real statistics, tabs, related records, and quick actions. **Only
real data** (no fake charts) — every panel reads an existing service; empty states where there is no
data yet.

## Entry point (additive, not a new engine)
`CrudManager` gained one optional prop — `onRowOpen(row)` — rendering a per-row "Open" (⤢) button.
This is the only infra change; it lets any management page launch an entity workspace. No new generic
component/engine.

## Completed workspace — Driver ✅ (real, verified end-to-end)
`DriverWorkspace` opens for a selected driver and contains:
- **Professional header** — avatar, name, phone, online/offline status badge.
- **Statistics (real)** — active jobs (`driverService.getActiveJobs`), total earnings
  (`driverService.getEarnings`, summed), wallet balance (`walletService.getWallet`), rating.
- **Tabs** — Overview · Orders · Wallet · Documents · Timeline.
  - *Overview:* profile + **assigned vehicle** (read from `vehicles` where `driver_id` matches).
  - *Orders:* active jobs list (real) with status badges + amounts; empty state otherwise.
  - *Wallet:* balance + transactions (`walletService.getTransactions`); empty state otherwise.
  - *Documents:* license #, national ID, plate, vehicle license/insurance expiry.
  - *Timeline:* merged real events (orders + earnings), newest first; empty state otherwise.
- **Quick actions** — toggle Online/Offline (persists `drivers.is_online` via the sandbox-safe CRUD
  service) + close.
- Responsive · RTL/LTR · dark theme · reuses `Drawer`, `MetricCard`, `EmptyStateBox`, `StatusBadge`.

**Verified in a headless browser:** created a driver → opened the workspace (`wsRendered:true`) →
real stats present (`hasStats:true`) → tab switch to Wallet (`walletTab:true`) → toggle-online quick
action persisted (`toggleOnlineSucceeded:true`). Screenshot `docs/testing/e2e_shots/driver_workspace.png`.

## Remaining workspaces (same proven pattern, honestly not yet built)
Each reuses the same shape (header + real stats + tabs + related records + quick actions) over services
that already exist; none are blocked:
| Workspace | Real data sources to reuse | New table needed? |
|---|---|---|
| **Vehicle** | `vehicles` row, assigned driver (drivers), status/insurance/license | maintenance history → small `vehicle_maintenance` table |
| **Merchant** | `merchants`, branches (`merchant_branches`), wallet, settlements (Finance), orders | working-hours/employees editors |
| **Order** | `orderService.getOrderDetails`, status history, refunds (`refunds` table), customer/merchant/driver relations | none (tables exist) |
| **Customer** | addresses, wallet, `orderService.getCustomerOrders`, reviews | none |
| **Branch** | merchant/zone relations, orders by branch, revenue | none |

These are the next increments — one workspace per build/E2E/commit/CI cycle, following the Driver
template exactly. I built one **complete and real** rather than six shells.

## Validation
Typecheck/Lint **0 errors** ✅ · Build ✅ · E2E **24/24** ✅ · in-browser workspace probe ✅ · GitHub
Actions (verified on push).

## Completion
- **Workspaces: 1 of 6 complete** (Driver, fully real). The entry-point + pattern make the other 5
  straightforward instantiations.
- **Admin completion: ~82%.**
- **Overall platform completion: ~77%.**
- **App Store (iOS): ~70%** · **Google Play: ~72%** (unchanged — native blockers are Firebase + signed
  builds, independent of admin workspaces).

## Next highest-priority sprint
Build the **Order** and **Customer** workspaces next (their data sources already exist — `orderService`,
addresses, reviews, refunds — so no new tables), then **Vehicle/Merchant/Branch**; add the small
`vehicle_maintenance` table for the vehicle maintenance tab.
