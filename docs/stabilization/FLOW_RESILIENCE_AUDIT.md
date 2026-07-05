# Flow Resilience Audit — HaaT Now

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> Happy / Failure / Recovery / Abuse / Edge paths for each critical workflow. Evidence cited `file:line`.

Legend: ✅ handled · ⚠️ partial · ❌ unhandled / can break integrity.

---

## 1. Order Placement

| Path | Behaviour | Verdict |
|---|---|---|
| Happy | 3 sequential inserts + notify (`order.service.ts:25-77`) | ✅ works |
| Failure — items insert fails | compensating `deleteOrder` (`:59-61`) | ⚠️ best-effort, not transactional |
| Failure — crash between order & items | **orphan order, no items** | ❌ no DB txn, no create RPC |
| Abuse — double submit | UI flag only (`CheckoutPage.tsx:293`); two clicks → **two orders**, each with its own idempotency key `initiate:<newOrderId>` | ❌ no DB dedup |
| Edge — client-tampered total | `total_amount`/`delivery_fee` authored by client at insert; payment re-derives from DB but the **order row** keeps the client value | ⚠️ price authority only at payment, not at order |

**Break point:** network drop or crash mid-create → orphan orders; scripted double-submit → duplicate orders. **Fix:** single `create_order` RPC with a client-supplied idempotency key + `UNIQUE`.

## 2. Payment

| Path | Behaviour | Verdict |
|---|---|---|
| Happy | Moyasar charge, amount from DB (`payment-initiate:122-126`) | ✅ |
| Payment timeout / no webhook | attempt stays `pending`; order stays `unpaid`; **no reconciliation job** re-polls Moyasar | ⚠️ manual `payment-verify` only |
| Duplicate payment (double initiate) | client lock (`payment-orchestrator:25-33`) + paid-state re-check; but attempt key is random UUID and "reuse pending" read is unlocked (`payment-initiate:130-163`) | ⚠️ client-dependent |
| Webhook replay | UNIQUE `idempotency_key` + 23505 race catch + no-downgrade guards (`payment-webhook:101-209`) | ✅ solid |
| Forged webhook | HMAC-SHA256, constant-time, **fail-closed** if secret missing (`payment-webhook:62-85`) | ✅ solid |
| Abuse — direct edge call bypassing client lock | edge function has no order-scoped dedup | ⚠️ |

**Break point:** a caller that skips the browser orchestrator can create a second Moyasar charge for one order. **Fix:** derive the attempt idempotency key from `order_id` (+ deterministic salt) and enforce `UNIQUE(order_id, active)` in the edge path.

## 3. Refund — ❌ highest money-integrity risk

| Path | Behaviour | Verdict |
|---|---|---|
| Happy | edge `payment-refund` sums prior refunds, checks ceiling, inserts, calls Moyasar (`payment-refund:131-213`) | ⚠️ |
| Concurrent partial refunds | **no row lock, no UNIQUE on `refunds`** → both pass the ceiling check → **over-refund** | ❌ |
| Gateway call fails after DB write | order already marked `refunded`/`partially_refunded` **before** the Moyasar call; `refunds` row stuck `pending` with null ref | ❌ persistent inconsistency (acknowledged in-code) |
| Ledger | refund never calls `post_ledger` | ❌ money-out invisible to finance |
| In-app trigger | **none** — no code inserts a refund (verified) | ❌ ops must call the edge fn manually |

**Break point:** double-refund race + refund-before-gateway ordering. **Fix:** wrap in a single txn (insert refund with `SELECT FOR UPDATE` on prior refunds, unique guard), call gateway first / use a saga, and post to `customer_refund` ledger account.

## 4. Wallet — ✅ resilient

`FOR UPDATE` lock, negative guard, atomic update+ledger (`20260614000003:4-61`); `complete_delivery` rolls back all-or-nothing (`20260614000012:49-169`). Race-safe. Only latent issue: no `UNIQUE(owner_type, owner_id)` on `wallets`.

## 5. Dispatch & Driver Assignment — ❌ multiple break points

