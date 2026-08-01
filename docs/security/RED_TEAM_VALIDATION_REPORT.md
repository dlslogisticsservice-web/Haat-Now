# Independent Red-Team Validation Report

External adversarial validation of Hardening Pass #2. **Strictly read-only** — no code,
migrations, or deploys. Every result is **reproducible evidence** from live attacks against
the production database `haat-now-prod` (`ckmqxhjdrfztkunqprax`), executed as a real
authenticated attacker via `SET ROLE authenticated` + a forged `request.jwt.claims` (the
same context PostgREST gives a logged-in client). All test data was transactional and
self-cleaned; a post-run count confirmed **zero residue** (all business tables = 0).

Nothing was trusted: not the regression tests, not the prior reports. Only what the
database actually did under attack.

## Method
For each attack: seed a minimal target as `postgres`, impersonate the attacker, execute the
exploit, then **read back the actual column value** (for writes) or **row count** (for reads)
to decide success — not merely whether an exception was thrown.

---

## Results — B1–B8 fixes

### B1 — Orders trigger — **FAILED (attack blocked)** ✅ protection holds
- **Attacks:** direct `UPDATE orders` as the owning customer setting `payment_status='paid'`, `total_amount=1`, `delivery_fee=0`, `payment_method='card'`, `status='delivered'` (skip), `driver_id=<arbitrary>`; and `ALTER TABLE orders DISABLE TRIGGER orders_guard_trg`.
- **Evidence:** every column read back **unchanged** (`payment_status=unpaid`, `total_amount=100.00`, `payment_method=cod`, `status=pending`, `driver_id=null`); trigger-disable denied.
- **RPC-chaining bypass hunt:** the only authenticated-callable SECURITY DEFINER functions that write order state are `refund_confirm` (guarded; sets `refunded`, never `paid`), `complete_delivery` (guarded), `manual_dispatch_order` (ops-only). **None** lets a client set `payment_status`/`total_amount`.
- **Reason:** `orders_guard` (SECURITY INVOKER) sees `current_user='authenticated'` and rejects protected-column writes + illegal transitions; DEFINER RPCs/`service_role` (owner role) pass through legitimately.
- **Risk:** none observed.

### B2 — Driver payout (`complete_delivery_payout`) — **FAILED (blocked)** ✅
- **Attack:** `perform complete_delivery_payout(<order>, self, 999999)` as authenticated.
- **Evidence:** denied (`has_function_privilege('authenticated',…)=false`). **Risk:** none.

### B3 — Loyalty — **FAILED (blocked)** ✅
- **Attacks:** `award_loyalty_points(self,1e6)`, `award_points_for_event(self,'order',1e9,null)` (replay), `redeem_loyalty_points(self,-1e6)` (negative mint), `redeem_loyalty_reward(self,…)`, and a **direct** `INSERT loyalty_transactions(self, 1e6)`.
- **Evidence:** all denied; no `loyalty_transactions` row created. **Risk:** none.

### B4 — Coupons (`redeem_advanced_coupon`) — **FAILED (blocked)** ✅
- **Attack:** `redeem_advanced_coupon('X', self, …, 100, null,null,null)` (self wallet-credit).
- **Evidence:** denied. Discounts are server-computed in `create_order` and the order total is immutable (B1), so forged discounts are impossible. **Risk:** none.

### B5 — Checkout — **FAILED (blocked)** ✅
- **Attacks:** total/delivery-fee manipulation is the B1 vector (blocked); `create_order` for another `customer_id` raises "customer mismatch"; `qty<=0` rejected; coupon eligibility + `used_count`/per-customer/max-uses now enforced inside `create_order` (verified) with the order total immutable.
- **Evidence:** money columns immutable (B1 evidence); coupon logic present + server-authoritative. **Risk:** none.

### B6 — Driver earnings — **FAILED (blocked)** ✅
- **Attack:** direct `INSERT driver_earnings(driver_id=self, delivery_fee_earned=999999)`.
- **Evidence:** no row created (self-insert policy dropped + INSERT revoked). **Risk:** none.

### B7 — Driver status impersonation (`set_driver_status`) — **FAILED (blocked)** ✅
- **Attack:** `set_driver_status(<other driver>, 'available', 24.7, 46.7)`.
- **Evidence:** denied. Cannot forge **another** driver's presence/GPS. **Risk:** none *for impersonation.* (But see the SUCCEEDED finding below — self-spoof via a different path.)

