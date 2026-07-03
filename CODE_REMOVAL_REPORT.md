# Code Removal Report

Code removed in Phase 4, **only after** verifying zero remaining references. Every removal was followed by a
successful `npm run lint`, and the sprint ended with build ✓ and **E2E 24/24**.

## Removed

### 1. `src/services/payment.service.ts` — **DELETED (685 LOC)**
- **What:** the client-side "payment gateway adapters" module — a simulation (fabricated `Math.random()`
  references, commented-out real gateway calls, `process.env.*` keys that are empty in the browser bundle).
- **Why:** duplicate/non-canonical of the payment domain. The canonical real charge is server-side
  (`payment-initiate` edge function via `paymentOrchestrator.initiate()`).
- **Zero-reference proof (before deletion):**
  - `grep "payment.service'" src` (imports) → **NONE** outside the orchestrator.
  - `grep "validatePaymentCredentials|PaymentProvider|PaymentRequest|PaymentResult|RefundRequest" src` (types/fns)
    → **NONE** outside `payment.service.ts` + the orchestrator.
  - 0 UI/feature imports.

### 2. `payment-orchestrator.service.ts` — mock/pass-through methods **REMOVED (~87 LOC net)**
- **Removed:** `pay()`, `refund()`, `providers()` (backed by the deleted mock); `wallet.*` (pass-through to
  `walletService`); `settlements.*` (pass-through to `financeService`); plus the now-unused `SUPPORTED_PROVIDERS`,
  `idempotencyCache`, `withRetry`, `PayOptions`, and the `paymentService`/`checkoutService`/`walletService`/
  `financeService` imports.
- **Kept (canonical):** `initiate()` (real edge-function path) + `reconcile()` + `history()` (real Supabase reads).
- **Zero-reference proof:** `grep "paymentOrchestrator.(pay|refund|providers|reconcile|history|wallet|settlements)" src`
  outside the file → **NONE**. `CheckoutPage` uses only `initiate()`.

### 3. `growth.service.ts → myTier()` — **REMOVED (4 LOC)**
- **What:** a duplicate of `growthb.service.myTier()` (both call RPC `resolve_loyalty_tier`).
- **Why:** canonical tier source is `growthb.service`.
- **Zero-reference proof:** `grep "\.myTier(" src` (non-service files) → only `growthbService.myTier` in
  `DiscoverScreen.tsx`; `growthService.myTier` had **no consumers**.

### 4. `OrdersList.tsx → STATUS_STEPS` — **REMOVED (6 LOC)**
- **What:** a status-step constant, dead since it was superseded by `STEP_FLOWS` (flagged in the audit).
- **Zero-reference proof:** `grep "STATUS_STEPS" src` → only its own (now-removed) declaration.

## Net effect
```
 9 source files changed:  +59 insertions / −785 deletions   (net −726 LOC)
 files deleted:           1  (payment.service.ts, 685 LOC)
 files added:             1  (src/config/fees.ts, canonical fee constant)
 files extended:          1  (src/services/types.ts, +29 LOC canonical status helpers)
```

## NOT removed (deliberately kept)
- **`payment-orchestrator` `reconcile()`/`history()`** — real, supabase-backed, thematically part of the canonical
  payment orchestrator; retained even though not yet UI-wired (removing unique real code is out of this sprint's
  duplication scope).
- **General dead files** unrelated to duplication (`CategoryIllustrations.tsx`, `AppPageLayout.tsx`,
  `LocationCard/Picker.tsx`, `seedHelper.ts`, `components/ui/index.ts`) — flagged by the audit as dead code, but
  **not duplication**; out of scope for this consolidation sprint. Left for a dedicated dead-code cleanup.
- **`sandboxStore` wallet/coupon/loyalty implementations** — the sandbox half of the dual-mode architecture;
  removing them would break the demo backend.

## Verification after removals
`npm run lint` → **0 errors** · `npm run build` → **✓** · `node docs/testing/e2e_runner.cjs` → **24/24 pass**.
No commit, no deploy (per sprint scope).
