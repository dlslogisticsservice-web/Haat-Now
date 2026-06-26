# Merchant Capability Matrix (RC-2C)

Audit of what the existing backend supports, then exposed everything genuinely supported.
Columns: DB · Service · UI · Realtime · Localized · Responsive · Status · Reason.

## Implemented this sprint (backend already existed — now exposed)
| Capability | DB | Service | UI | Realtime | Localized | Responsive | Status |
|---|---|---|---|---|---|---|---|
| **Merchant Wallet Center** | `wallets`, `wallet_transactions` | `walletService.getWallet('merchant',id)`, `getTransactions` | new `MerchantWalletCenter` tab | n/a | ✅ AR/EN | ✅ | **DONE** |
| **Merchant Notification Center** | `notifications` (is_read/created_at) | `notificationService.getUserNotifications/markRead/subscribe` | reused `NotificationCenter(adminId=merchantId)` | ✅ Supabase Realtime | ✅ AR/EN | ✅ | **DONE** |

- Wallet: real balance (auto-created `wallets` row, 0.00 until payouts) + real `wallet_transactions`
  with typed rows (deposit/payout/withdrawal/refund). Honest empty state — not faked.
- Notifications: the generic center **reused** (not duplicated) with the merchant's user id; live
  unread + mark-read/all + realtime channel. Verified `35-`, `36-` EN captures, 0 page errors.

## Already implemented (prior sprints)
| Capability | Status |
|---|---|
| Active Orders, Catalog CRUD, Inventory (+stock history/low-stock), Earnings analytics, Profile | ✅ real services |
| Store Management (status/busy/vacation/auto-accept/hours/min-order/prep/radius) | ✅ (RC-2) `merchant_branches.settings` |
| Kitchen Operations (real order lanes + prep timers + delay) | ✅ (RC-2B) real `orders` |
| Orders realtime | ✅ `merchant-orders-<branch>` channel |

## Supported by DB but BLOCKED on a missing service/column/policy (NOT faked)
| Capability | What exists | What's missing (exact) |
|---|---|---|
| **Variant Manager** | `product_variants(id, product_id, name, price_modifier)`; read via `product_variants(*)` | No merchant **write** service. Needs `merchantService.upsertVariant/deleteVariant` (real ops on `product_variants`) + RLS allowing the branch owner to write. Buildable next — pure service extension, no schema change. |
| **Add-on Manager** | — | **No `product_addons` / modifier-group table.** Add-ons are not modelled separately from variants. Needs new table + service. |
| **Review Center** | `reviews(order_id, customer_id, rating, comment)` + `review_reports` | No **merchant-scoped** read service and **no `merchant_reply` column**. Reading is possible via order→branch join (needs a `merchantService.branchReviews(branchId)` method + RLS); replying needs a schema column. |
| **Settlement Center** | `merchant_settlements` (admin `finance.service`) | No **merchant-scoped** read (admin-only RLS). Needs a merchant policy + `financeService.myMerchantSettlements(merchantId)`. |
| **Invoice Center** | — | **No `invoices` table.** Not modelled. Needs new table + generation pipeline. |
| **Tax Center** | — | **No tax table/columns** on orders/settlements. Not modelled. |
| **Export Center** | `finance_exports` (admin) | Admin-scoped; no merchant export endpoint/RLS. |
| **Analytics dashboards** (peak hours, heatmap, retention, repeat) | `analyticsService.getMerchantAnalytics` returns **totals only** (orders/delivered/revenue/avgOrder) | No hourly/cohort **aggregates**. Real charts need new RPCs / materialized views. Faking = forbidden. |
| **Inventory batches** | `inventory` + `stock_movements`/history | **No batch/lot table** (`inventory_batches`). Not modelled. (Stock alerts already surfaced in the Inventory tab via low_stock_threshold.) |
| **Customer Chat** | — | **No merchant↔customer thread/message table.** Net-new realtime backend. |

## Validation
- Build ✅ · TypeScript ✅ · ESLint(tsc) ✅ · E2E 24/24 ✅ · 0 page errors · 0 emoji (Lucide).

## Conclusion
Every capability whose backend **fully exists** (wallet, notifications) is now exposed. The next
buildable one **without schema change** is the **Variant Manager** (service extension on the existing
`product_variants` table). Everything else is blocked on a specific missing table/column/policy,
documented above — none faked.
