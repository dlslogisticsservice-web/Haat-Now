# HAAT NOW — Final Launch Blockers (Business-Logic Integrity)

Only findings that **must be fixed before launch** — every one is a confirmed,
authenticated-user-exploitable path to financial loss or integrity failure. Nice-to-haves,
hardening, and Low/Medium items are tracked separately in the penetration report and are
**not** listed here. Evidence + fixes in `BUSINESS_LOGIC_PENETRATION_REPORT.md`.

## 🔴 Must-fix before ANY launch (incl. Closed Beta)
Beta users are real accounts; each of these lets them steal money or corrupt state.

| # | Blocker | Impact | Fix | Time |
|---|---|---|---|---|
| B1 | **Direct `orders` write** — self-set `payment_status='paid'`, lower `total_amount`, forge `status` | Payment bypass; pay-what-you-want; false completion | Revoke blanket table UPDATE + BEFORE-UPDATE trigger (column immutability + legal transitions) | 1–2 d |
| B2 | **`complete_delivery_payout`** inflated driver payout (client fee, no owner check) | Direct theft from platform | `REVOKE EXECUTE`/DROP (superseded by `complete_delivery`) | 1 h |
| B3 | **Loyalty-points minting → wallet** (`award_points_for_event` p_ref=null, `award_loyalty_points`, `redeem_loyalty_points` negative) | Unlimited free money | Mandatory idempotency + positivity + `auth.uid()`; revoke direct EXECUTE | 1 d |
| B4 | **`redeem_advanced_coupon`** self wallet-credit | Free wallet money | `p_customer=auth.uid()`; server-derived amount; enforce guards | 0.5 d |
| B5 | **Coupon limits bypass** in `create_order` (max_uses/per-customer/one-time ignored) | Unlimited use of capped promos | Fold `redeem_coupon` into `create_order` (one transaction) | 0.5 d |
| B6 | **`driver_earnings` fabrication** (direct INSERT policy) | Inflated payable balance | Drop the INSERT policy; earnings only via `complete_delivery` | 1 h |
| B7 | **`set_driver_status`** forges any driver's GPS/presence | Dispatch theft / competitor sabotage | Ownership/admin guard + revoke anon/public | 1 h |
| B8 | **`respond_dispatch`** IDOR + accept-after-timeout | Offer manipulation, rivals' score tanking | Ownership guard + `timeout_at` check | 2 h |

## 🟠 Must-fix before Public Launch (acceptable to defer for a tiny trusted Closed Beta)
| # | Blocker | Why deferrable for beta | Fix | Time |
|---|---|---|---|---|
| B9 | **Referral farming / qualify without a real order** | Rewards can be capped/disabled during beta | Tie qualify to a verified delivered order; per-referrer caps | 1 d |
| B10 | **Coarse admin tier — no country scoping on actions** | Beta runs with one trusted super-admin | Country + `auth_has_permission` checks in privileged RPCs | 2–3 d |
| B11 | **Core-table tenant isolation not enforced** (cross-tenant catalog; `tenant_id` spoofable) | Single-brand beta | Complete staged tenant RLS on the 6 core tables | 2 d |
| B12 | **SVG → stored XSS** (`merchant-logos` allows `image/svg+xml`) | No untrusted merchant uploads in a curated beta | Remove SVG mime / sanitize + `Content-Disposition` | 1 h |
| B13 | **Refund reward clawback** (points/cashback/referral survive refund) | Low volume in beta | Reverse growth entries on `refund_confirm` | 0.5 d |

**All blockers close with one focused "Hardening Pass #2" migration + a coupon-flow change. Total ≈ 1–2 weeks. No feature work.**

---

## FINAL LAUNCH DECISION — business-logic integrity

# 🔴 NOT READY

**Rationale (evidence-based):** the payment, refund, settlement, dispatch-race, and
admin-escalation cores are genuinely well-built and **defended** — but **eight
authenticated-user-exploitable Critical/High vectors (B1–B8) allow direct financial theft
and state corruption today**: any logged-in customer can mark their own order paid or pay 1
unit for a full cart; any driver can inflate their payout or forge GPS; any user can mint
unlimited wallet money via loyalty points or self-credit coupons. These are not theoretical
— each is a single REST call, reproducible, with file:line root cause.

Because beta participants are **real authenticated accounts**, B1–B8 are **not acceptable
even for a Closed Beta**. This blocks launch on business-logic grounds independent of the
infrastructure audit.

**Path to READY WITH CONDITIONS (Closed Beta):** land Hardening Pass #2 closing **B1–B8**,
re-run this pentest to confirm, then a COD-only Closed Beta is defensible (with B9–B13
deferred under a trusted cohort). **Public Launch** additionally requires B9–B13 + the
infrastructure `PRODUCTION_LAUNCH_CHECKLIST.md` items (backups, monitoring, RLS-policy
tightening).

**Positive note for stakeholders:** the remediation is bounded and mechanical (revoke/guard
a known list of RPCs + one trigger + one coupon-flow change), the strong defenses already in
place are extensive, and there is **no customer→admin escalation and no wallet-primitive or
payment-webhook compromise**. This is a finishable gap, not a redesign.
