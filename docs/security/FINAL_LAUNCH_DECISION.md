# FINAL Launch Decision

## Decision: 🔴 **FAIL**

HAAT NOW **must not** proceed to Production Activation.

## Why (measured against the stated PASS criteria)

PASS was permitted only if **every** condition held. The evidence:

| PASS criterion | Met? | Evidence |
|---|---|---|
| Every previous exploit (B1–B8, RT-1/2, F-1…F-8) remains closed | ✅ Yes | 18/18 re-attacked live and BLOCKED |
| No new **Critical** vulnerabilities | ❌ **No** | **N-2** referral wallet minting (CRITICAL) |
| No new **High** vulnerabilities | ✅ (none High) | N-1 is Medium |
| No business-logic exploit can cause financial loss | ❌ **No** | N-2 minted 1,000,000.00 × 2 wallets |
| No privilege escalation succeeds | ✅ Yes | admin/RBAC escalation blocked |
| No tenant isolation failure | ✅ Yes | `auth_tenant()` DB-derived; website_* scoped |
| No payment manipulation | ✅ Yes | order money immutable; payment INSERT scoped |
| No wallet manipulation | ❌ **No** | N-2 credits arbitrary wallet balance |

Three PASS criteria fail. The FAIL rule is explicit: **any Critical exploit ⇒ FAIL**.

## The blocking exploit

**N-2 — Referral wallet minting (CRITICAL).** `generate_referral_code` (arbitrary
client-supplied rewards, arbitrary owner) → `apply_referral_code` (arbitrary referee) →
`qualify_referral` (no auth, order id never validated) credits customer wallets via a DEFINER
call that bypasses the client revoke on `credit_customer_wallet`. Proven: two fresh wallets
minted **1,000,000.00 each** from one chain with a fake order id, by an ordinary authenticated
user. Unbounded and scriptable. This is the previously-**deferred** referral-farming (B9)
surface — it was never remediated.

## Also required before launch

**N-1 — Driver KYC/PII over-exposure (Medium).** The ordering customer can read their assigned
driver's `national_id_number` and `license_number` via a full-row read. Not a launch-blocker on
severity alone, but a real privacy/PDPL exposure that must be fixed.

## What is solid (do not re-litigate)

All specifically-remediated items — **B1–B8, RT-1/RT-2, F-1…F-8** — held under fresh
independent attack, as did wallet-direct integrity, RBAC/privilege escalation, payment
manipulation, and customer/merchant/tenant isolation. The prior hardening work is real and
effective; the failure is a **subsystem that was deferred, not one that was fixed and regressed.**

## Path to PASS (next remediation sprint, then a fresh re-validation)

1. **N-2 (must-fix, Critical):** lock the referral RPCs — `generate_referral_code` to
   owner-self/ops with **server-fixed** reward amounts; `apply_referral_code` to
   `p_referee = auth.uid()`; `qualify_referral` to service/ops context driven by a **verified
   delivered + paid** order for the referee; revoke `EXECUTE` from `anon`/`public` on all three.
   Add regression tests reproducing this chain.
2. **N-1 (must-fix, Medium):** add a `drivers_public` safe projection (name/photo/phone/vehicle/
   rating/live-location) and narrow the order-detail embed; keep KYC columns owner/ops-only.
3. Re-run this exact battery **plus** the areas not fully exercised here (country-admin scoping,
   deep-links, SMS/push, app-layer rate limiting). Require every SUCCEEDED row to flip to BLOCKED.

_Assessment was strictly read-only: no code, migration, deployment, or infrastructure change was
made._