### B8 — Dispatch (`respond_dispatch`) — **FAILED (blocked)** ✅
- **Evidence:** body enforces caller-owns-driver + `timeout_at < now()`; not anon-executable. Multi-driver accept remains a single-winner conditional update. **Risk:** none.

---

## Results — broader "ALSO TEST"

| Area | Attack | Result | Evidence |
|---|---|---|---|
| Wallet integrity | `adjust_wallet_balance` / `credit_customer_wallet` as authed; direct `UPDATE wallets SET balance` | **BLOCKED** ✅ | denied; balance read back `0.00` |
| Privilege escalation | direct `INSERT user_roles(self,'admin')` | **BLOCKED** ✅ | no row (no client INSERT policy) |
| RLS isolation | read another customer's `orders` / `wallets` | **BLOCKED** ✅ | 0 rows both |
| Settlement | (covered) `pay_*_settlement` = `is_ops_admin` | **BLOCKED** ✅ | prior + guard present |
| JWT integrity | forge claims | **N/A to a real attacker** | claims are only forgeable here because the harness is superuser; a client's JWT is signature-verified by GoTrue — not forgeable without the secret |
| Service-role misuse | — | **N/A** | `service_role` is server-only (edge functions); not client-reachable |
| Webhook integrity | — | **NOT LIVE-TESTABLE** | edge functions are not deployed on this project; HMAC fail-closed verified by code only |
| Tenant/merchant isolation | enumerate all `merchants` | **INCONCLUSIVE** | 0 merchants seeded; `merchants_discovery_read using(true)` means catalog is tenant-agnostic by design (latent M1, not live-exploitable with no data) |

---

## 🔴 SUCCEEDED exploits (the platform was broken)

### RT-1 — Driver self-spoofs own GPS → dispatch manipulation — **SUCCEEDED**
- **Attack path:** authenticated driver → `PATCH /rest/v1/drivers?id=eq.<self>` `{"current_lat":24.7,"current_lng":46.7}`.
- **Evidence:** `current_lat` read back = **24.7** (write accepted).
- **Reason:** the `drivers` table has a table-wide `UPDATE` grant to `authenticated` (`authenticated_grants.sql:50`) + an own-row RLS policy (`Drivers update own profile`) and **no column lock** — the exact systemic pattern Hardening Pass #2 fixed on `orders`/`driver_earnings` but **did not apply to `drivers`**. `find_nearest_drivers` scores on `current_lat/lng`, so a driver can sit on top of every branch and win dispatch.
- **Risk:** **Medium** — dispatch-scoring manipulation / order cherry-picking / fair-allocation sabotage. No direct theft, no data leak, no privilege escalation.

### RT-2 — Driver self-inflates own `priority_score` → dispatch dominance — **SUCCEEDED**
- **Attack path:** authenticated driver → `PATCH /rest/v1/drivers?id=eq.<self>` `{"priority_score":9999}`.
- **Evidence:** `priority_score` read back = **9999**.
- **Reason:** same as RT-1 (`drivers` not column-locked). `priority_score` is a positive term in `find_nearest_drivers` scoring.
- **Risk:** **Medium** — an attacker driver dominates dispatch ranking. (Same root cause; `rating`, `active_orders`, `is_online` are equally writable.)

Both are the pentest's **M7** vector — explicitly deferred out of Hardening Pass #2's B1–B8 scope, on the one financially-relevant table (`drivers`) the pass left unlocked.

---

## Conclusion
All **eight** Hardening Pass #2 fixes (B1–B8) **held under direct attack** — including trigger-disable, RPC-chaining, negative/replay, and impersonation attempts — and core wallet/RLS/privilege isolation held. **However, two exploits succeeded** (RT-1, RT-2): a driver can spoof their own GPS and priority via a direct `drivers` write, because that table was not column-locked. Per the sprint's rule — *if even one exploit succeeds, the project fails* — the verdict is **FAIL**, with the honest qualification that the failing vector is **Medium** (dispatch-integrity, no theft/leak/escalation) and remediable by extending the existing `orders_guard` column-lock pattern to `drivers`.
