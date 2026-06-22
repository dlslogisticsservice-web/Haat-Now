# E2E_TEST_PLAN.md — HAAT NOW (Production)

End-to-end tests to run against the **deployed production build** (`VITE_AUTH_MODE=supabase`, served from the host — never `npm run dev`) using the live Supabase project. Login uses real phone OTP (Test OTP `123456` until Twilio is live). Demo accounts already provisioned.

## Test accounts (live)
| Role | Phone | OTP |
|---|---|---|
| Customer | +201000000001 | 123456 |
| Merchant | +201000000002 | 123456 |
| Driver | +201000000003 | 123456 |
| Egypt Admin | +201000000004 | 123456 |
| Saudi Admin | +966500000004 | 123456 |
| Super Admin | +201000000005 | 123456 |

> Use **SA-resolvable** branches/zones for order flows (only SA geography is seeded). Customer/merchant/driver demo profiles exist; create a fresh order per run.

## Pre-flight
- [ ] Deployed URL loads; bundle has **no** `DEMO_ACCOUNTS` (sandbox stripped); `123456` rejected for a **non-provisioned** phone.
- [ ] `localStorage` after login holds `sb-…-auth-token` (JWT), **no** `haat_sandbox_session`.

## CUSTOMER — full journey
1. **Auth:** open app → enter +201000000001 → OTP `123456` → lands on home; session persists on refresh; logout returns to login.
2. **Browse:** home loads real catalog (merchants/branches/offers); open a restaurant → menu loads.
3. **Cart → Checkout:** add items → cart → checkout; address selectable (or add); apply coupon (create one via Admin first) → discount reflected; choose **COD**; swipe to place order → success.
4. **Orders:** order appears in "My Orders"; open tracking → status stepper; map renders (if Maps key) or fallback.
5. **Wallet:** balance + transactions load (real `wallets`); after delivery, **loyalty points** appear; redeem 500 → wallet credit + ledger row.
6. **Notifications:** status-change + loyalty notifications arrive in the drawer; opening clears unread (`is_read`).
7. **Review:** on a delivered order, submit a star rating + comment → persists (`reviews`).
**Pass:** every step succeeds; customer sees only **their own** orders/wallet/notifications.

## MERCHANT — full workflow
1. Login +201000000002 → Merchant portal loads (own branch).
2. **Incoming orders:** the customer's order (on merchant's branch) appears; advance status (accepted → preparing → ready); customer sees updates live.
3. **Inventory:** open Inventory tab → products list with stock; `+/−` adjust persists (`products.stock` + `stock_movements`); drive a product to 0 → **out-of-stock** badge + auto-disabled.
4. **Catalog:** add/edit a product + price + image.
5. **Analytics/Wallet:** revenue/orders/avg reflect real `orders`; earnings balance shown.
**Pass:** merchant sees only **own-branch** orders; inventory/catalog/analytics operate on real data.

## DRIVER — full workflow
1. Login +201000000003 → Driver portal; toggle **online**.
2. **Feed:** an accepted/ready order appears in available jobs.
3. **Accept:** accept job → moves to active; customer/merchant see driver assigned.
4. **Advance/Complete:** progress to on-the-way → **complete delivery** → driver wallet credited (`complete_delivery` RPC) + customer points awarded + delivered notification.
5. **Earnings:** trips/total/avg update; wallet balance increases.
**Pass:** driver sees only **assigned** orders; completion atomically updates wallet + notifications.

## ADMIN — full workflow (+ country scoping)
1. **Super Admin** (+201000000005): KPIs/analytics reflect all orders; can view all countries.
2. **Coupons:** create coupon (code/discount/usage/expiry/country) → appears; customer can apply it; deactivate → no longer valid.
3. **Support:** open a customer ticket → reply.
4. **Country scoping:** log in as **Saudi Admin** (+966500000004) → sees SA orders only. Log in as **Egypt Admin** (+201000000004) → sees **no** SA orders (isolation). No `42501`, no recursion.
**Pass:** analytics/coupons/support work; admin country scoping enforced per role.

## Cross-cutting assertions
- [ ] **AuthZ:** each role's RLS isolation holds (no cross-tenant/cross-country reads).
- [ ] **No errors:** no `42501` / "infinite recursion" in any portal.
- [ ] **Realtime:** order status updates propagate customer↔merchant↔driver.
- [ ] **Payments:** COD completes; (after gateway config) card payment authorizes + webhook recorded.
- [ ] **Performance:** initial load acceptable; no console errors.

## Exit criteria
All four role journeys pass end-to-end on the deployed prod build with real auth + live data, country scoping enforced, and no authorization errors → **E2E PASS** (gate to launch).
