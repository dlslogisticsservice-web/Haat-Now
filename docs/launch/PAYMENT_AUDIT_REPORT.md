# Payment Audit Report — Production Launch Sprint

Date: 2026-07-07 · Method: full trace of the payment pipeline (client → orchestrator → edge
functions → DB) + provider grep. No code changed during the audit.

## Providers — status

| Provider | Status | Evidence |
|---|---|---|
| **Moyasar** | Production-ready (backend), sandbox-gated by env | Only wired gateway. `payment-initiate/refund` call `api.moyasar.com`; `payment-webhook` HMAC-verifies Moyasar. Needs `MOYASAR_SECRET_KEY` + `MOYASAR_CALLBACK_URL`. |
| **Stripe** | Partial — webhook-parse stub only | `payment-webhook` has `parseStripe`, but nothing ever *initiates* a Stripe charge. Catalog entry in `platformModel.ts`. |
| **Paymob** | Missing — config-catalog only | One row in `PROVIDER_CATALOG`; zero implementation in `src` or `supabase/functions`. |
| **Apple Pay / Google Pay / Mada** | Config/env only | Declared in `.env.example`; `mada`/`apple_pay` appear as UI labels; Mada routes through the Moyasar/card path. |
| **COD (cash on delivery)** | **First-class as of this sprint** | Order via the existing order engine + a COD record on the single pipeline (`paymentOrchestrator.recordCod` → `payment_attempts` provider `cod`). No gateway, no secret. |

## The single pipeline

- `paymentOrchestrator.initiate()` — the one client entry for hosted-gateway checkout; POSTs to
  the secure `payment-initiate` edge function (Moyasar), idempotent via `payment_idempotency`.
- `paymentOrchestrator.recordCod()` — **new**: first-class COD; writes a `payment_attempts`
  row (provider `cod`, status `pending`, key `cod:<orderId>`) and labels `orders.payment_method='cod'`.
  Reuses the pure COD model (`website-platform/finance/cod.ts`). No duplicated logic.
- `history()` — **fixed**: now reads `payment_attempts` (where live + COD attempts land) instead
  of the legacy unused `payment_transactions`.

## Edge functions (`supabase/functions/`)

`payment-initiate` (Moyasar charge → hosted URL), `payment-verify` (read-only status poll),
`payment-webhook` (HMAC + idempotent capture → `orders.payment_status='paid'`), `payment-refund`
(Moyasar refund; **requires `gateway_reference` → not applicable to COD**). All need secrets +
deploy. **None are required for COD.**

## Payment tables

`orders.payment_status` (unpaid/paid/refunded/partially_refunded, default unpaid),
`payment_attempts` (live ledger; provider/amount/status/idempotency_key), `payment_idempotency`
(initiate lock), `payment_methods`, `refunds`, `webhook_events`. RLS present on the attempt/
idempotency tables (customer read/insert-own). **New:** `orders.payment_method` (additive
migration `20260707000001`).

## Key correctness findings (from the audit)

1. Live checkout previously had **no cash/COD branch** — every live order forced Moyasar
   (503 without the secret). Fixed for the website launch surface (COD).
2. Settlement/commission/driver-credit are **payment-method-agnostic** (key off
   `status='delivered'` + `delivery_fee`) → COD orders settle without any gateway.
3. `capture_order_commission` RPC exists but is **never invoked** in app code → ledger
   commission postings won't happen automatically (P1, reporting; not a settlement dependency).
4. COD refund has no gateway path → handled as a support-ticket refund (`cxService.createTicket`
   type `refund`) + wallet/compensation (finance). Acceptable for COD launch.

## Reuse posture

No business logic duplicated. COD is a thin, first-class method on the existing orchestrator +
order engine + finance settlement. Card gateways (Moyasar) remain untouched.
