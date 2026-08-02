# FINAL Security Certification Report

**Engagement:** final independent security certification of HAAT NOW production
(`haat-now-prod` / `ckmqxhjdrfztkunqprax`) before Production Activation.
**Method:** verification by **exploitation only** — no code trust. Every result is fresh,
reproducible evidence from live attacks that impersonate each role (`SET ROLE` + forged
`request.jwt.claims`) and **read back** the stored value/row count. All probes were
transactional and self-cleaned (zero residue). No fix, code change, migration, or deploy.

## Result: 🟡 PASS WITH CONDITIONS
- Every previously discovered exploit (B1–B8, RT-1/2, F-1…F-8, N-1, N-2) is **CLOSED** — re-verified live.
- **No Critical, no High.** No financial, wallet, payment, privilege-escalation, or tenant-isolation
  failure succeeded.
- **Two new Medium** business-logic findings (C-1, C-2) and two Low (C-3, C-4) were reproduced.
  They gate a *clean* PASS but not launch: none is Critical/High and none causes financial loss.
  See `FINAL_LAUNCH_CERTIFICATE.md` for the conditions.

---

## Part 1 — Re-test of all prior findings (fresh evidence)

| ID | Attack re-run live | Result |
|---|---|---|
| B1 | client `UPDATE orders` payment_status/total/fee | **CLOSED** — stayed `unpaid`/`100.00` |
| B2 | `complete_delivery_payout` authed | **CLOSED** — EXECUTE denied |
| B3 | `award_loyalty_points`/`redeem_loyalty_points` authed | **CLOSED** — EXECUTE denied |
| B4 | `redeem_advanced_coupon` authed | **CLOSED** — EXECUTE denied |
| B5 | order total/discount forgery | **CLOSED** — totals immutable |
| B6 | direct `driver_earnings` INSERT | **CLOSED** — privilege false |
| B7 | `set_driver_status` authed | **CLOSED** — EXECUTE denied |
| B8 | `respond_dispatch` authed/anon | **CLOSED** — EXECUTE denied |
| RT-1 | driver self-spoof `current_lat` | **CLOSED** — read-back `null` |
| RT-2 | driver self-inflate `priority_score` | **CLOSED** — read-back unchanged (`7`) |
| F-1 | customer forges `complete_delivery` | **CLOSED** — raised; driver path works |
| F-2 | `finalize_driver_delivery` fake order | **CLOSED** — raised |
| F-3 | non-owner reads merchant `tax_number` | **CLOSED** — 0 rows; `merchants_public` safe |
| F-4 | anon `auto_dispatch_order`/`expire_dispatch_offers`/`recalc_driver_performance` | **CLOSED** — anon EXECUTE denied |
| F-5 | forge another order's `order_status_history` | **CLOSED** — rejected; no always-true INSERT remains |
| F-6 | list public buckets | **CLOSED** — 0 listing policies |
| F-7 | mutable `search_path` | **CLOSED** — 13/13 pinned |
| F-8 | `pg_trgm` in public | **CLOSED** — relocated |
| N-1 | ordering customer reads driver KYC | **CLOSED** — base 0 rows/null; `drivers_public` KYC-free |
| N-2 | referral wallet minting chain | **CLOSED** — arbitrary owner/foreign referee/direct-qualify blocked; rewards forced 15/10; **0 minted** |

**Also re-verified CLOSED:** wallet direct write + `adjust_wallet_balance`; privilege escalation
(`admin_users`/`user_roles` self-insert); customer isolation (orders/wallets/addresses = 0 cross-read);
IDOR order-cancel; cross-merchant product write; double-spend (`complete_delivery` idempotent — 1
earning, wallet 25.00); 0 RLS-disabled public tables.

---

## Part 2 — New findings (this certification)

### C-1 — Driver shift/presence manipulation (MEDIUM)
- **Category:** BOLA / business-logic; OWASP API1.
- **Attack path:** `start_shift(p_driver_id, …)`, `end_shift`, `start_break`, `end_break` are
  `SECURITY DEFINER`, client-executable, and perform **no ownership check** on the target driver /
  shift. They set `drivers.status` / `is_online` for that driver (bypassing `drivers_guard`).
- **Reproduction:** any authenticated user → `rpc('start_shift', {p_driver_id: <any driver>})`.
- **Evidence (read-back):** an unrelated attacker forced a victim driver to `is_online = true`,
  `status = 'available'`, and created **1 phantom shift row**.
- **Impact:** an attacker can force any driver online/available/on-break/offline and open/close
  phantom shifts — dispatch-integrity sabotage (a forced-online driver receives offers it can't
  serve → delayed/failed dispatch) and corrupted shift/attendance data.
- **Likelihood:** High (trivial, any authenticated user, any driver id).
- **Business risk:** Medium — operational/dispatch disruption and shift-data integrity; **no
  financial loss, no escalation, no data exposure.**
