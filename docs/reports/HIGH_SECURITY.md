# High Security Findings — HAAT NOW

**Date:** 2026-06-24 · Definition: serious risk (IDOR, impersonation, forgery, crash-to-DoS) with a
constrained blast radius or a mitigating control.

---

## HI-1 — `payment_transactions` INSERT open to any order (IDOR / record forgery) — **FIXED ✅**
Policy was `INSERT WITH CHECK (true)`: any authenticated user could insert payment-transaction rows for
**any `order_id`**, including other users' orders. Mitigated by the fact that the authoritative paid
status is set by the payment webhook/verify edge functions (service_role), not client rows — but the
open insert still allowed cross-order data forgery.
**Fix:** `payment_tx_own_order_insert` — `WITH CHECK (EXISTS(SELECT 1 FROM orders o WHERE o.id = order_id
AND o.customer_id = auth.uid()))`. The legitimate client flow (paying for **your own** order) still
passes; edge functions (service_role) bypass RLS. Verified live.

## HI-2 — `support_messages` sender impersonation — **FIXED ✅**
Policy was `INSERT WITH CHECK (true)`: a user could insert a support message with **any `sender_id`**
(impersonate another user/agent). **Fix:** `support_messages_sender_insert` — `WITH CHECK (sender_id =
auth.uid())`. Both customer messages (`sender_id = customerId = auth.uid()`) and admin replies
(`sender_id = adminId = auth.uid()`) still pass; impersonation is blocked. Verified live.

## HI-3 — No top-level React error boundary (white-screen DoS) — **FIXED ✅**
An uncaught render error anywhere would blank the entire SPA with no recovery. **Fix:** added
`src/components/ErrorBoundary.tsx` (bilingual fallback + reload + `onError` monitoring hook) and wrapped
the app in `main.tsx`. Build + E2E (24/24) confirm no regression.

---

## Result: **0 High security issues outstanding** (3 found, 3 fixed).
