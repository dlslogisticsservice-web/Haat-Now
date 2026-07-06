# Customer Portal (Wave 3, Part 4)

> The website customer account area — a **facade over the same app services** the mobile app uses
> (no duplicated logic). `portal/portal.ts`. Flag: `website.customer_portal`. Reusable by every tenant.

## Principle: reuse, don't reimplement
`CustomerPortalPort` + `AppServicesCustomerPortal` delegate **1:1** to the existing services:
| Portal capability | Delegates to |
|---|---|
| Wallet + transactions | `walletService.getWallet` / `getTransactions` |
| Loyalty points + history (Rewards) | `loyaltyService.getPoints` / `getHistory` |
| Saved orders / order history | `orderService.getCustomerOrders` |
| Favorites | `cxService.favoriteProductIds` |
| Notifications + unread + mark read | `notificationService.getUserNotifications` / `getUnreadCount` / `markRead` / `markAllRead` |

All methods return the platform `Result` type wrapping the app's own domain types (`Wallet`,
`LoyaltyTransaction`, `Order`, `Notification`, …) — typed success/error, no exceptions, and **zero**
portal-owned business logic (balances, points, orders all compute in the app services, so web and app
never drift).

## Realtime (Part 3)
Live account updates use the `RealtimePort` (`realtime/realtime.ts`), which reuses the app's Supabase
realtime channels: `onCustomerOrders`, `onDriverLocation`, `onOrderTracking` (notify-style; the
consumer refetches the tracking snapshot), `onNotifications`. No new realtime infrastructure.

## Coverage vs Part 4
Fully wired via existing services: **Wallet, Loyalty, Rewards, Saved Orders, Favorites,
Notifications**. Profile/Addresses/Saved-Cards/Support-Tickets/Refund-Requests/Downloads are surfaced
through the same delegation pattern against their respective app services/pages as those UIs are wired
in (each is an app service call, not new logic) — the port extends without changing the pattern.

## Runtime note
`AppServicesCustomerPortal` runs in the browser (the app services read `import.meta.env` at load, so
they execute in the app/E2E, not the Node unit tests). Its correctness (implements the port →
delegates) is guaranteed by the compiler; the contract is exercised via a port-shaped fake, matching
the platform's isolation convention.

## Reusability
Brand-agnostic + tenant-scoped (enforced by the app services + RLS). Every white-label tenant's
website gets the identical portal over the identical backend.
