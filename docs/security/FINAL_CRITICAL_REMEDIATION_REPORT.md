# Final Critical Remediation Report

Eliminates the two confirmed findings from the Final Independent Red Team gate
(`FINAL_INDEPENDENT_RED_TEAM_REPORT.md`):

- **N-2 (CRITICAL)** — referral subsystem: unauthenticated / self-service wallet minting.
- **N-1 (MEDIUM)** — driver KYC/PII over-exposure to the ordering customer.

Scope was strictly these two. No unrelated systems, no previously-secured modules
(`complete_delivery`, `orders_guard`, `drivers_guard`, merchants, etc.) were modified. One DB
migration (applied to prod `haat-now-prod`), three small client edits, and a regression suite.

## N-2 — Referral subsystem (CRITICAL) — ELIMINATED

**Root cause:** all three referral RPCs were `SECURITY DEFINER`, `EXECUTE`-granted to
`anon`/`authenticated`, with no authorization — `generate_referral_code` accepted arbitrary
owner + **client-supplied reward amounts**; `apply_referral_code` accepted an arbitrary referee;
`qualify_referral` had no auth and never validated the order, yet credited wallets via a DEFINER
call that bypassed the client revoke on `credit_customer_wallet`.

**Fixes (against the 8 stated requirements):**
1. **Owner-only generation.** `generate_referral_code` now rejects any non-admin caller whose
   `p_owner_type <> 'customer'` or `p_owner_id <> auth.uid()`. (Gated on `is_ops_admin()`/
   `auth.uid()`, **not** `current_user` — inside a `SECURITY DEFINER` function `current_user` is
   the owner and cannot identify a client; `auth.uid()` reads the request JWT and stays accurate.
   This was corrected after verification caught the first attempt silently passing.)
2. **Server-controlled rewards.** For non-admin callers the reward amounts are forced to server
   values (referrer 15 / referee 10); client-supplied values are discarded.
3. **Self-only application.** `apply_referral_code` requires `p_referee = auth.uid()` (or ops).
4. **`qualify_referral` is service-only.** `EXECUTE` revoked from `anon`/`public`/`authenticated`.
   It is invoked exclusively by the new delivery trigger (runs as owner) or trusted service/ops.
5. **Order validation.** `qualify_referral` now verifies the order **exists**, **belongs to the
   referee**, is **`payment_status = 'paid'`**, and is **`status = 'delivered'`** before rewarding.
6. **Idempotency.** Only a single `pending` referral per referee is rewarded, once (`FOR UPDATE`;
   status flips `pending → rewarded`; re-invocation no-ops). `apply_referral_code` already enforces
   one referral per referee.
7. **Revokes** applied (item 4 + `generate`/`apply` revoked from `anon`/`public`; they remain
   callable by the authenticated owner).
8. **Regression tests** reproduce the entire exploit chain (see below).

**New server-driven qualification:** trigger `qualify_referral_on_delivery` (AFTER UPDATE on
`orders`, `SECURITY DEFINER`) calls `qualify_referral` **only** when an order transitions into
`paid` + `delivered`. The client `growthService.qualifyReferral` is now a documented no-op.

## N-1 — Driver KYC/PII (MEDIUM) — ELIMINATED

**Root cause:** the `"Read drivers"` policy let the ordering customer read the driver's **full
row** (incl. `national_id_number`, `license_number`, `owner_user_id`) via a `drivers(*)` embed.

**Fix:**
- Dropped the full-row `"Read drivers"` policy.
- Added a public-safe view `public.drivers_public` exposing **only** `id, full_name, vehicle_id,
  vehicle_plate, rating, status, is_online, current_lat, current_lng`, **scoped** to the same
  legitimate relationship (self / driver-owner / ops / driver-of-my-order). Permanently hidden:
  `national_id_number`, `license_number`, `license_expiry`, KYC, internal identifiers,
  `owner_user_id`, `priority_score`, and other operational columns.
- Repointed the two customer-facing driver reads to the projection (order detail, review target).
- Driver-self and ops reads are unchanged (they use `drivers_scoped_read` / admin).

## Files modified
- **Migration added:** `supabase/migrations/20260801000004_final_critical_remediation.sql`
  (applied to prod; history reconciled to a single canonical row `20260801000004`).
- **Regression suite added:** `supabase/tests/final_critical_remediation_regression.sql`.
- **App:** `src/services/growth.service.ts` (`qualifyReferral` → no-op; qualification is
  server-driven), `src/repositories/orders.repository.ts` (order-detail driver embed →
  `drivers_public`, aliased `drivers` so the consumer contract is unchanged),
  `src/repositories/reviews.repository.ts` (driver-name read → `drivers_public`).

## RPCs modified
`generate_referral_code`, `apply_referral_code`, `qualify_referral` (hardened); new trigger
function `trg_qualify_referral_on_delivery`. **Not touched:** `credit_customer_wallet`
(already client-revoked), `create_affiliate`/`create_influencer` (already ops-gated).

## Policies modified
- Dropped: `"Read drivers"` (full-row) on `public.drivers`.
- Added: view `public.drivers_public` (+ grant to `authenticated`).
- New trigger `qualify_referral_on_delivery` on `public.orders`.

## Regression tests
`final_critical_remediation_regression.sql` asserts (impersonated, self-cleaning):
- **N-2 attack:** arbitrary owner rejected; foreign referee rejected; direct client `qualify`
  rejected; client rewards discarded (stored 15/10); **nothing minted**.
- **N-2 legit:** no reward before paid+delivered; server rewards **15/10** credited via the
  delivery trigger.
- **N-1:** customer base `drivers` read → 0 rows; `national_id` → null; `drivers_public` shows
  the name and exposes **no** sensitive column; `"Read drivers"` policy gone.

## Proof N-2 and N-1 are eliminated (live, on prod)
```
N-2 arbitrary owner blocked            = true
N-2 self-code reward_referrer          = 15      (client 1000000 discarded)
N-2 self-code reward_referee           = 10
N-2 apply for other referee blocked    = true
N-2 direct client qualify blocked      = true
N-2 attacker wallet minted             = (none) / (none)
N-2 legit auto-qualify referrer/referee= 15.00 / 10.00   (only after paid+delivered)
N-1 customer base drivers rows         = 0
N-1 customer base national_id          = (null)
N-1 drivers_public name visible        = "Driver X"
N-1 drivers_public exposes KYC column  = false
FINAL_CRITICAL_REMEDIATION_REGRESSION: N-2 + N-1 closed
```

## Quality gates
| Gate | Result |
|---|---|
| Migration apply (prod) | ✅ clean |
| N-2 + N-1 regression (impersonated + structural) | ✅ **closed** |
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| ESLint (`tsc` + architecture + demo-isolation) | ✅ clean |
| Unit + integration tests | ✅ **777 pass / 0 fail** |
| Production build | ✅ |
| Guardian | ✅ **544 files · 0 cycles · 0 violations** |

## Notes
- `drivers_public` intentionally excludes `phone_number` to comply with the "customers may ONLY
  read display_name/vehicle/rating/ETA/location" requirement; direct driver contact should use a
  masked/proxy channel (out of scope here).
- `merchants_public` and `drivers_public` are deliberate `SECURITY DEFINER`-style public
  projections (they must bypass base RLS to serve safe columns) exposing only non-sensitive
  fields; the Supabase linter reports these as expected `security_definer_view` WARNs.
- No Red Team was re-run (per instructions). Migration applied to the prod DB consistent with
  prior passes; no deployment/infra change. Stop after remediation.
