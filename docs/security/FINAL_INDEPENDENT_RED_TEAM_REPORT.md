# FINAL Independent Red Team Report

**Engagement:** final external offensive assessment of HAAT NOW production
(`haat-now-prod` / `ckmqxhjdrfztkunqprax`) before Production Activation.
**Rules of engagement:** strictly read-only — no code, migrations, fixes, deploys, or infra
changes. Every result is reproducible evidence from live attacks run by impersonating each
role (`SET ROLE authenticated`/`anon` + forged `request.jwt.claims`, the exact context
PostgREST gives a real client) and **reading back the stored value/row count** after each
attempt. All probes were transactional and self-cleaned; post-run counts confirmed **zero
residue**. Nothing was trusted — not the regression suites, not prior reports.

> Threat model note: JWT claims are forgeable *in this harness only* because it is superuser.
> A real client's token is GoTrue-signed and unforgeable, and identity/tenant/admin are derived
> from DB tables (`admin_users`, `tenant_members`), not client claims. Impersonating `auth.uid()`
> here models the strongest *real* attacker, not a stronger-than-real one.

## Verdict summary

| Result | Count | IDs |
|---|---|---|
| 🔴 **CRITICAL exploit succeeded** | **1** | **N-2** (referral wallet minting) |
| 🟠 New Medium | 1 | N-1 (driver KYC/PII over-exposure) |
| ✅ Prior exploits re-tested & still CLOSED | 18 | B1–B8, RT-1, RT-2, F-1…F-8 |

**A reproducible CRITICAL financial exploit exists → FINAL DECISION: FAIL** (see
`FINAL_LAUNCH_DECISION.md`).

---

## 🔴 N-2 — Referral subsystem: unauthenticated wallet minting (CRITICAL)

- **Exploit ID:** N-2
- **Severity:** **CRITICAL** (unlimited, self-service financial loss / wallet manipulation)
- **OWASP:** API1 (BOLA) + API5 (Broken Function-Level Authorization) + Business-Logic Abuse
- **Attack path:** three `SECURITY DEFINER` RPCs are `EXECUTE`-granted to `anon` **and**
  `authenticated` with **no authorization checks at all**:
  1. `generate_referral_code(p_owner_type, p_owner_id, p_reward_referrer, p_reward_referee)` —
     caller supplies **arbitrary reward amounts** and an **arbitrary owner id** (no
     `p_owner_id = auth.uid()` check, no cap).
  2. `apply_referral_code(p_code, p_referee)` — caller supplies **any** referee id (no
     `p_referee = auth.uid()` check); copies the code's rewards onto a `referrals` row.
  3. `qualify_referral(p_referee, p_order_id)` — **no auth check** and **`p_order_id` is never
     validated** (not checked for existence, ownership, delivery, or payment). It flips the
     referral to `rewarded` and calls `credit_customer_wallet(...)` for both parties — which,
     as a DEFINER call, **bypasses the client revoke on `credit_customer_wallet`**.
- **Reproduction steps** (authenticated attacker with two self-registered customer accounts A, B):
  1. `rpc('generate_referral_code', {p_owner_type:'customer', p_owner_id:A, p_reward_referrer:1000000, p_reward_referee:1000000})`
  2. `rpc('apply_referral_code', {p_code:<code>, p_referee:B})`
  3. `rpc('qualify_referral', {p_referee:B, p_order_id:<any random uuid>})`
- **Evidence (read-back after the chain, as the impersonated attacker):**
  ```
  Referral chain executed by authenticated attacker = true
  referrer (A) wallet balance = 1000000.00
  referee  (B) wallet balance = 1000000.00
  ```
  Two brand-new customer wallets were minted **1,000,000.00 each** from a single chain, with a
  **fake order id**. The amount and repetition are unbounded.
- **Impact:** direct, unlimited creation of customer wallet balance → spendable at checkout
  (wallet payment) = free goods / cash-equivalent theft. Total loss of wallet and referral
  economic integrity.
- **Likelihood:** **High** — trivially scriptable with ordinary self-service signups; no admin,
  no real order, no special knowledge required.
- **Business risk:** catastrophic (unbounded fraud, insolvency of the wallet ledger). This is the
  previously-**deferred** "referral farming" (B9) surface — never remediated — now confirmed as a
  live Critical.
- **Recommended fix (post-audit):** gate all three RPCs — `generate_referral_code` to ops/owner
  with `p_owner_id = auth.uid()` and server-fixed reward amounts (ignore client-supplied
  rewards); `apply_referral_code` to `p_referee = auth.uid()`; `qualify_referral` to
  server/service context only, driven by a **verified delivered+paid order** belonging to the
  referee (validate `p_order_id`), never client-callable. Revoke `EXECUTE` from `anon`/`public`
  on all three.

---

## 🟠 N-1 — Driver KYC/PII over-exposure to the ordering customer (MEDIUM)

- **Exploit ID:** N-1
- **Severity:** **Medium** (sensitive-PII / excessive-data exposure; no financial impact)
- **OWASP:** API3 (Broken Object Property Level Authorization) / excessive data exposure
- **Attack path:** the `drivers` "Read drivers" policy grants a customer SELECT on the **full
  row** of any driver assigned to one of **their own** orders, and the app reads it via a
  `drivers(*)` embed in order detail. The row includes `national_id_number`, `license_number`,
  `license_expiry`, `vehicle_plate`, `owner_user_id`, and live `current_lat/lng`.
