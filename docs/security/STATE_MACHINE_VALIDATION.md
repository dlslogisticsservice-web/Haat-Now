# HAAT NOW — State-Machine Validation

Every workflow's legal transitions and whether **illegal** transitions are rejected.
"Enforced where" distinguishes DB-level enforcement (trigger/CHECK/RPC guard, which a
direct PostgREST call cannot bypass) from happy-path-only enforcement (RPC/service logic
that the client can sidestep). Evidence in the penetration report.

## 1. Order lifecycle — ❌ NOT ENFORCED at the DB layer (BLOCKER)
Legal: `pending → accepted → preparing → on_the_way → delivered`; any non-terminal `→ cancelled`. Terminal: `delivered`, `cancelled`.

| Transition | Legal? | Rejected if illegal? |
|---|---|---|
| pending → accepted → preparing → on_the_way → delivered | ✅ | — |
| any → cancelled (non-terminal) | ✅ | — |
| **pending → delivered (skip)** | ❌ | **NO — accepted via direct `PATCH orders {status:'delivered'}`** |
| **delivered → pending (backward)** | ❌ | **NO** |
| **on_the_way → delivered by the customer** | ❌ | **NO (customer owns the row)** |
| forge `payment_status`, `total_amount`, `driver_id`, `branch_id` | ❌ | **NO** |

- **Enforced where:** only inside `complete_delivery` (requires `status='on_the_way'`, `delivery_atomicity.sql:103`) and `complete_delivery_payout` (requires `delivered`, `delivery_payout_rpc.sql:93`) — i.e. the *happy path*. There is **no BEFORE-UPDATE trigger or CHECK** on `orders`; the two AFTER triggers are exception-guarded and "never block the transition" (`dispatch_unify_finalize.sql:16-17`). Combined with the table-wide UPDATE grant + row-only RLS, **any owner (customer/driver/merchant) can jump to any status or edit any column directly.**
- **Required fix:** a BEFORE-UPDATE trigger that (a) restricts each role to its legal transitions and (b) makes `payment_status/total_amount/delivery_fee/driver_id/branch_id/customer_id` immutable to non-service callers. This single control closes C1 and the status-skip vectors.

## 2. Payment attempt — ✅ enforced
Legal: `pending → captured | failed | cancelled`. `unpaid → paid` on order only via the HMAC webhook.
- `order.payment_status` flips to `paid` **only** in `payment-webhook` under `.eq('payment_status','unpaid')` (`payment-webhook/index.ts:194`); a captured attempt is never downgraded (`:181`). Double-active-attempt blocked by `uq_payment_attempts_active_order`. ✅ *(But the order's `payment_status` is separately forgeable via direct write — see §1/C1. The attempt state machine itself is sound.)*

## 3. Refund saga — ✅ enforced
Legal: `reserve → confirm` (or failure). `refund_reserve` locks the attempt `FOR UPDATE`, sums prior refunds under the lock, rejects over-ceiling, idempotent; `refund_confirm` idempotent on already-`refunded`; non-captured / missing `gateway_reference` rejected; ops permission required (`atomic_refund.sql:61-141`). Illegal (double/over refund, refunding a fake attempt) rejected. ✅ *(Gap: does not reverse loyalty/cashback/referral — M5, integrity not state.)*

## 4. Dispatch offer — ⚠️ partially enforced
Legal: `offered → accepted | rejected | timeout | lost`. Terminal thereafter.
- **Enforced:** `respond_dispatch` gates on `status<>'offered'` (`operations_engine.sql:253`) → no re-accept; the order-claim is a single-winner conditional update → **multi-driver accept rejected** ✅.
- **NOT enforced:** no `timeout_at` check at accept-time → an expired-but-not-swept offer can still be accepted (H6); no caller-ownership check → any user can drive another driver's offer (IDOR, H6).
- **Fix:** add `timeout_at < now()` guard + ownership check.

## 5. Account / KYC status — ✅ enforced (writes)
Legal: `pending → under_review → approved | rejected`; `approved → suspended → (lift) approved`; `→ banned`. Writes are `is_ops_admin()`-only (`trust_kyc_onboarding.sql:282-284`) → **self-approval rejected** ✅. Gaps: no country scoping on the admin action (H5); storefront visibility not gated on `approved` (L2); ban doesn't force driver offline (L6).

## 6. Driver shift / presence — ⚠️ weakly bound
Legal: shift `scheduled → active → closed`; status `offline ↔ available ↔ busy ↔ on_break`. CHECK constraints bound the *values* (`operations_engine.sql:35,65`), but `start/end_shift`, `start/end_break`, and `set_driver_status` accept an arbitrary `p_driver_id` with no ownership check → any user can drive **another** driver's shift/presence (H2, L3). Values are constrained; **actor binding is not**.

## 7. Settlement — ✅ enforced
Legal: `pending → approved → paid` (and `rejected`). `pay_*_settlement` = `is_ops_admin()` + `FOR UPDATE` + `status='paid'` short-circuit (`finance_engine.sql:216-269`) → **double-pay rejected**, non-admin rejected. ✅

## 8. Coupon / referral / loyalty — ⚠️ split enforcement
- Coupon *redemption* (`redeem_coupon`) is race-safe (row lock + unique `(coupon,order)`) ✅, but redemption is **decoupled from the discount** applied in `create_order`, which ignores usage/eligibility limits (H1) — the *economic* state machine (used_count, per-customer) is not enforced on the pricing path.
- Referral: `pending → rewarded` is idempotent and self-referral-blocked ✅, but `rewarded` can be reached without a real qualifying order (H3).
- Loyalty balance has **no non-negative invariant** and no per-customer serialization (C3/M6) → points can go negative or be minted.

## Summary
| Workflow | DB-level enforcement | Verdict |
|---|---|---|
| Payment attempt | ✅ | Sound |
| Refund saga | ✅ | Sound |
| Settlement | ✅ | Sound |
| KYC/account (writes) | ✅ | Sound (scope gaps) |
| Dispatch offer | ⚠️ | Re-accept/multi-accept blocked; timeout+ownership gaps |
| Driver shift/presence | ⚠️ | Values bound; actor binding missing |
| Coupon/referral/loyalty | ⚠️ | Race-safe redemption; economic invariants not enforced |
| **Order lifecycle** | ❌ | **Transitions + money columns freely mutable via direct write — BLOCKER** |

**The one control that most improves integrity: a BEFORE-UPDATE trigger on `orders`** enforcing legal per-role transitions + money-column immutability. It converts §1 from ❌ to ✅ and neutralizes the top Critical.
