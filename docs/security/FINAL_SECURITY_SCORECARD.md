# FINAL Security Scorecard

Fresh external red-team re-validation of production `haat-now-prod`. **STATUS:** BLOCKED =
protection held (attack failed) · **SUCCEEDED** = exploit worked. Confidence reflects the
strength of the reproducible read-back evidence. Read-only; zero residue.

## Exploit scorecard

| Exploit | Status | Risk | Confidence | Evidence |
|---|---|---|---|---|
| **F-1 `complete_delivery` caller-authz bypass (customer force-completes own order + driver payout)** | **SUCCEEDED** | **High** | High | order.status→`delivered`; driver_earnings=1; driver wallet `25.00` |
| **F-2 `finalize_driver_delivery` driver self-mutates active_orders/status** | **SUCCEEDED** | **Medium** | High | active_orders 2→0; status busy→available |
| **F-3 `merchants` KYC/PII exposure to any authenticated user** | **SUCCEEDED** | **Medium** | High | read victim `tax_number='TAX-SECRET-9'`; policy `USING(true)` |
| F-4 anon executes `expire_dispatch_offers`/`recalc_driver_performance` | SUCCEEDED | Low | High | both executed under `role anon` |
| F-5 always-true INSERT (`order_status_history`,`campaign_events`,`search_analytics`) | WEAK | Low | High | advisor `rls_policy_always_true` ×3 |
| F-6 6 public buckets allow object listing | WEAK | Low | High | advisor `public_bucket_allows_listing` ×6 |
| F-7 13 functions mutable `search_path` | WEAK | Low | High | advisor `function_search_path_mutable` ×13 |
| F-8 `pg_trgm` in `public` schema | WEAK | Low | High | advisor `extension_in_public` |
| B1 orders money/identity/status immutable | BLOCKED | — | High | read-back `unpaid`/`100.00` |
| B2 `complete_delivery_payout` | BLOCKED | — | High | EXECUTE revoked |
| B3 loyalty award/redeem + direct mint | BLOCKED | — | High | revoked; 0 rows minted |
| B4 `redeem_advanced_coupon` | BLOCKED | — | High | EXECUTE revoked |
| B5 order total / discount forgery | BLOCKED | — | High | totals immutable (B1) |
| B6 `driver_earnings` direct INSERT | BLOCKED | — | High | `has_table_privilege=false` |
| B7 `set_driver_status` | BLOCKED | — | High | EXECUTE revoked |
| B8 `respond_dispatch` (anon+authed) | BLOCKED | — | High | revoked from both |
| RT-1 driver self-GPS spoof (direct) | BLOCKED | — | High | current_lat read-back `NULL` |
| RT-2 driver self-priority (direct) | BLOCKED | — | High | priority `50.50` (recalc), not `9999` |
| Wallet direct write / adjust / credit / cashback | BLOCKED | — | High | balance unchanged; revoked |
| Privilege escalation (admin_users/user_roles/assign_user_role) | BLOCKED | — | High | 0 rows; admin-only |
| Admin/finance RPCs (approve_payout, pay_settlement, issue_compensation, ban/suspend/kyc, broadcast) | BLOCKED | — | High | internal `is_ops_admin`/permission guards |
| `delete_my_account` on another user | BLOCKED | — | High | acts only on `auth.uid()` |
| Customer isolation (orders/wallets/addresses/payment_methods) | BLOCKED | — | High | 0 rows each |
| IDOR cross-customer order update | BLOCKED | — | High | status stayed `pending` |
| Merchant isolation (product write / stock) | BLOCKED | — | High | ownership enforced; stock unchanged |
| Tenant isolation (`website_*`) | BLOCKED | — | High | `tenant_id=auth_tenant()` from `tenant_members` |
| Coupon_usages forge | BLOCKED | — | High | insert rejected |
| Double-spend (`complete_delivery` ×2) | BLOCKED | — | High | idempotent; 1 earning, wallet `25.00` |
| Webhook HMAC / service-role edge | N/A | — | High | no edge functions deployed on prod |
| JWT forgery | N/A | — | High | GoTrue-signed; identity DB-derived |

## Tally
- **Exploits SUCCEEDED:** 3 (1 High, 2 Medium) + 4 Low weaknesses.
- **Previously-fixed items re-attacked:** B1–B8, RT-1, RT-2 — **all HELD**.
- **Isolation (customer / merchant / tenant) + escalation + double-spend:** all HELD.
- **Advisor severity:** 193 lints, all WARN; 0 ERROR/HIGH; 0 RLS-disabled tables; 0 definer views.

---

# FINAL DECISION: 🔴 **FAIL**

## Why FAIL
A fresh external attack found **three reproducible exploits** — chiefly **F-1**, a High-severity
broken-authorization defect in `complete_delivery` that lets a customer forge delivery
completion of their own order and trigger an unauthorized driver payout (proven: order marked
`delivered`, wallet credited `25.00`). A launch cannot proceed with a money-moving,
state-forging authorization bypass reachable by any customer.

## What is NOT broken (the platform's core defenses held)
Every previously-remediated exploit (B1–B8, RT-1, RT-2), wallet integrity, privilege
escalation, and all customer/merchant/tenant isolation **withstood independent re-attack**. The
failures are **new authorization gaps on a few RPCs/policies**, not regressions or a systemic
collapse.

## Remaining Low risks (track, non-blocking on their own)
F-4 unauthenticated maintenance-function execution; F-5 always-true INSERT policies
(order-history/analytics log spoofing); F-6 listable public buckets; F-7 mutable function
`search_path` ×13; F-8 `pg_trgm` in `public`.

## Recommendations before launch (est. ~1 day)
1. **F-1 (must-fix):** add `if p_driver_id <> auth.uid() and not is_ops_admin() then raise` to
   `complete_delivery` (or route completion through an ownership-checked driver RPC).
2. **F-2 (must-fix):** in `finalize_driver_delivery`, verify `p_order_id` is a real `delivered`
   order assigned to the caller before decrementing `active_orders`/flipping `status`.
3. **F-3 (must-fix):** replace `merchants_discovery_read USING(true)` with a public column/view
   subset; keep tax/registration/contact/owner columns ops-only.
4. **F-4–F-8 (should-fix):** guard/revoke the anon-reachable maintenance RPCs; scope the three
   always-true INSERT policies; make the 6 public buckets non-listable; pin `search_path` on the
   13 functions; relocate `pg_trgm`.
5. **Re-run this exact battery** after the fixes; require all SUCCEEDED rows to flip to BLOCKED.

_Read-only sprint — no code, migration, or deployment was changed._
