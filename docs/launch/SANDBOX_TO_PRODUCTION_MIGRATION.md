# Sandbox → Production Migration Plan (Launch Sprint 3, Part 1)

Goal: remove every **production** dependency on sandbox/demo data so the website (and app)
run on the real backend. The code already supports this — the dual-mode split routes to live
services when `VITE_AUTH_MODE` is not `sandbox`. This plan sequences the switch.

## How the dual mode works (why this is config, not a rewrite)

- `lib/supabase.ts`: when `VITE_AUTH_MODE=sandbox`, exports a **no-op Proxy stub** (empty
  results, no network). Otherwise it constructs a real Supabase client from
  `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- Every service branches `SANDBOX ? sandboxStore/demo : realService`. The **live branch
  already exists** in all 19 service files — it is simply not exercised in the demo build.
- `vite.config.ts` currently forces the demo build. Production must build with live env.

## Migration phases

### Phase A — Backend provisioning (prerequisite)
1. Provision the Supabase project; apply all migrations in `supabase/migrations/`.
2. Deploy edge functions (payments verify, order RPCs, tracking RPC, support RPCs).
3. Seed real catalog: merchants, branches, products (+variants/images), zones, coupons.
4. Configure secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, payment gateway
   (Moyasar) keys, and app-config rows (delivery fee, service fee, VAT rate, min order).

### Phase B — Build & environment flip
1. Build with `VITE_AUTH_MODE` unset (or `live`) + Supabase env present (`npm run build:live`).
2. Remove/guard the sandbox force in `vite.config.ts` for the production target.
3. Verify `MISSING_SUPABASE_VARS` is empty at boot (main.tsx guard).

### Phase C — Wire config-driven fees (remove remaining defaults)
1. Point `features/website/checkout.ts::websiteFeeConfig()` at admin app-config:
   - `deliveryFee` ← `MIN_DELIVERY_FEE` (already read by app CheckoutPage).
   - `serviceFee` ← `DEFAULT_SERVICE_FEE` / admin config.
   - `taxRate` ← regional VAT app-config (default 0.15).
   - `freeDeliveryThreshold`, `minOrder` ← app-config.
2. Confirm no literal fee remains (audit: only `config/fees.ts` defaults + engine inputs).

### Phase D — Data-path verification (per surface)
| Surface | Live service to verify | Acceptance |
|---|---|---|
| Website discovery | `homeService.getFeed()` | Real branches/offers render (not curated). |
| Website menu | `productService.getProductsByBranch()` | Real products + variants. |
| Website checkout | `orderService.createOrder()` (RPC `create_order`) | Server-priced order row created. |
| Coupons | `checkoutService.verifyCoupon()` | Real validation + `redeem_coupon`. |
| Payment | `paymentOrchestrator.initiate()` + verify | Moyasar redirect + status poll. |
| Tracking | `cxService.tracking()` + `subscribeTracking()` | Live driver/ETA/timeline. |
| Refund/Support | `cxService.createTicket()` | Ticket persisted. |
| Wallet/Loyalty | `walletService` / `loyaltyService` | Real balances/points. |

### Phase E — De-risk & cut over
1. Run the full gate suite against a staging Supabase (lint, tests, build:live, E2E).
2. Smoke the website commerce journey against live data (the 9-check commerce smoke).
3. Canary a subset of traffic; monitor the Launch Validation funnel
   (`website-platform/analytics/funnel.ts`): checkout completion, abandonment, order success,
   refund/support completion, tracking latency.
4. Full cut-over once funnel metrics are within target.

## Guardrails
- Do not delete sandbox branches — they power the demo build and local/E2E. Gate by env only.
- Keep the graceful fallbacks (empty live data → curated/empty state) so a partial backend
  never white-screens.
- The mobile app remains **one client** of the same services; the website is not downstream of it.

## Definition of done
- Production build uses live Supabase; `VITE_AUTH_MODE` is not sandbox.
- Website commerce journey completes on real data end-to-end.
- No literal fee anywhere except `config/fees.ts` defaults; all effective fees come from config.
- Funnel metrics green on canary.
