# GO / NO-GO — Final (Production Launch Sprint, COD)

## FINAL QUESTION: Can HaaT launch today using COD only?

## Answer: **NO**

— but with an important qualifier: **there are no remaining code blockers.** Launch is gated
entirely on operational provisioning. Once P0-1..3 (below) are done, the answer flips to GO.

## Evidence

### Why NO (today)
1. **The production build ships the sandbox stub.** `vite.config.ts:12` forces
   `VITE_AUTH_MODE=sandbox` unless `HAAT_LIVE_BACKEND=1`; committed `.env.production` pins
   sandbox. In sandbox, `lib/supabase.ts` returns a no-op client — **no order, auth, or payment
   touches a real backend.** A real customer cannot transact against the currently-built artifact.
2. **No live backend / migrations not applied.** 63 migrations (RLS, RBAC, RPCs, storage) are
   authored but require a provisioned Supabase project.
3. **Login/registration need an SMS OTP provider** configured in Supabase Auth — not present in
   repo. Without it, a real customer cannot register or log in.

None of these are code defects; they are provisioning/secret/config tasks. They are also **not
"minor"** (standing up a backend + SMS is real work), which is why the honest answer is NO rather
than "YES with minor operational tasks."

### Why the code is ready (COD)
- COD is a **first-class payment method** on the single payment engine, needing **no gateway and
  no secret** (`paymentOrchestrator.recordCod`, `website-platform/finance/cod.ts`).
- Settlement/commission/driver-credit are **payment-method-agnostic** (key off
  `status='delivered'` + `delivery_fee`) — COD orders pay out with zero gateway involvement.
- Verified end-to-end in the shipped mode: **COD commerce smoke 5/5**, **COD unit tests 5/5**,
  **test:website 141/141**, **E2E 24/24**, **lint 0**, **build + build:live ✓**.

## The exact path from NO → GO (operational, no code)

1. Provision the production Supabase project.
2. Apply all `supabase/migrations/**` (incl. `20260707000001_cod_payment_method.sql`).
3. Configure Supabase Auth **SMS OTP** provider (+ secret). *(P0-3)*
4. Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; build & deploy with
   `npm run build:live` (`HAAT_LIVE_BACKEND=1`). *(P0-1)*
5. Smoke the COD journey against live data (register → browse → order → COD → track → receive →
   rate → support).

**Gateway secrets (Moyasar) and edge-function deploys are NOT required for a COD-only launch** —
defer to when card payments are enabled (P1).

## Recommendation

Complete P0-1..3 (backend + migrations + SMS), then run the live COD smoke. At that point HaaT
**can launch with COD only** — the application code is ready and verified. Until then: **NO-GO**.
