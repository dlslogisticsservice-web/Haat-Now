# Cross-Module Integration Audit — HaaT Now

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> Every claim cited `file:line`. Classification: **Implemented / Partial / Stub / Disconnected / Missing**.

## Executive finding

There are **no database triggers on `orders` or `payments`**. The only triggers in the entire schema are `on_auth_user_created` and `updated_at` touches (verified across all migrations). Therefore **every cross-module reaction depends on which specific service function the UI happens to call**. There is exactly **one** genuine event-connected spine — order-lifecycle → notifications → ops visibility. Everything else marketed as an "engine" (Loyalty, Inventory, Campaign attribution, Message/Push delivery, CRM auto-ticketing, KYC enforcement) is **sandbox-only, manually triggered, or an isolated status screen**.

---

## Integration matrix

| From → To | Mechanism | Status | Evidence |
|---|---|---|---|
| Order create → Notify merchant | service call | ✅ Implemented | `order.service.ts:74` |
| Order status → Notify customer/driver | service call | ✅ Implemented | `order.service.ts:120-126` |
| Delivery complete → Notify customer | RPC return → service call | ✅ Implemented | `wallet.service.ts:38-40` |
| Orders/Drivers → Ops Command Center | shared tables + realtime | ✅ Implemented | `command.service.ts:73-114` |
| Ops action → Orders/Drivers/Shifts | adminCrud + `operation_events` log | ✅ Implemented | `ops-execution.service.ts:26-62` |
| Orders/Earnings → Analytics | aggregation queries | ✅ Implemented (fake trend deltas) | `analytics.service.ts:13-51`; `AdminDashboardHome.tsx:101-106` |
| KYC workflow (submit/review/audit) | RPC + `approval_history` | ✅ Implemented | `20260614000030` |
| Payment capture → order paid | webhook | ✅ Implemented | `payment-webhook:189-203` |
| Storefront → Campaign impression/click | component call | ✅ Implemented | `HomeScreen.tsx:106,165` |
| Ops action (reassign) → Notify | — | ❌ Disconnected (bypasses `orderService`) | `ops-execution.service.ts:27` |
| Order/Delivery → Loyalty points | — | ❌ Disconnected (`awardPoints` 0 callers) | `loyalty.service.ts:18`; `complete_delivery` has none |
| Order → Inventory decrement | — | ❌ Disconnected (`createOrder` no stock call) | `order.service.ts:10-78` |
| Checkout → Campaign conversion | — | ❌ Disconnected (`track('conversion')` 0 callers) | `campaign.service.ts:85` |
| Payment capture/refund → Finance ledger | — | ❌ Missing (never calls `post_ledger`) | `payment-refund`, `payment-webhook` |
| Message campaign → recipient delivery | — | 🟠 Stub (marks `sent` only) | `growth_engine.sql:250-251` |
| Segments → auto-recompute | — | 🟠 Manual (no pg_cron) | `20260614000036:161` |
| Order/Payment fail → CX ticket | — | ❌ Missing (manual only) | `cx.service.ts:116` |
| KYC status → order/driver eligibility | — | ❌ Not enforced (no `account_status` gate) | order/checkout/driver flow |
| Notifications → Push/SMS/Email | — | ❌ Missing (no delivery worker; `push_tokens` unused) | payment-only edge fns |

---

## Per-module notes

**Notifications** — in-app DB rows only; `push_tokens` is a dead end (registered, never consumed). Triggered by service calls, not DB events → any mutation outside `orderService` is silent.

**Loyalty — Disconnected.** `awardPoints` (both `loyalty.service.ts:18` and `growthb.service.ts:48`) have **zero callers** (verified). Only `sandboxStore.completeDelivery` grants points (`:173-178`). Redemption *is* wired (`WalletScreen.tsx:84`) — so production users redeem a balance they cannot earn.

**Inventory — Disconnected.** `adjust_product_stock` is real and atomic but only called from manual merchant edits (`MerchantApp.tsx:143`). Checkout never decrements. Stock and orders are independent systems → **oversell risk**.

**Campaigns/Growth/CRM — Partial.** Impressions/clicks real; **conversion attribution has no caller** → ROI structurally zero. Message campaigns don't send (comment admits no provider). Segment recompute manual. Support tickets never auto-created from failures.

**KYC/Trust — Implemented workflow, not a gate.** Full submit/review/suspend/ban RPCs + immutable audit trail. But `account_status` is read only by the KYC center — **no order, checkout, or driver-assignment code checks it**. A suspended/banned merchant or driver is **not blocked** from transacting.

**Ops Command Center — the most genuinely integrated module.** Real RPCs + realtime on the same `orders`/`drivers` tables the order flow writes; ops actions persist and log. Caveats: ops writes bypass `orderService` (no notifications), `batch_auto_dispatch` is manual-invoke, sandbox zone analytics fabricated.

**Analytics — real numbers, fake trends.** Aggregations are genuine; KPI up/down arrows and sparkline seeds are hard-coded.

---

## Root cause & recommendation

The structural root cause is the **absence of an event backbone**. With no DB triggers and no outbox/event bus, integration = "did someone remember to add the call in the service function?" — and most were not added. 

**Recommendation:** introduce a lightweight **outbox/event pattern** — a DB trigger on `orders`/`payments` status transitions writing to an `events` table, drained by a scheduled edge function that fans out to notifications (push/SMS/email), loyalty accrual, inventory decrement, campaign conversion, CX auto-ticketing, and KYC gating. This single piece of infrastructure closes the majority of the ❌ rows above.