- **Reproduction steps:** as the customer on an order with an assigned driver:
  `from('drivers').select('national_id_number, license_number').eq('id', <driver>)`.
- **Evidence (read-back as the ordering customer):**
  ```
  national_id_number = NATID-XYZ
  license_number     = LIC-XYZ
  ```
  (Isolation itself holds — an **unrelated** customer sees **0** driver rows; the exposure is
  scoped to the delivery relationship. But the *fields* returned far exceed what a customer needs.)
- **Impact:** every customer can harvest their delivery driver's government ID and licence
  number — identity-theft / harassment risk; privacy/PDPL exposure.
- **Likelihood:** High (any order-detail view returns it).
- **Business risk:** Medium — regulatory/privacy exposure and driver-safety concern; not financial.
- **Recommended fix:** expose drivers to customers through a safe projection (name, photo, phone,
  vehicle, rating, live location) — mirror the F-3 `merchants_public` pattern with a
  `drivers_public` view; keep KYC columns owner/ops-only. Narrow the order-detail `drivers(*)`
  embed to safe columns.

---

## Re-test of every previously-fixed exploit — all CLOSED (fresh evidence)

| ID | Attack re-run | Result |
|---|---|---|
| **B1** | client `UPDATE orders SET payment_status='paid'` / lower total | **BLOCKED** — read-back `unpaid` |
| **B2** | `complete_delivery_payout` (authed) | **BLOCKED** — revoked |
| **B3** | loyalty award/redeem + direct `loyalty_transactions` insert | **BLOCKED** — revoked; 0 rows |
| **B4** | `redeem_advanced_coupon` (authed) | **BLOCKED** — revoked |
| **B5** | order total / discount forgery | **BLOCKED** — totals immutable |
| **B6** | direct `driver_earnings` INSERT | **BLOCKED** — `has_table_privilege=false` |
| **B7** | `set_driver_status` (authed) | **BLOCKED** — revoked |
| **B8** | `respond_dispatch` (anon+authed) | **BLOCKED** — revoked |
| **RT-1** | driver self-spoof `current_lat` | **BLOCKED** — read-back `null` |
| **RT-2** | driver self-inflate `priority_score` | **BLOCKED** — read-back `0` |
| **F-1** | customer forges `complete_delivery` | **BLOCKED** — raises; real driver still works |
| **F-2** | `finalize_driver_delivery` fake/other order | **BLOCKED** — raises; active_orders untouched |
| **F-3** | non-owner reads merchant `tax_number` | **BLOCKED** — 0 rows; `merchants_public` safe-only |
| **F-4** | anon `expire_dispatch_offers` / `recalc_driver_performance` / `auto_dispatch_order` | **BLOCKED** — revoked from anon |
| **F-5** | always-true INSERT on order_status_history/campaign_events/search_analytics | **BLOCKED** — scoped |
| **F-6** | list public buckets | **BLOCKED** — listing policies removed |
| **F-7** | mutable `search_path` | **CLOSED** — 13/13 pinned |
| **F-8** | `pg_trgm` in public | **CLOSED** — moved to `extensions` |

## Additional surface assessed — no new exploit found

| Area | Result / evidence |
|---|---|
| Wallet direct write / `adjust_wallet_balance` / `credit_customer_wallet` (direct) | BLOCKED — balance unchanged; revoked |
| Privilege escalation — `admin_users`/`user_roles` self-insert; `assign_user_role` (non-admin); `is_ops_admin`/`auth_is_admin` sources | BLOCKED — DB-derived, not client-writable |
| Admin/finance RPCs — `approve_payout`, `pay_*_settlement`, `manual_dispatch`, `issue_compensation`, `ban/suspend/review_kyc`, `broadcast_notification`, `create_affiliate/influencer` | BLOCKED — internal `is_ops_admin()`/permission guards |
| `request_payout` | BLOCKED — self-or-ops + available-balance check |
| `refund_reserve`/`refund_confirm` | BLOCKED — non-admin authenticated rejected |
| Payment forge — `payment_attempts`/`payment_transactions` INSERT | BLOCKED — `with_check` scoped to `customer_id = auth.uid()` / own-order |
| Customer isolation — orders/wallets/addresses/payment_methods of another user | BLOCKED — 0 rows |
| Driver isolation — unrelated customer reading drivers | BLOCKED — 0 rows |
| Merchant isolation — cross-merchant product write / `adjust_product_stock` | BLOCKED — ownership enforced |
| Tenant isolation — `website_*` (`tenant_id = auth_tenant()` from `tenant_members`) | BLOCKED — not client-forgeable |
| Notifications | scoped to `target_user_id = auth.uid()`; no client INSERT grant |
| Storage uploads | INSERT `with_check` scoped to own folder / admin / merchant-owns-product; `kyc-documents` private |
| RLS coverage | **0** public tables with RLS disabled; **0** SECURITY DEFINER views (besides the intentional `merchants_public`) |
| Double-spend / replay | `complete_delivery` idempotent (unique order_id); `create_order`/`refund_reserve`/`post_ledger` idempotency-keyed |
| Edge Functions / webhook / service-role | none deployed (`list_edge_functions = []`) — no live client-reachable surface |

**Not exhaustively exercised (assessed by policy/definition, not live payload):** country-admin
role scoping, deep-link/universal-link handling, SMS/push providers, and app-layer rate limiting
— none contradicted by the evidence gathered, but they were not the focus given the Critical
already found. They should be covered in the re-validation after N-2/N-1 are fixed.
