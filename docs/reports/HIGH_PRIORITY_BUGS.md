# High-Priority Bugs — E2E Sprint

**Date:** 2026-06-24 · **Branch:** `feat/auth-recovery-frontend-sprint`
**Definition:** core action fails/throws but a workaround exists; data-loss risk; visibly broken state.

---

## H1 — Cart sync runs for every role and calls Supabase in sandbox → console-error spam — **FIXED ✅**

**Found by:** E2E console-error capture — every Merchant / Driver / Admin / Customer session logged:
```
Error fetching remote cart: [object Object]
syncLocalCartToRemote failed: [object Object]
```

**Root cause (two issues):**
1. `App.tsx` cart-sync `useEffect`s ran for **any** authenticated session (`if (session?.id)`), so
   merchant / driver / admin — who have **no cart** — triggered cart fetch/sync on every login. In
   **production** this would hit `customer_carts` for non-customers and error there too.
2. `cartService.fetchRemoteCart` / `syncLocalCartToRemote` **always** called Supabase, even in sandbox
   (no real cart backend) → guaranteed error + console noise on every customer session.

**Severity rationale:** non-crashing (errors are caught), but fired on **every session for every role**,
performed pointless network calls for non-customer roles, and represented incorrect cross-role behavior
that also affects production.

**Fix:**
- `App.tsx`: gated both cart-sync effects to `session.role === 'customer'` (+ added `session?.role` to
  the dependency arrays). Merchant/Driver/Admin no longer run cart logic.
- `cart.service.ts`: `fetchRemoteCart` returns the local cart and `syncLocalCartToRemote` is a no-op when
  `VITE_AUTH_MODE === 'sandbox'` (local cart is the source of truth in sandbox).

**Verification:** re-ran the full E2E suite — `CX / MX / DX / AX` ("no console/React errors") all **pass**;
the two error lines are gone for all four roles. Build + lint clean.

---

## Result: **0 High-priority bugs outstanding** (1 found, 1 fixed)
