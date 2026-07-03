# Canonical Architecture Registry

**Sprint:** Platform Consolidation. **Rule set:** no new features · no UI/visual change · preserve behavior ·
no placeholder/mock replacements (except replacing *duplicate real* implementations) · never large destructive
refactors · compile after every step.

This registry names the **single canonical implementation** for each duplicated domain the audit found, and
records — per domain — exactly what is safely unified in this sprint versus what is **defined-canonical but
deferred** because a full merge would change behavior or visuals (which the rules forbid).

## Guiding principle: dual-mode is not duplication
Many "duplicate" pairs are the **two halves of the sandbox/live architecture** (`VITE_AUTH_MODE`): a Supabase
service *and* a `sandboxStore` localStorage implementation for the same concept. These are **not** merged away —
merging would break the demo backend. Instead the canonical is a **facade** that routes sandbox↔live and exposes
one API, so callers stop branching on `SANDBOX` themselves. Deleting a real backend path is out of scope.

Likewise, **presentation that legitimately differs per surface is not duplication.** Order-status *colors/labels*
differ by design across customer/merchant/reports (different palettes, i18n-keys vs literals, Badge-variants vs
hex). Unifying those would be a visual change → forbidden. Only the **status keys, lifecycle order, and
transitions** (behavior-identical logic) are unified.

---

## Registry

| # | Domain | Duplicate implementations found (evidence) | **Canonical** | This sprint |
|---|---|---|---|---|
| 1 | **Order Status / lifecycle** | `OrdersList.CANON`/`STATUS_STEPS`, `MerchantApp` active-status array, `KitchenQueue.NEXT`, per-surface presentation maps | **`src/services/types.ts` order-status machine** (already the declared "single source of truth"), extended with `ORDER_LIFECYCLE` + `nextOrderStatus()` + `orderLifecycleIndex()` + `isActiveOrderStatus()` + `isTerminalOrderStatus()` | ✅ Extended the existing canonical (no competing module); redirected `OrdersList.CANON` + `MerchantApp` active-set; deleted dead `STATUS_STEPS`; kept per-surface presentation |
| 2 | **Delivery fee** | hardcoded `10` / `total_amount - 10` in `MerchantApp` (×3), `CheckoutPage` default `10.00`, `sandboxStore` `?? 10` | **`src/config/fees.ts` → `DEFAULT_DELIVERY_FEE`** | ✅ Replace literals with the constant (same value) |
| 3 | **Loyalty balance / tier** | `loyalty.service.getPoints` & `growthb.myPoints` both call RPC `loyalty_balance`; `growth.myTier` & `growthb.myTier` both call `resolve_loyalty_tier` | **balance → `loyalty.service`**; **tier → `growthb.service`** | ✅ `growthb.myPoints` delegates to `loyalty.service`; `growth.myTier` delegates to `growthb.myTier` |
| 4 | **Wallet access** | `wallet.service` (Supabase, `Wallet` obj), `sandboxStore.getWallet` (number, customer/driver only), `ops/payout` summary | **live → `wallet.service`** (`wallets`/`wallet_transactions`); **sandbox → `sandboxStore`**; **driver payout summary → `ops/payout.service`** | ◑ **Code-merge deferred.** No behavior-safe facade exists: the reads are the dual-mode split (sandboxStore has no merchant wallet; each consumer's balance read is intertwined with mode-specific transaction logic). A facade would change what a surface displays → forbidden. Canonical roles documented; a future façade is left for a behavior-change-allowed sprint |
| 5 | **Coupon** | `coupon.service` (validate), `growthb` coupons (admin mgmt), `sandboxStore` coupons, `checkout.verifyCoupon`, `cart.applyCoupon` | **validate → `coupon.service`** (+ `checkout.redeemCoupon` RPC) · **admin mgmt → `growthb.service`** · **sandbox → `sandboxStore`** | ◑ Roles are **distinct** (validate vs manage vs demo). No behavior-safe merge exists; canonical roles documented, no code merge |
| 6 | **Growth** | `growth.service` (Engine) & `growthb.service` (Mgmt) — overlapping tiers/segments/campaigns; two admin consoles | **`growthb.service`** (broader consumer set) | ◑ Safe delegation of the shared `resolve_loyalty_tier` (item 3); console merge **deferred** (would change admin UI = forbidden) |
| 7 | **Payment orchestrator** | `payment.service.ts` (685-LOC client mock, 0 UI imports), orchestrator `pay()`/`refund()` unused; real path = `initiate()` → edge fn | **`payment-orchestrator.service.ts` → `initiate()`** (→ Supabase edge functions) | ✅ Deprecate the mock client service + unused orchestrator methods; remove in Phase 4 (zero refs) |
| 8 | **Merchant Earnings vs Wallet** | `MerchantWalletCenter` (real) + `MerchantApp` "Earnings" tab (cosmetic) — two surfaces | **`MerchantWalletCenter`** for real balance; earnings tab reads via **walletCore** | ◑ Data routed through walletCore where safe; **surface merge deferred** (removing a tab = UI change = forbidden) |
| 9 | **Driver Wallet surfaces** | `DriverOpsPanel` wallet (real) + `DriverApp` "Earnings" tab (fabricated) | **`DriverOpsPanel`/walletCore** for real balance | ◑ Real earnings already via `sandboxStore`/wallet; fabricated KPIs are a *feature* concern, out of consolidation scope; surface merge deferred |
| — | **Maps** | `OrdersList` canvas map + embedded `OrderTrackingMap`, `DriverApp.DriverMiniMap` (SVG), `CheckoutPage` SVG route | **`OrderTrackingMap`** (real Google-Maps) for live tracking; SVG decoratives are surface-specific art | ◑ Canonical named; **no merge** — the SVG maps are bespoke decorative art with different inputs; merging = visual change = forbidden |

Legend: ✅ unified in code this sprint · ◑ canonical defined, full merge deferred with a rule-based reason.

---

## Canonical modules created / extended this sprint
- **`src/services/types.ts`** — extended the existing order-status machine with `ORDER_LIFECYCLE`,
  `nextOrderStatus()`, `orderLifecycleIndex()`, `isActiveOrderStatus()`, `isTerminalOrderStatus()`. Single source
  of truth for status ordering/transitions (no competing module created).
- **`src/config/fees.ts`** (new) — shared fee constants (`DEFAULT_DELIVERY_FEE`).
- Delegation making `loyalty.service` the canonical loyalty-balance source (`growthb.myPoints` now delegates).
- `payment-orchestrator.service.ts` slimmed to the canonical `initiate()` (+ real `reconcile`/`history`); the
  simulated `payment.service.ts` and the mock/pass-through orchestrator methods were removed (Phase 4).

> Note: no `walletCore` facade was created — see domain 4. Creating an unused facade would add dead code and
> could not redirect the intertwined dual-mode reads without changing behavior.

## Explicitly out of scope (would break the rules)
- Merging Supabase services with their `sandboxStore` twins (breaks the demo backend).
- Unifying per-surface status **presentation** (colors/labels/variants) — visual change.
- Merging `GrowthCenter`/`GrowthCenterB` consoles or the merchant/driver wallet **tabs** — UI change.
- Merging the decorative SVG maps — visual change.
- Any change to fabricated driver KPIs — that is a *feature* fix (the audit's separate concern), not
  de-duplication; touching it here would be a behavior change.

Every deferred item is recorded here so the canonical is unambiguous for a future feature sprint that is *allowed*
to change behavior/UI.
