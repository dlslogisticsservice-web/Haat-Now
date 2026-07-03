# Migration Report — import/reference redirects

Every reference that was pointed at a **canonical** implementation this sprint. Each redirect is
value-identical (same constant / same RPC / same result); compilation was verified after each domain.

## Domain 1 — Order Status → `src/services/types.ts`
| File | Before | After |
|---|---|---|
| `src/features/orders/OrdersList.tsx` | local `const CANON: OrderStatus[] = ['pending',…,'delivered']` | `import { ORDER_LIFECYCLE } from '../../services/types'`; `const CANON = ORDER_LIFECYCLE as readonly OrderStatus[]` |
| `src/features/orders/OrdersList.tsx` | dead `STATUS_STEPS` constant (unused) | **removed** |
| `src/features/merchant/MerchantApp.tsx` | `orders.filter(o => ['pending','accepted','preparing','on_the_way'].includes(o.status))` | `import { isActiveOrderStatus } from '../../services/types'`; `orders.filter(o => isActiveOrderStatus(o.status))` |

`types.ts` gained: `ORDER_LIFECYCLE`, `nextOrderStatus()`, `orderLifecycleIndex()`, `isActiveOrderStatus()`,
`isTerminalOrderStatus()` (built on the pre-existing `ORDER_STATUSES` / `MERCHANT_ACTIVE_STATUSES` /
`ARCHIVED_STATUSES`).

## Domain 2 — Delivery fee → `src/config/fees.ts` (`DEFAULT_DELIVERY_FEE`)
| File | Before | After |
|---|---|---|
| `src/features/merchant/MerchantApp.tsx` | `total_amount - 10` (×4 sites) | `total_amount - DEFAULT_DELIVERY_FEE` (import added) |
| `src/features/checkout/CheckoutPage.tsx` | `useState(10.00)` | `useState(DEFAULT_DELIVERY_FEE)` (import added) |
| `src/services/sandboxStore.ts` | `delivery_fee ?? 10` (×3 sites) | `delivery_fee ?? DEFAULT_DELIVERY_FEE` (import added) |

Value unchanged (10). The per-order `delivery_fee` field (the real value) was **not** touched — only the
duplicated fallback literal.

## Domain 3 — Loyalty balance → `loyalty.service`
| File | Before | After |
|---|---|---|
| `src/services/growthb.service.ts` | `myPoints()` called `supabase.rpc('loyalty_balance', …)` directly | `import { loyaltyService }`; `myPoints()` returns `Number((await loyaltyService.getPoints(customerId)).points)` |

Same RPC, same argument, same numeric result. Consumer `DiscoverScreen.tsx` (`growthbService.myPoints`) unchanged
and unaffected.

## Domain 7 — Payment → `paymentOrchestrator.initiate()`
| File | Before | After |
|---|---|---|
| `src/features/checkout/CheckoutPage.tsx` | already used `paymentOrchestrator.initiate()` | **unchanged** — it was already on the canonical path |
| `src/services/payment-orchestrator.service.ts` | imported `payment.service`, `checkoutService`, `walletService`, `financeService`; exposed `pay/providers/reconcile/refund/history/wallet/settlements/initiate` | imports only `supabase`, `authService`; exposes `initiate` + `reconcile` + `history` |

No consumer redirect was required — `CheckoutPage` was already calling the canonical `initiate()`. The migration
here was **removing** the non-canonical surface (see [CODE_REMOVAL_REPORT.md](CODE_REMOVAL_REPORT.md)).

## Not migrated (intentionally)
- Per-surface order-status **presentation** maps (visual — must differ per surface).
- Wallet reads (dual-mode split; no behavior-safe facade — see CANONICAL_ARCHITECTURE.md domain 4).
- `GrowthCenter`/`GrowthCenterB` consoles, merchant/driver wallet tabs, SVG maps (UI/visual — deferred).

## Compilation checkpoints
`npm run lint` → 0 errors after: (1) status redirect · (2) fee redirect · (3) loyalty delegation · (4) payment
deprecation · (5) payment removal. Final: build ✓, E2E 24/24.
