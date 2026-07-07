# COD Production Report — Production Launch Sprint

COD (Cash on Delivery) is treated as a **first-class production payment provider**, routed
through the existing payment engine, order engine and settlement engine. No temporary path, no
duplicated logic. COD requires **no gateway and no secret** — this is what makes it the
launch-enabling method.

## COD lifecycle — status after this sprint

| Stage | Status | Mechanism (reused) |
|---|---|---|
| **Order creation** | ✅ Ready | Website checkout → existing order engine (`sandboxStore.createOrder` demo / `orderService.createOrder` live). No gateway call. |
| **Recorded on payment engine** | ✅ Implemented | `paymentOrchestrator.recordCod()` → `payment_attempts` (provider `cod`, status `pending`, idempotent `cod:<orderId>`) + `orders.payment_method='cod'`. |
| **Order confirmation (merchant)** | ✅ Ready | `orderService.updateOrderStatus(id,'accepted')` / demo `setStatus`. Unchanged. |
| **Driver assignment** | ✅ Ready | Existing dispatch / `assignDriver`. Payment-method-agnostic. |
| **Cash collection** | ✅ At delivery | Driver `complete_delivery` RPC (credits driver wallet from `delivery_fee`). Reporting flip `payment_status→paid` = P1 refinement (see below). |
| **Merchant settlement** | ✅ Ready | `generate_merchant_settlement` — keys off delivered orders + commissions; **method-agnostic**. |
| **Driver settlement** | ✅ Ready | `generate_driver_settlement` / `pay_driver_settlement`. Method-agnostic. |
| **Accounting entries** | ⚠️ P1 | Ledger via `capture_order_commission` exists but is **not auto-invoked**; finance dashboards still compute revenue from delivered orders. Wire the RPC to the delivery event post-launch. |
| **Receipts** | ✅ Ready | `website-platform/finance/receipt.ts` renders a full receipt (line/fee/VAT/tip) from the pricing breakdown; downloadable on the order screen. |
| **Invoices** | ✅ Ready | `website-platform/invoices/invoice.ts`. |
| **Refund** | ✅ Ready (ticket path) | COD has no gateway reference → refund = support ticket (`cxService.createTicket` type `refund`) + wallet/compensation (finance). |
| **Cancellation** | ✅ Ready | `orderService.cancelOrder` (pending-only). No gateway to reverse for COD. |
| **Reporting / analytics** | ✅ Ready | Finance dashboards + `orders.payment_method` index for COD reporting. |

## What was implemented this sprint (code)

- `website-platform/finance/cod.ts` — pure COD model (`buildCodRecord`, `markCodCollected`,
  `codPaymentStatus`, `codRequiresGateway`). Node-tested (5 payment tests).
- `paymentOrchestrator.recordCod()` — COD on the single pipeline; `history()` fixed to read
  `payment_attempts`.
- Website checkout: COD is the **default and only enabled** method ("Cash on Delivery (COD)");
  `placeWebsiteOrder` records COD through the engine. Card/Wallet shown as "coming soon".
- Migration `20260707000001_cod_payment_method.sql` — additive `orders.payment_method` + index
  + provider docs. Idempotent.

## Verified

- COD commerce smoke (headless, sandbox): menu → cart → checkout (COD selected, no gateway) →
  order placed → live tracking → receipt. **5/5, 0 console errors.**
- COD payment unit tests: **5/5** (no gateway, full-amount due, pending→collected reconciliation,
  amount == pricing-engine total, non-negative).

## Remaining COD tasks (not launch-blocking)

- **P1** — Flip `orders.payment_status → paid` and call `capture_order_commission` when the
  driver marks delivered (reporting/ledger completeness; settlement already pays out).
- **P1** — App (mobile) `CheckoutPage` still card-only in live; add the COD branch there too
  (the website is the COD launch surface for now).

## COD needs NO secret

Order → delivery → driver wallet credit → settlement all run on Supabase RPCs off
`status='delivered'` + `delivery_fee`, with zero `MOYASAR_*`/gateway references. Provision the
backend and COD works end-to-end.
