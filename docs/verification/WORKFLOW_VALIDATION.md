# WORKFLOW_VALIDATION.md

End-to-end business workflow validated in **sandbox mode** across all six demo accounts, driven by Puppeteer through the **real UI** in one shared browser session (single shared backend = `sandboxStore`, localStorage).

## Why this works without a real backend
Sandbox accounts previously showed **isolated demo data** and real order writes failed as `anon` (`42501`). To validate the cross-actor lifecycle without touching Supabase, a shared sandbox backend (`src/services/sandboxStore.ts`) was added: the customer **writes** an order; merchant/driver/admin **read and mutate** the same store; wallet + notifications update on each transition. Active **only** when `VITE_AUTH_MODE=sandbox`; bypassed entirely in `supabase` mode.

## Result: 10 / 10 PASS

| # | Stage | Result | Runtime evidence |
|---|---|---|---|
| 1 | Customer creates order | ✅ PASS | login `+201000000001` → add product → cart → checkout → swipe-to-confirm → `sandboxStore` has 1 order, status `pending` (`o-1001`) |
| 2 | Merchant receives order | ✅ PASS | login `+201000000002` → Incoming tab shows `#merch_order_card_o-1001` |
| 3 | Merchant accepts order | ✅ PASS | clicked "قبول الطلب" → order status → `accepted` |
| 4 | Driver receives order | ✅ PASS | login `+201000000003` → order present in driver feed (`accepted`, no driver) |
| 5 | Driver accepts order | ✅ PASS | clicked feed accept → `driver_id` assigned, status → `on_the_way` |
| 6 | Driver completes delivery | ✅ PASS | clicked complete → status → `delivered` |
| 7 | Wallet updates | ✅ PASS | driver wallet credited delivery fee → `driver:<id> = 10` |
| 8 | Notification flow | ✅ PASS | 6 notifications generated across the lifecycle (customer + merchant + driver events) |
| 9 | Order history updates | ✅ PASS | login `+201000000001` → Orders tab shows the order; customer-scoped history = 1 |
| 10 | Admin sees lifecycle | ✅ PASS | login `+201000000005` (Super Admin) → dashboard order count reflects the placed order |

**Flow proven:** `pending → accepted → on_the_way → delivered`, with driver assignment, wallet credit, notifications, customer history, and admin visibility — each step driven through the actual portal UI of a different role.

## Files added/changed for the workflow
- **NEW** `src/services/sandboxStore.ts` — shared orders/wallet/notifications store + lifecycle transitions (`createOrder`, `setStatus`, `assignDriver`, `completeDelivery`, `getWallet`, `getNotifications`).
- `CheckoutPage.tsx` — sandbox order creation on confirm (bypasses real backend/payment); swipe handle got a stable id.
- `MerchantApp.tsx` — reads `sandboxStore` orders; accept/prepare write back.
- `DriverApp.tsx` — feed/active/earnings from `sandboxStore`; accept/complete write back + wallet credit; GPS no-op in sandbox.
- `OrdersList.tsx` — customer history from `sandboxStore`.
- `AdminDashboard.tsx` — order count from `sandboxStore`.

## Scope / honesty
- This validates the **business workflow logic and cross-portal UI** in sandbox. It is **not** a production/backend validation — real Supabase order/wallet/RPC execution still requires the P0 infra steps (phone provider, `authenticated` grants, role provisioning) documented in `PRODUCTION_VALIDATION_REPORT.md`. The `sandboxStore` path is demo scaffolding, not a production data path.
- Build: `tsc` clean, `npm run build` exit 0.