| Path | Behaviour | Verdict |
|---|---|---|
| Happy (live, admin-driven) | `auto_dispatch_order`→offer→`respond_dispatch` race-safe (`operations_engine:213-267`) | ✅ within System A |
| Auto-trigger on new order | **none** — orders sit unassigned until an admin clicks (`OperationsCenter.tsx:118-154`) | ❌ |
| Driver rejects offer | assignment → `rejected`; order stays unassigned; **no auto-reassign** (no scheduler) | ⚠️ manual |
| Offer timeout | `expire_dispatch_offers` runs **only on admin click** — no cron | ❌ |
| Driver accepts via DriverApp | separate `acceptDeliveryAtomic` path; does **not** update `dispatch_assignments` or `active_orders` | ❌ two systems diverge |
| Post-delivery | `finalize_driver_delivery` (frees workload) is **never called** | ❌ `active_orders` leaks forever |
| Concurrent grab of same order | `acceptDeliveryAtomic` guarded `where driver_id is null` (`driver.repository.ts:47-52`) | ✅ single-winner |
| Merchant never accepts | **no timeout, no auto-cancel** | ❌ order can hang indefinitely |

**Break points:** no automatic dispatch; no timeout automation; workload accounting corrupts scoring over time; two assignment systems with inconsistent state.

## 6. Delivery Completion — ✅ resilient

Fully atomic + idempotent (`20260614000012`). Double-complete short-circuits; `UNIQUE(order_id)` on `driver_earnings` prevents double pay. Only gap: dispatch workload not freed (§5).

## 7. Inventory — ❌ no coupling

Stock never decremented on order (`order.service.ts:10-78` has no stock call; `adjust_product_stock` is manual-only). **Overselling is possible** — two customers can buy the last unit; "out of stock" reflects only manual merchant edits.

## 8. Notifications — ⚠️ silent failures

`sendNotification` inserts a row; failures are unchecked (`order.service.ts:74` result ignored). No push/SMS/email delivery. Status changes outside `orderService` fire nothing → customers can miss "order accepted"/"driver assigned".

## 9. Concurrency / Race summary

| Concern | Protected? | Evidence |
|---|---|---|
| Wallet double-spend | ✅ `FOR UPDATE` | `0003`, `0012` |
| Delivery double-pay | ✅ `UNIQUE(order_id)` | `0011:33-44` |
| Order grab by 2 drivers | ✅ guarded UPDATE | `driver.repository.ts:47-52` |
| Dispatch offer contention | ✅ `respond_dispatch` guard | `operations_engine:247-267` |
| Coupon over-redeem (per order) | ✅ `UNIQUE(coupon_id, order_id)` | `0029:10` |
| Webhook replay | ✅ `UNIQUE(idempotency_key)` | `0017` |
| **Refund over-refund** | ❌ | `payment-refund:131-161` |
| **Duplicate order** | ❌ | `order.service.ts:10-78` |
| **Duplicate charge (direct edge)** | ⚠️ client-only | `payment-orchestrator:25-33` |
| **Inventory oversell** | ❌ | no order↔stock link |
| **Driver workload accounting** | ❌ | `finalize_driver_delivery` dead |

## 10. Missing resilience infrastructure (platform-wide)

- **No background job runner / scheduler** — no pg_cron, no scheduled edge function. Everything time-based (offer expiry, segment recompute, settlement runs, payment reconciliation) is **manual button clicks**. This is the single biggest operational-resilience gap.
- **No dead-letter / retry** for notifications or webhooks beyond provider retry.
- **No saga / compensation framework** — cross-step failures (order↔payment↔dispatch↔refund) have no orchestrated rollback; each is best-effort in app code.
- **No idempotency at order creation.**

**Overall resilience verdict:** The **atomic DB RPCs** (wallet, delivery, coupon, webhook) are genuinely robust. The **orchestration between flows** — where enterprises actually lose money — relies on the browser and manual admin action, and has several unguarded break points (refund, duplicate order, inventory, dispatch automation).
