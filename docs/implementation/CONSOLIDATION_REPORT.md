# Consolidation Report — Platform Consolidation Sprint

**Goal:** eliminate architectural duplication and establish single canonical implementations, **without** new
features, UI/visual change, placeholders, or behavior change — incrementally, compiling after every step.

**Result:** ✅ Complete. Every step compiled; behavior preserved (lint 0 · build ✓ · **E2E 24/24**). Net
**−726 LOC** (9 source files changed: +59 / −785), one 685-line simulated module removed, one shared constant and
five order-status lifecycle helpers established as canonical, loyalty balance unified to one service.

See the canonical decisions in [CANONICAL_ARCHITECTURE.md](CANONICAL_ARCHITECTURE.md), the import redirects in
[MIGRATION_REPORT.md](MIGRATION_REPORT.md), and the deletions in [CODE_REMOVAL_REPORT.md](CODE_REMOVAL_REPORT.md).

---

## Method (safety rails honored)
- **Incremental + compiled after every replacement** — `npm run lint` (tsc `--noEmit`) run after each domain; all
  green.
- **Mark-deprecate → redirect → verify-zero-refs → remove** — nothing deleted before references were gone.
- **Behavior preserved** — every redirect maps to the *same value / same RPC / same result*. No visual change:
  per-surface status **presentation** (colors/labels/variants) was deliberately left untouched.
- **Dual-mode is not duplication** — Supabase services and their `sandboxStore` twins were **not** merged
  (merging breaks the demo backend). Same for separate UI surfaces (merging = UI change).

---

## What was consolidated (per domain)

### 1. Order Status / lifecycle — ✅ unified
- **Duplication:** `OrdersList.CANON`, the dead `OrdersList.STATUS_STEPS`, and `MerchantApp`'s inline
  `['pending','accepted','preparing','on_the_way']` active-set each re-encoded the lifecycle.
- **Canonical:** the existing order-status machine in `src/services/types.ts` (already the declared single source
  of truth) — **extended** with `ORDER_LIFECYCLE`, `nextOrderStatus()`, `orderLifecycleIndex()`,
  `isActiveOrderStatus()`, `isTerminalOrderStatus()`. No competing module was created.
- **Redirects:** `OrdersList.CANON` → `ORDER_LIFECYCLE`; `MerchantApp` active filter → `isActiveOrderStatus()`.
- **Preserved:** each surface's status **presentation** (`OrdersList.STATUS_CONFIG` hex+icons,
  `MerchantApp.ORDER_STATUS_CFG` Badge variants, `MerchantReports` palette, `KitchenQueue` lanes) — these differ
  by design; unifying them would be a visual change (forbidden).

### 2. Delivery fee — ✅ unified
- **Duplication:** the magic number `10` / `total_amount - 10` hardcoded in `MerchantApp` (×4), `CheckoutPage`
  default, and `sandboxStore` (×3).
- **Canonical:** `src/config/fees.ts → DEFAULT_DELIVERY_FEE` (value **unchanged = 10**).
- **Redirects:** all of the above now reference the constant. The authoritative per-order value is still the
  order's `delivery_fee` field; only the duplicated fallback literal was centralized.

### 3. Loyalty — ✅ unified (balance)
- **Duplication:** `loyalty.service.getPoints` and `growthb.myPoints` both called RPC `loyalty_balance`;
  `growth.myTier` and `growthb.myTier` both called `resolve_loyalty_tier`.
- **Canonical:** balance → **`loyalty.service`**; tier → **`growthb.service`**.
- **Redirects:** `growthb.myPoints` now delegates to `loyaltyService.getPoints` (identical number). The unused
  `growth.myTier` duplicate (zero consumers) was removed.
- **Not merged:** `awardPoints` (event-based in growthb vs explicit-points in loyalty.service) and `redeemReward`
  vs `redeemPoints` are **different behaviors**, not duplicates — left intact.

### 7. Payment orchestrator — ✅ unified
- **Duplication/mock:** the 685-line client `payment.service.ts` was a simulation (fabricated `Math.random()`
  references, commented-out gateway calls, empty `process.env` keys) with **zero UI consumers**. The orchestrator
  exposed a mock `pay()`/`refund()`/`providers()` (backed by that mock) plus `wallet.*`/`settlements.*`
  pass-throughs duplicating `walletService`/`financeService`.
- **Canonical:** `paymentOrchestrator.initiate()` → the server-side `payment-initiate` edge function (real
  Moyasar charge) — the only path the app (`CheckoutPage`) uses.
- **Action:** the orchestrator was slimmed to `initiate()` + the real supabase-backed `reconcile()`/`history()`;
  the mock module and the mock/pass-through methods were removed (Phase 4, zero refs verified).

---

## What was defined-canonical but deferred (rule-based)
These are named canonically in [CANONICAL_ARCHITECTURE.md](CANONICAL_ARCHITECTURE.md) but **not** code-merged,
because a merge would violate an explicit rule:

| Domain | Why deferred |
|---|---|
| **4. Wallet access** | The reads are the dual-mode split (`sandboxStore` has no merchant wallet; each consumer's balance read is intertwined with mode-specific transaction logic). No facade can unify them without changing displayed values → **behavior/visual change**. |
| **5. Coupon** | The five paths are **role-distinct** (customer validate · admin manage · sandbox demo · checkout redeem · cart apply), not redundant. No behavior-safe merge exists. |
| **6. Growth (console)** | `GrowthCenter` vs `GrowthCenterB` are two admin **UIs**. Merging them = UI change (forbidden). Only the shared loyalty RPC was safely delegated (domain 3). |
| **8/9. Merchant/Driver wallet surfaces** | The cosmetic "Earnings" tabs vs real wallet centers are separate **UI surfaces**. Removing/merging a tab = UI change (forbidden). |
| **Maps** | `OrderTrackingMap` (real Google-Maps) is canonical for live tracking; the SVG maps are bespoke **decorative art** with different inputs. Merging = visual change (forbidden). |

Each is recorded so a future *behavior-change-allowed* sprint has an unambiguous target.

---

## Verification
| Gate | Result |
|---|---|
| Typecheck (`npm run lint`) after **every** domain | ✅ 0 errors (7 checkpoints) |
| Build (`npm run build`) | ✅ succeeded |
| E2E (`node docs/testing/e2e_runner.cjs`) | ✅ **24/24 pass, 0 fail** |
| Behavior | Preserved — redirects are value-identical; no UI/visual change |

No commit, no deploy (per sprint scope).
