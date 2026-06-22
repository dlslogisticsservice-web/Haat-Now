# RESUME_STATUS.md

Resume check after interruption. Verified against the live working tree + git, not assumed.

## Completed (saved + committed + build-verified)
- **DriverApp fixes** — `onLogout` prop, sandbox demo data, logout + language topbar, sandbox online-toggle, GPS no-op in sandbox. (commits `ebc29ba`, `a87ecf3`)
- **MerchantApp fixes** — `onLogout` prop, sandbox demo data, logout + language topbar, mobile tab nav. (`ebc29ba`)
- **Admin logout/navigation** — `onLogout`, visible logout + language + refresh, mobile tab nav. (`8a07729`)
- **Saudi Admin demo account** `+201000000006` (scope=country, SA) in `auth.service.ts` `DEMO_ACCOUNTS`. (`ebc29ba`) — marker confirmed (1 hit).
- **App.tsx wiring** — `onLogout={handleLogout}` passed to Admin, Merchant, Driver. (markers confirmed: 1 each)
- **Builds** — `tsc --noEmit` clean; `npm run build` exit 0 (re-confirmed now).
- **Later runtime verification** — portals 30/30 PASS, full order lifecycle 10/10 PASS (already committed in `a87ecf3`).
- Working tree: no uncommitted source changes.

## Partially Completed
- ~~Customer WalletScreen sandbox data~~ → **NOW COMPLETE.** `WalletScreen.tsx` reads `sandboxStore.getWallet('customer', customerId)` + derives transactions from sandbox orders in sandbox mode. Runtime-verified: wallet renders balance, no error (PASS). `tsc` clean, build exit 0.

## Not Started
- Nothing else from this sprint. (Production-cutover fixes — phone provider, `0019`, `order_country_code`, build-time sandbox strip — are DB/dashboard/ops items, out of this implementation sprint and already documented elsewhere; not started here by design.)

## Next Immediate Task
✅ Done — `WalletScreen.tsx` wired to `sandboxStore`. With this, **all customer-facing portals (home, restaurant, cart, checkout, orders, wallet) + merchant/driver/admin show data in sandbox**, and the interrupted sprint has no remaining unfinished items. No further sprint tasks pending.
