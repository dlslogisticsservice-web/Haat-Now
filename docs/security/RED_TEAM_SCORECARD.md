# Red-Team Scorecard

Live attacks against production `haat-now-prod`, as an authenticated attacker. Status:
**BLOCKED** = protection held (attack failed) · **SUCCEEDED** = exploit worked (platform
broken). Confidence reflects the strength of the reproducible evidence.

| Exploit | Status | Risk | Confidence | Evidence |
|---|---|---|---|---|
| B1 · set `payment_status='paid'` | BLOCKED | — | High | read-back `payment_status=unpaid` |
| B1 · lower `total_amount` | BLOCKED | — | High | read-back `total_amount=100.00` |
| B1 · zero `delivery_fee` | BLOCKED | — | High | trigger raised 42501 |
| B1 · change `payment_method` | BLOCKED | — | High | read-back `payment_method=cod` |
| B1 · status skip → `delivered` | BLOCKED | — | High | read-back `status=pending` |
| B1 · hijack `driver_id` | BLOCKED | — | High | read-back `driver_id=null` |
| B1 · `DISABLE TRIGGER` | BLOCKED | — | High | DDL denied for authenticated |
| B1 · RPC-chaining (DEFINER writes order money) | BLOCKED | — | High | only `refund_confirm`/`complete_delivery`/`manual_dispatch` — all guarded, none set `paid`/`total` |
| B2 · `complete_delivery_payout` | BLOCKED | — | High | EXECUTE denied |
| B3 · `award_loyalty_points` | BLOCKED | — | High | EXECUTE denied |
| B3 · `award_points_for_event` (replay) | BLOCKED | — | High | EXECUTE denied |
| B3 · `redeem_loyalty_points` (negative mint) | BLOCKED | — | High | EXECUTE denied |
| B3 · `redeem_loyalty_reward` | BLOCKED | — | High | EXECUTE denied |
| B3 · direct `INSERT loyalty_transactions` | BLOCKED | — | High | no row created |
| B4 · `redeem_advanced_coupon` (self-credit) | BLOCKED | — | High | EXECUTE denied |
| B5 · manipulate totals / forge discount | BLOCKED | — | High | money columns immutable (B1); server-computed |
| B6 · direct `INSERT driver_earnings` | BLOCKED | — | High | no row created |
| B7 · `set_driver_status(<other>)` (impersonation) | BLOCKED | — | High | EXECUTE denied |
| B8 · `respond_dispatch` IDOR / timeout | BLOCKED | — | High | ownership + `timeout_at` guards present, not anon |
| Wallet · `adjust_wallet_balance` / `credit_customer_wallet` | BLOCKED | — | High | EXECUTE denied |
| Wallet · direct `UPDATE wallets.balance` | BLOCKED | — | High | read-back `balance=0.00` |
| Privilege · self-`INSERT user_roles('admin')` | BLOCKED | — | High | no row created |
| RLS · read another customer's `orders` | BLOCKED | — | High | 0 rows |
| RLS · read another customer's `wallets` | BLOCKED | — | High | 0 rows |
| **RT-1 · driver self-spoof own GPS** (`drivers.current_lat`) | **SUCCEEDED** | **Medium** | High | read-back `current_lat=24.7` |
| **RT-2 · driver self-inflate `priority_score`** | **SUCCEEDED** | **Medium** | High | read-back `priority_score=9999` |
| JWT integrity (forge claims) | N/A | — | High | client JWT is signature-verified; not forgeable |
| Service-role misuse | N/A | — | High | server-only; not client-reachable |
| Webhook HMAC | NOT LIVE-TESTABLE | — | Low | edge functions not deployed on this project |
| Tenant/merchant isolation | INCONCLUSIVE | Low (latent) | Low | 0 merchants seeded; catalog tenant-agnostic by design (M1) |

## Tally
- **B1–B8 fixes attacked:** 8 / 8 **HELD**.
- **Additional protections attacked (wallet, RLS, privilege):** all **HELD**.
- **Exploits that SUCCEEDED:** **2** (RT-1, RT-2) — both Medium, both the deferred M7 `drivers`-table vector, both same root cause.

---

# FINAL DECISION: 🔴 **FAIL**

Per the sprint's rule — *if even one exploit succeeds, the project automatically fails* — the
two successful driver self-spoof exploits (RT-1, RT-2) force a **FAIL**.

**Honest context for stakeholders:** every one of the eight Hardening Pass #2 fixes (B1–B8)
was independently validated as **holding** under direct adversarial attack, along with
wallet integrity, RLS isolation, and privilege-escalation defenses. The failure is a
**single Medium-severity class** — a driver spoofing their **own** GPS/priority via the
`drivers` table, which the pass left un-column-locked (the known, deferred M7). It permits
dispatch manipulation, **not** financial theft, data exfiltration, or privilege escalation.

**Remediation to reach PASS (small, mechanical):** apply the existing `orders_guard`
column-lock pattern to `drivers` — make `current_lat`, `current_lng`, `priority_score`,
`rating`, `active_orders`, `status`, `is_online` non-client-writable (route presence through
`driver_locations` / an ownership-checked RPC). Then re-run this red-team battery. Estimated
~0.5 day. No other exploit surfaced.