- **Recommended fix (post-cert):** require `p_driver_id = auth.uid()` (or `owner_user_id`)/ops on
  all four shift RPCs, and verify the shift belongs to the caller for `end_shift`/`*_break`.

### C-2 — Review / rating manipulation (MEDIUM)
- **Category:** business-logic abuse / BOLA; OWASP API1/API6.
- **Attack path:** `submit_review(p_order_id, p_target_type, p_target_id, p_rating, …)` inserts a
  review with `status = 'approved'` immediately and **does not verify** that the order belongs to
  the caller or that the target (driver/merchant) was part of that order. Approved driver reviews
  update `drivers.rating` (live average).
- **Reproduction:** authenticated customer with any own order → `rpc('submit_review', {p_order_id:
  <own>, p_target_type:'driver', p_target_id:<any driver never used>, p_rating:1})`.
- **Evidence (read-back):** a fake 1-star review was accepted for an un-ordered target driver and
  dropped that driver's rating **5.0 → 1.00**.
- **Impact:** rating manipulation / review fraud — a competitor can tank any merchant's or driver's
  rating (or inflate their own), auto-approved, immediately affecting displayed reputation. Bounded
  by the number of order ids the attacker controls (one review per order+target).
- **Likelihood:** Medium–High.
- **Business risk:** Medium — reputation integrity; **no financial loss / escalation.**
- **Recommended fix:** verify `p_order_id` belongs to `auth.uid()` **and** the target was the
  order's driver/branch-merchant; consider moderation instead of auto-approve.

### C-3 — `set_default_address` missing ownership check (LOW, latent)
- `set_default_address(p_address_id)` scopes its update to the address's owner but never checks
  `auth.uid()`. **Not exploitable in practice:** the attacker cannot discover another customer's
  address UUID (RLS blocked the lookup; the call raised in testing). Defense-in-depth: add an
  `auth.uid()` ownership check.

### C-4 — Unauthenticated maintenance compute (LOW)
- `recalc_merchant_performance`, `recalc_all_merchant_performance`, `recompute_customer_segments`
  are anon-executable with no guard. They recompute **derived** analytics from real data (no
  injection, no data exposure) — a minor compute/DoS surface and unauthorized derived-data writes.
  Fix: revoke anon/public, gate to service/ops (mirrors the F-4 treatment of `recalc_driver_performance`).

---

## Part 3 — Coverage assessed with no new exploit

Authentication (GoTrue-signed JWT; identity/tenant/admin DB-derived) · Authorization/RBAC
(`assign_user_role`/`revoke_user_role` admin-gated; `admin_users` not client-writable) · Privilege
escalation (blocked) · IDOR/BOLA on orders/wallets/addresses/payments (isolated) · Wallet
(`adjust_wallet_balance`/`credit_customer_wallet` revoked; direct write blocked) · Referral (N-2
closed; residual: farming still requires **real paid+delivered orders** with server-fixed 15/10 rewards
— a bounded business risk, not a mint) · Coupons/Checkout (server-authoritative `create_order`;
`redeem_coupon`/`redeem_advanced_coupon` ownership/ops-gated) · Payments (order money immutable;
`payment_attempts`/`payment_transactions` INSERT scoped to own customer/order; `refund_*` ops/service-only)
· Orders/Dispatch (B1/F-1/F-2 closed; `respond_dispatch`/`auto_dispatch` locked) · Drivers (RT-1/2,
N-1 closed) · Merchants/Inventory (`adjust_product_stock` ownership; cross-merchant write blocked;
F-3 closed) · CMS/Website Builder (tenant-scoped via `auth_tenant()` from `tenant_members`;
`website_reorder_pages` permission-gated) · Storage/Buckets/Uploads (own-folder/admin scoped;
`kyc-documents` private; non-listable) · Supabase RLS (0 disabled tables) · RPCs (settlement/payout/
compensation/ban/suspend/kyc/broadcast/audience/accounting/campaign all `is_ops_admin`-gated) · Edge
Functions (none deployed) · Triggers (`orders_guard`, `drivers_guard`, `qualify_referral_on_delivery`
behave correctly; qualification only on paid+delivered) · Race/Replay/Double-spend (idempotency keys,
unique constraints, `FOR UPDATE`) · Tenant/Country isolation (`auth_tenant()`/`auth_admin_country()`
DB-derived; country-admin scope depends on `admin_users` integrity, which holds).

**Not exhaustively exercised (no contradicting evidence):** deep-links/universal-links, SMS/push
provider abuse, and app-layer rate limiting (message delivery is not provider-integrated yet).

---

## Severity ledger
| ID | Severity | Status |
|---|---|---|
| B1–B8, RT-1/2, F-1…F-8, N-1, N-2 | (prior) | **CLOSED** |
| C-1 driver shift/presence manipulation | Medium | OPEN |
| C-2 review/rating manipulation | Medium | OPEN |
| C-3 set_default_address ownership | Low (latent) | OPEN |
| C-4 anon maintenance compute | Low | OPEN |

No Critical. No High. No previous exploit reproduced.
